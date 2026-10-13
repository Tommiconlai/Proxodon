import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import { useLongPress } from '../hooks/useLongPress';
import { ManaCost } from './Mana';
import { groupMain, commanderRows, boardRows, bumpQty, removeRows, setCommander, moveToBoard } from './deckModel';
import { IconPlus, IconMinus, IconTrash, IconCrown, IconList } from '../components/icons';

const BOARD_LABEL = { main: 'main deck', side: 'sideboard', maybe: 'maybeboard' };
const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.bottom };
};

// Corpo dell'editor: comandante, gruppi per tipo, sideboard, maybeboard. Selezione come le carte
// in stampa (click = aggiungi/togli, Shift = intervallo, Esc = svuota); menu su click destro,
// Shift+F10 o pressione lunga, che agisce su tutta la selezione se la riga ne fa parte.
export default function DeckSections({ deck, update, touch }) {
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null); // { ids, x, y }
  const [hover, setHover] = useState(null); // immagine in anteprima (desktop)
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);

  const blocks = useMemo(() => {
    const cmd = commanderRows(deck);
    const side = boardRows(deck, 'side');
    const maybe = boardRows(deck, 'maybe');
    return {
      commander: cmd.length || deck.format === 'commander' ? { label: 'Commander', rows: cmd } : null,
      groups: groupMain(deck),
      side: side.length || deck.format !== 'commander' ? { label: 'Sideboard', rows: side } : null,
      maybe: maybe.length ? { label: 'Maybeboard', rows: maybe } : null,
    };
  }, [deck]);
  const order = useMemo(() => [
    ...(blocks.commander?.rows || []), ...blocks.groups.flatMap((g) => g.rows), ...(blocks.side?.rows || []), ...(blocks.maybe?.rows || []),
  ].map((r) => r.id), [blocks]);
  const selected = order.filter((id) => sel.has(id)); // righe ancora esistenti

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
    setMenu({ ids: inSel && selected.length > 1 ? selected : [id], x, y });
  };

  const menuRows = menu ? deck.cards.filter((r) => menu.ids.includes(r.id)) : [];
  const items = [];
  if (menuRows.length) {
    const ids = menuRows.map((r) => r.id);
    const allMain = menuRows.every((r) => r.board === 'main');
    const allCmd = menuRows.every((r) => r.commander);
    if (deck.format === 'commander' && allMain) {
      items.push({ key: 'cmd', Icon: IconCrown, label: allCmd ? 'Remove as commander' : 'Set as commander', run: () => update((d) => setCommander(d, ids, !allCmd)) });
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

  const row = (r) => (
    <li key={r.id} className={`deck-row${sel.has(r.id) ? ' selected' : ''}`}
      onMouseEnter={touch ? undefined : () => setHover(r.card.img)} onMouseLeave={touch ? undefined : () => setHover(null)}>
      <button type="button" className="deck-row-main" aria-pressed={sel.has(r.id)}
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
        <span className="deck-qty">{r.qty}</span>
        <span className="deck-name-cell">{r.card.name}</span>
        <ManaCost cost={r.card.mana} />
        <span className="deck-set">{r.card.set.toUpperCase()}</span>
      </button>
      <span className="deck-row-qty">
        <button type="button" aria-label={`One less ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, -1))}><IconMinus size={13} /></button>
        <button type="button" aria-label={`One more ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, 1))}><IconPlus size={13} /></button>
      </span>
    </li>
  );
  const group = (key, label, rows, extraClass = '') => (
    <section key={key} className={`deck-group ${extraClass}`} aria-label={label}>
      <h3 className="deck-group-head">{label} <span className="n">{sum(rows)}</span></h3>
      {rows.length ? <ul className="deck-rows">{rows.map(row)}</ul> : <p className="deck-empty">{key === 'commander' ? 'Right-click a card, then Set as commander.' : 'No cards yet.'}</p>}
    </section>
  );

  if (!deck.cards.length) {
    return <p className="deck-empty deck-empty-big">{touch ? 'Tap + to search and add cards.' : 'Search a card on the left and press Enter to add it.'}</p>;
  }
  return (
    <div className="deck-sections" onKeyDown={(e) => { if (e.key === 'Escape' && sel.size) { e.stopPropagation(); setSel(new Set()); } }}>
      {blocks.commander && group('commander', 'Commander', blocks.commander.rows, 'deck-block')}
      <div className="deck-columns">{blocks.groups.map((g) => group(g.key, g.label, g.rows))}</div>
      {blocks.side && group('side', 'Sideboard', blocks.side.rows, 'deck-block')}
      {blocks.maybe && (
        <details className="deck-maybe">
          <summary className="deck-group-head">Maybeboard <span className="n">{sum(blocks.maybe.rows)}</span></summary>
          <ul className="deck-rows">{blocks.maybe.rows.map(row)}</ul>
        </details>
      )}
      {menu && items.length > 0 && (
        <CardMenu x={menu.x} y={menu.y} title={menuRows.length === 1 ? menuRows[0].card.name : `${menuRows.length} cards selected`} items={items} onClose={closeMenu} />
      )}
      {hover && createPortal(<img className="deck-hover" src={hover} alt="" />, document.body)}
    </div>
  );
}
