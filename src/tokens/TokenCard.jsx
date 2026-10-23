import { useEffect, useId, useRef, useState } from 'react';
import { templateById } from './templates';
import { fitSize, layoutRules, parseRules, CARD_TYPES, artWindow, moveLayers, layerDims, typeLine, typeSuggestions } from './tokenModel';
import { prepare, renderToken, fontOf, ptBox, CREDIT_ICON, SET_ICON, SET_GAP } from './renderToken';
import { loadSubtypes } from './typeCatalog';
import { IconImage } from '../components/icons';

// Il token in modifica: il canvas (lo stesso disegno del PNG) e sopra, a filo delle zone della cornice, i campi da
// scrivere direttamente sulla carta, con un contorno leggero che esiste solo qui (il PNG non lo ha). Il campo che si sta
// scrivendo mostra il suo testo e il canvas lo salta; gli altri sono trasparenti sopra il testo disegnato. La riga del
// tipo è a tendine (tipi e sottotipi, + per aggiungerne). Si trascina l'immagine (con Sync anche l'overlay, senza solo il
// livello scelto), rotella o due dita la ingrandiscono, frecce e +/- da tastiera; senza immagine la finestra dell'arte è
// un pulsante per sceglierne una. Il canvas ha il bleed attorno, con il bordo vero della carta in rosso.

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
      <div className={`token-pt${editing ? ' editing' : ''}${power || toughness ? '' : ' empty'}`} style={st}>
        {input('power', power, 'Power')}<span aria-hidden="true">/</span>{input('toughness', toughness, 'Toughness')}
      </div>
    </div>
  );
}

