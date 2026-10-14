import { useEffect, useRef, useState } from 'react';
import { useDeck } from './useDeck';
import { FORMATS, boardCounts, countTarget, countOk, refreshSnapshots, addCard, toPrintEntries, coverRow } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import DeckSections from './DeckSections';
import CardSearch from './CardSearch';
import { MobilePage } from '../components/MobileLayout';
import { PrintDeckDialog, CoverDialog } from './dialogs';
import { IconArrowLeft, IconPlus, IconPrinter, IconImage } from '../components/icons';

// Editor del mazzo: testata con la copertina (arte della carta scelta, a sinistra, che verso destra
// si sfoca e svanisce; click = scegli un'altra carta del mazzo) e sopra, a sinistra, nome, formato,
// stato sync, conteggio e Print deck. Sotto il corpo con le sezioni; ricerca a sinistra (foglio a
// tutto schermo su telefono).
export default function DeckEditor({ uid, id, notify, printQueueCount, onPrintDeck }) {
  const { deck, update, saving, error } = useDeck(uid, id);
  const mobile = useIsMobile();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [searchOpen, setSearchOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
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

  const add = (card, opts) => update((d) => {
    const r = addCard(d, card, opts);
    if (!r.added) notify('This deck already has 500 rows', 'error');
    return r.deck;
  });

  if (!deck) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;

  const c = boardCounts(deck);
  // Nessuna domanda se la coda è vuota e non c'è sideboard.
  const startPrint = () => {
    if (!printQueueCount && !c.side) onPrintDeck(toPrintEntries(deck));
    else setPrintOpen(true);
  };
  const target = countTarget(deck.format);
  const cover = coverRow(deck);
  const sync = !online ? (saving ? 'Offline, saved on this device' : 'Offline') : saving ? 'Saving…' : 'Saved';
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <header className="deck-hero">
        <button type="button" className="deck-hero-art" onClick={() => setCoverOpen(true)} disabled={!cover}
          aria-label={cover ? `Deck cover: ${cover.card.name}. Change it` : 'Deck cover: add cards first'}>
          {cover?.card.art && (
            <>
              <span className="deck-hero-blur" aria-hidden="true"><span style={{ backgroundImage: `url("${cover.card.art}")` }} /></span>
              <span className="deck-hero-img" style={{ backgroundImage: `url("${cover.card.art}")` }} aria-hidden="true" />
            </>
          )}
          {cover && <span className="deck-hero-change" aria-hidden="true"><IconImage size={13} /> Change cover</span>}
        </button>
        <div className="deck-hero-content">
          <div className="deck-hero-title">
            <a className="deck-back" href="#/decks" aria-label="Back to decks"><IconArrowLeft size={18} /></a>
            <input className="deck-name" value={deck.name} maxLength={80} aria-label="Deck name" spellCheck={false}
              onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
              onBlur={() => update((d) => (d.name.trim() ? d : { ...d, name: 'Untitled deck' }))} />
          </div>
          <div className="deck-hero-meta">
            <select className="deck-format" value={deck.format} aria-label="Format" onChange={(e) => update((d) => ({ ...d, format: e.target.value }))}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <span className={`deck-sync${online ? '' : ' offline'}`} role="status">{sync}</span>
            <span className={`deck-count ${countOk(deck.format, c.main) ? 'ok' : 'warn'}`} title="Main deck">
              {c.main}{target ? `/${target}` : ''}
            </span>
            <button type="button" className="btn-secondary deck-print" onClick={startPrint} disabled={!c.main}><IconPrinter size={15} /> Print deck</button>
          </div>
        </div>
      </header>
      {coverOpen && (
        <CoverDialog deck={deck} onClose={() => setCoverOpen(false)}
          onPick={(oid) => { update((d) => ({ ...d, cover: oid })); setCoverOpen(false); }} />
      )}
      <div className="deck-body">
        {!mobile && <aside className="deck-search"><CardSearch format={deck.format} onAdd={add} /></aside>}
        <section className="deck-main"><DeckSections deck={deck} update={update} touch={mobile} /></section>
      </div>
      {mobile && <button type="button" className="fab deck-fab" onClick={() => setSearchOpen(true)} aria-label="Add cards"><IconPlus size={26} /></button>}
      {mobile && searchOpen && (
        <MobilePage title="Add cards" onClose={() => setSearchOpen(false)}>
          <CardSearch format={deck.format} onAdd={add} autoFocus />
        </MobilePage>
      )}
      {printOpen && (
        <PrintDeckDialog queueCount={printQueueCount} sideCount={c.side} onClose={() => setPrintOpen(false)}
          onConfirm={(side) => { setPrintOpen(false); onPrintDeck(toPrintEntries(deck, { includeSide: side })); }} />
      )}
    </div>
  );
}
