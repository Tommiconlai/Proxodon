import { memo, useEffect, useState } from 'react';
import { deckBracket } from './deckModel';
import { StatFrame } from './DeckStats';
import { NumField } from './LandPanel';
import { K, ROLE_CODES, pillDisagrees, powerAnalysis, powerInput, spellbookCombos, toggleRole, withEntry } from './powerAnalysis';
import { COMBOS, DEFAULT_WEIGHTS, FACTORS, STRENGTHS, TIERS, WIN_LABEL, WIN_LINES, ruleChecks } from './powerRules';
import { useOracle } from './useOracle';
import { IconAlert, IconReplay } from '../components/icons';
import { MAX_DECK_VIEWS, MAX_POWER_FIXES, setSetting, useSettings } from '../utils/settings';

// Scheda Power, solo Commander (forma A): quadrante con l'indice e il bracket da dichiarare, i cinque fattori, le regole
// ufficiali; conti, impostazioni e ruoli delle carte in due voci chiuse. Il calcolo sta in powerAnalysis.js.
// Pesi, correzioni e Spellbook sono preferenze dell'utente, in tutti i mazzi; forza del comandante e linea di vittoria
// valgono per mazzo (powerDecks), anche guardando i mazzi degli altri: il mazzo non cambia mai.

const f2 = (x) => x.toFixed(2);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const count = (rows) => rows.reduce((n, x) => n + (x.card ?? x).qty, 0);
const ROLE_NAME = {
  r: 'Ramp', f: 'Fast mana', x: 'Removal', w: 'Wipe', c: 'Counter', p: 'Protection', z: 'Free', t: 'Tutor', e: 'Draw engine',
  d: 'Single draw', n: 'Extra turn', m: 'Land denial', g: 'Game Changer', T: 'Tapped land', K: 'Sometimes tapped',
};
const GROUPS = [
  ['Not found', (c) => !c.found], ['Commander', (c) => c.found && c.commander],
  ['Spells', (c) => c.found && !c.commander && !c.land], ['Lands', (c) => c.found && !c.commander && c.land],
];

// public/combos.json (250 KB compressi): una volta sola, alla prima scheda Power con Spellbook acceso.
let combosData = null;
let combosFile = null;
const loadCombos = () => {
  combosFile ??= fetch('combos.json').then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }).then((data) => { combosData = data; return data; }, (e) => { combosFile = null; throw e; });
  return combosFile;
};

function useCombos(on) {
  const [file, setFile] = useState(() => ({ data: combosData, error: null }));
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    loadCombos().then((data) => live && setFile({ data, error: null }), (e) => live && setFile({ data: null, error: e.message }));
    return () => { live = false; };
  }, [on]);
  return { data: on ? file.data : null, loading: on && !file.data && !file.error, error: on ? file.error : null };
}

// Quadrante da 0 a 10: da 150° a 390°, 24° per punto. Le fasce hanno il nome accanto: il colore è il gradiente del sito.
const CX = 200, CY = 160, R = 130;
const RAMP = ['#00B8D9', '#4F8DF0', '#AB61ED', '#E044BE', '#FF2E96'];
const ZONES = TIERS.map((t, i) => ({ ...t, to: TIERS[i + 1]?.from ?? 10, color: RAMP[i] }));
const pt = (v, r) => {
  const a = ((150 + v * 24) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)].map((n) => +n.toFixed(1));
};
const arc = (a, b) => `M${pt(a, R)}A${R} ${R} 0 0 1 ${pt(b, R)}`;
const tick = (v) => `M${pt(v, R - 15)}L${pt(v, R + 15)}`;

function Gauge({ P, tier, ruleMin }) {
  const rule = ruleMin > 2 ? TIERS.find((t) => t.value === ruleMin) : null;
  const [rx, ry] = rule ? pt(rule.from, R + 20) : [];
  const right = rule?.from > 5; // a destra del centro l'etichetta va verso l'esterno dall'altra parte
  return (
    <svg viewBox="0 0 400 244" className="power-gauge" role="img"
      aria-label={`Gauge from 0 to 10: power index ${f2(P)}, tier ${tier.name}.${rule ? ` Rules minimum marked at the start of ${rule.name}.` : ''}`}>
      {ZONES.map((z) => <path key={z.id} d={arc(z.from + 0.05, z.to - 0.05)} className="power-track" />)}
      {ZONES.filter((z) => z.from + 0.05 < P).map((z) => <path key={z.id} d={arc(z.from + 0.05, Math.min(z.to - 0.05, P))} className="power-lit" stroke={z.color} />)}
      {ZONES.map((z) => {
        const [x, y] = pt((z.from + z.to) / 2, R + 24);
        return <text key={z.id} x={x} y={y + 4} textAnchor="middle" className="power-zone">{z.label}</text>;
      })}
      <path d={tick(P)} className="power-mark" />
      {rule && (
        <>
          <path d={tick(rule.from)} className="power-rule" />
          <text x={rx + (right ? 4 : -4)} y={ry} textAnchor={right ? 'start' : 'end'} className="power-rule-label">Rules min</text>
        </>
      )}
      <text x={CX} y="168" textAnchor="middle" className="power-p">{f2(P)}</text>
      <text x={CX} y="196" textAnchor="middle" className="power-out">OUT OF 10</text>
    </svg>
  );
}

