import { useMemo, useState } from 'react';
import { deckStats } from './deckModel';

// Vista Stats (main board): numeri chiave, curva di mana, simboli nei costi contro fonti di mana,
// tipi. SVG scritto a mano (niente librerie): barre sottili con l'estremo dati arrotondato, valori
// sulle barre, tooltip su hover e focus, una tabella per i lettori di schermo. Click su una barra
// della curva o dei tipi = seleziona quelle carte nella vista Deck (onSelect).
// Colori delle serie: --chart-1 / --chart-2, validati (dataviz) sul fondo scuro.

const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
const symUrl = (c) => `https://svgs.scryfall.io/card-symbols/${c}.svg`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Colonna con l'estremo dati arrotondato (4 px) e la base quadrata.
const colPath = (x, y, w, h) => {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};
// Barra orizzontale: base a sinistra, estremo arrotondato a destra.
const rowPath = (x, y, w, h) => {
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
};

// Riquadro di un grafico: titolo, area del grafico con il tooltip, tabella nascosta.
function Panel({ title, sub, legend, table, children }) {
  return (
    <figure className="stat-card">
      <figcaption>
        <span className="stat-title">{title}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </figcaption>
      {legend}
      {children}
      {table}
    </figure>
  );
}

// Tooltip condiviso da un grafico: posizione relativa al suo .stat-plot, letta all'evento.
function useTip() {
  const [tip, setTip] = useState(null); // { x, y, lines: [[valore, etichetta, colore?]] }
  const show = (e, lines) => {
    const b = e.currentTarget.closest('.stat-plot').getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2 - b.left, y: r.top - b.top, lines });
  };
  const el = tip && (
    <div className="stat-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.lines.map(([v, l, key]) => (
        <div key={l} className="stat-tip-row">
          {key && <span className="stat-key" style={{ background: key }} aria-hidden="true" />}
          <strong>{v}</strong> <span>{l}</span>
        </div>
      ))}
    </div>
  );
  return { el, show, hide: () => setTip(null) };
}

// Area cliccabile (più grande della barra): hover / focus = tooltip, click / Invio = seleziona.
const hit = (tipApi, lines, ids, onSelect, label) => ({
  tabIndex: 0,
  role: ids?.length ? 'button' : 'img',
  'aria-label': label,
  className: `stat-hit${ids?.length ? ' clickable' : ''}`,
  onPointerEnter: (e) => tipApi.show(e, lines),
  onPointerLeave: tipApi.hide,
  onFocus: (e) => tipApi.show(e, lines),
  onBlur: tipApi.hide,
  onClick: ids?.length ? () => onSelect(ids) : undefined,
  onKeyDown: ids?.length ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ids); } } : undefined,
});

function CurveChart({ curve, onSelect }) {
  const tip = useTip();
  const W = 320, H = 170, top = 18, bottom = 22, side = 8;
  const band = (W - side * 2) / curve.length;
  const bw = Math.min(24, band * 0.6);
  const plotH = H - top - bottom;
  const max = Math.max(1, ...curve.map((b) => b.count));
  const label = (mv) => (mv === 7 ? '7+' : String(mv));
  return (
    <Panel title="Mana curve" sub="Non-land cards by mana value"
      table={(
        <table className="sr-only">
          <caption>Mana curve</caption>
          <thead><tr><th>Mana value</th><th>Cards</th></tr></thead>
          <tbody>{curve.map((b) => <tr key={b.mv}><td>{label(b.mv)}</td><td>{b.count}</td></tr>)}</tbody>
        </table>
      )}>
      <div className="stat-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" aria-hidden="false" role="group" aria-label="Mana curve chart">
          <line x1={side} x2={W - side} y1={H - bottom + 0.5} y2={H - bottom + 0.5} className="stat-axis" />
          {curve.map((b, i) => {
            const cx = side + band * i + band / 2;
            const h = (b.count / max) * plotH;
            const y = H - bottom - h;
            return (
              <g key={b.mv}>
                {b.count > 0 && <path d={colPath(cx - bw / 2, y, bw, h)} className="stat-bar s1" />}
                {b.count > 0 && <text x={cx} y={y - 5} className="stat-val" textAnchor="middle">{b.count}</text>}
                <text x={cx} y={H - 7} className="stat-tick" textAnchor="middle">{label(b.mv)}</text>
                <rect x={side + band * i} y={top - 14} width={band} height={plotH + 14} fill="transparent"
                  {...hit(tip, [[plural(b.count, 'card'), `mana value ${label(b.mv)}`]], b.ids, onSelect,
                    `Mana value ${label(b.mv)}: ${plural(b.count, 'card')}${b.count ? '. Select them' : ''}`)} />
              </g>
            );
          })}
        </svg>
        {tip.el}
      </div>
    </Panel>
  );
}

