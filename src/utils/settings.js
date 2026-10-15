import { useSyncExternalStore } from 'react';

// Impostazioni dell'utente (pagina Settings), salvate su questo dispositivo in localStorage.
// ponytail: non si sincronizzano tra dispositivi; per farlo serve un campo nel profilo Firestore
// (users/{uid}) e una regola che lo accetti.
export const DEFAULTS = {
  deckFormat: 'commander', // nuovo mazzo e import
  deckGroupBy: 'type', // nuovo mazzo e import
  deckView: 'stacks', // vista di tutti i mazzi (anche dal menu View by)
  deckSort: 'name', // ordine di tutti i mazzi (anche dal menu Sort by)
  printSide: false, // Print deck: sideboard inclusa di default
  printAdd: false, // Print deck: aggiunge alla coda invece di sostituirla
  cardLang: 'en', // lingua delle immagini delle carte (se Scryfall ha la stampa)
  importFallback: true, // stampa (set, numero) non trovata: usa quella di default
  importMerge: true, // stessa stampa su più righe: una riga sola
  preview: 'medium', // anteprima al passaggio: off | small | medium | large
  reduceMotion: false,
  density: 'comfortable', // vista lista: comfortable | compact
  currency: 'eur', // eur (Cardmarket) | usd (TCGplayer) | off
};

const KEY = 'ip:settings';
const read = () => {
  try {
    // Vista e ordine stavano in chiavi proprie: diventano il valore iniziale.
    const legacy = Object.fromEntries([['deckView', 'ip:deckView'], ['deckSort', 'ip:deckSort']]
      .map(([k, ls]) => [k, localStorage.getItem(ls)]).filter(([, v]) => v));
    return { ...DEFAULTS, ...legacy, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS }; // storage bloccato o rovinato
  }
};

let current = read();
const subs = new Set();
const apply = () => document.documentElement.classList.toggle('reduce-motion', !!current.reduceMotion);
apply();

export const getSettings = () => current;

export function setSetting(key, value) {
  current = { ...current, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage bloccato: vale per la sessione */ }
  apply();
  subs.forEach((f) => f());
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
