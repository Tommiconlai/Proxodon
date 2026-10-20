import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeck } from './useDeck';
import { unpublishDeck, changedMs, countLikes } from './deckStore';
import { useCount } from './useCount';
import { FORMATS, boardCounts, refreshSnapshots, addCard, toPrintEntries, coverRow, deckTags, searchIdentity } from './deckModel';
import { useSettings } from '../utils/settings';
import { cardsByIds } from './scryfallSearch';
import { navigate, replaceRoute } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import DeckSections from './DeckSections';
import { DeckBand, DeckTitle, DeckCount, DeckTopBar, DeckTagList, DeckBracket } from './DeckTabs';
import { DeckDilemmas } from './Dilemmas';
import { DeckHelps } from './HelpRequests';
import CardSearch from './CardSearch';
import AdvancedSearch from './AdvancedSearch';
import { MobilePage } from '../components/MobileLayout';
import { PrintDeckDialog, CoverDialog, ExportDeckDialog, TagsDialog } from './dialogs';
import { IconX, IconArrowLeft, IconDeckTag, IconDeckPrint, IconDeckExport, IconDeckPublic, IconDeckHeart } from '../components/icons';
import { timeAgo } from '../utils/timeAgo';

const STUCK_AT = 72; // px: padding della barra + casella di ricerca, circa

