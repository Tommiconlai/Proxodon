import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import { useLongPress } from '../hooks/useLongPress';
import { ManaCost } from './Mana';
import { NameFormatDialog } from './dialogs';
import {
  GROUP_MODES, SORT_MODES, groupMain, commanderRows, boardRows, bumpQty, removeRows, setCommander, moveToBoard,
  addSection, renameSection, deleteSection, moveToSection, placeRows, overLimit, formatLabel,
} from './deckModel';
import { IconPlus, IconMinus, IconTrash, IconCrown, IconList, IconPencil, IconAlert } from '../components/icons';

const BOARD_LABEL = { main: 'main deck', side: 'sideboard', maybe: 'maybeboard' };
const VIEWS = [
  { id: 'list', label: 'List' },
  { id: 'grid', label: 'Grid' },
  { id: 'stacks', label: 'Stacks' },
  { id: 'split', label: 'Stacks, every copy' },
];
const PREVIEW_W = 244;
const PREVIEW_H = Math.round((PREVIEW_W * 680) / 488);
const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.bottom };
};
// Preferenza per dispositivo in localStorage (vista, ordine); storage bloccato = solo questa sessione.
function usePref(key, modes) {
  const [v, setV] = useState(() => {
    try {
      const x = localStorage.getItem(key);
      return modes.some((m) => m.id === x) ? x : modes[0].id;
    } catch {
      return modes[0].id;
    }
  });
  const set = (x) => {
    setV(x);
    try { localStorage.setItem(key, x); } catch { /* storage bloccato */ }
  };
  return [v, set];
}

