import { memo, useEffect, useRef, useState } from 'react';
import { StatFrame } from './DeckStats';
import { cachedOracle, fetchOracle } from './scryfallSearch';
import { landModel, karsten, landOdds, filterText, parseFilter, ROLES, ROLE_LABEL, LAND_FORMATS, KARSTEN_URL } from './landAnalysis';
import { simInput, simParams } from './landSim';
import { IconPlay, IconReplay, IconX } from '../components/icons';

// Analisi delle terre nella scheda Stats (spec LAND-COUNT-ANALYSIS): riepilogo, formula di Karsten col dettaglio dei
// termini, ruoli delle carte con override (salvati sul mazzo, deck.landAnalysis). Consultiva: non cambia mai le carte.
// I dati Oracle vengono dalla cache di scryfallSearch; quelli che mancano si scaricano una volta per insieme di carte.

const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const pct = (p) => `${(p * 100).toFixed(1)}%`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const GROUPS = ['ramp', 'draw', 'mdfc', 'spell', 'land'];
const GROUP_LABEL = { ramp: 'Ramp', draw: 'Draw', mdfc: 'MDFCs (spell // land)', spell: 'Other spells', land: 'Lands' };

// Dati Oracle delle righe (maybeboard esclusa): subito quelli in cache; gli id delle stampe che mancano in una chiave,
// scaricati una volta (settled = la chiave finita, con l'errore se c'è stato). Carte che Scryfall non trova: un secondo
// giro e poi restano fuori dall'analisi.
function useOracle(cards) {
  const [settled, setSettled] = useState({ key: '', error: null });
  const rows = cards.filter((r) => r.board !== 'maybe');
  const oracle = cachedOracle(rows);
  const missing = [...new Set(rows.filter((r) => !oracle.has(r.card.oid)).map((r) => r.card.sid))].sort().join(',');
  useEffect(() => {
    if (!missing) return undefined;
    let live = true;
    fetchOracle(missing.split(',').map((sid) => ({ card: { sid } })))
      .then(() => live && setSettled({ key: missing, error: null }), (e) => live && setSettled({ key: missing, error: e.message }));
    return () => { live = false; };
  }, [missing]);
  return { oracle, loading: !!missing && settled.key !== missing, error: settled.key === missing ? settled.error : null };
}

function Tile({ label, value, sub, children }) {
  return (
    <StatFrame className="stat-color" role="listitem">
      <span className="stat-pill">{label}</span>
      {children || <span className="stat-color-pct">{value}</span>}
      <span className="stat-color-sub">{sub}</span>
    </StatFrame>
  );
}

// Differenza in parole: entro mezzo punto "on target", sennò quante terre aggiungere o togliere.
function deltaText(d) {
  if (Math.abs(d) <= 0.5) return 'On target';
  const n = Math.round(Math.abs(d));
  return `${d > 0 ? '+' : '-'}${f1(Math.abs(d))} → ${d > 0 ? 'add' : 'cut'} ${plural(n, 'land')}`;
}