const Mini = ({ label, value, className }) => <div className={className}><dt className="power-label">{label}</dt><dd>{value}</dd></div>;

function Hero({ r, own }) {
  return (
    <StatFrame className="stat-card power-hero">
      <span className="stat-pill">Power index</span>
      <Gauge P={r.P} tier={r.tier} ruleMin={r.rules.ruleMin} />
      <div className="power-verdict">
        <div className="power-declare">
          <span className="power-label">Declare at the table</span>
          <span className="power-chip">{r.declared.label}</span>
        </div>
        <p className="power-note">{r.declared.note}</p>
        <dl className="power-minis">
          <Mini label="Tier" value={r.tier.name} />
          <Mini label="Rules min" value={`B${r.rules.ruleMin}`} />
          <Mini label="Commander" value={`x ${r.commanderMultiplier.toFixed(1)}`} className="power-mini-cmd" />
          <Mini label="Win line" value={own.mode ? WIN_LABEL[own.mode] : 'Auto'} />
        </dl>
      </div>
    </StatFrame>
  );
}

function Factors({ r }) {
  const { S, I, C, W, M } = r.details;
  const notes = {
    S: `eff. MV ${f2(S.effMV)}`, I: plural(count(I.rows), 'card'), C: plural(count(C.tutors), 'tutor'),
    W: plural(W.combos.length, 'combo'), M: `${Math.round(M.fraction * 100)}% untapped`,
  };
  return (
    <StatFrame className="stat-card">
      <span className="stat-pill">Factors</span>
      <ul className="power-factors">
        {FACTORS.map(([k, name]) => (
          <li key={k}>
            <span>
              <span className="power-name">{name}</span>
              <span className="power-sub">{Math.round(r.weights[k] * 100)}%, {notes[k]}</span>
            </span>
            <span className="stat-meter" aria-hidden="true"><span style={{ width: `${r.factors[k] * 10}%` }} /></span>
            <span className="power-value">{f2(r.factors[k])}</span>
          </li>
        ))}
      </ul>
    </StatFrame>
  );
}

const Warn = ({ children }) => <p className="power-warn"><IconAlert size={18} /><span>{children}</span></p>;

