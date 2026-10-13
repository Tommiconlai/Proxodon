import { useEffect, useRef, useState } from 'react';
import { useDeck } from './useDeck';
import { FORMATS, boardCounts, countTarget, countOk, refreshSnapshots } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import DeckSections from './DeckSections';
import { IconArrowLeft } from '../components/icons';

// Editor del mazzo: barra in alto (nome, formato, stato sync, conteggio), corpo con le sezioni.
// Ricerca (task 10) e Print deck (task 11) si aggiungono qui.
export default function DeckEditor({ uid, id, notify }) {
  const { deck, update, saving, error } = useDeck(uid, id);
  const mobile = useIsMobile();
  const [online, setOnline] = useState(() => navigator.onLine);
  const refreshed = useRef(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!error) return;
    notify(error.code === 'resource-exhausted'
      ? 'Daily sync limit reached. Your changes stay on this device and sync after the reset.'
      : `Sync error: ${error.message}`, 'error');
  }, [error, notify]);

  // Eliminato da un altro dispositivo mentre era aperto.
  useEffect(() => {
    if (deck !== null) return;
    notify('This deck was deleted', 'error');
    navigate('/decks');
  }, [deck, notify]);

  // Riallinea una volta gli snapshot con Scryfall (ban, immagini). Scryfall giù = restano quelli salvati.
  useEffect(() => {
    if (!deck || refreshed.current) return;
    refreshed.current = true;
    const ids = deck.cards.map((r) => r.card.sid);
    if (ids.length) cardsByIds(ids).then((map) => update((d) => refreshSnapshots(d, map).deck)).catch(() => {});
  }, [deck, update]);

  if (!deck) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;

  const c = boardCounts(deck);
  const target = countTarget(deck.format);
  const sync = !online ? (saving ? 'Offline, saved on this device' : 'Offline') : saving ? 'Saving…' : 'Saved';
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <header className="deck-bar">
        <a className="deck-back" href="#/decks" aria-label="Back to decks"><IconArrowLeft size={18} /></a>
        <input className="deck-name" value={deck.name} maxLength={80} aria-label="Deck name" spellCheck={false}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          onBlur={() => update((d) => (d.name.trim() ? d : { ...d, name: 'Untitled deck' }))} />
        <select className="deck-format" value={deck.format} aria-label="Format" onChange={(e) => update((d) => ({ ...d, format: e.target.value }))}>
          {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <span className={`deck-sync${online ? '' : ' offline'}`} role="status">{sync}</span>
        <span className={`deck-count ${countOk(deck.format, c.main) ? 'ok' : 'warn'}`} title="Main deck">
          {c.main}{target ? `/${target}` : ''}
        </span>
      </header>
      <div className="deck-body">
        <section className="deck-main"><DeckSections deck={deck} update={update} touch={mobile} /></section>
      </div>
    </div>
  );
}
