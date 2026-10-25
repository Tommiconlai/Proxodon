import { memo, useEffect, useState } from 'react';
import { StatFrame } from './DeckStats';
import { cachedOracle, fetchOracle } from './scryfallSearch';
import { landModel, karsten, landOdds, ROLES, ROLE_LABEL, LAND_FORMATS, KARSTEN_URL } from './landAnalysis';
import { IconReplay } from '../components/icons';

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

// Una carta: costo, badge cheap, motivi, ruolo (e mana prodotto per il ramp, peso per le MDFC), reset dell'override.
function RoleRow({ c, onOverride }) {
  const set = (patch) => onOverride(c.name, patch);
  return (
    <li className={`land-role-row${c.overridden ? ' changed' : ''}`}>
      <div className="land-role-card">
        <span className="deck-qty">{c.qty}</span>
        <span className="land-role-name">{c.name}</span>
        {c.role !== 'land' && <span className="land-mv" title="Mana value">{c.mv}{c.hasX ? '+X' : ''}</span>}
        {c.cheap && (c.role === 'ramp' || c.role === 'draw') && <span className="land-badge">cheap</span>}
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
        {c.overridden && (
          <button type="button" className="btn-secondary deck-icon-btn" aria-label={`Reset ${c.name}`} title="Back to the automatic role"
            onClick={() => set({ role: null, mana: null, weight: null })}><IconReplay size={14} /></button>
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
  const m = landModel(deck, oracle);
  const s = m.settings;
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
    return { ...x, overrides: o.role || Number.isFinite(o.mana) || Number.isFinite(o.weight) ? [...rest, o] : rest };
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
      <OddsCard m={m} setSetting={setSetting} />
      <RolesCard m={m} onOverride={onOverride} cmdrPick={cmdrPick} />
    </div>
  );
}

export default memo(LandPanel);