function FormulaCard({ m, k, setSetting }) {
  const s = m.settings;
  return (
    <StatFrame as="figure" className="stat-card land-formula">
      <figcaption>
        <span className="stat-pill">Karsten&apos;s formula</span>
        <span className="stat-sub">Empirical baseline: what successful decks play, not a probability model.</span>
      </figcaption>
      <div className="land-formula-main">
        <div className="land-big">
          <span className="land-big-n">{f1(k.recommendedLands)}</span>
          <span className="land-big-sub">lands recommended (≈ {k.rounded})</span>
        </div>
        <div className="land-big">
          <span className="land-big-n now">{m.lands}</span>
          <span className="land-big-sub">lands now</span>
        </div>
        <p className={`land-delta${Math.abs(k.delta) <= 0.5 ? ' ok' : ''}`}>{deltaText(k.delta)}</p>
      </div>
      {k.extrapolated && (
        <p className="land-note">Extrapolated: the formula is fitted on 60-card and 99-card decks, here it is scaled to {m.N} cards.</p>
      )}
      <details className="land-details">
        <summary>How it is computed</summary>
        <table className="land-terms">
          <tbody>
            {k.terms.map(([label, v]) => <tr key={label}><td>{label}</td><td>{v >= 0 ? '+' : '-'}{f2(Math.abs(v))}</td></tr>)}
            <tr className="sum"><td>Lands recommended</td><td>{f2(k.recommendedLands)}</td></tr>
          </tbody>
        </table>
        <div className="land-controls">
          <label className="stat-odds-field">
            <span>Cheap = mana value up to</span>
            <input type="number" min="0" max="10" value={s.cheap} onChange={(e) => {
              const v = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(v)) setSetting('cheap', Math.max(0, Math.min(10, Math.round(v))));
            }} />
          </label>
          <label className="land-check">
            <input type="checkbox" checked={s.fast} onChange={(e) => setSetting('fast', e.target.checked)} />
            <span>Count fast mana as a full land ({plural(m.fastMana, 'card')})</span>
          </label>
        </div>
        <p className="land-note">
          Cheap draw and ramp: draw, card selection, tutors, cycling, mana rocks, mana creatures and land search with mana value
          (or cycling cost) up to the threshold. MDFCs count 0.74 of a land when the land side can enter untapped, 0.38 when it
          always enters tapped. Source: Frank Karsten, <a href={KARSTEN_URL} target="_blank" rel="noopener noreferrer">How Many Lands
          Do You Need in Your Deck? An Updated Analysis</a>.
        </p>
      </details>
    </StatFrame>
  );
}

