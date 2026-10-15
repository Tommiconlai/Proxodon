import { useEffect, useMemo, useRef, useState } from 'react';
import { deckStats, hyperAtLeast } from './deckModel';
import { ManaCost } from './Mana';
import { IconInfo } from '../components/icons';

// Statistiche sotto il mazzo (main board), sul modello di Moxfield ma con lo stile del sito:
// 1. curva di mana a colonne impilate (permanenti / magie); la barra scelta (all'inizio la più alta)
//    mostra a fianco le sue carte divise per tipo;
// 2. una frase con conteggi, media e mediana del costo con e senza terre, costo totale;
// 3. una scheda per colore: quota dei simboli nei costi, simboli per costo, fonti di mana
//    (sbiadita se nessun costo usa quel colore);
// 4. probabilità di pescata per turno (DrawOdds).
// SVG scritto a mano (niente librerie), colori delle serie --chart-1 / --chart-2.

const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
const symUrl = (c) => `https://svgs.scryfall.io/card-symbols/${c}.svg`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const mvLabel = (mv) => (mv === 7 ? '7+' : String(mv));
const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);

// Colonna con l'estremo dati arrotondato (4 px) e la base quadrata.
const colPath = (x, y, w, h) => {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

// Tooltip della curva: posizione relativa a .stat-plot, letta all'evento.
function useTip() {
  const [tip, setTip] = useState(null); // { x, y, lines: [[valore, etichetta, colore]] }
  const show = (e, lines) => {
    const b = e.currentTarget.closest('.stat-plot').getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2 - b.left, y: r.top - b.top + 12, lines });
  };
  const el = tip && (
    <div className="stat-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.lines.map(([v, l, key]) => (
        <div key={l} className="stat-tip-row">
          <span className="stat-key" style={{ background: key }} aria-hidden="true" />
          <strong>{v}</strong> <span>{l}</span>
        </div>
      ))}
    </div>
  );
  return { el, show, hide: () => setTip(null) };
}

