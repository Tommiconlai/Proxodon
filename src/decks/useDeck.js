import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDeck, saveDeck } from './deckStore';
import { rid } from './deckModel';

// Mazzo aperto: stato locale + salvataggio dell'intero documento 800 ms dopo l'ultima modifica
// (e subito quando la scheda va in background o l'editor si chiude). Finché c'è una modifica
// locale in attesa, gli snapshot in arrivo non la sovrascrivono.
// synced = è arrivato almeno uno snapshot dal server (non solo dalla cache locale, che può essere vecchia):
// i salvataggi automatici (riallineamento con Scryfall all'apertura) aspettano lui.
// rev / ver: ogni salvataggio scrive la revisione letta + 1 e una ver nuova (saveDeck) e la copia locale avanza con
// loro, così il salvataggio dopo parte dalla versione giusta; le regole rifiutano una versione che non segue quella
// salvata. Rifiutata (permission-denied, non della copia pubblica): via le modifiche in attesa, si torna all'ultimo
// snapshot (il server lo rimanda comunque, ora che il timer è fermo).
// onError: errori di lettura e salvataggio, chiamato anche a editor chiuso (il salvataggio della chiusura).
// alive: chiuso l'editor, update non fa più niente (un Undo nel toast o una risposta di Scryfall in ritardo non
// riscrivono il mazzo da una copia ormai vecchia).
export function useDeck(uid, id, onError) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = eliminato
  const [pending, setPending] = useState(false); // scritture non ancora confermate dal server
  const [dirty, setDirty] = useState(false); // modifiche in attesa del debounce
  const [synced, setSynced] = useState(false);
  const latest = useRef(undefined);
  const snap = useRef(undefined); // ultimo snapshot arrivato, anche se tenuto da parte
  const timer = useRef(null);
  const alive = useRef(true);

  const write = useCallback(() => {
    timer.current = null;
    setDirty(false);
    const d = latest.current;
    if (!d) return;
    const ver = rid();
    latest.current = { ...d, rev: (d.rev || 0) + 1, ver };
    saveDeck(uid, d, ver).catch((e) => {
      if (e.code === 'permission-denied' && !e.publish) {
        clearTimeout(timer.current);
        timer.current = null;
        setDirty(false);
        latest.current = snap.current;
        setDeck(snap.current);
      }
      onError(e);
    });
  }, [uid, onError]);

  useEffect(() => listenDeck(uid, id, (d, hasPending, fromCache) => {
    snap.current = d;
    setPending(hasPending);
    if (!fromCache) setSynced(true);
    if (!timer.current) { latest.current = d; setDeck(d); }
  }, onError), [uid, id, onError]);

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

  return { deck, update, saving: dirty || pending, synced };
}
