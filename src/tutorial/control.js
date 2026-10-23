import { useSyncExternalStore } from 'react';

// Tutorial guidato acceso o spento: la rotta della pagina da cui è partito (dal ? della stampa, dei mazzi o di Tokens), o null.
// App lo monta sopra la pagina e lo chiude se la rotta cambia.
let route = null;
const subs = new Set();
const set = (v) => { route = v; subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

export const startTutorial = () => set(window.location.hash.replace(/^#/, '') || '/print');
export const stopTutorial = () => set(null);
export const useTutorial = () => useSyncExternalStore(subscribe, () => route, () => null);

// Rettangoli che si toccano (selezione ad area dei tutorial): a = { left, top, right, bottom }, el = elemento.
export const touches = (a, el) => {
  const b = el.getBoundingClientRect();
  return b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top;
};

// Il cursore indica, uno alla volta, i pulsanti della lista [[selettore, etichetta]], senza premerli.
export async function pointAt(g, list) {
  for (const [sel, text] of list) {
    await g.move(sel);
    g.say(text);
    await g.wait(1000);
  }
}
