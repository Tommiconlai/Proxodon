import { useSyncExternalStore } from 'react';

// Rotte hash (GitHub Pages: niente server per le rotte). Hash vuoto = stampa.
const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const read = () => window.location.hash.replace(/^#/, '') || '/print';

export function useHashRoute() {
  return useSyncExternalStore(subscribe, read, () => '/print');
}

export const navigate = (path) => { window.location.hash = path; };
