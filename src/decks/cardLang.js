import { useEffect, useState } from 'react';
import { localizedCard } from '../utils/scryfall';
import { useSettings, getSettings } from '../utils/settings';

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
const remember = (k, url) => {
  cache[k] = url;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage pieno o bloccato */ }
};
const keyOf = (card, lang, side) => (lang !== 'en' && card.set && card.cn ? `${card.set}/${card.cn}/${lang}${side ? '/b' : ''}` : null);
const normal = (c) => c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || '';
const backOf = (c) => (!c?.image_uris && c?.card_faces?.[1]?.image_uris?.normal) || '';
const english = (card, side) => (side ? card.back : card.img);

// Senza hook (anteprima al passaggio): quella già trovata, sennò l'inglese.
export const cachedImg = (card, side = 0) => cache[keyOf(card, getSettings().cardLang, side)] || english(card, side);

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
      remember(front, normal(c));
      if (back) remember(back, backOf(c));
      if (alive) found((n) => n + 1);
    });
    return () => { alive = false; };
  }, [k, known, front, back, card.set, card.cn, cardLang]);
  return known || english(card, side);
}