// Regole ufficiali, una riga per condizione. La pill accanto al nome resta com'è: se dice altro, un avviso.
function Rules({ r, deck, brackets }) {
  const pill = deckBracket(deck);
  return (
    <StatFrame className="stat-card">
      <span className="stat-pill">Official rules</span>
      <ul className="power-rules">
        {ruleChecks(r.rules).map((c) => (
          <li key={c.id} className={c.on ? 'on' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d={c.on ? 'M12 4l8 8-8 8-8-8z' : 'M6 12h12'} />
            </svg>
            <div>
              {c.on ? c.text : c.off}
              {c.on && <span className="power-sub">{c.items.join(', ')}</span>}
            </div>
            {c.on && <span className="power-tag">B{c.min}</span>}
          </li>
        ))}
      </ul>
      {r.rules.earlyCombo && r.declared.value < 4 && (
        <Warn>Early two-card combo: Bracket 3 allows two-card combos only if they do not end the game in the first turns.</Warn>
      )}
      {brackets && pillDisagrees(pill, r.declared.value) && (
        <Warn>The pill by the deck name says Bracket {pill}{deck.bracket == null ? ': it counts Game Changers only.' : ', set by hand.'}</Warn>
      )}
    </StatFrame>
  );
}

const ResetBtn = ({ label, onClick }) => (
  <button type="button" className="btn-secondary deck-icon-btn" onClick={onClick} aria-label={label} title={label}><IconReplay size={14} /></button>
);

// I conti fattore per fattore e le combo trovate.
function Terms({ r }) {
  const { S, I, C, W, M } = r.details;
  const lines = [
    ['S', `Effective mana value ${f2(S.effMV)}: average ${f2(S.avgMV)} on ${plural(S.nonLands, 'nonland')}, less ${K.rampBonus} for each of ${plural(S.cheap, 'ramp card')} up to mana value 2. Then 10 × (${K.sTop} − ${f2(S.effMV)}) / ${K.sSpan}.`],
    ['I', `${plural(count(I.rows), 'card')} worth ${f2(I.sum)}, divided by ${K.iDiv}. Free 2, mana value up to 1 = 1.5, 2 = 1, 3 = 0.5, more = 0.25.`],
    ['C', `${K.cScale} × (tutors ${f2(C.tutorSum)} + 0.5 × draw ${f2(C.drawSum)}). Tutors up to mana value 2 count 1, the others 0.5; draw engines 1, single draws 0.3.`],
    ['W', `${WIN_LABEL[W.mode]} ${W.base}, plus ${W.redundant} for further combos, plus ${W.extra} for extra lines.`],
    ['M', `${K.mLand} × ${f2(M.fraction)} of the ${plural(M.lands, 'land')} untapped + ${count(M.fast)} fast mana (up to ${K.mFastCap}). Lands tapped only sometimes count 0.75.`],
  ];
  return (
    <>
      <table className="land-terms power-terms">
        <tbody>
          {lines.map(([k, how]) => (
            <tr key={k}>
              <td>{FACTORS.find(([id]) => id === k)[1]}<span className="power-sub">{how}</span></td>
              <td>{f2(r.factors[k])}</td>
            </tr>
          ))}
          <tr className="sum">
            <td>Power index<span className="power-sub">Weighted sum {f2(r.pRaw)} × commander {r.commanderMultiplier.toFixed(1)}.</span></td>
            <td>{f2(r.P)}</td>
          </tr>
        </tbody>
      </table>
      {W.combos.length > 0 && (
        <>
          <h4 className="land-h">Combos in this deck</h4>
          <ul className="power-combos">
            {W.combos.map((c) => <li key={c.cards.join()}>{c.cards.join(' + ')} <span className="land-badge cost">{WIN_LABEL[c.kind]}</span></li>)}
          </ul>
        </>
      )}
    </>
  );
}

// Tutto ciò che si può cambiare: i valori di questo mazzo, i pesi, Spellbook.
function Controls({ r, own, setDeck, weights, s, combos }) {
  const { W } = r.details;
  return (
    <>
      <h4 className="land-h">This deck</h4>
      <div className="land-controls">
        <label className="stat-odds-field">
          <span>Commander</span>
          <select value={r.commanderMultiplier} onChange={(e) => { const v = Number(e.target.value); setDeck({ strength: v === 1 ? null : v }); }}>
            {!STRENGTHS.some(([v]) => v === r.commanderMultiplier) && <option value={r.commanderMultiplier}>x {r.commanderMultiplier}</option>}
            {STRENGTHS.map(([v, label]) => <option key={v} value={v}>x {v.toFixed(1)}, {label}</option>)}
          </select>
        </label>
        <label className="stat-odds-field">
          <span>Win line</span>
          <select value={own.mode || 'auto'} onChange={(e) => setDeck({ mode: e.target.value === 'auto' ? null : e.target.value })}>
            <option value="auto">Auto: {WIN_LABEL[W.autoMode]}</option>
            {Object.keys(WIN_LINES).map((m) => <option key={m} value={m}>{WIN_LABEL[m]}</option>)}
          </select>
        </label>
        <NumField label="Extra win lines" value={W.extra} min={0} max={6} onChange={(v) => setDeck({ extra: v || null })} />
        {Object.keys(own).length > 0 && <ResetBtn label="Back to the automatic values for this deck" onClick={() => setDeck({ strength: null, mode: null, extra: null })} />}
      </div>
      <h4 className="land-h">All decks</h4>
      <div className="land-controls">
        {FACTORS.map(([k, name]) => (
          <NumField key={k} label={name} value={Math.round(weights[k] * 100)} min={0} max={100}
            onChange={(v) => setSetting('powerWeights', { ...s.powerWeights, [k]: v / 100 })} />
        ))}
        {Object.keys(s.powerWeights).length > 0 && <ResetBtn label="Back to the default weights" onClick={() => setSetting('powerWeights', {})} />}
      </div>
      <label className="land-check">
        <input type="checkbox" checked={s.powerSpellbook} onChange={(e) => setSetting('powerSpellbook', e.target.checked)} />
        <span>Count the combos of Commander Spellbook</span>
      </label>
      <p className="land-note">
        Weights: only their ratio counts. Everything here stays in your preferences, the deck does not change. Combos: {COMBOS.length} well-known ones
        {combos.data ? <>, plus a copy of <a href="https://commanderspellbook.com" target="_blank" rel="noopener noreferrer">Commander Spellbook</a> with {combos.data.combos.length.toLocaleString('en')} of two or three cards that are infinite or win the game</> : ''}.
        Longer combos do not count.
      </p>
    </>
  );
}

// Una carta: quantità, nome, ruoli; aperta, tutti i ruoli da accendere o spegnere. Le caselle si creano solo all'apertura.
function RoleRow({ c, fix, setFix }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`power-role${c.fixed ? ' changed' : ''}`}>
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>
          <span className="deck-qty">{c.qty}</span>
          <span className="land-role-name">{c.name}</span>
          {!c.land && <span className="land-mv" title="Mana value">{c.cmc}</span>}
          {[...c.roles].map((role) => <span key={role} className="land-badge cost">{ROLE_NAME[role]}</span>)}
          {c.fixed && <span className="land-badge">Set by you</span>}
        </summary>
        {open && (
          <div className="power-role-edit">
            {[...ROLE_CODES].map((role) => (
              <label key={role} className="land-check">
                <input type="checkbox" checked={c.roles.includes(role)} onChange={() => setFix(c.name, toggleRole(fix, role, c.auto))} />
                <span>{ROLE_NAME[role]}</span>
              </label>
            ))}
            {!c.found && (
              <>
                <NumField label="Mana value" value={c.cmc} min={0} max={20} onChange={(v) => setFix(c.name, { ...fix, cmc: v })} />
                <label className="land-check">
                  <input type="checkbox" checked={c.land} onChange={(e) => setFix(c.name, { ...fix, land: e.target.checked })} />
                  <span>Land</span>
                </label>
              </>
            )}
            {c.fixed && <ResetBtn label={`Back to the automatic roles of ${c.name}`} onClick={() => setFix(c.name, {})} />}
          </div>
        )}
      </details>
    </li>
  );
}