// Mano iniziale: P(i terre su 7) per i = 0..7, in evidenza le mani da tenere (2-5).
function HandBars({ hand }) {
  const W = 400, H = 170, top = 20, bottom = 26;
  const band = W / hand.length;
  const bw = Math.min(30, band * 0.6);
  const max = Math.max(...hand) || 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg land-hand" role="img"
      aria-label={`Lands in the opening hand: ${hand.map((p, i) => `${i}: ${pct(p)}`).join(', ')}`}>
      <line x1="0" x2={W} y1={H - bottom + 0.5} y2={H - bottom + 0.5} className="stat-axis" />
      {hand.map((p, i) => {
        const h = (p / max) * (H - top - bottom);
        const x = band * i + (band - bw) / 2;
        return (
          <g key={i}>
            {h > 0.5 && <rect x={x} y={H - bottom - h} width={bw} height={h} rx={Math.min(3, h / 2)} className={`stat-bar ${i >= 2 && i <= 5 ? 's1' : 's2 land-dim'}`} />}
            <text x={x + bw / 2} y={H - bottom - h - 6} className="stat-val" textAnchor="middle">{p >= 0.0995 ? Math.round(p * 100) : (p * 100).toFixed(1)}</text>
            <text x={x + bw / 2} y={H - 8} className="stat-tick" textAnchor="middle">{i}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Probabilità (Fase 2): mano iniziale e land drop per turno. Exact: solo terre vere. Ideal: il mazzo senza le pescate
// economiche, MDFC e (col peso w) il ramp economico come terre; limite ottimista. Simulation: dalla Fase 3.
function OddsCard({ m, setSetting, sim }) {
  const [w, setW] = useState(0);
  const o = landOdds(m, w);
  const play = m.settings.play;
  return (
    <StatFrame as="figure" className="stat-card land-odds">
      <figcaption>
        <span className="stat-pill">Land drop odds</span>
        <span className="stat-sub">Exact hypergeometric odds, no mulligans: {plural(m.lands, 'land')} in {m.N} cards.</span>
      </figcaption>
      <div className="land-odds-grid">
        <div className="land-hand-box">
          <h4 className="land-h">Lands in the opening 7 (%)</h4>
          <HandBars hand={o.hand} />
          <p className="land-note">2 to 5 lands: <b>{pct(o.keepable)}</b>. Average {o.mean.toFixed(1)} lands.</p>
        </div>
        <div className="land-drops-box">
          <div className="land-controls">
            <label className="stat-odds-field">
              <span>Turn order</span>
              <select value={play ? 'play' : 'draw'} onChange={(e) => setSetting('play', e.target.value === 'play')}>
                <option value="play">On the play</option>
                <option value="draw">On the draw</option>
              </select>
            </label>
          </div>
          <table className="land-drops">
            <caption className="sr-only">Chance of making every land drop through each turn</caption>
            <thead>
              <tr>
                <th scope="col">Turn</th>
                <th scope="col" title="Lands only, MDFCs not counted">Exact</th>
                <th scope="col" title="Optimistic bound: cheap draw spells shrink the deck, MDFCs count as part of a land">Ideal</th>
                <th scope="col" title="Goldfish simulation with mulligans, ramp and draw">Simulation</th>
              </tr>
            </thead>
            <tbody>
              {o.drops.map((d) => (
                <tr key={d.t}>
                  <th scope="row">{d.t} <span className="land-seen">{d.n} cards</span></th>
                  <td>{pct(d.exact)}</td>
                  <td>{pct(d.ideal)}</td>
                  <td className="land-sim-cell">{sim?.onCurve[d.t - 1] != null ? pct(sim.onCurve[d.t - 1]) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <details className="land-details">
        <summary>About these numbers</summary>
        <p className="land-note">
          Each row is the chance of having played a land on every turn so far: at least t lands among the cards seen by turn t
          ({play ? 'on the play there is no draw on turn 1' : 'on the draw you also draw on turn 1'}). Ideal treats the deck as
          {' '}{m.N - m.cheapDraw} cards ({plural(m.cheapDraw, 'cheap draw spell')} replace themselves) with {f2(o.Ki)} lands
          (MDFCs as fractions{w ? `, cheap ramp as ${w} of a land` : ''}). It assumes every cantrip is cast at once and for free, so it
          is an upper bound: in a 60-card deck it values a cantrip at about 0.43 lands, against Karsten&apos;s empirical 0.28.
        </p>
        <div className="land-controls">
          <label className="stat-odds-field">
            <span>Cheap ramp as a land</span>
            <input type="number" min="0" max="1" step="0.1" value={w} onChange={(e) => {
              const v = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(v)) setW(Math.max(0, Math.min(1, v)));
            }} />
          </label>
        </div>
      </details>
    </StatFrame>
  );
}

// Risultati della simulazione per la sessione: chiave (carte e parametri) → risultato, gli ultimi 20.
const simCache = new Map();

// Simulazione nel worker (landSim.worker.js). start chiude quella in corso e ne lancia una, stop la ferma (terminate).
// result: quello della chiave attuale, sennò l'ultimo finito (outdated: mazzo o parametri cambiati dopo).
function useSim(key) {
  const [state, setState] = useState({ progress: null, error: null, last: null });
  const worker = useRef(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    setState((s) => ({ ...s, progress: null }));
  };
  const start = (input, params) => {
    worker.current?.terminate();
    const w = new Worker(new URL('./landSim.worker.js', import.meta.url), { type: 'module' });
    worker.current = w;
    const done = (patch) => {
      w.terminate();
      if (worker.current === w) worker.current = null;
      setState((s) => ({ ...s, progress: null, ...patch }));
    };
    w.onmessage = ({ data }) => {
      if (data.progress != null) { setState((s) => ({ ...s, progress: data.progress })); return; }
      if (data.error) { done({ error: data.error }); return; }
      simCache.set(key, data.result);
      if (simCache.size > 20) simCache.delete(simCache.keys().next().value);
      done({ last: key });
    };
    w.onerror = (e) => { e.preventDefault(); done({ error: e.message || 'The simulation could not start.' }); };
    setState((s) => ({ ...s, progress: 0, error: null }));
    w.postMessage({ input, params });
  };
  const fresh = simCache.get(key);
  const result = fresh || (state.last && simCache.get(state.last)) || null;
  return { result, outdated: !fresh && !!result, running: state.progress != null, progress: state.progress, error: state.error, start, stop };
}

function NumField({ label, value, min, max, step = 1, onChange }) {
  return (
    <label className="stat-odds-field">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => {
        const v = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
      }} />
    </label>
  );
}

const simShowsFormula = (r, f) => f >= r.rows[0].lands - 0.5 && f <= r.rows[r.rows.length - 1].lands + 0.5;

// Punteggio per numero di terre: banda quasi ottimale in ombra, terre attuali (linea piena) e formula (tratteggiata).
function SimChart({ r, formula }) {
  const W = 400, H = 210, top = 12, bottom = 36, left = 44, right = 12;
  const first = r.rows[0].lands;
  const step = (W - left - right) / r.rows.length; // ogni numero di terre al centro della sua fascia
  const ys = r.rows.map((x) => x.compounded);
  const pad = (Math.max(...ys) - Math.min(...ys)) * 0.15 || 1;
  const lo = Math.min(...ys) - pad, hi = Math.max(...ys) + pad;
  const sx = (v) => left + (v - first + 0.5) * step;
  const sy = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const showFormula = simShowsFormula(r, formula);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg land-sim-chart" role="img"
      aria-label={`Score by land count: ${r.rows.map((x) => `${x.lands}: ${x.compounded.toFixed(1)}`).join(', ')}`}>
      <rect x={sx(r.band[0]) - step / 2} y={top} width={(r.band[1] - r.band[0] + 1) * step} height={H - top - bottom} className="land-band" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={sy(t)} y2={sy(t)} className="stat-grid" />
          <text x={left - 8} y={sy(t) + 4} className="stat-tick" textAnchor="end">{t.toFixed(1)}</text>
        </g>
      ))}
      <line x1={left} x2={W - right} y1={H - bottom + 0.5} y2={H - bottom + 0.5} className="stat-axis" />
      {r.rows.map((x) => <text key={x.lands} x={sx(x.lands)} y={H - bottom + 16} className="stat-tick" textAnchor="middle">{x.lands}</text>)}
      <text x={left + (W - left - right) / 2} y={H - 3} className="stat-axis-title" textAnchor="middle">Lands</text>
      <line x1={sx(r.current)} x2={sx(r.current)} y1={top} y2={H - bottom} className="land-now-line" />
      {showFormula && <line x1={sx(formula)} x2={sx(formula)} y1={top} y2={H - bottom} className="land-formula-line" />}
      <path d={r.rows.map((x, i) => `${i ? 'L' : 'M'}${sx(x.lands)},${sy(x.compounded)}`).join('')} className="land-sim-line" />
      {r.rows.map((x) => <circle key={x.lands} cx={sx(x.lands)} cy={sy(x.compounded)} r={x.lands === r.best ? 5 : 3} className={`land-sim-pt${x.lands === r.best ? ' on' : ''}`} />)}
    </svg>
  );
}

// Una riga delle regole di mulligan: con h carte in mano si tiene da a a b terre.
function KeepRow({ h, keep, setOver }) {
  const [a, b] = keep[h];
  const field = (i, v) => (
    <input type="number" min="0" max="7" value={v} aria-label={`${i ? 'Most' : 'Fewest'} lands to keep ${h} cards`} onChange={(e) => {
      const n = Number(e.target.value);
      if (e.target.value === '' || !Number.isFinite(n)) return;
      const x = Math.max(0, Math.min(7, Math.round(n)));
      setOver({ keep: { ...keep, [h]: i ? [a, x] : [x, b] } });
    }} />
  );
  return <div className="stat-odds-field land-keep" title={`Keep a ${h}-card hand with this many lands`}><span>Keep {h}</span>{field(0, a)}<span>to</span>{field(1, b)}<span>lands</span></div>;
}

// Simulazione (Fase 3): avvio e stop, ottimo e banda, grafico, tabella per numero di terre, impostazioni.
function SimCard({ m, k, params, setOver, sim, onRun }) {
  const r = sim.result;
  const canRun = m.N >= 7 + params.turns;
  const range = r && (r.band[0] === r.band[1] ? `${r.band[0]}` : `${r.band[0]}-${r.band[1]}`);
  const inBand = r && r.current >= r.band[0] && r.current <= r.band[1];
  let where = '';
  if (r) where = inBand ? `Your ${r.current} lands are inside the near-optimal range.` : `Your ${r.current} lands are ${r.current < r.band[0] ? 'below' : 'above'} the near-optimal range.`;
  let status = 'Runs in the background, takes a few seconds.';
  if (!canRun) status = `Needs at least ${7 + params.turns} cards.`;
  else if (r && sim.outdated) status = 'The deck or the settings changed: run it again to update.';
  else if (r) status = `${r.rows.length} land counts, ${params.games.toLocaleString('en')} games each.`;
  // Effetti sul costo (addendum COST-REDUCTION): carte con sconti simulati e carte riconosciute ma non simulate.
  const affinity = m.cards.filter((c) => c.affinity).reduce((n, c) => n + c.qty, 0);
  const reducers = m.cards.filter((c) => c.reducer).reduce((n, c) => n + c.qty, 0);
  const discounts = affinity + reducers > 0;
  const unsupported = m.cards.filter((c) => c.unsupportedCost);
  const cur = r?.rows.find((x) => x.lands === r.current);
  return (
    <StatFrame as="figure" className="stat-card land-sim">
      <figcaption>
        <span className="stat-pill">Goldfish simulation</span>
        <span className="stat-sub">
          Plays {params.games.toLocaleString('en')} games for each land count, with mulligans, ramp, draw, tapped lands and fetches,
          and looks for the count that deploys the most mana value, early turns first.
        </span>
      </figcaption>
      {(discounts || unsupported.length > 0) && (
        <p className="land-note">
          {discounts && <>Discounts modelled: {[affinity && plural(affinity, 'affinity card'), reducers && plural(reducers, 'reducer')].filter(Boolean).join(', ')}
            {params.discounts ? '' : ' (off in the settings)'}. </>}
          {unsupported.length > 0 && <>Not modelled, printed cost: {unsupported.map((c) => `${c.name} (${c.unsupportedCost})`).join(', ')}.</>}
        </p>
      )}
      <div className="land-sim-run">
        <button type="button" className="btn-generate deck-icon-btn" disabled={sim.running || !canRun} onClick={onRun}
          aria-label="Run the simulation" title="Run the simulation"><IconPlay size={16} /></button>
        {sim.running ? (
          <>
            <div className="stat-meter land-progress" role="progressbar" aria-label="Simulation progress" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(sim.progress * 100)}><span style={{ width: `${sim.progress * 100}%` }} /></div>
            <button type="button" className="btn-secondary deck-icon-btn" onClick={sim.stop}
              aria-label="Stop the simulation" title="Stop the simulation"><IconX size={16} /></button>
          </>
        ) : <span className="land-note">{status}</span>}
      </div>
      {sim.error && <p className="land-note land-error" role="alert">{sim.error}</p>}
      {r && (
        <div className={`land-sim-out${sim.outdated ? ' outdated' : ''}`}>
          <p className="land-sim-head">Simulated optimum: <b>{r.best}</b> lands <span>(near-optimal {range})</span></p>
          <p className="land-note">{where}</p>
          <SimChart r={r} formula={k.recommendedLands} />
          <div className="stat-legend land-legend">
            <span><i className="land-swatch band" aria-hidden="true" />Near-optimal</span>
            <span><i className="land-swatch now" aria-hidden="true" />Now ({r.current})</span>
            <span><i className="land-swatch formula" aria-hidden="true" />Formula ({f1(k.recommendedLands)}{simShowsFormula(r, k.recommendedLands) ? '' : ', off the chart'})</span>
          </div>
          <div className="land-table-wrap">
            <table className="land-drops land-sim-table">
              <caption className="sr-only">Simulation results by land count</caption>
              <thead>
                <tr>
                  <th scope="col">Lands</th>
                  <th scope="col" title="Value deployed (mana value of the cards cast), early turns count more">Score</th>
                  <th scope="col" title="Chance of having 3 mana on turn 3">T3</th>
                  <th scope="col" title="Chance of having 4 mana on turn 4">T4</th>
                  <th scope="col" title={`At least ${params.turns + 2} lands seen by turn ${params.turns}`}>Flood</th>
                  <th scope="col" title="At least one mulligan that cost a card">Mull.</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.lands} className={`${x.lands === r.current ? 'now' : ''}${x.lands >= r.band[0] && x.lands <= r.band[1] ? ' band' : ''}`}>
                    <th scope="row">{x.lands}{x.lands === r.best && <span className="land-badge">best</span>}</th>
                    <td>{x.compounded.toFixed(1)}</td>
                    <td>{pct(x.onCurve[2])}</td>
                    <td>{x.onCurve[3] != null ? pct(x.onCurve[3]) : '-'}</td>
                    <td>{pct(x.flood)}</td>
                    <td>{pct(x.mulliganRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="land-note">
            Score: value deployed (MV), where turn 1 counts {params.turns} times and the last turn once. T3 and T4: chance of having that
            much mana on that turn. Flood: at least two lands that could never be played. Mull.: hands that went below 7 cards.
            {discounts && cur && <> Cards count at their printed mana value, whatever they cost: with {r.current} lands a game deploys
              {' '}{f1(cur.deployed)} mana value and pays {f1(cur.manaPaid)} mana.</>}
          </p>
          {Math.abs(k.recommendedLands - r.best) > 2 && (
            <p className="land-note">
              The formula says {f1(k.recommendedLands)}, the simulation {r.best}. The formula is empirical, fitted on successful
              tournament decks{k.extrapolated ? ' (and only extrapolated to this deck size)' : ''}, while the simulation is a goldfish:
              nobody interacts and nothing punishes a slow start, so the two can disagree by a few lands.
            </p>
          )}
        </div>
      )}
      <details className="land-details">
        <summary>Simulation settings</summary>
        <div className="land-sim-settings">
          <NumField label="Turns" value={params.turns} min={4} max={12} onChange={(v) => setOver({ turns: v })} />
          <NumField label="Free mulligans" value={params.freeMulligans} min={0} max={3} onChange={(v) => setOver({ freeMulligans: v })} />
          <NumField label="Games per count" value={params.games} min={1000} max={100000} step={1000} onChange={(v) => setOver({ games: v })} />
          <NumField label="Lands below" value={params.below} min={0} max={10} onChange={(v) => setOver({ below: v })} />
          <NumField label="Lands above" value={params.above} min={0} max={10} onChange={(v) => setOver({ above: v })} />
          <NumField label="Seed" value={params.seed} min={0} max={2147483647} onChange={(v) => setOver({ seed: v })} />
          {[7, 6, 5].map((h) => <KeepRow key={h} h={h} keep={params.keep} setOver={setOver} />)}
          {discounts && (
            <label className="land-check">
              <input type="checkbox" checked={params.discounts} onChange={(e) => setOver({ discounts: e.target.checked })} />
              <span>Cost reductions (off: every card pays its printed cost)</span>
            </label>
          )}
          <label className="land-check">
            <input type="checkbox" checked={params.keepRamp} onChange={(e) => setOver({ keepRamp: e.target.checked })} />
            <span>Also keep 7 cards with 2 lands and a ramp card of mana value up to 2</span>
          </label>
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setOver(null)}
            aria-label="Reset the simulation settings" title="Back to the default settings"><IconReplay size={14} /></button>
        </div>
        <p className="land-note">
          Turn order comes from Land drop odds ({params.play ? 'on the play' : 'on the draw'}). Lands in a hand include MDFCs; with 4 cards
          or fewer the hand is always kept. The same seed gives the same numbers.
        </p>
      </details>
      <p className="land-note">
        A model, not a game: no interaction, mana sinks, Treasures, color requirements or discounts other than affinity and
        static reducers, and lands that enter tapped only sometimes count as untapped.
      </p>
    </StatFrame>
  );
}

// Una carta: costo, badge (cheap, sconti, non simulata), motivi, ruolo (e mana prodotto per il ramp, peso per le MDFC),
// effetto sul costo (con sconto e filtro per i riduttori), reset dell'override.
function RoleRow({ c, onOverride }) {
  const set = (patch) => onOverride(c.name, patch);
  const filter = c.reducer && filterText(c.reducer.filter);
  return (
    <li className={`land-role-row${c.overridden ? ' changed' : ''}`}>
      <div className="land-role-card">
        <span className="deck-qty">{c.qty}</span>
        <span className="land-role-name">{c.name}</span>
        {c.role !== 'land' && <span className="land-mv" title="Mana value">{c.mv}{c.hasX ? '+X' : ''}</span>}
        {c.cheap && (c.role === 'ramp' || c.role === 'draw') && <span className="land-badge">cheap</span>}
        {c.affinity && <span className="land-badge cost" title="Costs 1 less for each artifact you control">Affinity</span>}
        {c.reducer && <span className="land-badge cost" title="Lowers the generic cost of these spells while on the battlefield">
          -{c.reducer.amount} {filter || 'all'} spells</span>}
        {c.unsupportedCost && <span className="land-badge off" title={`The simulation pays the printed cost: ${c.unsupportedCost}`}>Not modelled</span>}
        <span className="land-reasons">{c.overridden ? 'Set by you' : c.reasons.join('. ')}</span>
      </div>
      <div className="land-role-ctl">
        <select value={c.role} aria-label={`Role of ${c.name}`} onChange={(e) => set({ role: e.target.value === c.baseRole ? null : e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        {c.role === 'ramp' && c.rampKind !== 'landSearch' && (
          <input type="number" min="0" max="20" value={c.manaProduced} aria-label={`Mana produced by ${c.name}`} title="Mana produced"
            onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) set({ mana: Math.max(0, Math.min(20, Math.round(v))) }); }} />
        )}
        {c.role === 'mdfc' && (
          <select value={c.mdfcWeight} aria-label={`Land weight of ${c.name}`} title="Counts as this much of a land" onChange={(e) => set({ weight: Number(e.target.value) })}>
            {[...new Set([0.74, 0.38, c.mdfcWeight])].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        )}
        {c.role !== 'land' && (c.baseCost || c.affinity || c.reducer) && (
          <select value={c.affinity ? 'affinity' : c.reducer ? 'reducer' : 'none'} aria-label={`Cost reduction of ${c.name}`}
            title="Cost reduction in the simulation" onChange={(e) => set({ cost: e.target.value })}>
            <option value="none">No discount</option>
            <option value="affinity">Affinity for artifacts</option>
            {c.permanent && <option value="reducer">Makes spells cheaper</option>}
          </select>
        )}
        {c.reducer && (
          <>
            <input type="number" min="0" max="20" value={c.reducer.amount} aria-label={`Discount of ${c.name}`} title="Generic mana less per spell"
              onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) set({ cost: 'reducer', amount: Math.max(0, Math.min(20, Math.round(v))) }); }} />
            <input type="text" className="import-link-input land-filter" maxLength={60} spellCheck={false} key={filter} defaultValue={filter}
              placeholder="all spells" aria-label={`Spells discounted by ${c.name}`}
              title="Which spells: blue, artifact, instant and sorcery, goblin... One kind of word at a time. Empty: all spells"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!parseFilter(v)) e.target.value = filter; // parole di tipi diversi: si torna al filtro attuale
                else if (v !== filter) set({ cost: 'reducer', filter: v });
              }} />
          </>
        )}
        {c.overridden && (
          <button type="button" className="btn-secondary deck-icon-btn" aria-label={`Reset ${c.name}`} title="Back to the automatic values"
            onClick={() => set({ role: null, mana: null, weight: null, cost: null, amount: null, filter: null })}><IconReplay size={14} /></button>
        )}
      </div>
    </li>
  );
}