// Riga del tipo: una tendina per ogni tipo e sottotipo scelto (cambiarlo, o Remove) e in fondo un campo di ricerca:
// scrivendo, la tendina sotto propone i tipi di carta e i sottotipi dei tipi scelti (cataloghi di Scryfall); frecce per
// scegliere, Invio per aggiungere, Esc per chiudere, Backspace a campo vuoto toglie l'ultimo.
function TypeLine({ z, k, types, subtypes, set, indent }) {
  const [subs, setSubs] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const key = types.join('|');
  useEffect(() => {
    let on = true;
    loadSubtypes(key ? key.split('|') : []).then((l) => { if (on) setSubs(l); });
    return () => { on = false; };
  }, [key]);
  // Corpo come nel PNG: la riga intera rimpicciolisce per stare tra pallino e simbolo (meno lo spazio del campo).
  const line = typeLine(types, subtypes);
  const room = z.w - 2 * z.pad - indent - SET_ICON - SET_GAP - z.size * 3;
  const st = scaled(k, line ? fitSize(measurer(z), line, room, z.size, z.min) : z.size, z);
  const edit = (list, i, v) => (v === '' ? list.filter((_, j) => j !== i) : list.map((x, j) => (j === i ? v : x)));
  const chip = (list, field, options, label) => list.map((v, i) => (
    <select key={`${v}-${i}`} className="token-chip" value={v} aria-label={`${label} ${i + 1}`} title={`${label}: change or remove`} style={{ '--chars': v.length }}
      onChange={(e) => set({ [field]: edit(list, i, e.target.value) })}>
      {[...new Set([v, ...options])].map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="">Remove</option>
    </select>
  ));
  const options = open ? typeSuggestions(q, types, subtypes, subs) : [];
  const at = Math.min(active, Math.max(0, options.length - 1));
  const pick = (o) => {
    set(o.kind === 'type' ? { types: [...types, o.v] } : { subtypes: [...subtypes, o.v] });
    setQ('');
    setActive(0);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setActive((at + 1) % options.length); }
    else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setActive((at - 1 + options.length) % options.length); }
    else if (e.key === 'Enter' && options[at]) { e.preventDefault(); pick(options[at]); }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); } // il testo non aggiunto non resta nella riga
    else if (e.key === 'Backspace' && !q) {
      if (subtypes.length) set({ subtypes: subtypes.slice(0, -1) });
      else if (types.length) set({ types: types.slice(0, -1) });
    }
  };
  const empty = !types.length && !subtypes.length;
  return (
    <div className="token-zone" style={box(z)}>
      <div className="token-edit token-typeline" role="group" aria-label="Type line"
        style={{ ...st, paddingLeft: `calc(${z.pad + indent} * var(--u) * 1px)`, paddingRight: `calc(${z.pad + SET_ICON + SET_GAP} * var(--u) * 1px)` }}>
        {/* La fila scorre dentro il suo riquadro: a destra resta libero il simbolo dell'edizione. */}
        <div className="token-typeline-row">
          {chip(types, 'types', CARD_TYPES, 'Type')}
          {subtypes.length > 0 && <>
            <span className="token-dash" aria-hidden="true">{'–'}</span>
            {chip(subtypes, 'subtypes', subs, 'Subtype')}
          </>}
          <input className="token-type-search" value={q} placeholder={empty ? 'Type' : '+'} spellCheck={false} autoComplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded={options.length > 0} aria-controls={listId}
            aria-activedescendant={options[at] ? `${listId}-${at}` : undefined}
            aria-label="Add a type or subtype" title="Add a type or subtype: type to search"
            style={{ '--chars': Math.max(empty ? 4 : 1, q.length + 1) }}
            onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setQ(''); }} onKeyDown={onKey}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} />
        </div>
      </div>
      {options.length > 0 && (
        <ul id={listId} role="listbox" className="search-suggest token-type-suggest">
          {options.map((o, i) => (
            <li key={`${o.kind}-${o.v}`} id={`${listId}-${i}`} role="option" aria-selected={i === at} className={i === at ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}>
              {o.v}<span className="token-type-kind">{o.kind === 'type' ? 'type' : 'subtype'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TokenCard({ state, art, overlay, set, onPick, onFile, mobile, bleedMm }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [cssW, setCssW] = useState(0);
  const [over, setOver] = useState(false);
  const [focus, setFocus] = useState(null);
  const { zones } = templateById(state.template);
  const B = bleedMm * 10; // bleed in unità attorno alla carta
  const W = 630 + 2 * B;
  const H = 880 + 2 * B;
  const win = artWindow(zones.art, B);
  const k = cssW / W; // pixel dello schermo per unità
  const movable = !!(art || overlay);
  // Spostamento di immagine e overlay (Sync: insieme) da start di change = { dx, dy, k }.
  const move = (start, change) => {
    const r = moveLayers(start, { dx: 0, dy: 0, k: 1, ...change }, { sync: state.sync, target: state.target, dims: layerDims(art, overlay), win });
    set({ pos: r.art, overlayPos: r.overlay });
  };

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const maxH = mobile ? window.innerHeight * 0.62 : el.clientHeight;
      setCssW(Math.floor(Math.min(el.clientWidth, mobile ? 460 : 600, (maxH * W) / H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile, W, H]);

  // Il canvas salta il campo in scrittura (si vede il suo testo) e la riga del tipo (a tendine); il bordo vero della carta
  // in rosso sottile, solo qui.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssW) return undefined;
    let on = true;
    const dpr = window.devicePixelRatio || 1;
    prepare(state, B).then((parts) => {
      if (!on) return;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(((cssW * H) / W) * dpr);
      renderToken(canvas.getContext('2d'), state, {
        scale: (cssW * dpr) / W, b: B, art, overlay, ...parts, skip: new Set(['type', focus]), editor: true, trim: 1.5 / (cssW / W),
      });
    }).catch(() => {});
    return () => { on = false; };
  }, [state, art, overlay, cssW, focus, B, W, H]);

  // Trascinamento e pinch: i puntatori attivi; delta in pixel dello schermo → unità della carta.
  const drag = useRef(null);
  const down = (e) => {
    if (!movable) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntatore già finito: si trascina lo stesso */ }
    const ptrs = { ...(drag.current?.ptrs || {}), [e.pointerId]: { x: e.clientX, y: e.clientY } };
    drag.current = { ptrs, start: ptrs, from: { art: state.pos, overlay: state.overlayPos } };
  };
  const moveP = (e) => {
    const d = drag.current;
    if (!d?.ptrs[e.pointerId]) return;
    d.ptrs = { ...d.ptrs, [e.pointerId]: { x: e.clientX, y: e.clientY } };
    const ids = Object.keys(d.ptrs);
    if (ids.length === 1) {
      const [id] = ids;
      move(d.from, { dx: (d.ptrs[id].x - d.start[id].x) / k, dy: (d.ptrs[id].y - d.start[id].y) / k });
    } else if (ids.length === 2 && d.start[ids[0]] && d.start[ids[1]]) {
      const dist = (p) => Math.hypot(p[ids[0]].x - p[ids[1]].x, p[ids[0]].y - p[ids[1]].y);
      move(d.from, { k: dist(d.ptrs) / (dist(d.start) || 1) });
    }
  };
  const up = (e) => {
    const d = drag.current;
    if (!d) return;
    const { [e.pointerId]: _, ...ptrs } = d.ptrs;
    drag.current = Object.keys(ptrs).length ? { ptrs, start: ptrs, from: { art: state.pos, overlay: state.overlayPos } } : null;
  };
  // Rotella: listener non passivo, così la pagina non scorre mentre si ingrandisce.
  const live = useRef(null);
  useEffect(() => { live.current = { from: { art: state.pos, overlay: state.overlayPos }, move }; });
  const ready = cssW > 0; // il canvas c'è solo dopo la prima misura della colonna
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !movable) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      live.current.move(live.current.from, { k: Math.exp(-e.deltaY * 0.0015) });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [movable, ready]);
  const key = (e) => {
    if (!movable) return;
    const step = e.shiftKey ? 40 : 10;
    const change = { ArrowLeft: { dx: -step }, ArrowRight: { dx: step }, ArrowUp: { dy: -step }, ArrowDown: { dy: step },
      '+': { k: 1.1 }, '=': { k: 1.1 }, '-': { k: 1 / 1.1 } }[e.key];
    if (!change) return;
    e.preventDefault();
    move({ art: state.pos, overlay: state.overlayPos }, change);
  };

  const field = (name, label, placeholder, maxLength, z = zones[name], dx = 0) => (
    <Line z={z} k={k} name={name} value={state[name]} onChange={(v) => set({ [name]: v })} label={label} placeholder={placeholder}
      focus={focus} setFocus={setFocus} dx={dx} maxLength={maxLength} />
  );
  const cssH = (cssW * H) / W;
  // I campi stanno sull'area della carta (dentro il bleed), con le coordinate di sempre.
  const trimBox = { left: pct(B, W), top: pct(B, H), width: pct(630, W), height: pct(880, H) };
  return (
    <div ref={wrapRef} className={`token-stage${over ? ' drop' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
      {cssW > 0 && (
        <div className="token-card" style={{ width: cssW, height: cssH }}>
          <canvas ref={canvasRef} className={`token-canvas${movable ? ' has-art' : ''}`} tabIndex={movable ? 0 : -1} role="img"
            aria-label={movable ? 'Token image. Drag or use the arrow keys to move it, plus and minus to zoom.' : 'Token preview'}
            style={{ width: cssW, height: cssH }} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} onKeyDown={key} />
          <div className="token-edit-layer" style={trimBox}>
            {!art && (
              <button type="button" className="token-art-pick" style={box(zones.art)} onClick={onPick}
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