function Roles({ r, fixes, setFix }) {
  return (
    <>
      <p className="land-note">Open a card to change its roles: every number updates. A correction follows the card&apos;s name in all your decks.</p>
      {GROUPS.map(([label, test]) => {
        const cards = r.cards.filter(test).sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));
        return cards.length > 0 && (
          <details key={label} className="land-group" open={label !== 'Lands'}>
            <summary className="stat-mv-group"><h4>{label} <span className="n">{count(cards)}</span></h4></summary>
            <ul>{cards.map((c) => <RoleRow key={c.name} c={c} fix={fixes[c.name]} setFix={setFix} />)}</ul>
          </details>
        );
      })}
    </>
  );
}

// Voce chiusa: il contenuto si crea solo all'apertura. Aperta prende tutta la riga.
function Fold({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="power-fold" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {open && <div className="power-fold-body">{children}</div>}
    </details>
  );
}

function PowerPanel({ deck }) {
  const { oracle, loading, error } = useOracle(deck.cards);
  const s = useSettings();
  const combos = useCombos(s.powerSpellbook);
  const rows = powerInput(deck, oracle);
  if (!rows.length) return <p className="deck-empty deck-empty-big">Add cards to the main deck to see its power.</p>;
  if (loading) return <p className="field-hint" role="status">Loading card data from Scryfall…</p>;
  const own = s.powerDecks[deck.id] || {};
  const weights = { ...DEFAULT_WEIGHTS, ...s.powerWeights };
  const r = powerAnalysis({
    cards: rows, settings: { ...own, weights }, fixes: s.powerFixes, combos: combos.data ? spellbookCombos(combos.data, rows) : [],
  });
  const setDeck = (patch) => deck.id && setSetting('powerDecks', withEntry(s.powerDecks, deck.id, { ...own, ...patch }, MAX_DECK_VIEWS));
  const setFix = (name, fix) => setSetting('powerFixes', withEntry(s.powerFixes, name, fix, MAX_POWER_FIXES));
  return (
    <div className="power-panel">
      {r.unknown.length > 0 && (
        <p className="land-note" role="status">
          Not found ({count(r.unknown)}): {r.unknown.map((c) => c.name).join(', ')}. They count as spells of mana value 0 until you set them in Card roles.
          {error ? ` Scryfall: ${error}` : ''}
        </p>
      )}
      {combos.loading && <p className="land-note" role="status">Loading the Commander Spellbook combos…</p>}
      {combos.error && <p className="land-note" role="status">Commander Spellbook is not available ({combos.error}): only the well-known combos count.</p>}
      <Hero r={r} own={own} />
      <div className="power-row">
        <Factors r={r} />
        <Rules r={r} deck={deck} brackets={s.brackets} />
      </div>
      <div className="power-folds">
        <Fold title="How it is computed">
          <Terms r={r} />
          <Controls r={r} own={own} setDeck={setDeck} weights={weights} s={s} combos={combos} />
        </Fold>
        <Fold title="Card roles"><Roles r={r} fixes={s.powerFixes} setFix={setFix} /></Fold>
      </div>
    </div>
  );
}

export default memo(PowerPanel);
