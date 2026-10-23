import { useEffect, useRef, useState } from 'react';
import { templateById } from './templates';
import { clampPos, fitSize, layoutRules, parseRules, CARD_TYPES } from './tokenModel';
import { prepare, renderToken, fontOf, ptBox, CREDIT_ICON } from './renderToken';
import { loadSubtypes } from './typeCatalog';
import { IconImage } from '../components/icons';

// Il token in modifica: il canvas (lo stesso disegno del PNG) e sopra, a filo delle zone della cornice, i campi da
// scrivere direttamente sulla carta, con un contorno leggero che esiste solo qui (il PNG non lo ha). Il campo che si sta
// scrivendo mostra il suo testo e il canvas lo salta; gli altri sono trasparenti sopra il testo disegnato. La riga del
// tipo è a tendine (tipi e sottotipi, + per aggiungerne). Si trascina l'immagine, rotella o due dita la ingrandiscono,
// frecce e +/- da tastiera; senza immagine la finestra dell'arte è un pulsante per sceglierne una.

const CSS_FAMILY = { display: 'var(--font-display)', body: "'Space Grotesk', system-ui, sans-serif", mono: 'var(--font-mono)' };
const pct = (v, of) => `${(v / of) * 100}%`;
const box = (z) => ({ left: pct(z.x, 630), top: pct(z.y, 880), width: pct(z.w, 630), height: pct(z.h, 880) });

let mctx = null;
const measurer = (z) => (t, s) => {
  mctx ??= document.createElement('canvas').getContext('2d');
  mctx.font = fontOf(z, s);
  return mctx.measureText(t).width;
};
// Corpo in pixel per u unità della carta, mai sotto i 16 px nel campo (sotto, i telefoni ingrandiscono la pagina al
// tocco): il campo è più grande e ridotto con scale, così sullo schermo misura quanto il testo disegnato.
function scaled(k, u, z) {
  const px = u * k;
  const fs = Math.max(16, px);
  const sc = px / fs;
  return {
    position: 'absolute', left: 0, top: 0, width: `${100 / sc}%`, height: `${100 / sc}%`,
    transform: `scale(${sc})`, transformOrigin: '0 0', fontSize: fs, fontFamily: CSS_FAMILY[z.font], fontWeight: z.weight,
    '--u': k / sc, // pixel del campo per unità della carta, per i margini
  };
}

function Line({ z, k, value, onChange, placeholder, label, focus, setFocus, name, dx = 0, maxLength }) {
  const size = value ? fitSize(measurer(z), value, z.w - 2 * (z.pad || 0) - dx, z.size, z.min) : z.size;
  const st = scaled(k, size, z);
  return (
    <div className="token-zone" style={box(z)}>
      <input className={`token-edit${focus === name ? ' editing' : ''}`} value={value} placeholder={placeholder} aria-label={label}
        maxLength={maxLength} spellCheck={false} onFocus={() => setFocus(name)} onBlur={() => setFocus(null)}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...st, paddingLeft: `calc(${(z.pad || 0) + dx} * var(--u) * 1px)`, paddingRight: `calc(${z.pad || 0} * var(--u) * 1px)` }} />
    </div>
  );
}

function Rules({ z, k, value, onChange, focus, setFocus }) {
  const inner = { w: z.w - 2 * z.pad, h: z.h - 2 * z.pad };
  const { size, lines } = layoutRules(measurer(z), parseRules(value), inner, z);
  const top = z.pad + (value ? (inner.h - lines.length * size * z.lineH) / 2 : 0);
  const st = scaled(k, size, z);
  return (
    <div className="token-zone" style={box(z)}>
      <textarea className={`token-edit${focus === 'rules' ? ' editing' : ''}`} value={value} placeholder="Rules text, {T} {G} become symbols"
        aria-label="Rules text" maxLength={600} onFocus={() => setFocus('rules')} onBlur={() => setFocus(null)} onChange={(e) => onChange(e.target.value)}
        style={{ ...st, lineHeight: z.lineH, padding: `calc(${top} * var(--u) * 1px) calc(${z.pad} * var(--u) * 1px) 0` }} />
    </div>
  );
}

