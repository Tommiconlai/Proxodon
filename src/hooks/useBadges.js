import { useSyncExternalStore } from 'react';

// Notifiche delle schede Dilemmas e Help: { dilemmas, help } = quante cose dei giocatori seguiti aspettano una
// risposta. Le scrive l'area mazzi (Badges in DecksView, dove c'è Firebase), le leggono le schede da desktop e il
// menu della X (che sta fuori dal chunk dei mazzi). Fuori dall'area mazzi è vuoto: niente numeri.
let state = {};
const subs = new Set();
const subscribe = (cb) => { subs.add(cb); return () => subs.delete(cb); };
export function setBadges(next) {
  if (next.dilemmas === state.dilemmas && next.help === state.help) return; // stessi numeri: nessun ridisegno
  state = next;
  subs.forEach((cb) => cb());
}
export const useBadges = () => useSyncExternalStore(subscribe, () => state, () => state);
// Sopra 9 il numero diventa 9+ (il tondo resta piccolo).
export const badgeText = (n) => (n > 9 ? '9+' : String(n));
