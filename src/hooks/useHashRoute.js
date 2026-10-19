import { useSyncExternalStore } from 'react';
import { closingBack } from './useBackClose';

// Rotte hash (GitHub Pages: niente server per le rotte). Hash vuoto = stampa.
const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const read = () => window.location.hash.replace(/^#/, '') || '/print';

export function useHashRoute() {
  return useSyncExternalStore(subscribe, read, () => '/print');
}

// Con un overlay aperto (voce di useBackClose in cima, es. una voce di menu che apre Profile) la pagina nuova
// prende il posto della sua voce: sennò resterebbe orfana sotto, e Indietro andrebbe premuto due volte.
export const navigate = (path) => {
  if (window.history.state?.proxodonOverlay) replaceRoute(path, null);
  else window.location.hash = path;
};
// Come navigate ma al posto della voce attuale, che Indietro non ritrova (il mazzo aperto è stato cancellato).
// replaceState tiene idx (la posizione non cambia; state null = pagina nuova, idx + 1 dall'hashchange) e non manda
// hashchange: lo si manda a mano.
export function replaceRoute(path, state = window.history.state) {
  window.history.replaceState(state, '', `#${path}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

// Posizione della pagina in cronologia (history.state.idx, 0 = la prima aperta nella scheda): serve a goBack
// per sapere se la pagina prima è dell'app. Le voci degli overlay (useBackClose) copiano quella della pagina.
let idx = 0;
let leaving = false; // un goBack alla volta: un doppio click non torna indietro di due pagine (o fuori dall'app)
if (typeof window !== 'undefined') {
  idx = window.history.state?.idx ?? 0;
  window.history.replaceState({ ...window.history.state, idx }, '');
  window.addEventListener('hashchange', () => {
    const s = window.history.state;
    if (s?.idx == null) window.history.replaceState({ ...s, idx: ++idx }, ''); // pagina nuova
    else idx = s.idx; // avanti / indietro
  });
  window.addEventListener('popstate', () => { leaving = false; });
}

// Indietro dei dilemmi, delle richieste e del gioco: la pagina da cui si è arrivati (profilo, elenco, mazzo);
// aperta da un link esterno, fallback. Dopo il click, così un overlay appena chiuso (la conferma di Delete)
// toglie prima la sua voce: un back alla volta.
export function goBack(fallback) {
  if (leaving) return;
  leaving = true;
  const go = () => {
    if (closingBack()) window.addEventListener('popstate', () => setTimeout(go), { once: true });
    else if (idx > 0) window.history.back();
    else { leaving = false; navigate(fallback); }
  };
  setTimeout(go);
}