function PowerToughness({ z, k, power, toughness, set, focus, setFocus }) {
  const text = `${power}/${toughness}`;
  const st = scaled(k, fitSize(measurer(z), text, z.w - 16, z.size, z.min), z);
  const editing = focus === 'pt';
  const input = (key, value, label) => (
    <input className={`token-edit${editing ? ' editing' : ''}`} value={value} placeholder="0" aria-label={label} maxLength={3} inputMode="numeric"
      onFocus={() => setFocus('pt')} onBlur={() => setFocus(null)} onChange={(e) => set({ [key]: e.target.value })} />
  );
  return (
    <div className="token-zone" style={box(z)}>
      <div className={`token-pt${editing ? ' editing' : ''}`} style={st}>
        {input('power', power, 'Power')}<span aria-hidden="true">/</span>{input('toughness', toughness, 'Toughness')}
      </div>
    </div>
  );
}

// Riga del tipo: una tendina per tipo (cambiarlo, o Remove), un + per aggiungerne; dopo il trattino i sottotipi dei tipi
// scelti (dai cataloghi di Scryfall), con il loro +.
function TypeLine({ z, k, types, subtypes, set, indent }) {
  const [subs, setSubs] = useState([]);
  const key = types.join('|');
  useEffect(() => {
    let on = true;
    loadSubtypes(key ? key.split('|') : []).then((l) => { if (on) setSubs(l); });
    return () => { on = false; };
  }, [key]);
  const st = scaled(k, z.size, z);
  const edit = (list, i, v) => (v === '' ? list.filter((_, j) => j !== i) : list.map((x, j) => (j === i ? v : x)));
  const chip = (list, field, options, label) => list.map((v, i) => (
    <select key={`${v}-${i}`} className="token-chip" value={v} aria-label={`${label} ${i + 1}`} title={`${label}: change or remove`} style={{ '--chars': v.length }}
      onChange={(e) => set({ [field]: edit(list, i, e.target.value) })}>
      {[...new Set([v, ...options])].map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="">Remove</option>
    </select>
  ));
  const add = (list, field, options, label) => (
    <select className="token-chip-add" value="" aria-label={label} title={label}
      onChange={(e) => { if (e.target.value) set({ [field]: [...list, e.target.value] }); }}>
      <option value="" disabled hidden>+</option>
      {options.filter((o) => !list.includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="token-zone" style={box(z)}>
      <div className="token-edit token-typeline" role="group" aria-label="Type line"
        style={{ ...st, paddingLeft: `calc(${z.pad + indent} * var(--u) * 1px)`, paddingRight: `calc(${z.pad} * var(--u) * 1px)` }}>
        {chip(types, 'types', CARD_TYPES, 'Type')}
        {add(types, 'types', CARD_TYPES, 'Add a type')}
        {(subs.length > 0 || subtypes.length > 0) && <>
          <span className="token-dash" aria-hidden="true">{'–'}</span>
          {chip(subtypes, 'subtypes', subs, 'Subtype')}
          {subs.length > 0 && add(subtypes, 'subtypes', subs, 'Add a subtype')}
        </>}
      </div>
    </div>
  );
}

export default function TokenCard({ state, art, set, onPick, onFile, mobile }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [cssW, setCssW] = useState(0);
  const [over, setOver] = useState(false);
  const [focus, setFocus] = useState(null);
  const { zones } = templateById(state.template);
  const win = zones.art;
  const k = cssW / 630;
  const onPos = (pos) => art && set({ pos: clampPos(art.width, art.height, win, pos) });

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const maxH = mobile ? window.innerHeight * 0.62 : el.clientHeight;
      setCssW(Math.floor(Math.min(el.clientWidth, mobile ? 460 : 600, (maxH * 630) / 880)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile]);

  // Il canvas salta il campo in scrittura (si vede il suo testo) e la riga del tipo (a tendine).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssW) return undefined;
    let on = true;
    const dpr = window.devicePixelRatio || 1;
    prepare(state).then((parts) => {
      if (!on) return;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(((cssW * 880) / 630) * dpr);
      renderToken(canvas.getContext('2d'), state, { scale: (cssW * dpr) / 630, art, ...parts, skip: new Set(['type', focus]), editor: true });
    }).catch(() => {});
    return () => { on = false; };
  }, [state, art, cssW, focus]);

  // Trascinamento e pinch: i puntatori attivi; delta in pixel dello schermo → unità della carta.
  const drag = useRef(null);
  const down = (e) => {
    if (!art) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ptrs = { ...(drag.current?.ptrs || {}), [e.pointerId]: { x: e.clientX, y: e.clientY } };
    drag.current = { ptrs, start: ptrs, pos: state.pos };
  };
  const moveP = (e) => {
    const d = drag.current;
    if (!d?.ptrs[e.pointerId]) return;
    d.ptrs = { ...d.ptrs, [e.pointerId]: { x: e.clientX, y: e.clientY } };
    const ids = Object.keys(d.ptrs);
    if (ids.length === 1) {
      const [id] = ids;
      onPos({ ...d.pos, x: d.pos.x + (d.ptrs[id].x - d.start[id].x) / k, y: d.pos.y + (d.ptrs[id].y - d.start[id].y) / k });
    } else if (ids.length === 2 && d.start[ids[0]] && d.start[ids[1]]) {
      const dist = (p) => Math.hypot(p[ids[0]].x - p[ids[1]].x, p[ids[0]].y - p[ids[1]].y);
      onPos({ ...d.pos, zoom: d.pos.zoom * (dist(d.ptrs) / (dist(d.start) || 1)) });
    }
  };
  const up = (e) => {
    const d = drag.current;
    if (!d) return;
    const { [e.pointerId]: _, ...ptrs } = d.ptrs;
    drag.current = Object.keys(ptrs).length ? { ptrs, start: ptrs, pos: state.pos } : null;
  };
  // Rotella: listener non passivo, così la pagina non scorre mentre si ingrandisce.
  const posRef = useRef(null);
  useEffect(() => { posRef.current = { pos: state.pos, onPos }; });
  const ready = cssW > 0; // il canvas c'è solo dopo la prima misura della colonna
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !art) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const { pos, onPos: move } = posRef.current;
      move({ ...pos, zoom: pos.zoom * Math.exp(-e.deltaY * 0.0015) });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [art, ready]);
  const key = (e) => {
    if (!art) return;
    const step = e.shiftKey ? 40 : 10;
    const p = state.pos;
    const next = { ArrowLeft: { x: p.x - step }, ArrowRight: { x: p.x + step }, ArrowUp: { y: p.y - step }, ArrowDown: { y: p.y + step },
      '+': { zoom: p.zoom * 1.1 }, '=': { zoom: p.zoom * 1.1 }, '-': { zoom: p.zoom / 1.1 } }[e.key];
    if (!next) return;
    e.preventDefault();
    onPos({ ...p, ...next });
  };

  const field = (name, label, placeholder, maxLength, z = zones[name], dx = 0) => (
    <Line z={z} k={k} name={name} value={state[name]} onChange={(v) => set({ [name]: v })} label={label} placeholder={placeholder}
      focus={focus} setFocus={setFocus} dx={dx} maxLength={maxLength} />
  );
  const cssH = (cssW * 880) / 630;
  return (
    <div ref={wrapRef} className={`token-stage${over ? ' drop' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
      {cssW > 0 && (
        <div className="token-card" style={{ width: cssW, height: cssH }}>
          <canvas ref={canvasRef} className={`token-canvas${art ? ' has-art' : ''}`} tabIndex={art ? 0 : -1} role="img"
            aria-label={art ? 'Token image. Drag or use the arrow keys to move it, plus and minus to zoom.' : 'Token preview'}
            style={{ width: cssW, height: cssH }} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} onKeyDown={key} />
          <div className="token-edit-layer">
            {!art && (
              <button type="button" className="token-art-pick" style={box(win)} onClick={onPick}
                aria-label="Add an image (or drop or paste one here)" title="Add an image (or drop or paste one here)"><IconImage size={Math.max(24, 44 * k)} /></button>
            )}
            {field('name', 'Name', 'Name', 60)}
            <TypeLine z={zones.type} k={k} types={state.types} subtypes={state.subtypes} set={set}
              indent={state.colors.length ? zones.indicator.r * 2 + 10 : 0} />
            {zones.text && <Rules z={zones.text} k={k} value={state.rules} onChange={(v) => set({ rules: v })} focus={focus} setFocus={setFocus} />}
            {ptBox(state) && <PowerToughness z={zones.pt} k={k} power={state.power} toughness={state.toughness} set={set} focus={focus} setFocus={setFocus} />}
            {field('credit', 'Image credit', 'Illustrator', 60, zones.credit, CREDIT_ICON)}
          </div>
        </div>
      )}
    </div>
  );
}
