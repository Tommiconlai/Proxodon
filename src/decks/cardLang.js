import { useEffect, useState } from 'react';
import { localizedCard } from '../utils/scryfall';
import { useSettings, getSettings } from '../utils/settings';

// Immagini delle carte nella lingua scelta (Settings → Card language): l'URL della stampa
// localizzata (stesso set e numero) se Scryfall ce l'ha, sennò l'immagine inglese dello snapshot.
// Cache su questo dispositivo ("" = non esiste in quella lingua), così la ricerca si fa una volta.
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
const keyOf = (card, lang) => (lang !== 'en' && card.set && card.cn ? `${card.set}/${card.cn}/${lang}` : null);
const normal = (c) => c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || '';

// Senza hook (anteprima al passaggio): quella già trovata, sennò l'inglese.
export const cachedImg = (card) => cache[keyOf(card, getSettings().cardLang)] || card.img;

export function useCardImg(card) {
  const { cardLang } = useSettings();
  const k = keyOf(card, cardLang);
  const [, found] = useState(0);
  const known = k ? cache[k] : undefined;
  useEffect(() => {
    if (!k || known !== undefined) return undefined;
    let alive = true;
    localizedCard(card.set, card.cn, cardLang).then((c) => {
      remember(k, normal(c));
      if (alive) found((n) => n + 1);
    });
    return () => { alive = false; };
  }, [k, known, card.set, card.cn, cardLang]);
  return known || card.img;
}