function RolesCard({ m, onOverride, cmdrPick }) {
  const groups = GROUPS.map((g) => ({ g, cards: m.cards.filter((c) => c.role === g).sort((a, b) => a.mv - b.mv || a.name.localeCompare(b.name)) }))
    .filter((x) => x.cards.length);
  return (
    <StatFrame className="stat-card land-roles">
      <span className="stat-pill">Card roles</span>
      <p className="stat-sub">What each card does for your mana. Change a role if the guess is wrong: every number above updates.</p>
      {m.commanders.length > 0 && <p className="land-note">Commander, not counted: {m.commanders.map((c) => c.name).join(', ')}.</p>}
      {cmdrPick}
      {groups.map(({ g, cards }) => (
        <details key={g} className="land-group" open={g !== 'land' && g !== 'spell'}>
          <summary className="stat-mv-group"><h4>{GROUP_LABEL[g]} <span className="n">{cards.reduce((n, c) => n + c.qty, 0)}</span></h4></summary>
          <ul>{cards.map((c) => <RoleRow key={c.oid} c={c} onOverride={onOverride} />)}</ul>
        </details>
      ))}
    </StatFrame>
  );
}

function LandPanel({ deck, update }) {
  const { oracle, loading, error } = useOracle(deck.cards);
  const [simOver, setSimOver] = useState({}); // impostazioni della simulazione cambiate a mano (solo per la sessione)
  const m = landModel(deck, oracle);
  const s = m.settings;
  const input = simInput(m);
  const params = simParams(m, simOver);
  const sim = useSim(JSON.stringify([input, params]));
  if (!m.N && !m.commanders.length) {
    return loading ? <p className="field-hint">Loading card data from Scryfall…</p> : null;
  }
  const k = karsten(m);
  // Ogni modifica riscrive deck.landAnalysis intero (settings e lista degli override).
  const save = (fn) => update((d) => ({ ...d, landAnalysis: fn({ overrides: d.landAnalysis?.overrides || [], settings: d.landAnalysis?.settings || {} }) }));
  const setSetting = (key, v) => save((x) => ({ ...x, settings: { ...x.settings, [key]: v } }));
  const onOverride = (name, patch) => save((x) => {
    const o = { ...(x.overrides.find((y) => y.name === name) || { name }), ...patch };
    const rest = x.overrides.filter((y) => y.name !== name);
    return { ...x, overrides: o.role || Number.isFinite(o.mana) || Number.isFinite(o.weight) || o.cost ? [...rest, o] : rest };
  });
  const fmtLabel = (id) => LAND_FORMATS.find(([f]) => f === id)[1];
  // Commander senza comandante nel mazzo: si sceglie qui (solo per l'analisi, il mazzo non cambia).
  const legends = s.format === 'commander' && !deck.cards.some((r) => r.board === 'main' && r.commander)
    ? deck.cards.filter((r) => r.board === 'main' && r.card.cmdr) : [];
  const cmdrPick = legends.length > 0 && (
    <label className="stat-odds-field land-cmdr">
      <span>Commander</span>
      <select value={s.cmdr || ''} onChange={(e) => setSetting('cmdr', e.target.value || null)}>
        <option value="">None</option>
        {[...new Map(legends.map((r) => [r.card.oid, r.card.name]))].map(([oid, name]) => <option key={oid} value={oid}>{name}</option>)}
      </select>
    </label>
  );
  const sizeSub = s.format === 'commander' ? `library, ${plural(m.commanders.length, 'commander')} apart`
    : s.format === '60' && m.N !== 60 ? 'not 60: the formula is scaled' : 'main deck';
  return (
    <div className="land-analysis">
      <div className="stat-colors stat-tiles" role="list" aria-label="Land analysis summary">
        <Tile label="Format" sub={deck.landAnalysis?.settings?.format ? 'set by you' : `detected: ${fmtLabel(s.auto)}`}>
          <select className="land-format" value={deck.landAnalysis?.settings?.format || 'auto'} aria-label="Analysis format"
            onChange={(e) => setSetting('format', e.target.value === 'auto' ? null : e.target.value)}>
            <option value="auto">Auto</option>
            {LAND_FORMATS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Tile>
        <Tile label="Deck size" value={m.N} sub={sizeSub} />
        <Tile label="Lands" value={m.mdfcWeight ? f2(m.lands + m.mdfcWeight) : m.lands}
          sub={m.mdfcWeight ? `${m.lands} + ${plural(m.mdfcUntapped + m.mdfcTapped, 'MDFC')}` : 'MDFCs count as fractions'} />
        <Tile label="Avg mana value" value={f2(m.avgMV)} sub="nonland, no commander" />
        <Tile label="Cheap draw" value={m.cheapDraw} sub={`mana value up to ${s.cheap}`} />
        <Tile label="Cheap ramp" value={m.cheapRamp} sub={`mana value up to ${s.cheap}`} />
        {s.format !== 'commander' && <Tile label="Companion" value={m.companion ? 'Yes' : 'No'} sub="in the sideboard" />}
      </div>
      {(loading || m.unknown.length > 0) && (
        <p className="land-note" role="status">
          {loading ? 'Loading card data from Scryfall…'
            : `Not analysed (${m.unknown.reduce((n, c) => n + c.qty, 0)}): ${m.unknown.map((c) => c.name).join(', ')}. ${error ? `Scryfall: ${error}` : 'No card data for these.'}`}
        </p>
      )}
      <FormulaCard m={m} k={k} setSetting={setSetting} />
      <OddsCard m={m} setSetting={setSetting} sim={sim.outdated ? null : sim.result?.rows.find((x) => x.lands === sim.result.current)} />
      <SimCard m={m} k={k} params={params} sim={sim} onRun={() => sim.start(input, params)}
        setOver={(patch) => setSimOver((o) => (patch ? { ...o, ...patch } : {}))} />
      <RolesCard m={m} onOverride={onOverride} cmdrPick={cmdrPick} />
    </div>
  );
}

export default memo(LandPanel);
