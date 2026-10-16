import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { listenDecks, listenCommunity, createDeck, saveDeck, deleteDeck, setDeckPublic, changedMs, countLikes } from './deckStore';
import {
  FORMATS, newDeck, duplicateDeck, deckIdentity, deckCover, scryfallImg, formatLabel, searchTerms, deckMatches,
} from './deckModel';
import { useSettings } from '../utils/settings';
import { navigate } from '../hooks/useHashRoute';
import { useLongPress, menuPoint } from '../hooks/useLongPress';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { ManaPips } from './Mana';
import { NameFormatDialog, ExportDeckDialog } from './dialogs';
import { timeAgo } from '../utils/timeAgo';
import ImportDeckDialog from './ImportDeckDialog';
import { useCount } from './useCount';
import { TabLabel } from './DeckTabs';
import { DilemmaFeed } from './Dilemmas';
import { HandsIntro, HandsPlay } from './KeepOrMull';
import { useBracketSlide } from '../hooks/useBracketSlide';
import {
  IconPlus, IconCopy, IconTrash, IconPencil, IconDownload, IconExport, IconGlobe, IconSearch, IconFilter, IconHeart, IconPlay,
} from '../components/icons';

const COLORS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'], ['C', 'Colorless']];
const NO_FILTERS = { format: '', colors: [], card: '' };

