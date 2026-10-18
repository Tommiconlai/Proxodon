import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDeck, saveDeck } from './deckStore';

// Mazzo aperto: stato locale + salvataggio dell'intero documento 800 ms dopo l'ultima modifica
// (e subito quando la scheda va in background o l'editor si chiude). Finché c'è una modifica
// locale in attesa, gli snapshot in arrivo non la sovrascrivono.
// synced = è arrivato almeno uno snapshot dal server (non solo dalla cache locale, che può essere vecchia):
// i salvataggi automatici (riallineamento con Scryfall all'apertura) aspettano lui.
// rev: ogni salvataggio scrive la revisione letta + 1 (saveDeck) e la copia locale avanza con lei, così il
// salvataggio dopo parte dalla revisione giusta; le regole rifiutano una revisione che non segue quella salvata.
// alive: chiuso l'editor, update non fa più niente (un Undo nel toast o una risposta di Scryfall in ritardo non
// riscrivono il mazzo da una copia ormai vecchia).
export function useDeck(uid, id) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = eliminato
  const [pending, setPending] = useState(false); // scritture non ancora confermate dal server
  const [dirty, setDirty] = useState(false); // modifiche in attesa del debounce
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState(null);
  const latest = useRef(undefined);
  const timer = useRef(null);
  const alive = useRef(true);

  const write = useCallback(() => {
    timer.current = null;
    setDirty(false);
    const d = latest.current;
    if (!d) return;
    latest.current = { ...d, rev: (d.rev || 0) + 1 };
    saveDeck(uid, d).catch(setError);
  }, [uid]);

  useEffect(() => listenDeck(uid, id, (d, hasPending, fromCache) => {
    setPending(hasPending);
    if (!fromCache) setSynced(true);
    if (!timer.current) { latest.current = d; setDeck(d); }
  }, setError), [uid, id]);

  useEffect(() => {
    alive.current = true;
    const flush = () => { if (timer.current) { clearTimeout(timer.current); write(); } };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); alive.current = false; };
  }, [write]);

  const update = useCallback((fn) => {
    const prev = latest.current;
    if (!prev || !alive.current) return;
    const next = fn(prev);
    if (next === prev) return;
    latest.current = next;
    setDeck(next);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(write, 800);
  }, [write]);

  return { deck, update, saving: dirty || pending, synced, error };
}