// Editor del mazzo. Desktop (Figma "Proxodon" 47:108): in alto la barra con il nome (cuore = like ricevuti, se
// pubblico; sotto "by" il nickname, owner) a sinistra e la ricerca a destra, ferma in alto (sopra la testata è
// trasparente, quando la testata è uscita prende lo sfondo); la testata con la copertina a sinistra (sfumata ai
// bordi; click = scegli un'altra carta) e in basso a destra tag, stato sync e le icone; sotto la fascia
// (DeckBand) col formato nell'incavo e le schede, ferma sotto la barra. Poi il corpo con le sezioni (o Stats /
// Dilemmas / Help). Telefono: il nome sta nella testata e scorre con lei, formato e icone in alto a destra; sotto la
// testata la barra (DeckTopBar) con la ricerca sempre aperta, il conteggio e Back to top; niente schede, tutto in una
// pagina: carte, Stats (con la mano di prova), Dilemmas, Help.
// Telefono: Help sta in fondo alla pagina (sotto carte, Stats e Dilemmas); la porta in vista.
const toHelp = () => setTimeout(() => document.querySelector('.deck-part-help')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

export default function DeckEditor({ uid, id, notify, printQueueCount, onPrintDeck, initialTab, owner }) {
  // Errori di sync del mazzo, anche dopo la chiusura dell'editor (notify è dell'app, resta vivo).
  const syncError = useCallback((e) => notify(e.code === 'resource-exhausted'
    ? 'Daily sync limit reached. Your changes stay on this device and sync after the reset.'
    // Salvataggio rifiutato ma il mazzo sul server è quello di partenza (useDeck, kept): le modifiche restano, Retry
    // (solo a editor aperto) riprova subito.
    : e.kept ? (e.retry ? 'Your last change was not saved. It is still here: retry now, or it is tried again with your next change.' : 'Your last change to this deck could not be saved.')
    // Versione rifiutata dalle regole (useDeck): il mazzo è cambiato altrove, qui torna la versione salvata.
    : e.code === 'permission-denied' && !e.publish ? 'This deck changed on another device or tab: your last change was not saved. You now see the saved version.'
      : e.publish ? `Community copy not updated: ${e.message}` : `Sync error: ${e.message}`, 'error', e.retry && { label: 'Retry', onClick: e.retry }), [notify]);
  const { deck, update, saving, unsaved, synced } = useDeck(uid, id, syncError);
  const mobile = useIsMobile();
  const likes = useCount(countLikes, id, undefined, !!deck?.public);
  const settings = useSettings(); // stampa (aggiungi o sostituisci, sideboard), valuta dei prezzi
  const [online, setOnline] = useState(() => navigator.onLine);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [ask, setAsk] = useState(null); // Dilemma dal menu delle carte: le 2 carte per il nuovo dilemma
  const [helpAsk, setHelpAsk] = useState(null); // Ask for help dal menu delle carte: le carte in focus della nuova richiesta
  const [advOpen, setAdvOpen] = useState(false); // pannello della ricerca avanzata (desktop)
  const [stuck, setStuck] = useState(false); // la testata è uscita: la fascia ricerca ha lo sfondo
  // Schede della testata: deck | stats | dilemmas | help; #/decks/:id/help (le proprie richieste dal feed Help) apre Help.
  const [tab, setTab] = useState(initialTab === 'help' ? 'help' : 'deck');
  // #/decks/:id/help (le proprie richieste dal feed Help): da telefono, appena c'è il mazzo, scende fino a Help.
  const loaded = !!deck;
  useEffect(() => { if (mobile && loaded && initialTab === 'help') toHelp(); }, [mobile, loaded, initialTab]);
  const heroRef = useRef(null);
  const scrollRef = useRef(null); // .deck-scroll: Back to top della barra in cima (DeckTopBar, telefono)
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

  // Eliminato da un altro dispositivo mentre era aperto.
  useEffect(() => {
    if (deck !== null) return;
    notify('This deck was deleted', 'error');
    replaceRoute('/decks'); // con navigate, Indietro (anche quello di Android) rientrerebbe nel mazzo che non c'è più
  }, [deck, notify]);

  // Riallinea una volta gli snapshot con Scryfall (ban, immagini). Scryfall giù = restano quelli salvati.
  useEffect(() => {
    // Solo da una versione confermata dal server (synced): da una cache vecchia salverebbe la copia vecchia.
    if (!deck || !synced || refreshed.current) return;
    refreshed.current = true;
    const ids = deck.cards.map((r) => r.card.sid);
    if (ids.length) cardsByIds(ids).then((map) => update((d) => refreshSnapshots(d, map).deck)).catch(() => {});
  }, [deck, synced, update]);

  const add = (card, opts) => update((d) => {
    const r = addCard(d, card, opts);
    if (!r.added) notify('This deck already has 500 rows', 'error');
    return r.deck;
  });

  // Listener fallito prima del primo snapshot (il motivo è nel toast di syncError): niente spinner infinito.
  if (deck === false) {
    return (
      <div className="decks-root decks-center">
        <div className="signin-panel" role="alert">
          <p>Could not load this deck.</p>
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => navigate('/decks')}
            aria-label="All decks" title="All decks"><IconArrowLeft size={18} /></button>
        </div>
      </div>
    );
  }
  if (!deck) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;

  const c = boardCounts(deck);
  // Nessuna domanda se la coda è vuota e non c'è sideboard.
  const startPrint = () => {
    if (!c.side && (!printQueueCount || settings.printAdd)) onPrintDeck(toPrintEntries(deck), settings.printAdd);
    else setPrintOpen(true);
  };
  const cover = coverRow(deck);
  const savedAt = changedMs(deck); // ultimo cambio di carte (changedAt): Public, edizioni, prezzi non contano
  const syncState = unsaved ? 'Not saved' : !online ? (saving ? 'Offline, saved on this device' : 'Offline') : saving ? 'Saving…' : 'Saved';
  const sync = syncState === 'Saved' && savedAt ? `Saved ${timeAgo(savedAt)}` : syncState;
  const name = (
    <input className="deck-name" value={deck.name} maxLength={80} aria-label="Deck name" spellCheck={false}
      onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
      onBlur={() => update((d) => (d.name.trim() ? d : { ...d, name: 'Untitled deck' }))} />
  );
  const format = (
    <select className="deck-format" value={deck.format} aria-label="Format" onChange={(e) => update((d) => ({ ...d, format: e.target.value }))}>
      {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
    </select>
  );
  // Da desktop una scheda alla volta, da telefono tutto in fila. Dilemma e Ask for help dal menu delle carte: da desktop
  // aprono la scheda, da telefono la sezione è già lì (Help la porta in vista: con una richiesta aperta c'è l'avviso).
  const cards = (t) => (
    <DeckSections deck={deck} update={update} touch={mobile} tab={t} onTab={mobile ? undefined : setTab} notify={notify}
      onDilemma={(c) => { setAsk(c); setTab('dilemmas'); }}
      onHelp={(c) => { setHelpAsk(c); setTab('help'); if (mobile) toHelp(); }}
      onPrint={(rows) => onPrintDeck(toPrintEntries({ cards: rows.map((r) => ({ ...r, board: 'main' })) }), true)} />
  );
  const dilemmas = <DeckDilemmas deck={deck} uid={uid} mine notify={notify} ask={ask} onAsked={() => setAsk(null)} />;
  const helps = <DeckHelps deck={deck} uid={uid} mine notify={notify} update={update} ask={helpAsk} onAsked={() => setHelpAsk(null)} />;
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll" ref={scrollRef} onScroll={mobile ? undefined : onScroll}>
      {!mobile && (
        <div className="deck-sticky">
          {/* Nome a sinistra, ricerca a destra. */}
          <div className={`deck-sticky-bar${stuck ? ' stuck' : ''}`}>
            <DeckTitle by={owner}>
              {name}
              <DeckBracket deck={deck} update={update} />
              {deck.public && <span className="deck-likes" role="img" aria-label={`${likes} ${likes === 1 ? 'like' : 'likes'}`} title={`${likes} ${likes === 1 ? 'like' : 'likes'}`}><IconDeckHeart />{likes > 0 && <span>{likes}</span>}</span>}
            </DeckTitle>
            <div className="deck-hero-search">
              <CardSearch format={deck.format} identity={searchIdentity(deck)} onAdd={add} notify={notify} advanced={advOpen} onAdvanced={setAdvOpen} />
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
          {mobile && <div className="deck-hero-title">{name}<DeckBracket deck={deck} update={update} /></div>}
          <DeckTagList deck={deck} />
          <div className="deck-hero-meta">
            {mobile && format}
            {/* Pulsanti solo icona: il nome sta in aria-label e nel tooltip. Telefono: in alto a destra della testata. */}
            <span className="deck-hero-actions">
            <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setTagsOpen(true)}
              aria-label="Tags" title="Tags"><IconDeckTag /></button>
            <button type="button" className="btn-secondary deck-icon-btn" onClick={startPrint} disabled={!c.main}
              aria-label="Print deck" title="Print deck"><IconDeckPrint /></button>
            <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}
              aria-label="Export" title="Export"><IconDeckExport /></button>
            {/* Pubblico = copia in Community, riscritta a ogni salvataggio (deckStore); acceso = ciano. */}
            <button type="button" className={`btn-secondary deck-icon-btn${deck.public ? ' is-public' : ''}`} aria-pressed={!!deck.public}
              aria-label="Share in Community"
              title={deck.public ? 'Public, in Community. Click to make it private (its dilemmas and help requests are deleted)' : 'Private. Click to share it in Community'}
              onClick={() => {
                const on = !deck.public;
                update((d) => ({ ...d, public: on }));
                if (!on) unpublishDeck(uid, id).catch((e) => notify(`Sync error: ${e.message}`, 'error'));
                notify(on ? 'Shared in Community' : 'Removed from Community, with its dilemmas and help requests');
              }}><IconDeckPublic /></button>
            </span>
            <span className={`deck-sync${online ? '' : ' offline'}`}>{sync}</span>
            {/* Annuncia solo i cambi di stato, non il "minutes ago" che si aggiorna da solo. */}
            <span className="sr-only" role="status">{syncState}</span>
          </div>
        </div>
      </header>
      {mobile ? (
        <DeckTopBar deck={deck} scrollRef={scrollRef} onFilters={() => setAdvOpen(true)} filtersOpen={advOpen}
          search={<CardSearch format={deck.format} identity={searchIdentity(deck)} onAdd={add} notify={notify} noAdvanced />} />
      ) : <DeckBand tab={tab} onTab={setTab} format={format} />}
      <div className="deck-body">
        <section className="deck-main">
          {!mobile && advOpen && (
            <section className="deck-adv-panel" aria-label="Advanced search">
              <div className="deck-adv-head">
                <h2 className="decks-title">Advanced search</h2>
                <button type="button" className="modal-close" onClick={() => setAdvOpen(false)} aria-label="Close advanced search" title="Close advanced search"><IconX size={18} /></button>
              </div>
              <AdvancedSearch format={deck.format} identity={searchIdentity(deck)} onAdd={add} notify={notify} />
            </section>
          )}
          {/* Print dal menu delle carte: si aggiungono alla coda di stampa (mai la sostituiscono), anche dal maybeboard. */}
          {mobile ? <>{cards('all')}<div className="deck-part">{dilemmas}</div><div className="deck-part deck-part-help">{helps}</div></>
            : tab === 'dilemmas' ? dilemmas : tab === 'help' ? helps : cards(tab)}
        </section>
      </div>
      </div>
      {!mobile && tab === 'deck' && <DeckCount deck={deck} />}
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
      {coverOpen && (
        <CoverDialog deck={deck} onClose={() => setCoverOpen(false)}
          onPick={(oid) => { update((d) => ({ ...d, cover: oid })); setCoverOpen(false); }} />
      )}
      {mobile && advOpen && (
        <MobilePage title="Advanced search" onClose={() => setAdvOpen(false)}>
          <AdvancedSearch format={deck.format} identity={searchIdentity(deck)} onAdd={add} notify={notify} />
        </MobilePage>
      )}
      {tagsOpen && <TagsDialog tags={deckTags(deck)} onChange={(tags) => update((d) => ({ ...d, tags }))} onClose={() => setTagsOpen(false)} />}
      {printOpen && (
        <PrintDeckDialog queueCount={printQueueCount} sideCount={c.side} add={settings.printAdd} defaultSide={settings.printSide}
          onClose={() => setPrintOpen(false)}
          onConfirm={(side) => { setPrintOpen(false); onPrintDeck(toPrintEntries(deck, { includeSide: side }), settings.printAdd); }} />
      )}
    </div>
  );
}
