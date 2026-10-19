import { useEffect, useRef } from 'react';

// Back del sistema (Android, swipe-back di iOS, tasto Indietro del browser) = chiude l'overlay aperto in
// cima, invece di lasciare la schermata. Ogni overlay attivo aggiunge una voce in cronologia con lo stesso
// URL (pushState, niente hashchange); il back la toglie e chiude solo l'ultimo aperto. Chiuso
// dall'interfaccia (✕, Esc, scelta nel menu) la sua voce si toglie con history.back(), se è ancora quella
// corrente (se nel frattempo si è navigati altrove, la voce resta: un passo indietro in più, innocuo).
// La push aspetta un tick: lo StrictMode di sviluppo monta, smonta e rimonta l'effect subito, così la
// prima voce non nasce nemmeno.
const stack = [];
let skip = 0; // popstate provocati dalle nostre history.go, da ignorare
let seq = 0;
let pending = 0; // voci di overlay chiusi nello stesso momento: tolte insieme con un solo history.go
export const closingBack = () => skip > 0 || pending > 0; // un overlay appena chiuso sta ancora togliendo la sua voce
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skip) { skip -= 1; return; }
    stack[stack.length - 1]?.close();
  });
}

export function useBackClose(active, onClose) {
  const cb = useRef(onClose);
  useEffect(() => { cb.current = onClose; });
  useEffect(() => {
    if (!active) return undefined;
    const entry = { id: ++seq, close: () => cb.current?.() };
    let pushed = false;
    const t = setTimeout(() => {
      window.history.pushState({ ...window.history.state, proxodonOverlay: entry.id }, '');
      pushed = true;
      stack.push(entry);
    }, 0);
    return () => {
      clearTimeout(t);
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      // La sua voce è ancora sopra la pagina: in cima, o sotto quella di un overlay aperto dopo e chiuso insieme
      // (id più alto). Due history.back() di fila ne farebbero uno solo: una voce orfana, Indietro da premere due volte.
      if (pushed && (window.history.state?.proxodonOverlay ?? 0) >= entry.id) {
        if (!pending) setTimeout(() => { skip += 1; window.history.go(-pending); pending = 0; });
        pending += 1;
      }
    };
  }, [active]);
}
