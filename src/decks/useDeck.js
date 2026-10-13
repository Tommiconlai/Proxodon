import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDeck, saveDeck } from './deckStore';

// Mazzo aperto: stato locale + salvataggio dell'intero documento 800 ms dopo l'ultima modifica
// (e subito quando la scheda va in background o l'editor si chiude). Finché c'è una modifica
// locale in attesa, gli snapshot in arrivo non la sovrascrivono.
export function useDeck(uid, id) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = eliminato
  const [pending, setPending] = useState(false); // scritture non ancora confermate dal server
  const [dirty, setDirty] = useState(false); // modifiche in attesa del debounce
  const [error, setError] = useState(null);
  const latest = useRef(undefined);
  const timer = useRef(null);

  const write = useCallback(() => {
    timer.current = null;
    setDirty(false);
    if (latest.current) saveDeck(uid, latest.current).catch(setError);
  }, [uid]);

  useEffect(() => listenDeck(uid, id, (d, hasPending) => {
    setPending(hasPending);
    if (!timer.current) { latest.current = d; setDeck(d); }
  }, setError), [uid, id]);

  useEffect(() => {
    const flush = () => { if (timer.current) { clearTimeout(timer.current); write(); } };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [write]);

  const update = useCallback((fn) => {
    const prev = latest.current;
    if (!prev) return;
    const next = fn(prev);
    if (next === prev) return;
    latest.current = next;
    setDeck(next);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(write, 800);
  }, [write]);

  return { deck, update, saving: dirty || pending, error };
}