// Aprendo un mazzo la lista si smonta: ricerca, filtri e scorrimento (per scheda) restano qui, in memoria
// per la sessione della pagina, e tornano al rientro. ponytail: niente sessionStorage, una ricarica azzera.
const memory = { q: '', filters: NO_FILTERS, scroll: {} };
const scrollParent = (el) => { // l'elemento stesso o il primo antenato che scorre (telefono: .decks-root)
  for (let p = el; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return document.scrollingElement;
};
// key null (dilemma aperto, Play) = in cima, senza ricordare. Il ripristino aspetta che la pagina sia
// abbastanza lunga (le liste arrivano da Firestore), per al massimo ~40 frame.
function useScrollMemory(ref, key) {
  useLayoutEffect(() => {
    const box = scrollParent(ref.current);
    if (!box) return undefined;
    const y = key ? memory.scroll[key] || 0 : 0;
    let n = 0;
    let raf = 0;
    const go = () => {
      if (box.scrollHeight - box.clientHeight >= y || n++ > 40) box.scrollTop = y;
      else raf = requestAnimationFrame(go);
    };
    go();
    const save = () => { if (key) memory.scroll[key] = box.scrollTop; };
    box.addEventListener('scroll', save, { passive: true });
    return () => { cancelAnimationFrame(raf); box.removeEventListener('scroll', save); };
  }, [ref, key]);
}
const LIST_TABS = [['community', 'Community'], ['dilemmas', 'Dilemmas'], ['mine', 'My decks']];
const DILEMMA_SECTIONS = [['help', 'Help requests', '#/dilemmas'], ['hands', 'Keep or mull', '#/dilemmas/hands']];

// Riquadro di un mazzo (lista, Community, profilo): sull'arte, in alto a sinistra sotto una sfumatura
// nera, nome (accanto il globo se è pubblico, fuori dalla Community), formato e like ricevuti; sotto
// identità di colore, poi autore (by, nella Community) e ultima modifica; il prezzo sta solo in Stats.
// Testi in cqi: il riquadro è largo una percentuale della griglia e tutto scala con lui. props vanno sul pulsante.
export function DeckTile({ deck: d, by, ...props }) {
  const cover = scryfallImg(deckCover(d));
  const updated = changedMs(d); // ultimo cambio di carte (changedAt), non l'ultima scrittura
  const likes = useCount(countLikes, d.id, undefined, !!d.public);
  return (
    <button type="button" className="deck-tile" {...props}>
      <span className="deck-tile-art" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
        <span className="deck-tile-head">
          <span className="deck-tile-title">
            <span className="deck-tile-name">{d.name}</span>
            {d.public && !by && <span className="deck-tile-public" title="Public, in Community"><IconGlobe size={12} /><span className="sr-only">, public</span></span>}
          </span>
          <span className="deck-tile-format">{formatLabel(d.format)}</span>
          <span className="deck-tile-likes"><IconHeart size={12} /> {likes}<span className="sr-only"> likes</span></span>
        </span>
      </span>
      <span className="deck-tile-body">
        <span className="deck-tile-foot">
          <ManaPips colors={deckIdentity(d)} />
        </span>
        <span className="deck-tile-meta">
          {by && <span className="deck-tile-by">by {by}</span>}
          {updated && <span>Updated {timeAgo(updated)}</span>}
        </span>
      </span>
    </button>
  );
}

const Empty = ({ title, hint }) => (
  <div className="decks-empty">
    <p className="decks-empty-title">{title}</p>
    <p className="field-hint">{hint}</p>
  </div>
);

// Community: gli ultimi 20 mazzi pubblici degli altri (i propri stanno in My decks) che passano ricerca e
// filtri. La query cerca la prima parola (300 ms dopo l'ultimo tasto), il resto lo filtra deckMatches.
function CommunityGrid({ uid, terms, filters }) {
  const [decks, setDecks] = useState(null);
  const [error, setError] = useState(null);
  const word = terms[0] || '';
  const [term, setTerm] = useState(word);
  useEffect(() => {
    const t = setTimeout(() => setTerm(word), 300);
    return () => clearTimeout(t);
  }, [word]);
  useEffect(() => listenCommunity(term, (d) => { setDecks(d); setError(null); }, setError), [term]);

  if (error) return <Empty title="Community is not available" hint={error.message} />;
  if (!decks) return <span className="import-spinner" aria-label="Loading" />;
  const others = decks.filter((d) => d.uid !== uid);
  const shown = others.filter((d) => deckMatches(d, terms, filters)).slice(0, 20);
  if (!shown.length) {
    return others.length || terms.length
      ? <Empty title="No decks match" hint="Try another name or clear the filters." />
      : <Empty title="No public decks from other players yet" hint="Yours are in My decks. Share one with Share in Community from its menu, or Public in the deck page." />;
  }
  return (
    <ul className="deck-grid">
      {shown.map((d) => (
        <li key={d.id} className="deck-tile-wrap">
          <DeckTile deck={d} by={d.owner || 'anonymous'} onClick={() => navigate(`/community/${d.id}`)} />
        </li>
      ))}
    </ul>
  );
}

// Lista mazzi: schede Community, Dilemmas e My decks (rotte #/community, #/dilemmas e #/decks, stesso
// componente: ricerca e filtri restano passando dall'una all'altra), ricerca per nome e Filters (formato,
// colori, carta); in Dilemmas la ricerca (domanda, carte, mazzo, autore) e accanto solo il formato.
// Dilemmas ha due sezioni (section): Help requests (i dilemmi, 'help') e Keep or mull (mani iniziali,
// 'hands'), ognuna col suo Play nella barra delle sezioni. open = il dilemma aperto dal feed
// (#/dilemmas/:mazzo/:dilemma), play = il gioco della sezione: niente ricerca né barra.
export default function DeckList({ uid, notify, tab = 'mine', open, play, section = 'help' }) {
  const community = tab === 'community';
  const dilemmas = tab === 'dilemmas';
  const hands = dilemmas && section === 'hands';
  const searchLabel = dilemmas ? 'Search dilemmas' : 'Search decks by name';
  const tabsRef = useRef(null);
  useBracketSlide(tabsRef, LIST_TABS.findIndex(([t]) => t === tab));
  const sectionsRef = useRef(null);
  useBracketSlide(sectionsRef, hands ? 1 : 0);
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'new' | 'import' | { rename: deck } | { del: deck } | { exp: deck }
  const [menu, setMenu] = useState(null); // { deck, x, y }
  const [q, setQ] = useState(memory.q);
  const [filters, setFilters] = useState(memory.filters);
  useEffect(() => { memory.q = q; memory.filters = filters; }, [q, filters]);
  const rootRef = useRef(null);
  useScrollMemory(rootRef, open || play ? null : dilemmas ? `dilemmas:${section}` : tab);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);
  const settings = useSettings(); // formato e raggruppamento dei nuovi mazzi, valuta dei prezzi

  useEffect(() => listenDecks(uid, setDecks, (e) => notify(`Could not load your decks: ${e.message}`, 'error')), [uid, notify]);

  const writeError = (e) => notify(`Sync error: ${e.message}`, 'error');
  const create = (deck) => {
    const { id, done } = createDeck(uid, deck);
    done.catch(writeError);
    return id;
  };

  const terms = searchTerms(q);
  const nFilters = (filters.format ? 1 : 0) + filters.colors.length + (filters.card.trim() ? 1 : 0);
  const toggleColor = (c) => setFilters((f) => ({ ...f, colors: f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c] }));
  const shown = decks?.filter((d) => deckMatches(d, terms, filters));

  const menuItems = menu ? [
    { key: 'rename', Icon: IconPencil, label: 'Rename', run: () => setDialog({ rename: menu.deck }) },
    {
      key: 'pub', Icon: IconGlobe, label: menu.deck.public ? 'Make private' : 'Share in Community',
      run: () => {
        setDeckPublic(uid, menu.deck, !menu.deck.public).catch(writeError);
        notify(menu.deck.public ? 'Removed from Community' : 'Shared in Community');
      },
    },
    { key: 'dup', Icon: IconCopy, label: 'Duplicate', run: () => { create(duplicateDeck(menu.deck)); notify('Deck duplicated'); } },
    { key: 'txt', Icon: IconExport, label: 'Export…', run: () => setDialog({ exp: menu.deck }) },
    { key: 'del', Icon: IconTrash, label: 'Delete', danger: true, run: () => setDialog({ del: menu.deck }) },
  ] : [];

  return (
    <div className="decks-root decks-page" ref={rootRef}>
      <header className="decks-head">
        <nav className="decks-tabs" aria-label="Decks" ref={tabsRef}>
          {LIST_TABS.map(([t, label]) => (
            <a key={t} href={t === 'mine' ? '#/decks' : `#/${t}`} className="decks-title decks-tab" aria-current={tab === t ? 'page' : undefined}><TabLabel>{label}</TabLabel></a>
          ))}
        </nav>
        {tab === 'mine' && (
          <div className="decks-actions">
            {/* Solo in My decks. Solo icone (nome nel tooltip e per i lettori di schermo); backup e ripristino stanno in Settings. */}
            <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setDialog('import')} aria-label="Import a deck" title="Import a deck"><IconDownload size={18} /></button>
            <button type="button" className="btn-add deck-new deck-icon-btn" onClick={() => setDialog('new')} aria-label="New deck" title="New deck"><IconPlus size={18} /></button>
          </div>
        )}
      </header>

      {/* Sezioni di Dilemmas, con il Play della sezione aperta a destra. */}
      {dilemmas && !open && !play && (
        <div className="dilemma-sections-bar">
          <nav className="decks-tabs dilemma-sections" aria-label="Dilemmas sections" ref={sectionsRef}>
            {DILEMMA_SECTIONS.map(([s, label, href]) => (
              <a key={s} href={href} className="decks-title decks-tab" aria-current={section === s ? 'page' : undefined}><TabLabel>{label}</TabLabel></a>
            ))}
          </nav>
          <button type="button" className="btn-add deck-new deck-icon-btn" onClick={() => navigate(hands ? '/dilemmas/hands/play' : '/dilemmas/play')}
            aria-label={hands ? 'Play Keep or mull' : 'Play help requests'} title={hands ? 'Play Keep or mull' : 'Play help requests'}><IconPlay size={18} /></button>
        </div>
      )}

      {!open && !play && !hands && <>
      <div className="decks-search" role="search">
        <label className="decks-search-box">
          <IconSearch size={16} />
          <input type="search" className="import-link-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={searchLabel} aria-label={searchLabel} spellCheck={false} />
        </label>
        {/* Dilemmas: solo il formato, accanto alla ricerca (lo stesso filtro formato delle altre schede). */}
        {dilemmas ? (
          <select className={`decks-format${filters.format ? ' on' : ''}`} value={filters.format} aria-label="Format" title="Format"
            onChange={(e) => setFilters((f) => ({ ...f, format: e.target.value }))}>
            <option value="">Any format</option>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        ) : (
          <button type="button" className={`btn-secondary decks-filter-btn${nFilters ? ' on' : ''}`} aria-expanded={filtersOpen}
            aria-controls="deck-filters" onClick={() => setFiltersOpen((v) => !v)}>
            <IconFilter size={16} /> Filters{nFilters > 0 && <span className="decks-filter-n">{nFilters}</span>}
          </button>
        )}
      </div>
      {filtersOpen && !dilemmas && (
        <div id="deck-filters" className="decks-filters">
          <label className="decks-filter">
            <span>Format</span>
            <select value={filters.format} onChange={(e) => setFilters((f) => ({ ...f, format: e.target.value }))}>
              <option value="">Any</option>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="decks-filter">
            <span>Contains card</span>
            <input type="search" className="import-link-input decks-card-filter" value={filters.card} placeholder="Card name"
              spellCheck={false} onChange={(e) => setFilters((f) => ({ ...f, card: e.target.value }))} />
          </label>
          <div className="decks-filter" role="group" aria-label="Colors">
            <span aria-hidden="true">Colors</span>
            <span className="decks-colors">
              {COLORS.map(([c, label]) => (
                <button key={c} type="button" className="decks-color" aria-pressed={filters.colors.includes(c)}
                  aria-label={label} title={label} onClick={() => toggleColor(c)}>
                  <ManaPips colors={c === 'C' ? [] : [c]} />
                </button>
              ))}
            </span>
          </div>
          {nFilters > 0 && <button type="button" className="signin-link" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>}
        </div>
      )}
      </>}

      {hands ? (play ? <HandsPlay uid={uid} notify={notify} /> : <HandsIntro uid={uid} />)
        : dilemmas ? <DilemmaFeed uid={uid} notify={notify} open={open} play={play} terms={terms} format={filters.format} />
        : community ? <CommunityGrid uid={uid} terms={terms} filters={filters} /> : <>
        {decks === null && <span className="import-spinner" aria-label="Loading" />}
        {decks?.length === 0 && <Empty title="Start your first deck" hint="Create one from scratch, or import a list." />}
        {decks?.length > 0 && !shown.length && <Empty title="No decks match" hint="Try another name or clear the filters." />}
        {shown?.length > 0 && (
          <ul className="deck-grid">
            {shown.map((d) => (
              <li key={d.id} className="deck-tile-wrap">
                <DeckTile deck={d}
                  onClick={() => { if (!press.consumed()) navigate(`/decks/${d.id}`); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ deck: d, ...menuPoint(e) }); }}
                  {...press.bind((x, y) => setMenu({ deck: d, x, y }))} />
                {/* Fuori dal riquadro (niente pulsanti annidati), posato sull'angolo dell'arte. */}
                <button type="button" className="deck-tile-export" aria-label={`Export ${d.name}`} title="Export"
                  onClick={() => setDialog({ exp: d })}><IconExport size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </>}

      {menu && <CardMenu x={menu.x} y={menu.y} title={menu.deck.name} items={menuItems} onClose={closeMenu} />}
      {dialog === 'import' && (
        <ImportDeckDialog onClose={() => setDialog(null)}
          onImported={(deck, notFound) => {
            setDialog(null);
            const id = create(deck);
            notify(notFound.length
              ? `Imported. Not found: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ` and ${notFound.length - 5} more` : ''}`
              : 'Deck imported', notFound.length ? 'error' : 'success');
            navigate(`/decks/${id}`);
          }} />
      )}
      {dialog === 'new' && (
        <NameFormatDialog title="New deck" confirmLabel="Create" initialFormat={settings.deckFormat} onClose={() => setDialog(null)}
          onSubmit={(v) => { setDialog(null); navigate(`/decks/${create(newDeck({ ...v, groupBy: settings.deckGroupBy }))}`); }} />
      )}
      {dialog?.exp && <ExportDeckDialog deck={dialog.exp} onClose={() => setDialog(null)} />}
      {dialog?.rename && (
        <NameFormatDialog title="Rename deck" confirmLabel="Rename" initialName={dialog.rename.name} showFormat={false}
          onClose={() => setDialog(null)}
          onSubmit={({ name }) => { saveDeck(uid, { ...dialog.rename, name }).catch(writeError); setDialog(null); }} />
      )}
      <ConfirmDialog open={!!dialog?.del} message={`Delete “${dialog?.del?.name}”? This can’t be undone.`} confirmLabel="Delete deck"
        onCancel={() => setDialog(null)}
        onConfirm={() => { deleteDeck(uid, dialog.del).catch(writeError); setDialog(null); }} />
    </div>
  );
}
