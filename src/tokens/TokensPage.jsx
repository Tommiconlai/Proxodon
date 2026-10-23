import { useEffect, useId, useRef, useState } from 'react';
import { TEMPLATES, templateById } from './templates';
import { frameColors, clampPos, MAX_ZOOM } from './tokenModel';
import { prepare, renderToken, renderTokenFile } from './renderToken';
import { ManaCost } from '../decks/Mana';
import { saveFile } from '../utils/download';
import { navigate } from '../hooks/useHashRoute';
import { IconUpload, IconTrash, IconReplay, IconDownload, IconNavPrint, IconPlus } from '../components/icons';

const COLORS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']];
const EMPTY = { template: 'classic', colors: [], name: '', type: '', rules: '', power: '', toughness: '', credit: '', pos: { x: 0, y: 0, zoom: 1 } };
// Il token in lavorazione resta finché la scheda è aperta (andando su Print e tornando c'è ancora); niente salvataggio.
const memory = { state: EMPTY, art: null };

const thumb = (t, colors) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.svg(frameColors(colors), { pt: true }))}`;

// Anteprima: il token disegnato alla grandezza della colonna (per la densità dello schermo); si trascina l'immagine, la
// rotella o due dita la ingrandiscono, frecce e +/- da tastiera. Un'immagine si può anche lasciare o incollare qui.
function TokenStage({ state, art, onPos, onFile, mobile }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [cssW, setCssW] = useState(0);
  const [over, setOver] = useState(false);
  const win = templateById(state.template).zones.art;
  const move = (pos) => art && onPos(clampPos(art.width, art.height, win, pos));

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const maxH = mobile ? window.innerHeight * 0.56 : el.clientHeight;
      setCssW(Math.floor(Math.min(el.clientWidth, mobile ? 420 : 560, (maxH * 630) / 880)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssW) return undefined;
    let on = true;
    const dpr = window.devicePixelRatio || 1;
    prepare(state).then((parts) => {
      if (!on) return;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(((cssW * 880) / 630) * dpr);
      renderToken(canvas.getContext('2d'), state, { scale: (cssW * dpr) / 630, art, ...parts });
    }).catch(() => {});
    return () => { on = false; };
  }, [state, art, cssW]);

  // Trascinamento e pinch: i puntatori attivi; delta in pixel dello schermo → unità della carta.
  const drag = useRef(null);
  const units = (px) => (px * 630) / cssW;
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
      move({ ...d.pos, x: d.pos.x + units(d.ptrs[id].x - d.start[id].x), y: d.pos.y + units(d.ptrs[id].y - d.start[id].y) });
    } else if (ids.length === 2 && d.start[ids[0]] && d.start[ids[1]]) {
      const dist = (p) => Math.hypot(p[ids[0]].x - p[ids[1]].x, p[ids[0]].y - p[ids[1]].y);
      move({ ...d.pos, zoom: d.pos.zoom * (dist(d.ptrs) / (dist(d.start) || 1)) });
    }
  };
  const up = (e) => {
    const d = drag.current;
    if (!d) return;
    const { [e.pointerId]: _, ...ptrs } = d.ptrs;
    drag.current = Object.keys(ptrs).length ? { ptrs, start: ptrs, pos: state.pos } : null;
  };
  // Rotella: listener non passivo, così la pagina non scorre mentre si ingrandisce.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !art) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const p = stateRef.current.pos;
      onPos(clampPos(art.width, art.height, win, { ...p, zoom: p.zoom * Math.exp(-e.deltaY * 0.0015) }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [art, win, onPos]);
  const key = (e) => {
    if (!art) return;
    const step = e.shiftKey ? 40 : 10;
    const p = state.pos;
    const next = { ArrowLeft: { x: p.x - step }, ArrowRight: { x: p.x + step }, ArrowUp: { y: p.y - step }, ArrowDown: { y: p.y + step },
      '+': { zoom: p.zoom * 1.1 }, '=': { zoom: p.zoom * 1.1 }, '-': { zoom: p.zoom / 1.1 } }[e.key];
    if (!next) return;
    e.preventDefault();
    move({ ...p, ...next });
  };

  const label = `Token preview${state.name.trim() ? `: ${state.name.trim()}` : ''}.${art ? ' Drag or use the arrow keys to move the image, plus and minus to zoom.' : ' Drop or paste an image here.'}`;
  return (
    <div ref={wrapRef} className={`token-stage${over ? ' drop' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
      <canvas ref={canvasRef} className={`token-canvas${art ? ' has-art' : ''}`} tabIndex={0} role="img" aria-label={label}
        style={{ width: cssW, height: (cssW * 880) / 630 }}
        onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} onKeyDown={key} />
    </div>
  );
}

