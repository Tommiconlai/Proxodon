import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { listenDecks, listenCommunity, createDeck, saveDeck, deleteDeck, setDeckPublic, setDeckFolder, changedMs, countLikes, countOpenHelps } from './deckStore';
import {
  FORMATS, duplicateDeck, deckIdentity, deckCover, deckTags, scryfallImg, formatLabel, searchTerms, deckMatches, rid,
} from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { useLongPress, menuPoint } from '../hooks/useLongPress';
import { useIsMobile } from '../hooks/useIsMobile';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { ManaPips } from './Mana';
import { NameFormatDialog, ExportDeckDialog } from './dialogs';
import { timeAgo } from '../utils/timeAgo';
import NewDeckDialog from './NewDeckDialog';
import { useCount } from './useCount';
import { TabLabel, ListBand } from './DeckTabs';
import { DilemmaFeed } from './Dilemmas';
import { HelpFeed } from './HelpRequests';
import { useBracketSlide } from '../hooks/useBracketSlide';
import {
  IconPlus, IconCopy, IconTrash, IconPencil, IconExport, IconGlobe, IconHeart, IconPlay, IconFolder, IconArrowLeft, IconWrench,
  IconDeckSearch, IconDeckFilter, IconDeckExport, IconX,
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
const LIST_TABS = [['community', 'Community'], ['dilemmas', 'Dilemmas'], ['help', 'Help'], ['mine', 'My decks']];
const listHref = (t) => (t === 'mine' ? '#/decks' : `#/${t}`);

// Sagoma dei riquadri (Figma "Proxodon" 52:275): 209x208, angoli 10, in alto al centro un incavo per i simboli
// dell'identità, largo quanto loro (n simboli da 9 px a passi di 14: mezzo fondo a = 6n - 2, come i due
// riquadri del design, 2 e 3 colori), con le curve copiate dal design. n = 0: senza incavo.
const TILE_BOX = 'H199C204.523 0 209 4.477 209 10V198C209 203.523 204.523 208 199 208H10C4.477 208 0 203.523 0 198V10C0 4.477 4.477 0 10 0Z';
function tileShape(n) {
  if (!n) return `M10 0${TILE_BOX}`;
  const l = 104.5 - (6 * n - 2);
  const r = 104.5 + (6 * n - 2);
  return `M${l - 13} 0C${l - 9.41} 0 ${l - 6.5} 2.91 ${l - 6.5} 6.5C${l - 6.5} 10.09 ${l - 3.59} 13 ${l} 13H${r}`
    + `C${r + 3.478} 13 ${r + 6.317} 10.269 ${r + 6.491} 6.835L${r + 6.509} 6.165C${r + 6.683} 2.731 ${r + 9.522} 0 ${r + 13} 0${TILE_BOX}`;
}
const masks = {};
const tileMask = (n) => (masks[n] ??= `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 209 208' preserveAspectRatio='none'><path d='${tileShape(n)}' fill='white'/></svg>`)}")`);
let frames = 0; // id del gradiente del bordo, uno per riquadro
// Arte ritagliata dalla sagoma (children) e bordo sfumato ciano → viola → magenta (dashed = tratteggio ciano, il +).
function TileFrame({ n = 0, dashed, children }) {
  const [k] = useState(() => `tile-g${++frames}`);
  const mask = tileMask(n);
  return (
    <>
      <span className="deck-tile-shape" style={{ maskImage: mask, WebkitMaskImage: mask }}>{children}</span>
      <svg className="deck-tile-frame" viewBox="0 0 209 208" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {!dashed && (
          <linearGradient id={k} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.1" stopColor="#00E5FF" /><stop offset="0.5" stopColor="#AB61ED" /><stop offset="0.9" stopColor="#FF2E96" />
          </linearGradient>
        )}
        <path d={tileShape(n)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={dashed ? 1.5 : 1}
          stroke={dashed ? 'rgba(0, 229, 255, 0.55)' : `url(#${k})`} strokeDasharray={dashed ? '6 5' : undefined} />
      </svg>
    </>
  );
}

// Riquadro di un mazzo (lista, Community, profilo), sagoma del Figma 52:275: l'arte al 50% con l'ombra interna, i
// simboli dell'identità nell'incavo in alto; in alto a sinistra nome (accanto il globo se è pubblico, fuori dalla
// Community, e la chiave inglese magenta se ha una help request aperta, anche nella Community) e formato; in basso
// like ricevuti e tag, poi autore (by, nella Community) e ultima modifica. Il prezzo sta solo in Stats. props
// vanno sul pulsante. stats = { likes, help } già noti (demo del tutorial): niente letture dal server.
export function DeckTile({ deck: d, by, stats, ...props }) {
  const cover = scryfallImg(deckCover(d));
  const updated = changedMs(d); // ultimo cambio di carte (changedAt), non l'ultima scrittura
  const live = !stats && !!d.public;
  const likesNow = useCount(countLikes, d.id, undefined, live);
  const helpsNow = useCount(countOpenHelps, d.id, undefined, live);
  const likes = stats ? stats.likes : likesNow;
  const helping = stats ? stats.help : helpsNow > 0; // chiave inglese: help request aperta
  const tags = deckTags(d).join(' · ');
  const identity = deckIdentity(d);
  return (
    <button type="button" className="deck-tile" {...props}>
      <TileFrame n={Math.max(1, identity.length)}>
        {cover && <span className="deck-tile-art" style={{ backgroundImage: `url("${cover}")` }} />}
      </TileFrame>
      <span className="deck-tile-pips"><ManaPips colors={identity} /></span>
      <span className="deck-tile-head">
        <span className="deck-tile-title">
          <span className="deck-tile-name">{d.name}</span>
          {d.public && !by && <span className="deck-tile-public" title="Public, in Community"><IconGlobe size={12} /><span className="sr-only">, public</span></span>}
          {helping && <span className="deck-tile-public help" title="Open help request"><IconWrench size={12} /><span className="sr-only">, open help request</span></span>}
        </span>
        <span className="deck-tile-format">{formatLabel(d.format)}</span>
      </span>
      <span className="deck-tile-body">
        <span className="deck-tile-foot">
          <span className="deck-tile-likes"><IconHeart size={12} /> {likes}<span className="sr-only"> likes</span></span>
          {tags && <span className="deck-tile-tags" title={tags}>{tags}</span>}
        </span>
        <span className="deck-tile-meta">
          {by && <span className="deck-tile-by">by {by}</span>}
          {updated && <span>Updated {timeAgo(updated)}</span>}
        </span>
      </span>
    </button>
  );
}

// Riquadro tratteggiato con la sagoma di un mazzo, il contenuto al centro: + in fondo a My decks, See all in fondo
// ai mazzi del profilo (href = link).
export function GhostTile({ label, href, onClick, children }) {
  const Tag = href ? 'a' : 'button';
  return (
    <li className="deck-tile-wrap">
      <Tag className="deck-tile deck-add" {...(href ? { href } : { type: 'button', onClick })} aria-label={label} title={label}>
        <TileFrame dashed />
        {children}
      </Tag>
    </li>
  );
}

// Nome della cartella: click = si rinomina sul posto (Enter o uscita salvano, Esc annulla, vuoto = resta).
function FolderName({ name, onRename, className = '' }) {
  const [editing, setEditing] = useState(false);
  const open = useRef(false); // una sola chiusura: Enter / Esc smontano l'input e il blur non deve ripetere
  if (editing) {
    const finish = (v) => {
      if (!open.current) return;
      open.current = false;
      setEditing(false);
      if (v && v !== name) onRename(v);
    };
    return (
      <input className={`folder-name-input ${className}`} defaultValue={name} maxLength={40} autoFocus aria-label="Folder name"
        spellCheck={false} onBlur={(e) => finish(e.target.value.trim())} onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(e.currentTarget.value.trim());
          if (e.key === 'Escape') { e.stopPropagation(); finish(name); }
        }} />
    );
  }
  return <button type="button" className={`folder-name ${className}`} onClick={() => { open.current = true; setEditing(true); }} title="Rename folder">{name}</button>;
}

