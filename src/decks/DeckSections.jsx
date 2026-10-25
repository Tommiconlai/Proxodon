import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import { useLongPress, menuPoint } from '../hooks/useLongPress';
import { ManaCost } from './Mana';
import { NameFormatDialog, CopiesDialog } from './dialogs';
import ArtPickerModal from '../components/ArtPickerModal';
import { cardsByIds } from './scryfallSearch';
import {
  GROUP_MODES, SORT_MODES, VIEWS, groupMain, commanderRows, boardRows, bumpQty, removeRows, setCommander, moveToBoard,
  addSection, renameSection, deleteSection, moveToSection, placeRows, overLimit, formatLabel, illegalIn, legalityLabel,
  splitRow, changeEdition, snapshotFromCard, validateDeck, packPiles, splitPiles, maxCopies, MAX_DILEMMA_CARDS, MAX_HELP_CARDS, DRAG_ROWS,
} from './deckModel';
import DeckStats from './DeckStats';
import LandPanel from './LandPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import SampleHand from './SampleHand';
import CardImg from './CardImg';
import { CardFrame, CardFrameDefs } from '../components/CardFrame';
import { useCardImg } from './cardLang';
import { PREVIEW, previewAt } from './hoverPreview';
import { useSettings, setDeckView } from '../utils/settings';
import {
  IconPlus, IconMinus, IconTrash, IconCrown, IconList, IconPencil, IconAlert, IconBan, IconImage, IconCopy, IconFlip, IconPrinter, IconEye, IconX, IconScale, IconLifebuoy, IconZap, IconUsers,
} from '../components/icons';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';

const BOARD_LABEL = { main: 'main deck', side: 'sideboard', maybe: 'maybeboard' };
// Larghezza dell'anteprima al passaggio (Settings → Card preview), 0 = spenta.
// Anteprima fissa sullo schermo, sopra tutto (posizione e misure da previewAt): nel mazzo e nella decklist dei dilemmi.
export const HoverCard = ({ hover }) => createPortal(hover.back ? (
  <div className="deck-hover deck-hover-pair" style={{ left: hover.x, top: hover.y }}>
    <img src={hover.img} alt="" style={{ width: hover.w }} />
    <img src={hover.back} alt="" style={{ width: hover.w }} />
  </div>
) : <img className="deck-hover" src={hover.img} alt="" style={{ left: hover.x, top: hover.y, width: hover.w }} />, document.body);

// Anteprima di DeckSections in un piccolo store per istanza: cambiarla ridisegna solo HoverLayer.
const hoverStore = () => {
  let value = null;
  const subs = new Set();
  return {
    get: () => value,
    set: (h) => { value = h; subs.forEach((f) => f()); },
    sub: (f) => { subs.add(f); return () => subs.delete(f); },
  };
};
// L'anteprima è fissa sullo schermo: sparisce appena qualcosa scorre.
function HoverLayer({ store }) {
  const hover = useSyncExternalStore(store.sub, store.get);
  useEffect(() => {
    if (!hover) return undefined;
    const off = () => store.set(null);
    window.addEventListener('scroll', off, true);
    return () => window.removeEventListener('scroll', off, true);
  }, [hover, store]);
  return hover && <HoverCard hover={hover} />;
}
// Stack: le pile si allargano (da 200 a 400 px, --stack-w) per riempire l'area del mazzo; l'altezza
// di una pila viene dal numero di carte e dalla larghezza: carta 680/488, poi la riga del nome di
// ogni carta coperta (margin-top -125.3% della larghezza).
const STACK_MIN = 200;
const STACK_MAX = 400;
const STACK_GAP = 20; // spazio verticale tra pile nella stessa colonna, = gap di .deck-stack-col
const COL_GAP = 16; // spazio tra le colonne, = gap orizzontale di .deck-columns.view-stacks
const PILE_HEAD = 34; // intestazione del gruppo con il suo margine
// Telefono: la fascia scoperta di ogni carta è fissa a 36 px (CSS .is-mobile, margin-top calc(36px - 139.344%)),
// così il chip − / numero / + (4 + 28 px, bersagli da dito) non finisce sulla carta dopo.
const TOUCH_STRIP = 36;
// Telefono e tablet: pile larghe almeno TOUCH_MIN, almeno due colonne (telefono 2, iPad in verticale 4 o 5).
const TOUCH_MIN = 170;
const pileHeight = (n, w, strip = w * (680 / 488 - 1.253)) => PILE_HEAD + (n ? (w * 680) / 488 + (n - 1) * strip : 26); // 0 carte = "No commander yet."
const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
// La riga resta dov'è (stessa zona e sezione, non comandante): lì il rilascio non cambierebbe nulla.
const stays = (r, board, section) => r.board === board && !r.commander && (section === undefined || (r.section ?? null) === section);
// Split: un elemento per copia (e cornici ricalcolate a coppie), quindi un mazzo altrui da 500 righe x 99 bloccherebbe
// la scheda. Sopra SPLIT_MAX copie (tutte le zone) si vede come Stacks, una carta per riga col numero, finché non si
// chiede di vederle tutte. Nessun mazzo vero ci arriva: Commander 100, Constructed 60 + 15; i cube sì.
const SPLIT_MAX = 300;
// Corpo dell'editor: barra (ordina, vista, raggruppa, + nuova sezione), comandante, gruppi, sideboard, maybeboard,
// poi statistiche e mano di prova sotto tutto.
// Viste: lista (righe), griglia (immagini), stack (immagini sovrapposte, si vede la riga del nome;
// le pile riempiono colonne alte quanto la pila più alta, nell'ordine dei gruppi),
// stack con ogni copia (3 copie = 3 carte impilate). Le carte oltre il limite di copie del formato
// hanno un avviso, più un riepilogo in alto.
// Selezione come le carte in stampa (click = aggiungi/togli, Shift = intervallo, Esc = svuota);
// menu su click destro, Shift+F10 o pressione lunga, sulla selezione se la riga ne fa parte.
// Click sul vuoto = deseleziona; trascinando sul vuoto col mouse = selezione ad area.
// Desktop: le carte si trascinano tra gruppi del main, sezioni, sideboard e maybeboard, o sulle zone che durante il
// trascinamento compaiono in basso a sinistra sopra il conteggio (senza scorrere fino al gruppo). Creare una
// sezione porta il mazzo in raggruppamento custom; da telefono si sposta tutto dal menu.
// readOnly (Community): niente menu (solo View card), trascinamento, +/- e sezioni nuove; update cambia solo la vista.
// Senza onCut (il mazzo di un altro, non una help request) niente selezione né selezione ad area: da desktop il click
// non fa nulla, da telefono il tocco seleziona quella carta e la apre (CardView, si chiude toccando fuori).
// onCut(rows) (help request, anche in sola lettura): Suggest cut nel menu e carte trascinabili verso la zona Cuts.
// tab (schede di DeckBand da desktop): 'deck' = barra e carte, 'stats' = statistiche e mano di prova; 'all' (telefono, una
// sola pagina) = le carte e sotto le statistiche, senza la mano di prova.
// onPrint(rows): Print nel menu, porta le righe scelte (anche una sola) nella stampa.
// notify(msg, kind, action): Remove e − sull'ultima copia tolgono subito, con Undo nel toast.
// View card (menu, anche in sola lettura): la carta a tutto schermo, per leggerla da telefono.
// onDilemma(cards): Dilemma nel menu, attivo solo con 2-4 carte diverse selezionate e il mazzo pubblico.
// onHelp(cards): Ask for help nel menu, le carte scelte (fino a MAX_HELP_CARDS diverse) in focus nella nuova richiesta.
// Telefono (touch): − / + della carta selezionata (una sola) in una barra sopra quella in basso, a 44 px.
// tokens: la sezione sotto il maybeboard con i token che creano le carte (DeckTokens), solo nei propri mazzi.
const NEW_SECTION = 'new-section'; // voce di Group by da telefono: apre New section, non è un raggruppamento

