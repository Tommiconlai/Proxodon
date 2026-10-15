import { useEffect, useRef, useState } from 'react';
import { useDeck } from './useDeck';
import { FORMATS, boardCounts, refreshSnapshots, addCard, toPrintEntries, coverRow } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import DeckSections from './DeckSections';
import CardSearch from './CardSearch';
import AdvancedSearch from './AdvancedSearch';
import { MobilePage } from '../components/MobileLayout';
import { PrintDeckDialog, CoverDialog, ExportDeckDialog } from './dialogs';
import { IconPlus, IconPrinter, IconX, IconExport } from '../components/icons';

const STUCK_AT = 72; // px: padding della barra + casella di ricerca, circa
// "Saved 10 minutes ago": tempo dall'ultima scrittura (updatedAt del documento).
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
const ago = (ms) => {
  const sec = (Date.now() - ms) / 1000;
  const u = UNITS.find(([, n]) => sec >= n);
  return u ? rtf.format(-Math.floor(sec / u[1]), u[0]) : 'just now';
};

// Editor del mazzo: testata con la copertina (arte della carta scelta, a sinistra, che verso destra
// si sfoca e svanisce; click = scegli un'altra carta del mazzo, lo dice il cursore a mano) e sopra,
// a sinistra, in basso formato, stato sync, conteggio, Print deck ed Export (si torna alla lista con la tab
// Decks). Sotto il corpo con le sezioni. Tutto scorre insieme (deck-scroll) tranne la fascia con il
// nome del mazzo e la ricerca (desktop), che resta in alto: sopra la testata è trasparente, quando
// la testata è uscita prende lo sfondo. Telefono: il nome sta nella testata e scorre con lei, + apre
// la ricerca a tutto schermo.
export default function DeckEditor({ uid, id, notify, printQueueCount, onPrintDeck }) {
  const { deck, update, saving, error } = useDeck(uid, id);
  const mobile = useIsMobile();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [searchOpen, setSearchOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false); // pannello della ricerca avanzata (desktop)
  const [stuck, setStuck] = useState(false); // la testata è uscita: la fascia ricerca ha lo sfondo
  const heroRef = useRef(null);
  const refreshed = useRef(false);
  // Barra quando della testata resta meno della riga nome + ricerca. Soglia fissa: la barra da
  // .stuck è più bassa (niente Advanced search), misurarla farebbe oscillare lo stato.
  const onScroll = (e) => setStuck(e.currentTarget.scrollTop > (heroRef.current?.offsetHeight || 0) - STUCK_AT);

  // Ridisegno ogni 30 s: il "minutes ago" va avanti da solo.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

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
  const cover = coverRow(deck);
  const savedAt = deck.updatedAt?.toMillis?.();
  const sync = !online ? (saving ? 'Offline, saved on this device' : 'Offline') : saving ? 'Saving…' : savedAt ? `Saved ${ago(savedAt)}` : 'Saved';
  const name = (
    <input className="deck-name" value={deck.name} maxLength={80} aria-label="Deck name" spellCheck={false}
      onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
      onBlur={() => update((d) => (d.name.trim() ? d : { ...d, name: 'Untitled deck' }))} />
  );
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll" onScroll={mobile ? undefined : onScroll}>
      {!mobile && (
        <div className="deck-sticky">
          <div className={`deck-sticky-bar${stuck ? ' stuck' : ''}`}>
            {name}
            <div className="deck-hero-search">
              <CardSearch format={deck.format} onAdd={add} notify={notify} advanced={advOpen} onAdvanced={setAdvOpen} />
            </div>
          </div>
        </div>
      )}
      <header className="deck-hero" ref={heroRef}>
        <button type="button" className="deck-hero-art" onClick={() => setCoverOpen(true)} disabled={!cover}
          aria-label={cover ? `Deck cover: ${cover.card.name}. Change it` : 'Deck cover: add cards first'}>
          {cover?.card.art && (
            <>
              <span className="deck-hero-blur" aria-hidden="true"><span style={{ backgroundImage: `url("${cover.card.art}")` }} /></span>
              <span className="deck-hero-img" style={{ backgroundImage: `url("${cover.card.art}")` }} aria-hidden="true" />
            </>
          )}
        </button>
        <div className="deck-hero-content">
          {mobile && <div className="deck-hero-title">{name}</div>}
          <div className="deck-hero-meta">
            <select className="deck-format" value={deck.format} aria-label="Format" onChange={(e) => update((d) => ({ ...d, format: e.target.value }))}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button type="button" className="btn-secondary deck-print" onClick={startPrint} disabled={!c.main}><IconPrinter size={15} /> Print deck</button>
            <button type="button" className="btn-secondary deck-print" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}><IconExport size={15} /> Export</button>
            <span className={`deck-sync${online ? '' : ' offline'}`} role="status">{sync}</span>
          </div>
        </div>
      </header>
      <div className="deck-body">
        <section className="deck-main">
          {!mobile && advOpen && (
            <section className="deck-adv-panel" aria-label="Advanced search">
              <div className="deck-adv-head">
                <h2 className="decks-title">Advanced search</h2>
                <button type="button" className="modal-close" onClick={() => setAdvOpen(false)} aria-label="Close advanced search"><IconX size={18} /></button>
              </div>
              <AdvancedSearch format={deck.format} onAdd={add} notify={notify} />
            </section>
          )}
          <DeckSections deck={deck} update={update} touch={mobile} />
        </section>
      </div>
      </div>
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
      {coverOpen && (
        <CoverDialog deck={deck} onClose={() => setCoverOpen(false)}
          onPick={(oid) => { update((d) => ({ ...d, cover: oid })); setCoverOpen(false); }} />
      )}
      {mobile && <button type="button" className="fab deck-fab" onClick={() => setSearchOpen(true)} aria-label="Add cards"><IconPlus size={26} /></button>}
      {mobile && searchOpen && (
        <MobilePage title="Add cards" onClose={() => setSearchOpen(false)}>
          <CardSearch format={deck.format} onAdd={add} notify={notify} autoFocus />
        </MobilePage>
      )}
      {printOpen && (
        <PrintDeckDialog queueCount={printQueueCount} sideCount={c.side} onClose={() => setPrintOpen(false)}
          onConfirm={(side) => { setPrintOpen(false); onPrintDeck(toPrintEntries(deck, { includeSide: side })); }} />
      )}
    </div>
  );
}