// Pagina Tokens (#/tokens): cornice, colore, immagine e testi a sinistra (telefono: sotto l'anteprima), il token al
// centro; Add to Print lo manda alla coda di stampa (onAdd = addItems di App), Download lo salva come PNG.
export default function TokensPage({ onAdd, notify, mobile }) {
  const [state, setState] = useState(memory.state);
  const [art, setArtNow] = useState(memory.art);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const id = useId();
  useEffect(() => { memory.state = state; memory.art = art; }, [state, art]);
  const set = (patch) => setState((s) => ({ ...s, ...patch }));
  const field = (k) => ({ id: `${id}-${k}`, value: state[k], onChange: (e) => set({ [k]: e.target.value }) });
  const template = templateById(state.template);

  const setArt = async (file) => {
    if (!file?.type?.startsWith('image/')) { notify('That file is not an image.', 'error'); return; }
    try {
      const bmp = await createImageBitmap(file);
      setArtNow(bmp);
      set({ pos: { x: 0, y: 0, zoom: 1 } });
    } catch {
      notify('Could not read that image.', 'error');
    }
  };
  // Incolla (Ctrl+V, "Copia immagine" da un altro sito): un'immagine negli appunti diventa l'arte; il testo resta ai campi.
  const setArtRef = useRef(setArt);
  setArtRef.current = setArt;
  useEffect(() => {
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      setArtRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
  const toggleColor = (c) => set({ colors: state.colors.includes(c) ? state.colors.filter((x) => x !== c) : [...state.colors, c] });
  const posRef = useRef(set);
  posRef.current = set;
  const [onPos] = useState(() => (pos) => posRef.current({ pos }));

  const create = async (then) => {
    setBusy(true);
    try {
      then(await renderTokenFile(state, art));
    } catch (e) {
      notify(e.message || 'Could not create the token.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const addToPrint = () => create((file) => {
    onAdd([{ file, bleedMode: template.bleedMode }]);
    notify('Token added to Print', 'success', { label: 'Open Print', onClick: () => navigate('/print') });
  });
  const download = () => create((file) => saveFile(file.name, file));

  const actions = (
    <div className="token-actions">
      <button type="button" className="btn-add deck-icon-btn" onClick={addToPrint} disabled={busy} aria-label="Add to Print" title="Add to Print"><IconNavPrint size={20} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={download} disabled={busy} aria-label="Download PNG" title="Download PNG"><IconDownload size={18} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={() => { setState(EMPTY); setArtNow(null); }} disabled={busy}
        aria-label="New token" title="New token (clears this one)"><IconPlus size={18} /></button>
    </div>
  );
  const stage = <TokenStage state={state} art={art} onPos={onPos} onFile={setArt} mobile={mobile} />;
  const controls = (
    <>
      <section className="sidebar-section">
        <h2>Frame</h2>
        <div className="token-frames" role="radiogroup" aria-label="Frame">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={t.id === state.template} className="token-frame-btn"
              aria-label={t.name} title={t.name} onClick={() => set({ template: t.id, pos: { x: 0, y: 0, zoom: 1 } })}>
              <img src={thumb(t, state.colors)} alt="" />
            </button>
          ))}
        </div>
        <div className="adv-pips" role="group" aria-label="Color">
          {COLORS.map(([c, name]) => (
            <label key={c} className={`adv-pip${state.colors.includes(c) ? ' on' : ''}`} title={name}>
              <input type="checkbox" checked={state.colors.includes(c)} onChange={() => toggleColor(c)} aria-label={name} />
              <ManaCost cost={`{${c}}`} />
            </label>
          ))}
        </div>
        <p className="field-hint">{state.colors.length === 0 ? 'No color: a colorless frame.' : state.colors.length > 1 ? 'Two or more colors: a gold frame.' : `${COLORS.find(([c]) => c === state.colors[0])[1]} frame.`}</p>
      </section>
      <section className="sidebar-section">
        <h2>Image</h2>
        <div className="token-row">
          {/* Un pulsante vero (raggiungibile da tastiera) che apre il selettore; il click è un gesto, vale anche sui telefoni. */}
          <input ref={fileRef} type="file" accept="image/*" hidden tabIndex={-1} aria-hidden="true"
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) setArt(f); }} />
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => fileRef.current?.click()}
            aria-label="Upload an image" title="Upload an image"><IconUpload size={18} /></button>
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => set({ pos: { x: 0, y: 0, zoom: 1 } })} disabled={!art}
            aria-label="Reset position and zoom" title="Reset position and zoom"><IconReplay size={18} /></button>
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setArtNow(null)} disabled={!art}
            aria-label="Remove the image" title="Remove the image"><IconTrash size={18} /></button>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-zoom`}>Zoom</label>
          <input id={`${id}-zoom`} type="range" min="1" max={MAX_ZOOM} step="0.01" value={state.pos.zoom} disabled={!art}
            onChange={(e) => onPos(clampPos(art.width, art.height, template.zones.art, { ...state.pos, zoom: Number(e.target.value) }))} />
        </div>
        <p className="field-hint">Upload, drop or paste an image (copy it from any site, then Ctrl+V). Drag it on the card to move it.</p>
      </section>
      <section className="sidebar-section">
        <h2>Text</h2>
        <div className="field"><label className="field-label" htmlFor={`${id}-name`}>Name</label>
          <input className="import-link-input" {...field('name')} placeholder="Goblin" maxLength={60} spellCheck={false} /></div>
        <div className="field"><label className="field-label" htmlFor={`${id}-type`}>Type line</label>
          <input className="import-link-input" {...field('type')} placeholder="Token Creature - Goblin" maxLength={80} spellCheck={false} /></div>
        {template.zones.text && (
          <div className="field"><label className="field-label" htmlFor={`${id}-rules`}>Rules text</label>
            <textarea className="import-link-input" {...field('rules')} rows={4} maxLength={600} placeholder="Haste" />
            <p className="field-hint">{'{T}, {G}, {2/W} become mana symbols.'}</p></div>
        )}
        <div className="token-row">
          <div className="field"><label className="field-label" htmlFor={`${id}-power`}>Power</label>
            <input className="import-link-input" {...field('power')} placeholder="1" maxLength={4} inputMode="numeric" /></div>
          <div className="field"><label className="field-label" htmlFor={`${id}-toughness`}>Toughness</label>
            <input className="import-link-input" {...field('toughness')} placeholder="1" maxLength={4} inputMode="numeric" /></div>
        </div>
        <div className="field"><label className="field-label" htmlFor={`${id}-credit`}>Image credit</label>
          <input className="import-link-input" {...field('credit')} placeholder="Art by" maxLength={60} spellCheck={false} /></div>
      </section>
    </>
  );

  if (mobile) {
    return (
      <div className="tokens-mobile">
        <div className="tokens-head">
          <h1 className="decks-title">Tokens</h1>
          {actions}
        </div>
        {stage}
        <div className="tokens-controls">{controls}</div>
      </div>
    );
  }
  return (
    <div className="app-body tokens-body">
      <aside className="sidebar">
        <div className="sidebar-scroll">{controls}</div>
        <div className="sidebar-section sidebar-export">{actions}</div>
      </aside>
      <main className="main-content tokens-main">{stage}</main>
    </div>
  );
}