// Corpo dell'editor: barra (raggruppa, ordina, vista, nuova sezione), comandante, gruppi, sideboard, maybeboard.
// Viste: lista (righe), griglia (immagini), stack (immagini sovrapposte, si vede la parte alta),
// stack con ogni copia (3 copie = 3 carte impilate). Le carte oltre il limite di copie del formato
// hanno un avviso, più un riepilogo in alto.
// Selezione come le carte in stampa (click = aggiungi/togli, Shift = intervallo, Esc = svuota);
// menu su click destro, Shift+F10 o pressione lunga, sulla selezione se la riga ne fa parte.
// Desktop: le carte si trascinano tra gruppi del main, sezioni, sideboard e maybeboard. Creare una
// sezione porta il mazzo in raggruppamento custom; da telefono si sposta tutto dal menu.
export default function DeckSections({ deck, update, touch }) {
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null); // { ids, x, y }
  const [hover, setHover] = useState(null); // anteprima accanto alla riga: { img, x, y }
  const [view, setView] = usePref('ip:deckView', VIEWS);
  const [sort, setSort] = usePref('ip:deckSort', SORT_MODES);
  const [dialog, setDialog] = useState(null); // { id?, name?, moveIds? } nuova sezione o rinomina
  const [dropKey, setDropKey] = useState(null);
  const [dragging, setDragging] = useState(false); // durante il trascinamento il maybeboard vuoto accetta il rilascio
  const dragIds = useRef(null);
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);
  const custom = deck.groupBy === 'custom';
  const split = view === 'split';
  const layout = split ? 'stacks' : view; // classi CSS: lo split è uno stack
  const over = useMemo(() => overLimit(deck), [deck]);
  const overBy = useMemo(() => new Map(over.map((e) => [e.oid, e])), [over]);
  // Avviso solo dove le copie contano: main e (fuori da Commander) sideboard.
  const warnOf = (r) => (r.board === 'main' || (r.board === 'side' && deck.format !== 'commander') ? overBy.get(r.card.oid) : undefined);

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
    // Al massimo 2 comandanti: "Set" solo su 1-2 righe, "Remove" su qualsiasi gruppo di comandanti.
    if (deck.format === 'commander' && allMain && (allCmd || ids.length <= 2)) {
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

  // Trascinamento (desktop): la riga, o tutta la selezione se ne fa parte.
  const endDrag = () => { dragIds.current = null; setDropKey(null); setDragging(false); };
  const dragProps = (r) => (touch ? {} : {
    draggable: true,
    onDragStart: (e) => {
      dragIds.current = sel.has(r.id) && selected.length > 1 ? selected : [r.id];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', r.card.name);
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
      const ids = dragIds.current;
      endDrag();
      if (ids) update((d) => placeRows(d, ids, board, section));
    },
  });

  // copy = indice della copia nella vista split (ogni copia è una carta, tutte agiscono sulla riga).
  const row = (r, copy = 0) => {
    const warn = warnOf(r);
    const warnText = warn && `${warn.count} copies, max ${warn.max} in ${formatLabel(deck.format)}`;
    return (
      <li key={copy ? `${r.id}:${copy}` : r.id} className={`deck-row${sel.has(r.id) ? ' selected' : ''}${warn ? ' over' : ''}`} {...dragProps(r)}
        onMouseEnter={touch ? undefined : (e) => showPreview(e, r)} onMouseLeave={touch ? undefined : () => setHover(null)}>
        <button type="button" className="deck-row-main" aria-pressed={sel.has(r.id)}
          aria-label={view === 'list' ? undefined : `${split ? `${r.card.name}, copy ${copy + 1} of ${r.qty}` : `${r.qty} ${r.card.name}`}${warn ? `, ${warnText}` : ''}`}
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
              {warn && <span className="deck-warn-icon" title={warnText}><IconAlert size={13} /><span className="sr-only">{warnText}</span></span>}
              <ManaCost cost={r.card.mana} />
              <span className="deck-set">{r.card.set.toUpperCase()}</span>
            </>
          ) : (
            <>
              {r.card.img ? <img src={r.card.img} alt="" loading="lazy" draggable={false} /> : <span className="deck-card-ph">{r.card.name}</span>}
              {r.qty > 1 && !split && <span className="deck-card-qty">{r.qty}</span>}
              {warn && <span className="deck-card-warn" title={warnText}><IconAlert size={12} /></span>}
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
  const empty = (g) => {
    if (g.key === 'commander') return 'Right-click a card, then Set as commander.';
    if (custom && 'section' in g) return touch ? 'Long-press a card, then Move to.' : 'Drag cards here.';
    return 'No cards yet.';
  };
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
    return <p className="deck-empty deck-empty-big">{touch ? 'Tap + to search and add cards.' : 'Search a card on the left and press Enter to add it.'}</p>;
  }
  return (
    <div className={`deck-sections view-${layout}`} onKeyDown={(e) => { if (e.key === 'Escape' && sel.size) { e.stopPropagation(); setSel(new Set()); } }}>
      <div className="deck-toolbar">
        <label className="deck-tool">
          <span>Group by</span>
          <select value={deck.groupBy} onChange={(e) => update((d) => ({ ...d, groupBy: e.target.value }))}>
            {GROUP_MODES.filter((m) => m.id !== 'custom' || custom || deck.sections.length).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
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
        <button type="button" className="btn-secondary deck-new-section" onClick={() => setDialog({})}><IconPlus size={14} /> New section</button>
      </div>
      {over.length > 0 && (
        <p className="deck-warn" role="status">
          <IconAlert size={15} />
          <span>Over the copy limit for {formatLabel(deck.format)}: {over.map((e) => `${e.name} ${e.count}/${e.max}`).join(', ')}.</span>
        </p>
      )}
      {blocks.commander && group(blocks.commander, 'deck-block')}
      <div className={`deck-columns view-${layout}`}>{blocks.groups.map((g) => group(g, '', ['main', g.section]))}</div>
      {blocks.side && group(blocks.side, 'deck-block', ['side'])}
      {(blocks.maybe.rows.length > 0 || dragging) && (
        <details className={`deck-maybe${dropKey === 'maybe' ? ' drop-target' : ''}`} {...dropProps('maybe', 'maybe')}>
          <summary className="deck-group-head">Maybeboard <span className="n">{sum(blocks.maybe.rows)}</span></summary>
          <ul className={`deck-rows view-${layout}`}>{cards(blocks.maybe.rows)}</ul>
        </details>
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
      {hover && createPortal(<img className="deck-hover" src={hover.img} alt="" style={{ left: hover.x, top: hover.y, width: PREVIEW_W }} />, document.body)}
    </div>
  );
}
