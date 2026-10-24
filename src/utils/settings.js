import { useSyncExternalStore } from 'react';

// Impostazioni dell'utente (pagina Settings). Una copia sta su questo dispositivo in localStorage (vale anche senza
// account); con un account si salvano anche lì (decks/settingsSync, users/{uid}/settings/prefs) e seguono l'utente
// su ogni dispositivo.
export const DEFAULTS = {
  deckFormat: 'commander', // nuovo mazzo e import
  deckGroupBy: 'type', // nuovo mazzo e import
  deckPublic: false, // nuovo mazzo: condiviso subito in Community
  deckView: 'stacks', // vista di default dei mazzi
  deckSort: 'name', // ordine di default dei mazzi
  deckViews: {}, // id del mazzo → { view?, sort? } scelti dentro quel mazzo, solo se diversi dal default
  brackets: true, // Commander bracket nei mazzi, in Community e nei profili
  printSide: false, // Print deck: sideboard inclusa di default
  printAdd: false, // Print deck: aggiunge alla coda invece di sostituirla
  cardLang: 'en', // lingua delle immagini delle carte (se Scryfall ha la stampa)
  printRule: 'default', // stampa delle carte aggiunte dalla ricerca: default (di Scryfall) | newest | oldest | cheapest
  prefSets: [], // set preferiti in ordine ({ code, name }), prima della regola
  favPrints: {}, // oracle id → { sid, name, set, cn } stampa scelta per quella carta, prima dei set
  importFallback: true, // stampa (set, numero) non trovata: usa quella di default
  importMerge: true, // stessa stampa su più righe: una riga sola
  preview: 'medium', // anteprima al passaggio: off | small | medium | large
  reduceMotion: false,
  density: 'comfortable', // vista lista: comfortable | compact
  currency: 'eur', // eur (Cardmarket) | usd (TCGplayer) | off
};
export const MAX_DECK_VIEWS = 300; // mazzi con vista propria: oltre, escono i più vecchi
export const MAX_FAV_PRINTS = 1000;
export const MAX_PREF_SETS = 30;

// localStorage che non lancia (storage bloccato, navigazione privata, pieno): null in lettura, niente in scrittura.
export const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* vale per la sessione */ } };

// Solo le chiavi note, col tipo del default: un valore rovinato o scritto da un'altra versione non passa.
const kind = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
export const cleanSettings = (raw) => Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? raw : {})
  .filter(([k, v]) => Object.hasOwn(DEFAULTS, k) && kind(v) === kind(DEFAULTS[k])));

const KEY = 'ip:settings';
const read = () => {
  try {
    // Vista e ordine stavano in chiavi proprie: diventano il valore iniziale.
    const legacy = Object.fromEntries([['deckView', 'ip:deckView'], ['deckSort', 'ip:deckSort']]
      .map(([k, ls]) => [k, localStorage.getItem(ls)]).filter(([, v]) => v));
    return { ...DEFAULTS, ...legacy, ...cleanSettings(JSON.parse(localStorage.getItem(KEY) || '{}')) };
  } catch {
    return { ...DEFAULTS }; // storage bloccato o rovinato
  }
};

let current = read();
const subs = new Set();
const localSubs = new Set(); // solo i cambi fatti qui (setSetting), non quelli arrivati dall'account
const apply = () => document.documentElement.classList.toggle('reduce-motion', !!current.reduceMotion);
apply();
const commit = () => {
  lsSet(KEY, JSON.stringify(current));
  apply();
  subs.forEach((f) => f());
};

export const getSettings = () => current;

export function setSetting(key, value) {
  current = { ...current, [key]: value };
  commit();
  localSubs.forEach((f) => f());
}

// Impostazioni arrivate dall'account (settingsSync): prendono il posto di quelle del dispositivo, senza tornare su.
export function applySettings(raw) {
  current = { ...current, ...cleanSettings(raw) };
  commit();
}
export const onLocalChange = (f) => { localSubs.add(f); return () => localSubs.delete(f); };

// Vista o ordine scelti dentro un mazzo: restano solo se diversi dal default (uguali = il mazzo segue il default).
// Il mazzo appena toccato va in fondo, così oltre MAX_DECK_VIEWS escono i più vecchi.
export function setDeckView(id, patch) {
  const next = { ...current.deckViews[id], ...patch };
  if (next.view === current.deckView) delete next.view;
  if (next.sort === current.deckSort) delete next.sort;
  const rest = Object.entries(current.deckViews).filter(([k]) => k !== id);
  if (Object.keys(next).length) rest.push([id, next]);
  setSetting('deckViews', Object.fromEntries(rest.slice(-MAX_DECK_VIEWS)));
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
