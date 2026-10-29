import { useCallback, useEffect, useRef, useState } from 'react';
import { deckFromServer, listenDeck, saveDeck } from './deckStore';
import { rid, refreshSnapshots } from './deckModel';
import { cardsByIds } from './scryfallSearch';

// Mazzo aperto: stato locale + salvataggio dell'intero documento 800 ms dopo l'ultima modifica
// (e subito quando la scheda va in background o l'editor si chiude). Finché c'è una modifica
// locale in attesa, gli snapshot in arrivo non la sovrascrivono.
// synced = è arrivato almeno uno snapshot dal server (non solo dalla cache locale, che può essere vecchia):
// i salvataggi automatici (riallineamento con Scryfall all'apertura) aspettano lui.
// rev / ver: ogni salvataggio scrive la revisione letta + 1 e una ver nuova (saveDeck) e la copia locale avanza con
// loro, così il salvataggio dopo parte dalla versione giusta; le regole rifiutano una versione che non segue quella
// salvata. Rifiutato (permission-denied, non della copia pubblica): si rilegge il mazzo dal server. Se è cambiato
// rispetto alla versione da cui partiva il salvataggio (base, che avanza con i salvataggi confermati) è un conflitto:
// via le modifiche in attesa, si torna alla versione del server. Se no il rifiuto era altro (App Check, regole) e le
// modifiche restano (unsaved), ripartendo dalla versione del server: il toast offre Retry, e si riprova comunque
// alla modifica dopo, in background o alla chiusura. Rilettura fallita (offline, App Check) = modifiche tenute.
// onError: errori di lettura e salvataggio, chiamato anche a editor chiuso (il salvataggio della chiusura).
// alive: chiuso l'editor, update non fa più niente (un Undo nel toast o una risposta di Scryfall in ritardo non
// riscrivono il mazzo da una copia ormai vecchia).
// Testo del toast per un errore di useDeck; changed = salvataggio rifiutato perché il mazzo è cambiato altrove.
export const syncText = (e, changed) => (e.code === 'resource-exhausted'
  ? 'Daily sync limit reached. Your changes stay on this device and sync after the reset.'
  // Salvataggio rifiutato ma il mazzo sul server è quello di partenza (kept): le modifiche restano, Retry (solo a
  // editor aperto) riprova subito.
  : e.kept ? (e.retry ? 'Your last change was not saved. It is still here: retry now, or it is tried again with your next change.' : 'Your last change to this deck could not be saved.')
  : e.code === 'permission-denied' && !e.publish ? changed
    : e.publish ? `Community copy not updated: ${e.message}` : `Sync error: ${e.message}`);

export function useDeck(uid, id, onError) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = eliminato, false = non caricato (errore)
  const [pending, setPending] = useState(false); // scritture non ancora confermate dal server
  const [dirty, setDirty] = useState(false); // modifiche in attesa del debounce
  const [unsaved, setUnsaved] = useState(false); // modifiche tenute dopo un rifiuto che non era un conflitto
  const [synced, setSynced] = useState(false);
  const latest = useRef(undefined);
  const base = useRef(null); // { rev, ver } del server da cui partono le modifiche locali
  const held = useRef(false); // modifiche tenute: gli snapshot non le sovrascrivono
  const seq = useRef(0); // ultimo salvataggio partito: decide solo lui
  const timer = useRef(null);
  const alive = useRef(true);

  const write = useCallback(function save() { // nome: Retry la richiama
    timer.current = null;
    held.current = false;
    setDirty(false);
    setUnsaved(false);
    const d = latest.current;
    if (!d) return;
    const ver = rid();
    // Oggetto condiviso dai salvataggi in coda: confermato uno, quello dopo parte dalla sua versione.
    const b = base.current ?? (base.current = { rev: d.rev, ver: d.ver });
    const mine = ++seq.current;
    const saved = () => { b.rev = (d.rev || 0) + 1; b.ver = ver; };
    latest.current = { ...d, rev: (d.rev || 0) + 1, ver };
    saveDeck(uid, d, ver).then(saved, async (e) => {
      if (e.publish) saved(); // il mazzo è salvato, solo la copia pubblica no
      if (e.code !== 'permission-denied' || e.publish) { onError(e); return; }
      if (mine !== seq.current) return; // un salvataggio dopo questo (rifiutato anche lui, base sbagliata) decide
      // Intanto le modifiche restano, rimesse sulla versione del server (questo salvataggio non c'è): quelle fatte
      // dopo, o il mazzo salvato se lo snapshot del rifiuto l'ha già sostituito con quello del server.
      held.current = true;
      const now = latest.current;
      latest.current = { ...(now && (now.ver !== b.ver || timer.current) ? now : d), rev: b.rev, ver: b.ver };
      setDeck(latest.current);
      const s = await deckFromServer(uid, d.id).catch(() => undefined); // undefined = non si sa
      if (mine !== seq.current) return; // modificato durante la rilettura: decide il salvataggio nuovo
      if (s !== undefined && (!s || (s.rev || 0) !== (b.rev || 0) || (s.ver ?? null) !== (b.ver ?? null))) {
        held.current = false;
        clearTimeout(timer.current);
        timer.current = null;
        setDirty(false);
        latest.current = s;
        base.current = s && { rev: s.rev, ver: s.ver };
        setDeck(s);
        onError(e);
        return;
      }
      setUnsaved(true);
      e.kept = true;
      if (alive.current) e.retry = () => { if (alive.current) { clearTimeout(timer.current); save(); } };
      onError(e);
    });
  }, [uid, onError]);

  useEffect(() => listenDeck(uid, id, (d, hasPending, fromCache) => {
    setPending(hasPending);
    if (!fromCache) setSynced(true);
    if (!timer.current && !held.current) {
      latest.current = d;
      setDeck(d);
      if (!hasPending) base.current = d && { rev: d.rev, ver: d.ver };
    }
  }, (e) => { setDeck((d) => (d === undefined ? false : d)); onError(e); }), [uid, id, onError]);

  useEffect(() => {
    alive.current = true;
    const flush = () => { if (timer.current || held.current) { clearTimeout(timer.current); write(); } };
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

  return { deck, update, saving: dirty || pending, unsaved, synced };
}

// Riallinea una volta gli snapshot con Scryfall (ban, immagini). Scryfall giù = restano quelli salvati. Solo da una
// versione confermata dal server (synced): da una cache vecchia salverebbe la copia vecchia.
export function useScryfallRefresh(deck, synced, update) {
  const refreshed = useRef(false);
  useEffect(() => {
    if (!deck || !synced || refreshed.current) return;
    refreshed.current = true;
    const ids = deck.cards.map((r) => r.card.sid);
    if (ids.length) cardsByIds(ids).then((map) => update((d) => refreshSnapshots(d, map).deck)).catch(() => {});
  }, [deck, synced, update]);
}