// Cartella in My decks: stessa sagoma (senza incavo), le copertine dei primi 4 mazzi a mosaico, il nome
// (rinominabile) in alto, in basso quanti mazzi. Click sul riquadro = la apre. drop = props del trascinamento.
export function FolderTile({ folder, onOpen, onRename, drop, active }) {
  const covers = folder.decks.map((d) => scryfallImg(deckCover(d))).filter(Boolean).slice(0, 4);
  const n = folder.decks.length;
  return (
    <li className={`deck-tile-wrap folder-wrap${active ? ' drop' : ''}`} {...drop}>
      <button type="button" className="deck-tile folder-tile" onClick={onOpen} aria-label={`Open folder ${folder.name}, ${n} ${n === 1 ? 'deck' : 'decks'}`}>
        <TileFrame>
          <span className="folder-art" data-n={covers.length}>
            {covers.map((c, i) => <span key={i} style={{ backgroundImage: `url("${c}")` }} />)}
          </span>
        </TileFrame>
        <span className="deck-tile-body">
          <span className="deck-tile-foot"><span className="folder-count"><IconFolder size={14} /> {n} {n === 1 ? 'deck' : 'decks'}</span></span>
          <span className="deck-tile-meta"><span>Folder</span></span>
        </span>
      </button>
      <FolderName name={folder.name} onRename={onRename} className="on-tile" />
    </li>
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
          <DeckTile deck={d} by={d.owner || 'a player'} onClick={() => navigate(`/community/${d.id}`)} />
        </li>
      ))}
    </ul>
  );
}

