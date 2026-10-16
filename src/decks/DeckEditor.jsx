import { useEffect, useRef, useState } from 'react';
import { useDeck } from './useDeck';
import { unpublishDeck, changedMs } from './deckStore';
import { FORMATS, boardCounts, refreshSnapshots, addCard, toPrintEntries, coverRow, priceLabel } from './deckModel';
import { useSettings } from '../utils/settings';
import { cardsByIds } from './scryfallSearch';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import DeckSections from './DeckSections';
import { DeckTabs, DeckCount, DeckBottomBar } from './DeckTabs';
import { DeckDilemmas } from './Dilemmas';
import CardSearch from './CardSearch';
import AdvancedSearch from './AdvancedSearch';
import { MobilePage } from '../components/MobileLayout';
import { PrintDeckDialog, CoverDialog, ExportDeckDialog } from './dialogs';
import { IconPrinter, IconX, IconExport, IconGlobe } from '../components/icons';
import { timeAgo } from '../utils/timeAgo';

const STUCK_AT = 72; // px: padding della barra + casella di ricerca, circa

// Editor del mazzo: testata con la copertina (arte della carta scelta, a sinistra, che verso destra
// si sfoca e svanisce; click = scegli un'altra carta del mazzo, lo dice il cursore a mano) e sopra,
// a sinistra, in basso formato, stato sync, conteggio, Print deck ed Export (si torna alla lista con la tab
// Decks). Sotto il corpo con le sezioni (o Stats / Dilemmas). Tutto scorre insieme (deck-scroll) tranne la fascia
// con il nome del mazzo, le schede Deck / Stats / Dilemmas al centro e la ricerca (desktop), che resta in alto: sopra la testata è trasparente, quando
// la testata è uscita prende lo sfondo. Telefono: il nome sta nella testata e scorre con lei, Print /
// Export / Public in alto a destra; in basso la barra (DeckBottomBar) con il conteggio, Back to top e la
// lente che apre la ricerca a tutto schermo.
export default function DeckEditor({ uid, id, notify, printQueueCount, onPrintDeck }) {
  const { deck, update, saving, error } = useDeck(uid, id);
  const mobile = useIsMobile();
  const settings = useSettings(); // stampa (aggiungi o sostituisci, sideboard), valuta dei prezzi
  const [online, setOnline] = useState(() => navigator.onLine);
  const [searchOpen, setSearchOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false); // pannello della ricerca avanzata (desktop)
  const [stuck, setStuck] = useState(false); // la testata è uscita: la fascia ricerca ha lo sfondo
  const [tab, setTab] = useState('deck'); // schede della testata: deck | stats | dilemmas
  const heroRef = useRef(null);
  const scrollRef = useRef(null); // .deck-scroll: Back to top della barra in basso (telefono)
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
    if (!c.side && (!printQueueCount || settings.printAdd)) onPrintDeck(toPrintEntries(deck), settings.printAdd);
    else setPrintOpen(true);
  };
  const cover = coverRow(deck);
  const savedAt = changedMs(deck); // ultimo cambio di carte (changedAt): Public, edizioni, prezzi non contano
  const price = priceLabel(deck, settings.currency);
  const sync = !online ? (saving ? 'Offline, saved on this device' : 'Offline') : saving ? 'Saving…' : savedAt ? `Saved ${timeAgo(savedAt)}` : 'Saved';
  const name = (
    <input className="deck-name" value={deck.name} maxLength={80} aria-label="Deck name" spellCheck={false}
      onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
      onBlur={() => update((d) => (d.name.trim() ? d : { ...d, name: 'Untitled deck' }))} />
  );
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll" ref={scrollRef} onScroll={mobile ? undefined : onScroll}>
      {!mobile && (
        <div className="deck-sticky">
          {/* Nome a sinistra, schede al centro, ricerca a destra. */}
          <div className={`deck-sticky-bar has-tabs${stuck ? ' stuck' : ''}`}>
            {name}
            <DeckTabs tab={tab} onTab={setTab} bar />
            <div className="deck-hero-search">
              <CardSearch format={deck.format} onAdd={add} notify={notify} advanced={advOpen} onAdvanced={setAdvOpen} />
            </div>
          </div>
        </div>
      )}
      <header className={`deck-hero${mobile ? ' has-tabs' : ''}`} ref={heroRef}>
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
            {/* Pulsanti solo icona: il nome sta in aria-label e nel tooltip. Telefono: in alto a destra della testata. */}
            <span className="deck-hero-actions">
            <button type="button" className="btn-secondary deck-icon-btn" onClick={startPrint} disabled={!c.main}
              aria-label="Print deck" title="Print deck"><IconPrinter size={17} /></button>
            <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}
              aria-label="Export" title="Export"><IconExport size={17} /></button>
            {/* Pubblico = copia in Community, riscritta a ogni salvataggio (deckStore); acceso = ciano. */}
            <button type="button" className={`btn-secondary deck-icon-btn${deck.public ? ' is-public' : ''}`} aria-pressed={!!deck.public}
              aria-label="Share in Community"
              title={deck.public ? 'Public, in Community. Click to make it private' : 'Private. Click to share it in Community'}
              onClick={() => {
                const on = !deck.public;
                update((d) => ({ ...d, public: on }));
                if (!on) unpublishDeck(id).catch((e) => notify(`Sync error: ${e.message}`, 'error'));
                notify(on ? 'Shared in Community' : 'Removed from Community');
              }}><IconGlobe size={17} /></button>
            </span>
            {price && <span className="deck-price" title={`${settings.currency === 'eur' ? 'Cardmarket' : 'TCGplayer'} price on Scryfall, main deck and sideboard`}>{price}</span>}
            <span className={`deck-sync${online ? '' : ' offline'}`} role="status">{sync}</span>
          </div>
        </div>
      </header>
      {mobile && <DeckTabs tab={tab} onTab={setTab} />}
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
          {/* Print dal menu delle carte: si aggiungono alla coda di stampa (mai la sostituiscono), anche dal maybeboard. */}
          {tab === 'dilemmas' ? <DeckDilemmas deck={deck} uid={uid} mine notify={notify} /> : <DeckSections deck={deck} update={update} touch={mobile} tab={tab} onTab={setTab}
            onPrint={(rows) => onPrintDeck(toPrintEntries({ cards: rows.map((r) => ({ ...r, board: 'main' })) }), true)} />}
        </section>
      </div>
      </div>
      {mobile ? <DeckBottomBar deck={deck} showCount={tab === 'deck'} scrollRef={scrollRef} onSearch={() => setSearchOpen(true)} />
        : tab === 'deck' && <DeckCount deck={deck} />}
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
      {coverOpen && (
        <CoverDialog deck={deck} onClose={() => setCoverOpen(false)}
          onPick={(oid) => { update((d) => ({ ...d, cover: oid })); setCoverOpen(false); }} />
      )}
      {mobile && searchOpen && (
        <MobilePage title="Search cards" onClose={() => setSearchOpen(false)}>
          <CardSearch format={deck.format} onAdd={add} notify={notify} autoFocus />
        </MobilePage>
      )}
      {printOpen && (
        <PrintDeckDialog queueCount={printQueueCount} sideCount={c.side} add={settings.printAdd} defaultSide={settings.printSide}
          onClose={() => setPrintOpen(false)}
          onConfirm={(side) => { setPrintOpen(false); onPrintDeck(toPrintEntries(deck, { includeSide: side }), settings.printAdd); }} />
      )}
    </div>
  );
}