function ColorChart({ colors }) {
  const tip = useTip();
  const shown = colors.filter((c) => c.pips || c.sources);
  const W = 320, H = 170, top = 18, bottom = 26, side = 8, gap = 2;
  const band = (W - side * 2) / Math.max(1, shown.length);
  const bw = Math.min(20, (band * 0.7 - gap) / 2);
  const plotH = H - top - bottom;
  const max = Math.max(1, ...shown.flatMap((c) => [c.pips, c.sources]));
  const legend = (
    <div className="stat-legend">
      <span><i className="stat-swatch s1" aria-hidden="true" />Mana symbols in costs</span>
      <span><i className="stat-swatch s2" aria-hidden="true" />Mana sources</span>
    </div>
  );
  return (
    <Panel title="Colors" sub="Symbols your spells need against cards that make that mana" legend={legend}
      table={(
        <table className="sr-only">
          <caption>Colors</caption>
          <thead><tr><th>Color</th><th>Mana symbols in costs</th><th>Mana sources</th></tr></thead>
          <tbody>{shown.map((c) => <tr key={c.c}><td>{COLOR_NAME[c.c]}</td><td>{c.pips}</td><td>{c.sources}</td></tr>)}</tbody>
        </table>
      )}>
      {shown.length === 0 ? <p className="deck-empty">No colored costs or mana sources yet.</p> : (
        <div className="stat-plot">
          <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="group" aria-label="Colors chart">
            <line x1={side} x2={W - side} y1={H - bottom + 0.5} y2={H - bottom + 0.5} className="stat-axis" />
            {shown.map((c, i) => {
              const cx = side + band * i + band / 2;
              const bars = [[c.pips, 's1', cx - gap / 2 - bw], [c.sources, 's2', cx + gap / 2]];
              return (
                <g key={c.c}>
                  {bars.map(([v, cls, x]) => {
                    const h = (v / max) * plotH;
                    return v > 0 && (
                      <g key={cls}>
                        <path d={colPath(x, H - bottom - h, bw, h)} className={`stat-bar ${cls}`} />
                        <text x={x + bw / 2} y={H - bottom - h - 5} className="stat-val" textAnchor="middle">{v}</text>
                      </g>
                    );
                  })}
                  <image href={symUrl(c.c)} x={cx - 8} y={H - bottom + 6} width="16" height="16" />
                  <rect x={side + band * i} y={top - 14} width={band} height={plotH + 14} fill="transparent"
                    {...hit(tip, [[c.pips, 'symbols in costs', 'var(--chart-1)'], [c.sources, 'sources', 'var(--chart-2)']], null, null,
                      `${COLOR_NAME[c.c]}: ${plural(c.pips, 'symbol')} in costs, ${plural(c.sources, 'source')}`)} />
                </g>
              );
            })}
          </svg>
          {tip.el}
        </div>
      )}
    </Panel>
  );
}

function TypeChart({ types, onSelect }) {
  const tip = useTip();
  const W = 320, rowH = 24, bh = 14, labelW = 92, valueW = 30;
  const H = Math.max(rowH, types.length * rowH);
  const maxW = W - labelW - valueW;
  const max = Math.max(1, ...types.map((t) => t.count));
  return (
    <Panel title="Types" sub="A card with two types counts in both"
      table={(
        <table className="sr-only">
          <caption>Types</caption>
          <thead><tr><th>Type</th><th>Cards</th></tr></thead>
          <tbody>{types.map((t) => <tr key={t.type}><td>{t.type}</td><td>{t.count}</td></tr>)}</tbody>
        </table>
      )}>
      <div className="stat-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="group" aria-label="Types chart">
          <line x1={labelW + 0.5} x2={labelW + 0.5} y1={0} y2={H} className="stat-axis" />
          {types.map((t, i) => {
            const y = i * rowH + (rowH - bh) / 2;
            const w = (t.count / max) * maxW;
            return (
              <g key={t.type}>
                <text x={labelW - 8} y={i * rowH + rowH / 2 + 4} className="stat-tick" textAnchor="end">{t.type}</text>
                <path d={rowPath(labelW + 1, y, w, bh)} className="stat-bar s1" />
                <text x={labelW + w + 6} y={i * rowH + rowH / 2 + 4} className="stat-val">{t.count}</text>
                <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent"
                  {...hit(tip, [[plural(t.count, 'card'), t.type]], t.ids, onSelect, `${t.type}: ${plural(t.count, 'card')}. Select them`)} />
              </g>
            );
          })}
        </svg>
        {tip.el}
      </div>
    </Panel>
  );
}

export default function DeckStats({ deck, onSelect }) {
  const s = useMemo(() => deckStats(deck), [deck]);
  if (!s.cards) return <p className="deck-empty deck-empty-big">Add cards to the main deck to see its stats.</p>;
  const tiles = [
    ['Cards', s.cards],
    ['Lands', s.lands],
    ['Spells', s.cards - s.lands],
    ['Average mana value', s.avgMv ?? '-'],
  ];
  return (
    <div className="deck-stats">
      <div className="stat-tiles">
        {tiles.map(([label, value]) => (
          <div key={label} className="stat-tile"><span className="stat-tile-label">{label}</span><span className="stat-tile-value">{value}</span></div>
        ))}
      </div>
      <CurveChart curve={s.curve} onSelect={onSelect} />
      <ColorChart colors={s.colors} />
      <TypeChart types={s.types} onSelect={onSelect} />
    </div>
  );
}