// Lista mazzi: schede Community, Dilemmas, Help e My decks (rotte #/community, #/dilemmas, #/help e #/decks, stesso
// componente: ricerca e filtri restano passando dall'una all'altra), ricerca per nome e Filters (formato,
// colori, carta); in Dilemmas e Help la ricerca (domanda, carte, mazzo, autore) e accanto solo il formato.
// open = il dilemma aperto dal feed (#/dilemmas/:mazzo/:dilemma; una help request si apre invece in CommunityDeck),
// play = il gioco (#/dilemmas/play, dal Play al posto del +): niente ricerca. folder = la cartella aperta in My decks (#/decks/folder/:id).
export default function DeckList({ uid, notify, tab = 'mine', open, play, folder: folderId }) {
  const community = tab === 'community';
  const dilemmas = tab === 'dilemmas';
  const help = tab === 'help';
  const feed = dilemmas || help; // ricerca nei testi e solo il formato accanto
  const searchLabel = dilemmas ? 'Search dilemmas' : help ? 'Search requests' : 'Search decks by name or tag';
  const tabsRef = useRef(null);
  useBracketSlide(tabsRef, LIST_TABS.findIndex(([t]) => t === tab));
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'new' | 'import' | { rename: deck } | { del: deck } | { exp: deck }
  const [menu, setMenu] = useState(null); // { deck, x, y }
  const [q, setQ] = useState(memory.q);
  const [filters, setFilters] = useState(memory.filters);
  useEffect(() => { memory.q = q; memory.filters = filters; }, [q, filters]);
  const rootRef = useRef(null);
  useScrollMemory(rootRef, open || play ? null : folderId ? `folder:${folderId}` : tab);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);
  const mobile = useIsMobile();
  const dragId = useRef(null); // mazzo trascinato (desktop)
  const [dropOn, setDropOn] = useState(null); // id del mazzo / cartella (o 'out') sotto il trascinamento

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
  // Cartelle (folder sul mazzo), nell'ordine del mazzo cambiato più di recente. Con ricerca o filtri la
  // lista è piatta, cartelle comprese; altrimenti cartelle, poi i mazzi fuori, o quelli della cartella aperta.
  const searching = terms.length > 0 || nFilters > 0;
  const folders = [];
  for (const d of decks || []) {
    if (!d.folder?.id) continue;
    let f = folders.find((x) => x.id === d.folder.id);
    if (!f) folders.push(f = { id: d.folder.id, name: d.folder.name || 'New folder', decks: [] });
    f.decks.push(d);
  }
  const openFolder = !searching && folders.find((f) => f.id === folderId);
  const gridDecks = searching ? shown : openFolder ? openFolder.decks : decks?.filter((d) => !d.folder?.id);
  const moveTo = (ids, folder) => setDeckFolder(uid, ids, folder).catch(writeError);
  const renameFolder = (f, name) => moveTo(f.decks.map((d) => d.id), { id: f.id, name });
  // Trascinamento (desktop): un mazzo su un altro = nuova cartella "New folder" con i due (o entra nella
  // cartella dell'altro), su una cartella = ci entra, sul pulsante indietro della cartella aperta = esce.
  const dropProps = (key, onDrop) => (mobile ? {} : {
    onDragOver: (e) => { if (dragId.current && dragId.current !== key) { e.preventDefault(); setDropOn(key); } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOn((k) => (k === key ? null : k)); },
    onDrop: (e) => {
      e.preventDefault();
      const id = dragId.current;
      dragId.current = null;
      setDropOn(null);
      if (id && id !== key) onDrop(id);
    },
  });
  const dropOnDeck = (target) => (id) => {
    if (target.folder?.id) {
      if (decks.find((d) => d.id === id)?.folder?.id !== target.folder.id) moveTo([id], target.folder);
    } else {
      moveTo([target.id, id], { id: rid(), name: 'New folder' });
      notify('Folder created');
    }
  };

  const menuItems = menu ? [
    { key: 'rename', Icon: IconPencil, label: 'Rename', run: () => setDialog({ rename: menu.deck }) },
    {
      key: 'pub', Icon: IconGlobe, label: menu.deck.public ? 'Make private' : 'Share in Community',
      run: () => {
        setDeckPublic(uid, menu.deck, !menu.deck.public).catch(writeError);
        notify(menu.deck.public ? 'Removed from Community, with its dilemmas and help requests' : 'Shared in Community');
      },
    },
    { key: 'dup', Icon: IconCopy, label: 'Duplicate', run: () => { create({ ...duplicateDeck(menu.deck), folder: menu.deck.folder ?? null }); notify('Deck duplicated'); } },
    // Cartelle anche senza trascinare (telefono): nelle altre, in una nuova, fuori.
    ...folders.filter((f) => f.id !== menu.deck.folder?.id).map((f) => ({
      key: `f-${f.id}`, Icon: IconFolder, label: `Move to “${f.name}”`, run: () => moveTo([menu.deck.id], { id: f.id, name: f.name }),
    })),
    { key: 'f-new', Icon: IconFolder, label: 'Move to a new folder', run: () => moveTo([menu.deck.id], { id: rid(), name: 'New folder' }) },
    ...(menu.deck.folder?.id ? [{ key: 'f-out', Icon: IconFolder, label: 'Remove from folder', run: () => moveTo([menu.deck.id], null) }] : []),
    { key: 'txt', Icon: IconExport, label: 'Export…', run: () => setDialog({ exp: menu.deck }) },
    { key: 'del', Icon: IconTrash, label: 'Delete', danger: true, run: () => setDialog({ del: menu.deck }) },
  ] : [];

  return (
    <div className="decks-root decks-page" ref={rootRef}>
      {/* Desktop: la fascia a trapezi del Figma 52:275; telefono: le schede tra [ ]. */}
      {mobile ? (
        <header className="decks-head">
          <nav className="decks-tabs" aria-label="Decks" ref={tabsRef}>
            {LIST_TABS.map(([t, label]) => (
              <a key={t} href={listHref(t)} className="decks-title decks-tab" aria-current={tab === t ? 'page' : undefined}><TabLabel>{label}</TabLabel></a>
            ))}
          </nav>
        </header>
      ) : <ListBand items={LIST_TABS.map(([t, label]) => [t, label, listHref(t)])} current={tab} />}

      {!open && !play && <>
      <div className="decks-search" role="search">
        <label className="decks-search-box">
          <IconDeckSearch />
          <input type="search" className="import-link-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={searchLabel} aria-label={searchLabel} spellCheck={false} />
        </label>
        {/* Dilemmas e Help: solo il formato, accanto alla ricerca (lo stesso filtro formato delle altre schede). */}
        {feed ? (
          <select className={`decks-format${filters.format ? ' on' : ''}`} value={filters.format} aria-label="Format" title="Format"
            onChange={(e) => setFilters((f) => ({ ...f, format: e.target.value }))}>
            <option value="">Any format</option>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        ) : (
          <button type="button" className={`decks-filter-btn${nFilters ? ' on' : ''}`} aria-expanded={filtersOpen}
            aria-controls="deck-filters" onClick={() => setFiltersOpen((v) => !v)}
            aria-label={nFilters ? `Filters, ${nFilters} on` : 'Filters'} title="Filters">
            <IconDeckFilter />{nFilters > 0 && <span className="decks-filter-n" aria-hidden="true">{nFilters}</span>}
          </button>
        )}
        {dilemmas && (
          <div className="decks-actions">
            <button type="button" className="btn-add deck-new deck-icon-btn" onClick={() => navigate('/dilemmas/play')} aria-label="Play dilemmas" title="Play dilemmas"><IconPlay size={18} /></button>
          </div>
        )}
      </div>
      {filtersOpen && !feed && (
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
          {nFilters > 0 && (
            <button type="button" className="decks-clear" onClick={() => setFilters(NO_FILTERS)} aria-label="Clear filters" title="Clear filters"><IconX size={14} /></button>
          )}
        </div>
      )}
      </>}

      {dilemmas ? <DilemmaFeed uid={uid} notify={notify} open={open} play={play} terms={terms} format={filters.format} />
        : help ? <HelpFeed uid={uid} terms={terms} format={filters.format} />
        : community ? <CommunityGrid uid={uid} terms={terms} filters={filters} /> : <>
        {decks === null && <span className="import-spinner" aria-label="Loading" />}
        {decks?.length === 0 && <Empty title="Start your first deck" hint="Create one with the + below, from scratch or from a list." />}
        {decks?.length > 0 && searching && !shown.length && <Empty title="No decks match" hint="Try another name or clear the filters." />}
        {openFolder && (
          <div className="folder-head">
            <button type="button" className={`btn-secondary deck-icon-btn${dropOn === 'out' ? ' drop' : ''}`} onClick={() => navigate('/decks')}
              aria-label="All decks" title={mobile ? 'All decks' : 'All decks (drop a deck here to take it out of the folder)'}
              {...dropProps('out', (id) => moveTo([id], null))}><IconArrowLeft size={18} /></button>
            <IconFolder size={20} />
            <FolderName name={openFolder.name} onRename={(name) => renameFolder(openFolder, name)} className="in-head" />
          </div>
        )}
        {decks && (!searching || shown.length > 0) && (
          <ul className="deck-grid">
            {!searching && !openFolder && folders.map((f) => (
              <FolderTile key={f.id} folder={f} onOpen={() => navigate(`/decks/folder/${f.id}`)} onRename={(name) => renameFolder(f, name)}
                active={dropOn === f.id} drop={dropProps(f.id, (id) => moveTo([id], { id: f.id, name: f.name }))} />
            ))}
            {gridDecks.map((d) => (
              <li key={d.id} className={`deck-tile-wrap${dropOn === d.id ? ' drop' : ''}`} draggable={!mobile}
                onDragStart={(e) => { dragId.current = d.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.name); }}
                onDragEnd={() => { dragId.current = null; setDropOn(null); }}
                {...dropProps(d.id, dropOnDeck(d))}>
                <DeckTile deck={d}
                  onClick={() => { if (!press.consumed()) navigate(`/decks/${d.id}`); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ deck: d, ...menuPoint(e) }); }}
                  {...press.bind((x, y) => setMenu({ deck: d, x, y }))} />
                {/* Fuori dal riquadro (niente pulsanti annidati), posato sull'angolo dell'arte. */}
                <button type="button" className="deck-tile-export" aria-label={`Export ${d.name}`} title="Export"
                  onClick={() => setDialog({ exp: d })}><IconDeckExport /></button>
              </li>
            ))}
            {!searching && <GhostTile label="New deck" onClick={() => setDialog('new')}><IconPlus size={44} /></GhostTile>}
          </ul>
        )}
      </>}

      {menu && <CardMenu x={menu.x} y={menu.y} title={menu.deck.name} items={menuItems} onClose={closeMenu} />}
      {/* Nuovo mazzo, vuoto o da una lista; nasce nella cartella aperta. */}
      {dialog === 'new' && (
        <NewDeckDialog onClose={() => setDialog(null)}
          onCreate={(deck, notFound) => {
            setDialog(null);
            const id = create({ ...deck, folder: openFolder ? { id: openFolder.id, name: openFolder.name } : null });
            if (deck.cards.length) {
              notify(notFound.length
                ? `Imported. Not found: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ` and ${notFound.length - 5} more` : ''}`
                : 'Deck imported', notFound.length ? 'error' : 'success');
            }
            navigate(`/decks/${id}`);
          }} />
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
