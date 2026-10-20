import { useEffect, useState } from 'react';
import { localizedCard } from '../utils/scryfall';
import { useSettings, getSettings } from '../utils/settings';
import { scryfallImg } from './deckModel';

// Immagini delle carte nella lingua scelta (Settings → Card language): l'URL della stampa
// localizzata (stesso set e numero) se Scryfall ce l'ha, sennò l'immagine inglese dello snapshot.
// Cache su questo dispositivo ("" = non esiste in quella lingua), così la ricerca si fa una volta.
// side 1 = retro delle carte a due facce (chiave con /b, fallback card.back).
const KEY = 'ip:locimg:v2'; // v2: senza i segnaposto "Not Available" (stampe senza scansione)
let cache = {};
try {
  localStorage.removeItem('ip:locimg');
  cache = JSON.parse(localStorage.getItem(KEY) || '{}');
} catch { /* storage bloccato */ }
// Al massimo MAX voci (escono le più vecchie: l'ordine degli oggetti è quello d'inserimento) e una scrittura ogni mezzo
// secondo: un mazzo con centinaia di stampe strane non riempie lo storage né rifà il JSON a ogni carta.
const MAX = 3000;
let saving = 0;
const remember = (k, url) => {
  delete cache[k];
  cache[k] = url;
  const keys = Object.keys(cache);
  for (let i = 0; i < keys.length - MAX; i++) delete cache[keys[i]];
  clearTimeout(saving);
  saving = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage pieno o bloccato */ }
  }, 500);
};
const keyOf = (card, lang, side) => (lang !== 'en' && card.set && card.cn ? `${card.set}/${card.cn}/${lang}${side ? '/b' : ''}` : null);
const normal = (c) => c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || '';
const backOf = (c) => (!c?.image_uris && c?.card_faces?.[1]?.image_uris?.normal) || '';
// Solo immagini Scryfall anche qui: le usano anteprime e carta a tutto schermo, pure per mazzi di altri.
const english = (card, side) => scryfallImg(side ? card.back : card.img);

// Senza hook (anteprima al passaggio): quella già trovata, sennò l'inglese.
// Anche la cache passa da scryfallImg: lo storage lo può scrivere qualunque pagina della stessa origine.
export const cachedImg = (card, side = 0) => scryfallImg(cache[keyOf(card, getSettings().cardLang, side)]) || english(card, side);

export function useCardImg(card, side = 0) {
  const { cardLang } = useSettings();
  const front = keyOf(card, cardLang, 0);
  const back = card.back ? keyOf(card, cardLang, 1) : null;
  const k = side ? back : front;
  const [, found] = useState(0);
  const known = k ? cache[k] : undefined;
  // Una ricerca porta entrambe le facce.
  useEffect(() => {
    if (!k || known !== undefined) return undefined;
    let alive = true;
    localizedCard(card.set, card.cn, cardLang).then((c) => {
      if (c === undefined) return; // errore momentaneo: niente cache, resta l'inglese
      remember(front, normal(c));
      if (back) remember(back, backOf(c));
      if (alive) found((n) => n + 1);
    });
    return () => { alive = false; };
  }, [k, known, front, back, card.set, card.cn, cardLang]);
  return scryfallImg(known) || english(card, side);
}