// onGroup(rows): To group list nel menu (anche in sola lettura), le righe scelte vanno in una lista di gruppo.
export default function DeckSections({ deck, update, touch, readOnly, tab = 'deck', onTab, onPrint, onDilemma, onHelp, onCut, inCuts, notify, tokens, onGroup }) {
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null); // { ids, x, y }
  // Anteprima accanto alla riga ({ img, back, w, x, y }) nel suo componente (HoverLayer): passare sulle righe
  // ridisegna solo lei, non tutte le righe con l'effect delle cornici (mazzi da centinaia di righe).
  const [hoverBox] = useState(hoverStore);
  const setHover = hoverBox.set;
  // Carte a due facce: id riga → mezzi giri fatti. Ogni click aggiunge 180° (rotateY), così la carta gira
  // sempre nello stesso verso; dispari = retro. Solo su questo schermo, non si salva.
  const [flipped, setFlipped] = useState(() => new Map());
  const flip = (id) => setFlipped((prev) => new Map(prev).set(id, (prev.get(id) || 0) + 1));
  // Vista e ordine: quelli scelti in questo mazzo (Settings, deckViews per id del mazzo), sennò i default di Settings;
  // i menu View by e Sort by li cambiano solo per questo mazzo. Anteprima e densità: solo da Settings.
  const settings = useSettings();
  const own = settings.deckViews[deck.id] || {};
  const view = [own.view, settings.deckView].find((v) => VIEWS.some((x) => x.id === v)) || 'stacks';
  const sort = [own.sort, settings.deckSort].find((v) => SORT_MODES.some((x) => x.id === v)) || 'name';
  const setView = (v) => deck.id && setDeckView(deck.id, { view: v });
  const setSort = (v) => deck.id && setDeckView(deck.id, { sort: v });
  const previewW = PREVIEW[settings.preview] ?? PREVIEW.medium;
  const [allCopies, setAllCopies] = useState(false); // Split oltre SPLIT_MAX copie, chiesto da chi guarda
  const [dialog, setDialog] = useState(null); // { id?, name?, moveIds? } nuova sezione o rinomina
  const [edition, setEdition] = useState(null); // { ids, name, current } righe a cui cambiare edizione
  const [viewing, setViewing] = useState(null); // carta aperta con View card
  const [dropKey, setDropKey] = useState(null);
  // Trascinamento in corso nell'editor: { ids, host, x }. Il maybeboard vuoto accetta il rilascio e in basso, al centro
  // dell'area del mazzo (x = il centro di .deck-sections dentro host = .deck-editor), compaiono le zone dove spostare
  // le carte e quella che le toglie.
  const [dragging, setDragging] = useState(null);
  const dragIds = useRef(null); // { ids, one } durante un trascinamento; one = una copia sola (Alt, o una copia in Stacks (all))
  // Carta con più copie rilasciata: quante spostarne ({ row, board, section }) o toglierne ({ row, remove: true }).
  const [ask, setAsk] = useState(null);
  const [marquee, setMarquee] = useState(null); // rettangolo della selezione ad area, relativo al contenitore
  const marqueeRef = useRef(null); // { x0, y0, base: Set, active }
  const swallowClick = useRef(false); // il click che chiude un'area non deve deselezionare
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);
  const custom = deck.groupBy === 'custom';
  const copies = sum(deck.cards);
  const capped = view === 'split' && copies > SPLIT_MAX && !allCopies;
  const split = view === 'split' && !capped;
  const layout = view === 'split' ? 'stacks' : view; // classi CSS: lo split è uno stack (anche oltre SPLIT_MAX)
  const over = useMemo(() => overLimit(deck), [deck]);
  const overBy = useMemo(() => new Map(over.map((e) => [e.oid, e])), [over]);
  // Avvisi solo dove le carte contano: main e (fuori da Commander) sideboard.
  const counts = (r) => r.board === 'main' || (r.board === 'side' && deck.format !== 'commander');
  const warnOf = (r) => (counts(r) ? overBy.get(r.card.oid) : undefined);
  const banOf = (r) => (counts(r) ? illegalIn(deck.format, r.card) : null);
  // Controlli del formato (mai bloccanti): chip sopra le carte, il click seleziona le carte coinvolte.
  const issues = useMemo(() => validateDeck(deck), [deck]);
  // Chip dei controlli e barre dei grafici: seleziona quelle carte e porta in vista la prima. Dai grafici
  // (scheda Stats) torna prima a Deck: lo scorrimento aspetta il render delle carte.
  const pick = (ids) => {
    setSel(new Set(ids));
    onTab?.('deck');
    // CSS.escape: gli id delle righe di un mazzo altrui sono testo libero (una " romperebbe il selettore).
    setTimeout(() => document.querySelector(`.deck-row[data-row-id="${CSS.escape(ids[0])}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  // Larghezza utile dell'area del mazzo (senza padding): decide quanto si allargano le pile.
  const rootRef = useRef(null);
  const [areaW, setAreaW] = useState(0);
  const hasCards = deck.cards.length > 0;
  useEffect(() => {
    if (!rootRef.current) return undefined;
    const ro = new ResizeObserver(([e]) => setAreaW(e.contentRect.width));
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [hasCards]);

  // Cornice (CardFrame) solo sulla parte scoperta: negli stack e nella griglia sovrapposta la carta dopo,
  // nella stessa colonna, copre il resto. --frame-h = altezza scoperta, ricalcolata dopo ogni render: il CSS
  // taglia lì il contorno, che finisce dove comincia la carta sopra (niente lato in basso).
  // Confronto a coppie (O(n²), n ≤ 500 righe); una mappa per colonna se mai rallenta.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || view === 'list') return;
    const lis = [...root.querySelectorAll('.deck-rows .deck-row')];
    const pos = lis.map((li) => [li.offsetLeft, li.offsetTop, li.offsetHeight]);
    lis.forEach((li, i) => {
      const [x, y, h] = pos[i];
      let bottom = y + h;
      for (const [x2, y2] of pos) if (Math.abs(x2 - x) < 1 && y2 > y + 1 && y2 < bottom) bottom = y2;
      li.style.setProperty('--frame-h', bottom < y + h ? `${bottom - y}px` : '');
    });
  });

  const blocks = useMemo(() => {
    const cmd = commanderRows(deck);
    const side = boardRows(deck, 'side', sort);
    const maybe = boardRows(deck, 'maybe', sort);
    return {
      commander: cmd.length || deck.format === 'commander' ? { key: 'commander', label: 'Commander', rows: cmd } : null,
      groups: groupMain(deck, sort),
      side: side.length || deck.format !== 'commander' ? { key: 'side', label: 'Sideboard', rows: side } : null,
      maybe: { key: 'maybe', label: 'Maybeboard', rows: maybe },
    };
  }, [deck, sort]);
  const order = useMemo(() => [
    ...(blocks.commander?.rows || []), ...blocks.groups.flatMap((g) => g.rows), ...(blocks.side?.rows || []), ...blocks.maybe.rows,
  ].map((r) => r.id), [blocks]);
  const selected = order.filter((id) => sel.has(id)); // righe ancora esistenti
  // Righe che possono stare in una sezione custom: main board, non comandanti.
  const sectionable = useMemo(() => new Set(blocks.groups.flatMap((g) => g.rows.map((r) => r.id))), [blocks]);


  const noSelect = readOnly && !onCut;
  const onRowClick = (e, id) => {
    if (press.consumed()) return;
    if (noSelect) {
      const r = touch && deck.cards.find((x) => x.id === id);
      if (r) { setSel(new Set([id])); setViewing(r.card); }
      return;
    }
    if (e.shiftKey && anchor && anchor !== id) {
      const a = order.indexOf(anchor);
      const b = order.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSel((prev) => new Set([...prev, ...order.slice(lo, hi + 1)]));
        setAnchor(id);
        return;
      }
    }
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setAnchor(id);
  };

  const openMenu = (id, x, y) => {
    const inSel = sel.has(id);
    if (!inSel && !noSelect) { setSel(new Set([id])); setAnchor(id); }
    setHover(null);
    setMenu({ ids: inSel && selected.length > 1 ? selected : [id], x, y });
  };

  // Tolte subito, con Undo nel toast: le righe tornano com'erano (zona, sezione, comandante, quantità).
  // n: copie tolte per riga (la zona Remove); le righe con più di n copie restano con le altre.
  const removeWithUndo = (rows, n) => {
    if (!rows.length) return;
    const gone = rows.filter((r) => !n || r.qty <= n);
    const fewer = rows.filter((r) => n && r.qty > n);
    const ids = gone.map((r) => r.id);
    update((d) => fewer.reduce((x, r) => bumpQty(x, r.id, -n), removeRows(d, ids)));
    setSel((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    const k = rows.reduce((s, r) => s + Math.min(n || r.qty, r.qty), 0);
    notify?.(rows.length > 1 ? `Removed ${k} cards` : `Removed ${gone.length ? '' : `${k} `}${rows[0].card.name}`, 'success', {
      label: 'Undo',
      onClick: () => update((d) => fewer.reduce((x, r) => bumpQty(x, r.id, n),
        { ...d, cards: [...d.cards, ...gone.filter((r) => !d.cards.some((x) => x.id === r.id))] })),
    });
  };
  const less = (r) => (r.qty > 1 ? update((d) => bumpQty(d, r.id, -1)) : removeWithUndo([r]));
  const canAdd = (r) => deck.format !== 'commander' || maxCopies('commander', r.card) > 1; // Commander: + solo dove il limite lo consente

  const menuRows = menu ? deck.cards.filter((r) => menu.ids.includes(r.id)) : [];
  const items = [];
  if (menuRows.length === 1) items.push({ key: 'view', Icon: IconEye, label: 'View card', run: () => setViewing(menuRows[0].card) });
  // Help request (anche in sola lettura, e su telefono al posto del trascinamento): le carte vanno nella zona Cuts.
  if (onCut && menuRows.length) {
    items.push({ key: 'cut', Icon: IconMinus, label: menuRows.length > 1 ? `Suggest cutting ${menuRows.length} cards` : 'Suggest cut', run: () => onCut(menuRows) });
  }
  if (onGroup && menuRows.length) items.push({ key: 'group', Icon: IconUsers, label: 'To group list', run: () => onGroup(menuRows) });
  if (menuRows.length && !readOnly) {
    const ids = menuRows.map((r) => r.id);
    if (onPrint) items.push({ key: 'print', Icon: IconPrinter, label: 'Print', run: () => onPrint(menuRows) });
    if (onDilemma) {
      const fits = menuRows.length >= 2 && menuRows.length <= MAX_DILEMMA_CARDS;
      const distinct = new Set(menuRows.map((r) => r.card.oid)).size === menuRows.length;
      items.push({
        key: 'dilemma', Icon: IconScale, label: 'Dilemma', disabled: !fits || !distinct || !deck.public,
        note: !fits ? `Select 2 to ${MAX_DILEMMA_CARDS} cards` : !distinct ? 'Pick different cards' : 'Make the deck public first',
        run: () => onDilemma(menuRows.map((r) => r.card)),
      });
    }
    if (onHelp) {
      const focus = [...new Map(menuRows.map((r) => [r.card.oid, r.card])).values()];
      items.push({
        key: 'help', Icon: IconLifebuoy, label: 'Ask for help', disabled: focus.length > MAX_HELP_CARDS || !deck.public,
        note: !deck.public ? 'Make the deck public first' : `Select up to ${MAX_HELP_CARDS} cards`,
        run: () => onHelp(focus),
      });
    }
    const allMain = menuRows.every((r) => r.board === 'main');
    const allCmd = menuRows.every((r) => r.commander);
    // Change edition su righe della stessa carta; Split row su una riga con più copie.
    if (menuRows.every((r) => r.card.oid === menuRows[0].card.oid)) {
      items.push({ key: 'ed', Icon: IconImage, label: 'Change edition', run: () => setEdition({ ids, name: menuRows[0].card.name, current: menuRows.length === 1 ? menuRows[0].card : null }) });
    }
    if (menuRows.length === 1 && menuRows[0].qty > 1) {
      items.push({ key: 'split', Icon: IconCopy, label: 'Split row', run: () => update((d) => splitRow(d, ids[0])) });
    }
    // Al massimo 2 comandanti in tutto: "Set" solo se con quelli già presenti non si supera 2;
    // "Remove" su qualsiasi gruppo di comandanti.
    const cmdAfter = commanderRows(deck).length + menuRows.filter((r) => !r.commander).length;
    if (deck.format === 'commander' && allMain && (allCmd || cmdAfter <= 2)) {
      items.push({ key: 'cmd', Icon: IconCrown, label: allCmd ? 'Remove as commander' : 'Set as commander', run: () => update((d) => setCommander(d, ids, !allCmd)) });
    }
    if (ids.every((id) => sectionable.has(id))) {
      for (const g of custom ? blocks.groups : []) {
        if (menuRows.every((r) => (r.section ?? null) === g.section)) continue;
        items.push({ key: `sec-${g.key}`, Icon: IconList, label: `Move to “${g.label}”`, run: () => update((d) => moveToSection(d, ids, g.section)) });
      }
      items.push({ key: 'sec-new', Icon: IconPlus, label: 'Move to a new section…', run: () => setDialog({ moveIds: ids }) });
    }
    for (const b of ['main', 'side', 'maybe']) {
      if (menuRows.every((r) => r.board === b)) continue;
      if (b === 'side' && deck.format === 'commander') continue; // niente sideboard in Commander
      items.push({ key: b, Icon: IconList, label: `Move to ${BOARD_LABEL[b]}`, run: () => update((d) => moveToBoard(d, ids, b)) });
    }
    items.push({
      key: 'rm', Icon: IconTrash, label: ids.length > 1 ? `Remove ${ids.length} cards` : 'Remove', danger: true,
      run: () => removeWithUndo(menuRows),
    });
  }

  // Anteprima (desktop, ogni vista): accanto alla riga (previewAt).
  const showPreview = (e, r) => {
    if (touch || !previewW || !r.card.img || dragIds.current) return;
    setHover(previewAt(e.currentTarget.getBoundingClientRect(), r.card, previewW));
  };

  // Spazio vuoto (non carte, barra, menu o dialoghi): il click deseleziona, il trascinamento col mouse
  // disegna un'area e aggiunge le carte che tocca (come nella stampa, non toglie le altre).
  // Conta solo la parte visibile di una carta: negli stack e nella griglia (righe sovrapposte) la carta
  // successiva nella stessa colonna copre il resto.
  const onEmpty = (e) => e.currentTarget.contains(e.target)
    && !e.target.closest('.deck-row, .deck-toolbar, .deck-group-actions, .deck-issues, .deck-analysis, .deck-tokens, .modal-overlay, button, select, input, summary, a');
  const marqueeHandlers = {
    onPointerDown: (e) => {
      swallowClick.current = false; // nuovo gesto
      if (touch || noSelect || e.pointerType !== 'mouse' || e.button !== 0 || !onEmpty(e)) return;
      e.preventDefault(); // niente selezione di testo mentre si trascina
      marqueeRef.current = { x0: e.clientX, y0: e.clientY, base: new Set(selected), active: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      const m = marqueeRef.current;
      if (!m || (!m.active && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 4)) return;
      m.active = true;
      const box = e.currentTarget.getBoundingClientRect();
      const cx = Math.min(Math.max(e.clientX, box.left), box.right);
      const cy = Math.min(Math.max(e.clientY, box.top), box.bottom);
      const [x1, x2] = m.x0 < cx ? [m.x0, cx] : [cx, m.x0];
      const [y1, y2] = m.y0 < cy ? [m.y0, cy] : [cy, m.y0];
      const n = new Set(m.base);
      const rows = [...e.currentTarget.querySelectorAll('.deck-row')].map((li) => [li, li.getBoundingClientRect()]);
      rows.forEach(([li, r]) => {
        const bottom = rows.reduce((b, [, o]) => (Math.abs(o.left - r.left) < 1 && o.top > r.top + 1 ? Math.min(b, o.top) : b), r.bottom);
        if (r.left < x2 && r.right > x1 && r.top < y2 && bottom > y1) n.add(li.dataset.rowId);
      });
      setSel(n);
      setHover(null);
      setMarquee({ left: x1 - box.left, top: y1 - box.top, width: x2 - x1, height: y2 - y1 });
    },
    onPointerUp: () => {
      if (marqueeRef.current?.active) swallowClick.current = true;
      marqueeRef.current = null;
      setMarquee(null);
    },
    onPointerCancel: () => { marqueeRef.current = null; setMarquee(null); },
    onClick: (e) => {
      if (swallowClick.current) { swallowClick.current = false; return; }
      if (onEmpty(e) && sel.size) setSel(new Set());
    },
  };

  // Trascinamento (desktop): la riga, o tutta la selezione se ne fa parte; con Alt una copia per riga. In Stacks (all)
  // ogni copia è una carta: presa da sola (non in una selezione di più righe) si sposta solo quella.
  const endDrag = () => { dragIds.current = null; setDropKey(null); setDragging(null); };
  // Sola lettura con onCut: si trascina solo verso fuori (DRAG_ROWS, la zona Cuts delle help request), qui niente rilascio.
  const dragProps = (r) => (touch || (readOnly && !onCut) ? {} : {
    draggable: true,
    onDragStart: (e) => {
      const ids = sel.has(r.id) && selected.length > 1 ? selected : [r.id];
      const one = e.altKey || (split && ids.length === 1);
      dragIds.current = { ids, one };
      e.dataTransfer.effectAllowed = readOnly ? 'copy' : 'move';
      e.dataTransfer.setData('text/plain', r.card.name);
      e.dataTransfer.setData(DRAG_ROWS, JSON.stringify(ids));
      // Viste a immagini: il fantasma è solo la carta (il riquadro della riga nello stack cattura
      // anche le carte sovrapposte), con il numero di copie spostate se più di una.
      const img = view !== 'list' && e.currentTarget.querySelector('img');
      if (img) {
        const rows = deck.cards.filter((x) => ids.includes(x.id));
        const n = one ? rows.length : sum(rows);
        const g = document.createElement('div');
        g.className = 'deck-ghost';
        g.append(img.cloneNode());
        if (n > 1) g.append(Object.assign(document.createElement('span'), { textContent: n }));
        document.body.append(g);
        e.dataTransfer.setDragImage(g, 70, 24);
        setTimeout(() => g.remove(), 0);
      }
      setHover(null);
      if (!readOnly) { // zone di rilascio: solo nell'editor, centrate sull'area del mazzo (quella della selezione)
        const host = e.currentTarget.closest('.deck-editor');
        const area = rootRef.current?.getBoundingClientRect();
        const x = host && area ? area.left - host.getBoundingClientRect().left + area.width / 2 : 0;
        setDragging({ ids, host, x });
      }
    },
    onDragEnd: endDrag,
  });
  // Rilascio su un gruppo del main (con la sua sezione in custom), sul sideboard o sul maybeboard; act = cosa fare
  // al posto dello spostamento (la zona Remove). endDrag anche qui: la riga spostata può smontarsi prima del suo dragend.
  // Una sola riga con più copie (senza Alt, fuori da Stacks (all)) che cambia posto: prima chiede quante (CopiesDialog).
  const dropProps = (key, board, section, act) => (touch || readOnly ? {} : {
    onDragOver: (e) => { if (!dragIds.current) return; e.preventDefault(); setDropKey(key); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey((k) => (k === key ? null : k)); },
    onDrop: (e) => {
      e.preventDefault();
      const drag = dragIds.current;
      endDrag();
      if (!drag) return;
      if (act) return act(drag);
      const r = !drag.one && drag.ids.length === 1 && deck.cards.find((x) => x.id === drag.ids[0]);
      if (r && r.qty > 1 && !stays(r, board, section)) setAsk({ row: r, board, section });
      else update((d) => placeRows(d, drag.ids, board, section, { n: drag.one ? 1 : undefined }));
    },
  });
  const placeLabel = (board, section) => (section ? `“${deck.sections.find((s) => s.id === section)?.name || 'Section'}”` : `the ${BOARD_LABEL[board]}`);
  // Zona Remove, come lo spostamento: una sola riga con più copie chiede quante; Alt e Stacks (all) una per riga.
  const removeDrag = (drag) => {
    const rows = deck.cards.filter((r) => drag.ids.includes(r.id));
    if (!drag.one && rows.length === 1 && rows[0].qty > 1) setAsk({ row: rows[0], remove: true });
    else removeWithUndo(rows, drag.one ? 1 : undefined);
  };

  // copy = indice della copia nella vista split (ogni copia è una carta, tutte agiscono sulla riga).
  const row = (r, copy = 0) => {
    const warn = warnOf(r);
    const warnText = warn && `${warn.count} copies, max ${warn.max} in ${formatLabel(deck.format)}`;
    const ban = banOf(r);
    const banText = ban && legalityLabel(ban, deck.format);
    const gc = deck.format === 'commander' && r.card.gc; // game changer, solo nei mazzi Commander
    const turns = (r.card.back && flipped.get(r.id)) || 0;
    const cutHere = inCuts?.has(r.card.oid); // già nei Cuts della risposta: la cornice della selezione, fissa
    return (
      <li key={copy ? `${r.id}:${copy}` : r.id} data-row-id={r.id} className={`deck-row${sel.has(r.id) ? ' selected' : ''}${cutHere ? ' marked' : ''}${warn ? ' over' : ''}`} {...dragProps(r)}
        onMouseEnter={touch ? undefined : (e) => showPreview(e, r)} onMouseLeave={touch ? undefined : () => setHover(null)}>
        <button type="button" className="deck-row-main" aria-pressed={sel.has(r.id)}
          aria-label={view === 'list' ? undefined : `${split ? `${r.card.name}, copy ${copy + 1} of ${r.qty}` : `${r.qty} ${r.card.name}`}${ban ? `, ${banText}` : ''}${warn ? `, ${warnText}` : ''}${gc ? ', game changer' : ''}${cutHere ? ', in Cuts' : ''}`}
          onClick={(e) => onRowClick(e, r.id)}
          onContextMenu={(e) => { e.preventDefault(); const p = menuPoint(e); openMenu(r.id, p.x, p.y); }}
          onKeyDown={(e) => {
            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
              e.preventDefault();
              const rc = e.currentTarget.getBoundingClientRect();
              openMenu(r.id, rc.left + 24, rc.bottom);
            }
          }}
          {...press.bind((x, y) => openMenu(r.id, x, y))}>
          {view === 'list' ? (
            <>
              <span className="deck-qty">{r.qty}</span>
              <span className="deck-name-cell">{r.card.name}{cutHere && <span className="sr-only">, in Cuts</span>}</span>
              {ban && <span className="deck-ban-icon" title={banText}><IconBan size={13} /><span className="sr-only">{banText}</span></span>}
            {warn && <span className="deck-warn-icon" title={warnText}><IconAlert size={13} /><span className="sr-only">{warnText}</span></span>}
              {gc && <span className="deck-gc-icon" title="Game changer"><IconZap size={13} /><span className="sr-only">Game changer</span></span>}
              <ManaCost cost={r.card.mana} />
              <span className="deck-set">{r.card.set.toUpperCase()}</span>
            </>
          ) : (
            <>
              {/* Due facce: fronte e retro dorso a dorso in .deck-card-flipper, che ruota di turns × 180°. */}
              {r.card.img && r.card.back ? (
                <span className="deck-card-flipper" style={{ transform: `perspective(1000px) rotateY(${turns * 180}deg)` }}>
                  <CardImg card={r.card} />
                  <CardImg card={r.card} side={1} className="deck-card-backface" />
                </span>
              ) : r.card.img ? <CardImg card={r.card} /> : <span className="deck-card-ph">{r.card.name}</span>}
              {(ban || warn || gc) && (
              <span className="deck-card-flags">
                {ban && <span className="deck-card-ban" title={banText}><IconBan size={13} /></span>}
                {warn && <span className="deck-card-warn" title={warnText}><IconAlert size={12} /></span>}
                {gc && <span className="deck-card-gc" title="Game changer"><IconZap size={12} /></span>}
              </span>
            )}
            </>
          )}
        </button>
        {/* Cornice della stampa (CardFrame): contorno sfumato al 60% al passaggio, pieno e con alone sulla carta selezionata. */}
        {view !== 'list' && <CardFrame />}
        {/* Fuori dalla carta (niente pulsanti annidati), anche in sola lettura. */}
        {view !== 'list' && r.card.back && r.card.img && (
          <button type="button" className="deck-card-flip" aria-pressed={turns % 2 === 1} title="Flip"
            aria-label={`Flip ${r.card.name}`} onClick={() => flip(r.id)}><IconFlip size={13} /></button>
        )}
        {/* Immagini: copie al centro in alto, − e + ai lati al passaggio, nello stesso stile (copia
            singola: solo − e +, centrati). Lista: +/- in fondo alla riga, il numero è nella colonna. */}
        {(!readOnly || (view !== 'list' && r.qty > 1 && !split)) && (
          <span className="deck-row-qty">
            {!readOnly && <button type="button" aria-label={`One less ${r.card.name}`} title={`One less ${r.card.name}`} onClick={() => less(r)}><IconMinus size={13} /></button>}
            {view !== 'list' && r.qty > 1 && !split && <span className="deck-card-qty" aria-hidden="true">{r.qty}</span>}
            {!readOnly && canAdd(r) && <button type="button" aria-label={`One more ${r.card.name}`} title={`One more ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, 1))}><IconPlus size={13} /></button>}
          </span>
        )}
      </li>
    );
  };
  const cards = (rows) => (split ? rows.flatMap((r) => Array.from({ length: r.qty }, (_, i) => row(r, i))) : rows.map((r) => row(r)));
  // Niente istruzioni nella pagina: stanno nel ? dell'header (DeckHelp).
  const empty = (g) => (g.key === 'commander' ? 'No commander yet.' : 'No cards yet.');
  // drop = [zona, sezione] per accettare il rilascio delle carte trascinate.
  const group = (g, extraClass = '', drop) => (
    <section key={g.key} className={`deck-group ${extraClass}${dropKey === g.key ? ' drop-target' : ''}`} aria-label={g.label} {...(drop && dropProps(g.key, ...drop))}>
      <h3 className="deck-group-head">
        <span className="deck-group-name">{g.label}</span> <span className="n">{sum(g.rows)}</span>
        {g.section && !readOnly && (
          <span className="deck-group-actions">
            <button type="button" aria-label={`Rename ${g.label}`} title={`Rename ${g.label}`} onClick={() => setDialog({ id: g.section, name: g.label })}><IconPencil size={13} /></button>
            <button type="button" aria-label={`Delete section ${g.label}`} title={`Delete section ${g.label}`} onClick={() => update((d) => deleteSection(d, g.section))}><IconTrash size={13} /></button>
          </span>
        )}
      </h3>
      {g.rows.length ? <ul className={`deck-rows view-${layout}`}>{cards(g.rows)}</ul> : <p className="deck-empty">{empty(g)}</p>}
    </section>
  );

  // Zone del trascinamento: Main (in custom le sue sezioni), Sideboard dove c'è, Maybeboard; spenta (from) quella da
  // cui vengono tutte le carte trascinate, dove il rilascio non cambierebbe nulla (il comandante sul Main invece
  // smette di esserlo, quindi lì resta attiva). section undefined = la riga tiene la sua sezione.
  const dragRows = dragging ? deck.cards.filter((r) => dragging.ids.includes(r.id)) : [];
  const zones = !dragging ? [] : [
    ...(custom
      ? blocks.groups.map((g) => ({ key: `zone-${g.key}`, label: g.section ? g.label : 'Main', board: 'main', section: g.section, n: g.count }))
      : [{ key: 'zone-main', label: 'Main', board: 'main', section: undefined, n: sum(deck.cards.filter((r) => r.board === 'main')) }]),
    ...(blocks.side ? [{ key: 'zone-side', label: 'Sideboard', board: 'side', section: undefined, n: sum(blocks.side.rows) }] : []),
    { key: 'zone-maybe', label: 'Maybeboard', board: 'maybe', section: undefined, n: sum(blocks.maybe.rows) },
  ].map((z) => ({
    ...z,
    from: dragRows.length > 0 && dragRows.every((r) => stays(r, z.board, z.section)),
  }));

  if (!deck.cards.length) {
    return <p className="deck-empty deck-empty-big">No cards yet.</p>;
  }
  // Stack: comandante, gruppi e sideboard sono pile (argomenti di group) impacchettate in colonne.
  const piles = layout === 'stacks' ? [
    blocks.commander && [blocks.commander, 'deck-block'],
    ...blocks.groups.map((g) => [g, '', ['main', g.section]]),
    blocks.side && [blocks.side, 'deck-block', ['side']],
  ].filter(Boolean) : [];
  const pileN = piles.map(([g]) => (split ? sum(g.rows) : g.rows.length));
  const pack = (w) => packPiles(pileN.map((n) => pileHeight(n, w)), STACK_GAP);
  // Colonne contate a 200 px, poi pile allargate fino a riempire l'area (impacchettate di nuovo).
  // Touch (telefono, tablet in verticale): tante colonne quante ne stanno da TOUCH_MIN (almeno 2), pile in ordine
  // divise in colonne contigue con la più alta il più bassa possibile (splitPiles).
  const n0 = pack(STACK_MIN).length || 1;
  const touchCols = Math.max(2, Math.floor((areaW + COL_GAP) / (TOUCH_MIN + COL_GAP)));
  const stackW = touch ? Math.max(100, Math.floor((areaW - (touchCols - 1) * COL_GAP) / touchCols))
    : Math.max(STACK_MIN, Math.min(STACK_MAX, Math.floor((areaW - (n0 - 1) * COL_GAP) / n0)));
  const stackCols = touch ? splitPiles(pileN.map((n) => pileHeight(n, stackW, TOUCH_STRIP) + STACK_GAP), touchCols) : pack(stackW);
  return (
    <div className={`deck-sections ${tab === 'stats' ? 'tab-stats' : `view-${layout}`}${settings.density === 'compact' ? ' density-compact' : ''}`} ref={rootRef} {...marqueeHandlers}
      onKeyDown={(e) => { if (e.key === 'Escape' && sel.size && !menu) { e.stopPropagation(); setSel(new Set()); } }}>
      {marquee && <div className="marquee" style={marquee} aria-hidden="true" />}
      {tab !== 'stats' && <>
      {view !== 'list' && <CardFrameDefs />}
      <div className="deck-toolbar">
        <label className="deck-tool">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="deck-tool">
          <span>View by</span>
          <select value={view} onChange={(e) => { setView(e.target.value); setHover(null); }}>
            {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <label className="deck-tool">
          <span>Group by</span>
          {/* Da telefono New section è l'ultima voce di Group by (la tendina resta sul raggruppamento attuale); da desktop il +. */}
          <select value={deck.groupBy} onChange={(e) => (e.target.value === NEW_SECTION ? setDialog({}) : update((d) => ({ ...d, groupBy: e.target.value })))}>
            {GROUP_MODES.filter((m) => m.id !== 'custom' || custom || deck.sections.length).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            {touch && !readOnly && <option value={NEW_SECTION}>New section…</option>}
          </select>
        </label>
        {!readOnly && !touch && <button type="button" className="btn-secondary deck-new-section" aria-label="New section" title="New section" onClick={() => setDialog({})}><IconPlus size={16} /></button>}
      </div>
      {issues.length > 0 && (
        <ul className="deck-issues" aria-label={`${formatLabel(deck.format)} checks`}>
          {issues.map((it) => (
            <li key={it.key}>
              <button type="button" className={`deck-issue ${it.level}`} disabled={!it.ids.length}
                title={it.ids.length ? 'Select these cards' : undefined} onClick={() => pick(it.ids)}>
                {it.level === 'error' ? <IconBan size={14} /> : <IconAlert size={14} />}
                <span>{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {capped && (
        <p className="deck-split-cap" role="status">
          <IconCopy size={14} />
          <span>{copies} cards: above {SPLIT_MAX}, Stacks (all) shows each card once with its count.</span>
          <button type="button" className="btn-secondary deck-icon-btn" aria-label={`Show all ${copies} copies`} title={`Show all ${copies} copies (slow on big lists)`}
            onClick={() => setAllCopies(true)}><IconEye size={16} /></button>
        </p>
      )}
      {/* Negli stack comandante e sideboard sono pile come le altre: il mazzo è un unico blocco centrato. */}
      {blocks.commander && layout !== 'stacks' && group(blocks.commander, 'deck-block')}
      <div className={`deck-columns view-${layout}`} style={layout === 'stacks' ? { '--stack-w': `${stackW}px` } : undefined}>
        {layout === 'stacks'
          ? stackCols.map((ids) => <div key={piles[ids[0]][0].key} className="deck-stack-col">{ids.map((i) => group(...piles[i]))}</div>)
          : blocks.groups.map((g) => group(g, '', ['main', g.section]))}
      </div>
      {blocks.side && layout !== 'stacks' && group(blocks.side, 'deck-block', ['side'])}
      {(blocks.maybe.rows.length > 0 || dragging) && (
        <details className={`deck-maybe${dropKey === 'maybe' ? ' drop-target' : ''}`} {...dropProps('maybe', 'maybe')}>
          <summary className="deck-group-head">Maybeboard <span className="n">{sum(blocks.maybe.rows)}</span></summary>
          <ul className={`deck-rows view-${layout}`}>{cards(blocks.maybe.rows)}</ul>
        </details>
      )}
      {tokens}
      </>}
      {/* Scheda Stats: statistiche e mano di prova; da telefono sotto le carte, solo le statistiche. */}
      {tab !== 'deck' && <div className="deck-analysis">
        <section aria-labelledby="deck-stats-head">
          <h3 className="deck-analysis-head" id="deck-stats-head">Stats</h3>
          {/* Un dato strano in un mazzo altrui spegne solo le statistiche, non tutta la pagina. */}
          <ErrorBoundary fallback={<p className="field-hint">Stats could not be computed for this deck.</p>}>
            <DeckStats deck={deck} onSelect={pick} />
          </ErrorBoundary>
        </section>
        {/* Analisi delle terre: in Community gli override cambiano solo la vista (update locale). */}
        <section aria-labelledby="deck-lands-head">
          <h3 className="deck-analysis-head" id="deck-lands-head">Land analysis</h3>
          <ErrorBoundary fallback={<p className="field-hint">The land analysis could not be computed for this deck.</p>}>
            <LandPanel deck={deck} update={update} />
          </ErrorBoundary>
        </section>
        {/* La mano di prova solo da desktop: da telefono non è pratica (scelta dell'utente). */}
        {tab === 'stats' && (
          <section aria-labelledby="deck-hand-head">
            <h3 className="deck-analysis-head" id="deck-hand-head">Sample hand</h3>
            <SampleHand deck={deck} />
          </section>
        )}
      </div>}
      {/* Solo per il trascinamento col mouse (da tastiera e telefono si sposta dal menu): fuori dagli screen reader. */}
      {/* Remove toglie le carte trascinate (le copie scelte, come lo spostamento), con Undo nel toast come dal menu. */}
      {dragging?.host && zones.length > 0 && createPortal(
        <div className="deck-drop-zones" style={{ left: dragging.x }} aria-hidden="true">
          <span className="deck-drop-title">Move to</span>
          <div className="deck-drop-row">
            {zones.map((z) => (
              <div key={z.key} data-zone={z.key} className={`deck-drop-zone${z.from ? ' from' : dropKey === z.key ? ' drop-target' : ''}`}
                {...(z.from ? {} : dropProps(z.key, z.board, z.section))}>
                {z.label} <span className="n">{z.n}</span>
              </div>
            ))}
            {/* To group list: le righe trascinate (una copia con Alt) vanno alla scelta della lista; il mazzo non cambia. */}
            {onGroup && (
              <div data-zone="zone-group" className={`deck-drop-zone group${dropKey === 'zone-group' ? ' drop-target' : ''}`}
                {...dropProps('zone-group', null, undefined, (drag) => onGroup(deck.cards.filter((r) => drag.ids.includes(r.id)).map((r) => (drag.one ? { ...r, qty: 1 } : r))))}>
                <IconUsers size={14} /> To group list
              </div>
            )}
            <div data-zone="zone-remove" className={`deck-drop-zone remove${dropKey === 'zone-remove' ? ' drop-target' : ''}`}
              {...dropProps('zone-remove', null, undefined, removeDrag)}>
              <IconTrash size={14} /> Remove
            </div>
          </div>
        </div>,
        dragging.host,
      )}
      {menu && items.length > 0 && (
        <CardMenu x={menu.x} y={menu.y} title={menuRows.length === 1 ? menuRows[0].card.name : `${menuRows.length} cards selected`} items={items} onClose={closeMenu} />
      )}
      {dialog && (
        <NameFormatDialog title={dialog.id ? 'Rename section' : 'New section'} confirmLabel={dialog.id ? 'Rename' : 'Create'}
          initialName={dialog.name || ''} showFormat={false} placeholder="Ramp" maxLength={40} onClose={() => setDialog(null)}
          onSubmit={({ name }) => {
            update((d) => {
              if (dialog.id) return renameSection(d, dialog.id, name);
              const r = addSection(d, name);
              return dialog.moveIds ? moveToSection(r.deck, dialog.moveIds, r.id) : r.deck;
            });
            setDialog(null);
          }} />
      )}
      {ask && (
        <CopiesDialog qty={ask.row.qty} onClose={() => setAsk(null)} {...(ask.remove ? {
          title: 'Remove copies', action: 'Remove', question: `How many ${ask.row.card.name} to remove? There are ${ask.row.qty}.`,
        } : {
          title: 'Move copies', action: 'Move', question: `How many ${ask.row.card.name} go to ${placeLabel(ask.board, ask.section)}? There are ${ask.row.qty}.`,
        })} onPick={(n) => {
          if (ask.remove) removeWithUndo([ask.row], n);
          else update((d) => placeRows(d, [ask.row.id], ask.board, ask.section, { n }));
          setAsk(null);
        }} />
      )}
      {edition && (
        <ArtPickerModal name={edition.name} current={edition.current} onClose={() => setEdition(null)}
          title={`Change edition, ${edition.name}${edition.ids.length > 1 ? ` (${edition.ids.length} rows)` : ''}`}
          onPickPrint={async (p) => {
            const c = (await cardsByIds([p.id])).get(p.id);
            if (!c) throw new Error('This print was not found on Scryfall.');
            const snap = snapshotFromCard(c);
            update((d) => changeEdition(d, edition.ids, snap));
            setEdition(null);
          }} />
      )}
      {viewing && <CardView card={viewing} onClose={() => { setViewing(null); if (noSelect) setSel(new Set()); }} />}
      {/* Telefono: − / + della carta selezionata, grandi, sopra la barra in basso (sulla carta non
          stanno a 44 px nella fascia scoperta degli stack). */}
      {touch && !readOnly && view !== 'list' && tab !== 'stats' && selected.length === 1 && (() => {
        const r = deck.cards.find((x) => x.id === selected[0]);
        return r && createPortal(
          <div className="deck-sel-bar" role="group" aria-label={`${r.card.name}, ${r.qty} ${r.qty === 1 ? 'copy' : 'copies'}`}>
            <button type="button" className="btn-secondary deck-icon-btn" aria-label={`One less ${r.card.name}`} title="One less" onClick={() => less(r)}><IconMinus size={20} /></button>
            <span className="deck-sel-qty" aria-hidden="true">{r.qty}</span>
            {canAdd(r) && <button type="button" className="btn-secondary deck-icon-btn" aria-label={`One more ${r.card.name}`} title="One more" onClick={() => update((d) => bumpQty(d, r.id, 1))}><IconPlus size={20} /></button>}
          </div>, document.body);
      })()}
      <HoverLayer store={hoverBox} />
    </div>
  );
}

// View card (e lo zoom della ricerca avanzata): la carta a tutto schermo, versione large di Scryfall nella
// lingua di Settings, le due facce si girano con Flip. Chiude con ✕, Esc, il back del sistema o un tocco fuori.
export function CardView({ card, onClose }) {
  const [side, setSide] = useState(0);
  const ref = useOverlayDismiss(onClose);
  const src = useCardImg(card, side).replace('/normal/', '/large/');
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="card-zoom-wrap" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={card.name} onClick={(e) => e.stopPropagation()}>
        <img src={src} className="card-zoom" alt={side ? `${card.name}, back` : card.name} />
        <button type="button" className="modal-close card-zoom-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={20} /></button>
        {card.back && (
          <button type="button" className="btn-secondary deck-icon-btn card-zoom-flip" onClick={() => setSide((s) => 1 - s)}
            aria-label={`Flip ${card.name}`} title="Flip"><IconFlip size={20} /></button>
        )}
      </div>
    </div>,
    document.body,
  );
}
