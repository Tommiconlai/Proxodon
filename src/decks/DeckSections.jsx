import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import { useLongPress } from '../hooks/useLongPress';
import { ManaCost } from './Mana';
import { NameFormatDialog } from './dialogs';
import ArtPickerModal from '../components/ArtPickerModal';
import { cardsByIds } from './scryfallSearch';
import {
  GROUP_MODES, SORT_MODES, groupMain, commanderRows, boardRows, bumpQty, removeRows, setCommander, moveToBoard,
  addSection, renameSection, deleteSection, moveToSection, placeRows, overLimit, formatLabel, illegalIn, legalityLabel,
  splitRow, changeEdition, snapshotFromCard, validateDeck, packPiles,
} from './deckModel';
import DeckStats from './DeckStats';
import SampleHand from './SampleHand';
import { IconPlus, IconMinus, IconTrash, IconCrown, IconList, IconPencil, IconAlert, IconBan, IconImage, IconCopy } from '../components/icons';

const BOARD_LABEL = { main: 'main deck', side: 'sideboard', maybe: 'maybeboard' };
const VIEWS = [
  { id: 'list', label: 'List' },
  { id: 'grid', label: 'Grid' },
  { id: 'stacks', label: 'Stacks' },
  { id: 'split', label: 'Stacks, every copy' },
];
const PREVIEW_W = 320;
const PREVIEW_H = Math.round((PREVIEW_W * 680) / 488);
// Stack: le pile si allargano (da 200 a 400 px, --stack-w) per riempire l'area del mazzo; l'altezza
// di una pila viene dal numero di carte e dalla larghezza: carta 680/488, poi la riga del nome di
// ogni carta coperta (margin-top -125.3% della larghezza).
const STACK_MIN = 200;
const STACK_MAX = 400;
const STACK_GAP = 20; // spazio verticale tra pile nella stessa colonna, = gap di .deck-stack-col
const COL_GAP = 16; // spazio tra le colonne, = gap orizzontale di .deck-columns.view-stacks
const PILE_HEAD = 34; // intestazione del gruppo con il suo margine
const pileHeight = (n, w) => PILE_HEAD + (n ? (w * 680) / 488 + (n - 1) * w * (680 / 488 - 1.253) : 26); // 0 carte = "No commander yet."
const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.bottom };
};
// Preferenza per dispositivo in localStorage (vista, ordine); storage bloccato = solo questa sessione.
function usePref(key, modes, fallback) {
  const [v, setV] = useState(() => {
    try {
      const x = localStorage.getItem(key);
      return modes.some((m) => m.id === x) ? x : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (x) => {
    setV(x);
    try { localStorage.setItem(key, x); } catch { /* storage bloccato */ }
  };
  return [v, set];
}

// Corpo dell'editor: barra (ordina, vista, raggruppa, + nuova sezione), comandante, gruppi, sideboard, maybeboard,
// poi statistiche e mano di prova sotto tutto.
// Viste: lista (righe), griglia (immagini), stack (immagini sovrapposte, si vede la riga del nome;
// le pile riempiono colonne alte quanto la pila più alta, nell'ordine dei gruppi),
// stack con ogni copia (3 copie = 3 carte impilate). Le carte oltre il limite di copie del formato
// hanno un avviso, più un riepilogo in alto.
// Selezione come le carte in stampa (click = aggiungi/togli, Shift = intervallo, Esc = svuota);
// menu su click destro, Shift+F10 o pressione lunga, sulla selezione se la riga ne fa parte.
// Click sul vuoto = deseleziona; trascinando sul vuoto col mouse = selezione ad area.
// Desktop: le carte si trascinano tra gruppi del main, sezioni, sideboard e maybeboard. Creare una
// sezione porta il mazzo in raggruppamento custom; da telefono si sposta tutto dal menu.
export default function DeckSections({ deck, update, touch }) {
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null); // { ids, x, y }
  const [hover, setHover] = useState(null); // anteprima accanto alla riga: { img, x, y }
  // Default: stack ordinati per nome (Group by Type viene da newDeck).
  const [view, setView] = usePref('ip:deckView', VIEWS, 'stacks');
  const [sort, setSort] = usePref('ip:deckSort', SORT_MODES, 'name');
  const [dialog, setDialog] = useState(null); // { id?, name?, moveIds? } nuova sezione o rinomina
  const [edition, setEdition] = useState(null); // { ids, name, current } righe a cui cambiare edizione
  const [dropKey, setDropKey] = useState(null);
  const [dragging, setDragging] = useState(false); // durante il trascinamento il maybeboard vuoto accetta il rilascio
  const dragIds = useRef(null); // { ids, one } durante un trascinamento; one = Alt, una copia sola
  const [marquee, setMarquee] = useState(null); // rettangolo della selezione ad area, relativo al contenitore
  const marqueeRef = useRef(null); // { x0, y0, base: Set, active }
  const swallowClick = useRef(false); // il click che chiude un'area non deve deselezionare
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);
  const custom = deck.groupBy === 'custom';
  const split = view === 'split';
  const layout = split ? 'stacks' : view; // classi CSS: lo split è uno stack
  const over = useMemo(() => overLimit(deck), [deck]);
  const overBy = useMemo(() => new Map(over.map((e) => [e.oid, e])), [over]);
  // Avvisi solo dove le carte contano: main e (fuori da Commander) sideboard.
  const counts = (r) => r.board === 'main' || (r.board === 'side' && deck.format !== 'commander');
  const warnOf = (r) => (counts(r) ? overBy.get(r.card.oid) : undefined);
  const banOf = (r) => (counts(r) ? illegalIn(deck.format, r.card) : null);
  // Controlli del formato (mai bloccanti): chip sopra le carte, il click seleziona le carte coinvolte.
  const issues = useMemo(() => validateDeck(deck), [deck]);
  // Chip dei controlli e barre dei grafici: seleziona quelle carte e porta in vista la prima.
  const pick = (ids) => {
    setSel(new Set(ids));
    document.querySelector(`.deck-row[data-row-id="${ids[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  // L'anteprima è fissa sullo schermo: sparisce appena qualcosa scorre.
  useEffect(() => {
    if (!hover) return undefined;
    const off = () => setHover(null);
    window.addEventListener('scroll', off, true);
    return () => window.removeEventListener('scroll', off, true);
  }, [hover]);

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


  const onRowClick = (e, id) => {
    if (press.consumed()) return;
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
    if (!inSel) { setSel(new Set([id])); setAnchor(id); }
    setHover(null);
    setMenu({ ids: inSel && selected.length > 1 ? selected : [id], x, y });
  };

  const menuRows = menu ? deck.cards.filter((r) => menu.ids.includes(r.id)) : [];
  const items = [];
  if (menuRows.length) {
    const ids = menuRows.map((r) => r.id);
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
      run: () => { update((d) => removeRows(d, ids)); setSel(new Set()); },
    });
  }

  // Anteprima (desktop, lista e stack): accanto alla riga, a destra se c'è spazio, sennò a sinistra.
  const showPreview = (e, r) => {
    if (touch || view === 'grid' || !r.card.img || dragIds.current) return;
    const rc = e.currentTarget.getBoundingClientRect();
    const x = rc.right + 12 + PREVIEW_W <= window.innerWidth ? rc.right + 12 : Math.max(8, rc.left - PREVIEW_W - 12);
    const y = Math.min(Math.max(8, rc.top + rc.height / 2 - PREVIEW_H / 2), window.innerHeight - PREVIEW_H - 8);
    setHover({ img: r.card.img, x, y });
  };

  // Spazio vuoto (non carte, barra, menu o dialoghi): il click deseleziona, il trascinamento col mouse
  // disegna un'area e aggiunge le carte che tocca (come nella stampa, non toglie le altre).
  // Nello stack di una carta conta solo la fascia visibile, fino all'inizio della successiva.
  const onEmpty = (e) => e.currentTarget.contains(e.target)
    && !e.target.closest('.deck-row, .deck-toolbar, .deck-group-actions, .deck-issues, .deck-analysis, .modal-overlay, button, select, input, summary, a');
  const marqueeHandlers = {
    onPointerDown: (e) => {
      swallowClick.current = false; // nuovo gesto
      if (touch || e.pointerType !== 'mouse' || e.button !== 0 || !onEmpty(e)) return;
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
      e.currentTarget.querySelectorAll('.deck-row').forEach((li) => {
        const r = li.getBoundingClientRect();
        const next = layout === 'stacks' && li.nextElementSibling;
        const bottom = next ? Math.min(r.bottom, next.getBoundingClientRect().top) : r.bottom;
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

  // Trascinamento (desktop): la riga, o tutta la selezione se ne fa parte; con Alt una copia per riga.
  const endDrag = () => { dragIds.current = null; setDropKey(null); setDragging(false); };
  const dragProps = (r) => (touch ? {} : {
    draggable: true,
    onDragStart: (e) => {
      const ids = sel.has(r.id) && selected.length > 1 ? selected : [r.id];
      dragIds.current = { ids, one: e.altKey };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', r.card.name);
      // Viste a immagini: il fantasma è solo la carta (il riquadro della riga nello stack cattura
      // anche le carte sovrapposte), con il numero di copie spostate se più di una.
      const img = view !== 'list' && e.currentTarget.querySelector('img');
      if (img) {
        const rows = deck.cards.filter((x) => ids.includes(x.id));
        const n = e.altKey ? rows.length : sum(rows);
        const g = document.createElement('div');
        g.className = 'deck-ghost';
        g.append(img.cloneNode());
        if (n > 1) g.append(Object.assign(document.createElement('span'), { textContent: n }));
        document.body.append(g);
        e.dataTransfer.setDragImage(g, 70, 24);
        setTimeout(() => g.remove(), 0);
      }
      setHover(null);
      setDragging(true);
    },
    onDragEnd: endDrag,
  });
  // Rilascio su un gruppo del main (con la sua sezione in custom), sul sideboard o sul maybeboard.
  // endDrag anche qui: la riga spostata può smontarsi prima del suo dragend.
  const dropProps = (key, board, section) => (touch ? {} : {
    onDragOver: (e) => { if (!dragIds.current) return; e.preventDefault(); setDropKey(key); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey((k) => (k === key ? null : k)); },
    onDrop: (e) => {
      e.preventDefault();
      const drag = dragIds.current;
      endDrag();
      if (drag) update((d) => placeRows(d, drag.ids, board, section, { one: drag.one }));
    },
  });

  // copy = indice della copia nella vista split (ogni copia è una carta, tutte agiscono sulla riga).
  const row = (r, copy = 0) => {
    const warn = warnOf(r);
    const warnText = warn && `${warn.count} copies, max ${warn.max} in ${formatLabel(deck.format)}`;
    const ban = banOf(r);
    const banText = ban && legalityLabel(ban, deck.format);
    return (
      <li key={copy ? `${r.id}:${copy}` : r.id} data-row-id={r.id} className={`deck-row${sel.has(r.id) ? ' selected' : ''}${warn ? ' over' : ''}`} {...dragProps(r)}
        onMouseEnter={touch ? undefined : (e) => showPreview(e, r)} onMouseLeave={touch ? undefined : () => setHover(null)}>
        <button type="button" className="deck-row-main" aria-pressed={sel.has(r.id)}
          aria-label={view === 'list' ? undefined : `${split ? `${r.card.name}, copy ${copy + 1} of ${r.qty}` : `${r.qty} ${r.card.name}`}${ban ? `, ${banText}` : ''}${warn ? `, ${warnText}` : ''}`}
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
              <span className="deck-name-cell">{r.card.name}</span>
              {ban && <span className="deck-ban-icon" title={banText}><IconBan size={13} /><span className="sr-only">{banText}</span></span>}
            {warn && <span className="deck-warn-icon" title={warnText}><IconAlert size={13} /><span className="sr-only">{warnText}</span></span>}
              <ManaCost cost={r.card.mana} />
              <span className="deck-set">{r.card.set.toUpperCase()}</span>
            </>
          ) : (
            <>
              {r.card.img ? <img src={r.card.img} alt="" loading="lazy" draggable={false} /> : <span className="deck-card-ph">{r.card.name}</span>}
              {r.qty > 1 && !split && <span className="deck-card-qty">{r.qty}</span>}
              {(ban || warn) && (
              <span className="deck-card-flags">
                {ban && <span className="deck-card-ban" title={banText}><IconBan size={13} /></span>}
                {warn && <span className="deck-card-warn" title={warnText}><IconAlert size={12} /></span>}
              </span>
            )}
            </>
          )}
        </button>
        <span className="deck-row-qty">
          <button type="button" aria-label={`One less ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, -1))}><IconMinus size={13} /></button>
          <button type="button" aria-label={`One more ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, 1))}><IconPlus size={13} /></button>
        </span>
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
        {g.section && (
          <span className="deck-group-actions">
            <button type="button" aria-label={`Rename ${g.label}`} onClick={() => setDialog({ id: g.section, name: g.label })}><IconPencil size={13} /></button>
            <button type="button" aria-label={`Delete section ${g.label}`} onClick={() => update((d) => deleteSection(d, g.section))}><IconTrash size={13} /></button>
          </span>
        )}
      </h3>
      {g.rows.length ? <ul className={`deck-rows view-${layout}`}>{cards(g.rows)}</ul> : <p className="deck-empty">{empty(g)}</p>}
    </section>
  );

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
  const n0 = pack(STACK_MIN).length || 1;
  const stackW = Math.max(STACK_MIN, Math.min(STACK_MAX, Math.floor((areaW - (n0 - 1) * COL_GAP) / n0)));
  const stackCols = pack(stackW);
  return (
    <div className={`deck-sections view-${layout}`} ref={rootRef} {...marqueeHandlers}
      onKeyDown={(e) => { if (e.key === 'Escape' && sel.size) { e.stopPropagation(); setSel(new Set()); } }}>
      {marquee && <div className="marquee" style={marquee} aria-hidden="true" />}
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
          <select value={deck.groupBy} onChange={(e) => update((d) => ({ ...d, groupBy: e.target.value }))}>
            {GROUP_MODES.filter((m) => m.id !== 'custom' || custom || deck.sections.length).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary deck-new-section" aria-label="New section" title="New section" onClick={() => setDialog({})}><IconPlus size={16} /></button>
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
      {/* Sotto tutto il mazzo, come Moxfield: statistiche e mano di prova. */}
      <div className="deck-analysis">
        <section aria-labelledby="deck-stats-head">
          <h3 className="deck-analysis-head" id="deck-stats-head">Stats</h3>
          <DeckStats deck={deck} onSelect={pick} />
        </section>
        <section aria-labelledby="deck-hand-head">
          <h3 className="deck-analysis-head" id="deck-hand-head">Sample hand</h3>
          <SampleHand deck={deck} />
        </section>
      </div>
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
      {hover && createPortal(<img className="deck-hover" src={hover.img} alt="" style={{ left: hover.x, top: hover.y, width: PREVIEW_W }} />, document.body)}
    </div>
  );
}