function CurveChart({ curve, pick, onPick }) {
  const tip = useTip();
  const W = 400, H = 230, top = 18, bottom = 42, left = 34, right = 4;
  const plotH = H - top - bottom;
  const band = (W - left - right) / curve.length;
  const bw = Math.min(40, band * 0.6);
  const max = Math.max(1, ...curve.map((b) => b.count));
  const step = max > 24 ? 10 : 5;
  const yMax = Math.ceil(max / step) * step;
  const y = (v) => H - bottom - (v / yMax) * plotH;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);
  return (
    <figure className="stat-card stat-curve">
      <figcaption>
        <span className="stat-title">Mana curve</span>
        <span className="stat-sub">Non-land cards by mana value. Click a bar to see its cards.</span>
      </figcaption>
      <div className="stat-legend">
        <span><i className="stat-swatch s1" aria-hidden="true" />Permanents</span>
        <span><i className="stat-swatch s2" aria-hidden="true" />Spells</span>
      </div>
      <div className="stat-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="group" aria-label="Mana curve chart">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={W - right} y1={y(t) + 0.5} y2={y(t) + 0.5} className={t ? 'stat-grid' : 'stat-axis'} />
              <text x={left - 8} y={y(t) + 4} className="stat-tick" textAnchor="end">{t}</text>
            </g>
          ))}
          <text className="stat-axis-title" textAnchor="middle" transform={`translate(11 ${top + plotH / 2}) rotate(-90)`}>Cards</text>
          <text x={left + (W - left - right) / 2} y={H - 4} className="stat-axis-title" textAnchor="middle">Mana value</text>
          {curve.map((b, i) => {
            const x = left + band * i + (band - bw) / 2;
            const hp = (b.perm / yMax) * plotH;
            const hs = (b.spell / yMax) * plotH;
            const base = H - bottom;
            const label = `Mana value ${mvLabel(b.mv)}: ${plural(b.perm, 'permanent')}, ${plural(b.spell, 'spell')}`;
            return (
              <g key={b.mv} className={`stat-col${pick === i ? ' on' : ''}`}>
                {b.perm > 0 && (b.spell > 0
                  ? <rect x={x} y={base - hp} width={bw} height={hp} className="stat-bar s1" />
                  : <path d={colPath(x, base - hp, bw, hp)} className="stat-bar s1" />)}
                {b.spell > 0 && <path d={colPath(x, base - hp - hs, bw, hs)} className="stat-bar s2" />}
                {b.count > 0 && <text x={x + bw / 2} y={base - hp - hs - 6} className="stat-val" textAnchor="middle">{b.count}</text>}
                <text x={x + bw / 2} y={base + 16} className="stat-tick" textAnchor="middle">{mvLabel(b.mv)}</text>
                <rect x={left + band * i} y={top - 14} width={band} height={plotH + 34} fill="transparent"
                  tabIndex={0} role="button" aria-pressed={pick === i} aria-label={label} className="stat-hit clickable"
                  onPointerEnter={(e) => tip.show(e, [[b.perm, 'permanents', 'var(--chart-1)'], [b.spell, 'spells', 'var(--chart-2)']])}
                  onPointerLeave={tip.hide} onFocus={(e) => tip.show(e, [[b.perm, 'permanents', 'var(--chart-1)'], [b.spell, 'spells', 'var(--chart-2)']])}
                  onBlur={tip.hide} onClick={() => onPick(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i); } }} />
              </g>
            );
          })}
        </svg>
        {tip.el}
        <table className="sr-only">
          <caption>Mana curve</caption>
          <thead><tr><th>Mana value</th><th>Permanents</th><th>Spells</th></tr></thead>
          <tbody>{curve.map((b) => <tr key={b.mv}><td>{mvLabel(b.mv)}</td><td>{b.perm}</td><td>{b.spell}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

// Carte della barra scelta, per tipo: click = selezionala nel mazzo.
function CurveCards({ bin, onSelect }) {
  return (
    <div className="stat-card stat-mv">
      <div className="stat-mv-head">
        <span className="stat-title">Mana value {mvLabel(bin.mv)}</span>
        <span className="n">{plural(bin.count, 'card')}</span>
        {bin.ids.length > 0 && <button type="button" className="btn-secondary stat-mv-select" onClick={() => onSelect(bin.ids)}>Select in deck</button>}
      </div>
      {!bin.count && <p className="deck-empty">No cards at this mana value.</p>}
      {bin.groups.map((g) => (
        <section key={g.label} className="stat-mv-group" aria-label={g.label}>
          <h4>{g.label} <span className="n">{sum(g.rows)}</span></h4>
          <ul>
            {g.rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="stat-mv-row" onClick={() => onSelect([r.id])} aria-label={`${r.qty} ${r.card.name}. Select in deck`}>
                  <span className="deck-qty">{r.qty}</span>
                  <span className="stat-mv-name">{r.card.name}</span>
                  <ManaCost cost={r.card.mana} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Numero da un campo: arrotondato e limitato a [lo, hi]; vuoto o non valido = def.
const num = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  return v === '' || !Number.isFinite(n) ? def : Math.min(hi, Math.max(lo, n));
};

// Probabilità di pescata: cosa (le copie di una carta, 4 di default, oppure un tipo del mazzo con
// le sue copie nel grimorio), almeno quante, fino a che turno (10 di default). Ipergeometrica sul
// grimorio: per primi 7 + T - 1 carte (niente pescata al primo turno), per secondi 7 + T. Il grafico
// è largo quanto la sezione (larghezza misurata, testi a dimensione fissa). Crosshair + tooltip per
// turno, tabella per i lettori di schermo.
function DrawOdds({ library, types }) {
  const [what, setWhat] = useState('copies');
  const [copies, setCopies] = useState('4');
  const [least, setLeast] = useState('1');
  const [turnsIn, setTurns] = useState('10');
  const [at, setAt] = useState(null); // indice del turno sotto il mouse / focus
  const [width, setWidth] = useState(0);
  const plotRef = useRef(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(plotRef.current);
    return () => ro.disconnect();
  }, []);
  const type = types.find((t) => t.type === what);
  const K = type ? type.count : num(copies, 1, library, 4);
  const k = num(least, 1, K, 1);
  const turns = num(turnsIn, 2, 20, 10);
  const pts = Array.from({ length: turns }, (_, i) => ({
    t: i + 1, play: hyperAtLeast(library, K, 7 + i, k), draw: hyperAtLeast(library, K, 8 + i, k),
  }));
  const W = Math.max(280, Math.round(width)), H = 260, top = 14, bottom = 30, left = 44, right = 54;
  const plotW = W - left - right, plotH = H - top - bottom;
  const step = plotW / (turns - 1);
  const x = (i) => left + i * step;
  const y = (p) => top + (1 - p) * plotH;
  const path = (key) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join('');
  // Un decimale; vicino agli estremi senza toccarli ">99.9%" / "<0.1%" (es. 41 artefatti su 60:
  // almeno uno in mano al 99,987%, arrotondato all'intero sembrava 100%).
  const f = (p) => {
    const v = p * 100;
    if (v > 99.95 && v < 100) return '>99.9%';
    if (v > 0 && v < 0.05) return '<0.1%';
    return `${Number(v.toFixed(1))}%`;
  };
  const every = step < 34 ? 2 : 1; // etichette dei turni alterne quando sono strette, contate dall'ultimo
  const series = [['play', 'On the play', 1], ['draw', 'On the draw', 2]];
  const last = pts[turns - 1];
  const tip = at != null && pts[at];
  const what2 = type ? `the ${K} ${type.label.toLowerCase()}` : `${K} ${K === 1 ? 'copy' : 'copies'} of a card`;
  return (
    <figure className="stat-card stat-odds">
      <figcaption className="stat-odds-title">
        <span className="stat-title">Draw odds</span>
        <span className="stat-sub">Chance to draw at least {k} of {what2} by each turn</span>
      </figcaption>
      <div className="stat-odds-controls">
        <label className="stat-odds-field">
          <span>Draw</span>
          <select value={what} onChange={(e) => setWhat(e.target.value)}>
            <option value="copies">Copies of a card</option>
            {types.map((t) => <option key={t.type} value={t.type}>{t.label} ({t.count})</option>)}
          </select>
        </label>
        {!type && (
          <label className="stat-odds-field">
            <span>Copies</span>
            <input type="number" min="1" max={library} value={copies} onChange={(e) => setCopies(e.target.value)} />
          </label>
        )}
        <label className="stat-odds-field">
          <span>At least</span>
          <input type="number" min="1" max={K} value={least} onChange={(e) => setLeast(e.target.value)} />
        </label>
        <label className="stat-odds-field">
          <span>Turns</span>
          <input type="number" min="2" max="20" value={turnsIn} onChange={(e) => setTurns(e.target.value)} />
        </label>
      </div>
      <div className="stat-legend">
        {series.map(([key, label, n]) => <span key={key}><i className={`stat-swatch s${n}`} aria-hidden="true" />{label}</span>)}
      </div>
      <div className="stat-plot" ref={plotRef} onPointerLeave={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="group" aria-label="Draw odds chart">
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={left} x2={W - right} y1={y(p) + 0.5} y2={y(p) + 0.5} className={p ? 'stat-grid' : 'stat-axis'} />
              <text x={left - 8} y={y(p) + 4} className="stat-tick" textAnchor="end">{p * 100}%</text>
            </g>
          ))}
          {pts.map((p, i) => (turns - 1 - i) % every === 0 && (
            <text key={p.t} x={x(i)} y={H - bottom + 18} className="stat-tick" textAnchor="middle">T{p.t}</text>
          ))}
          {tip && <line x1={x(at)} x2={x(at)} y1={top} y2={H - bottom} className="stat-crosshair" />}
          {series.map(([key, , n]) => (
            <g key={key}>
              <path d={path(key)} className={`stat-line s${n}`} />
              {pts.map((p, i) => <circle key={p.t} cx={x(i)} cy={y(p[key])} r={at === i ? 5 : 3.5} className={`stat-dot s${n}`} />)}
            </g>
          ))}
          {/* Etichette a fine linea: per secondi sopra, per primi sotto (per secondi è sempre più alta). */}
          <text x={x(turns - 1) + 8} y={y(last.draw) - 2} className="stat-val">{f(last.draw)}</text>
          <text x={x(turns - 1) + 8} y={y(last.play) + 12} className="stat-val">{f(last.play)}</text>
          {pts.map((p, i) => (
            <rect key={p.t} x={x(i) - step / 2} y={top} width={step} height={plotH} fill="transparent"
              tabIndex={0} className="stat-hit" aria-label={`Turn ${p.t}: ${f(p.play)} on the play, ${f(p.draw)} on the draw`}
              onPointerEnter={() => setAt(i)} onFocus={() => setAt(i)} onBlur={() => setAt(null)} />
          ))}
        </svg>
        {tip && (
          <div className="stat-tip" style={{ left: `${(x(at) / W) * 100}%`, top: `${(y(tip.draw) / H) * 100}%` }} role="status">
            <div className="stat-tip-row"><strong>T{tip.t}</strong></div>
            {series.map(([key, label, n]) => (
              <div key={key} className="stat-tip-row">
                <span className="stat-key" style={{ background: `var(--chart-${n})` }} aria-hidden="true" />
                <strong>{f(tip[key])}</strong> <span>{label.toLowerCase()}</span>
              </div>
            ))}
          </div>
        )}
        <table className="sr-only">
          <caption>Chance to draw at least {k} of {what2}</caption>
          <thead><tr><th>Turn</th><th>On the play</th><th>On the draw</th></tr></thead>
          <tbody>{pts.map((p) => <tr key={p.t}><td>{p.t}</td><td>{f(p.play)}</td><td>{f(p.draw)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

function ColorCard({ c, s }) {
  const top = Math.max(1, ...c.byMv);
  const share = pct(c.sources, s.sources);
  return (
    <div className={`stat-color${c.pips ? '' : ' dim'}`}>
      <img src={symUrl(c.c)} alt="" width="44" height="44" />
      <span className="stat-color-pct">{pct(c.pips, s.pips)}%</span>
      <span className="stat-color-sub">{plural(c.pips, 'symbol')} in costs</span>
      <svg className="stat-color-curve" viewBox="0 0 80 26" role="img" aria-label={`${COLOR_NAME[c.c]} symbols by mana value: ${c.byMv.join(', ')}`}>
        {c.byMv.map((v, i) => v > 0 && <rect key={i} x={i * 10 + 1} y={24 - (v / top) * 22} width="8" height={(v / top) * 22} rx="1.5" className="stat-bar s1" />)}
        <line x1="0" x2="80" y1="24.5" y2="24.5" className="stat-axis" />
      </svg>
      <span className="stat-color-label"><span>{COLOR_NAME[c.c]} sources</span><b>{share}%</b></span>
      <span className="stat-meter" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
      <span className="stat-color-sub">{c.sources} of {s.sources} · {plural(c.landSources, 'land')}</span>
    </div>
  );
}

export default function DeckStats({ deck, onSelect }) {
  const s = useMemo(() => deckStats(deck), [deck]);
  const [pick, setPick] = useState(null);
  if (!s.cards) return <p className="deck-empty deck-empty-big">Add cards to the main deck to see its stats.</p>;
  const sel = pick ?? s.curve.reduce((best, b, i) => (b.count > s.curve[best].count ? i : best), 0);
  const v = (x) => (x == null ? '-' : x);
  return (
    <div className="deck-stats">
      <div className="stat-curve-row">
        <CurveChart curve={s.curve} pick={sel} onPick={setPick} />
        <CurveCards bin={s.curve[sel]} onSelect={onSelect} />
      </div>
      <p className="stat-summary">
        <IconInfo size={16} />
        <span>
          The main deck has <b>{s.cards}</b> cards: <b>{s.lands}</b> lands and <b>{s.cards - s.lands}</b> nonlands.
          Its average mana value is <b>{v(s.avgAll)}</b> with lands and <b>{v(s.avgMv)}</b> without, the median <b>{v(s.medianAll)}</b> with
          lands and <b>{v(s.medianMv)}</b> without. Total mana value: <b>{s.totalMv}</b>.
        </span>
      </p>
      <div className="stat-colors">{s.colors.map((c) => <ColorCard key={c.c} c={c} s={s} />)}</div>
      <p className="stat-foot">A card that makes more than one color counts as a source of each, so sources can add up to more than 100%.</p>
      {s.library > 0 && <DrawOdds library={s.library} types={s.drawTypes} />}
    </div>
  );
}
