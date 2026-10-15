import { useEffect, useId, useRef, useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { fetchPrints } from '../utils/scryfall';
import { autocomplete } from './scryfallSearch';
import { IconX, IconUpload, IconSearch, IconTrash } from '../components/icons';

const OUT = 256; // lato della foto salvata (px)
const MAX_ZOOM = 4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Il ritaglio è un quadrato nell'immagine sorgente: lato min(w, h) / zoom attorno al centro
// (cx, cy), sempre dentro l'immagine. Lo stesso quadrato riempie il cerchio a ogni dimensione.
const side = (img, z) => Math.min(img.w, img.h) / z;
const fit = (img, z, cx, cy) => {
  const zz = clamp(z, 1, MAX_ZOOM);
  const half = side(img, zz) / 2;
  return { z: zz, cx: clamp(cx, half, img.w - half), cy: clamp(cy, half, img.h - half) };
};

// L'immagine dentro un riquadro di `size` px, posizionata secondo il ritaglio.
function CropView({ img, crop, size, className, children, ...rest }) {
  const s = side(img, crop.z);
  const k = size / s;
  return (
    <div className={className} style={{ width: size, height: size }} {...rest}>
      <img src={img.url} alt="" draggable={false} style={{
        width: img.w * k,
        height: img.h * k,
        transform: `translate(${-(crop.cx - s / 2) * k}px, ${-(crop.cy - s / 2) * k}px)`,
      }} />
      {children}
    </div>
  );
}

// Area di ritaglio: trascina per spostare, rotella / pizzico / + e - per lo zoom, frecce per spostare.
function CropArea({ img, crop, setCrop, size }) {
  const ref = useRef(null);
  const pts = useRef(new Map()); // puntatori attivi (mouse o dita)
  // dx, dy in px dello schermo: l'immagine segue il dito.
  const drag = (dx, dy) => setCrop((c) => {
    const k = side(img, c.z) / size;
    return fit(img, c.z, c.cx - dx * k, c.cy - dy * k);
  });
  const zoomBy = (f) => setCrop((c) => fit(img, c.z * f, c.cx, c.cy));

  // Rotella: listener nativo non passivo, altrimenti scorre il modale.
  useEffect(() => {
    const el = ref.current;
    const onWheel = (e) => {
      e.preventDefault();
      setCrop((c) => fit(img, c.z * Math.exp(-e.deltaY * 0.0015), c.cx, c.cy));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [img, setCrop]);

  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const move = (e) => {
    const p = pts.current.get(e.pointerId);
    if (!p) return;
    const before = [...pts.current.values()];
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) return drag(e.clientX - p.x, e.clientY - p.y);
    if (pts.current.size !== 2) return undefined;
    // Pizzico: lo zoom segue il rapporto tra le distanze delle due dita.
    const [a, b] = [...pts.current.values()];
    const d0 = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
    if (d0 > 0) zoomBy(Math.hypot(a.x - b.x, a.y - b.y) / d0);
    return undefined;
  };
  const up = (e) => { pts.current.delete(e.pointerId); };
  const key = (e) => {
    const step = size * 0.04;
    const dir = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (dir) drag(...dir);
    else if (e.key === '+' || e.key === '=') zoomBy(1.1);
    else if (e.key === '-') zoomBy(1 / 1.1);
    else return;
    e.preventDefault();
  };

  return (
    <CropView img={img} crop={crop} size={size} className="crop-area" ref={ref} tabIndex={0}
      aria-label="Photo crop. Drag or use the arrow keys to move it, plus and minus to zoom."
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} />
  );
}

// Sorgente: file dal dispositivo oppure l'art di una carta (una per illustrazione, ritaglio art_crop).
function SourcePicker({ busy, onFile, onArt }) {
  const [q, setQ] = useState('');
  const [names, setNames] = useState([]);
  const [arts, setArts] = useState(null); // null = nessuna ricerca ancora
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const listId = useId();

  // Suggerimenti nativi (datalist): 250 ms dopo l'ultima battuta, la richiesta precedente annullata.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => autocomplete(text, ctrl.signal).then(setNames).catch(() => {}), 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const find = async (name) => {
    setSearching(true);
    setError(null);
    try {
      setArts((await fetchPrints(name, 'art')).filter((p) => p.art));
    } catch (e) {
      setError(e.message || 'Scryfall error.');
    } finally {
      setSearching(false);
    }
  };
  const change = (e) => {
    setQ(e.target.value);
    if (names.includes(e.target.value)) find(e.target.value); // scelto dai suggerimenti
  };
  const submit = (e) => {
    e.preventDefault();
    const t = q.trim();
    if (t) find(names.find((n) => n.toLowerCase() === t.toLowerCase()) || names[0] || t);
  };

  return (
    <>
      <button type="button" className="btn-secondary photo-upload" onClick={() => fileRef.current.click()} disabled={busy}>
        <IconUpload size={15} /> Upload an image
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      <div className="signin-or" aria-hidden="true">or a card art</div>
      <form className="photo-search" onSubmit={submit}>
        <input className="import-link-input" value={q} onChange={change} list={listId} placeholder="Card name, e.g. Sol Ring"
          aria-label="Card name" autoComplete="off" spellCheck={false} disabled={busy} />
        <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>
        <button type="submit" className="btn-secondary" disabled={busy || searching || !q.trim()}>
          {searching ? <span className="import-spinner" /> : <IconSearch size={15} />} Find art
        </button>
      </form>
      {error && <div className="info-box info-box-error"><span>{error}</span></div>}
      {arts?.length === 0 && <p className="modal-hint">No card found with that name.</p>}
      {arts?.length > 0 && (
        <div className="art-grid photo-arts">
          {arts.map((p) => (
            <button key={p.id} type="button" className="art-cell" onClick={() => onArt(p)} disabled={busy}
              title={`${p.setName} (${p.set})${p.artist ? `, art by ${p.artist}` : ''}`}>
              <img src={p.art} alt={`${p.setName}${p.artist ? `, art by ${p.artist}` : ''}`} loading="lazy" />
              <span>{p.artist || p.set}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Nuova foto profilo: scegli la sorgente, poi centrala nel cerchio. onSave riceve un JPEG 256 px.
// onRemove (solo con una foto personalizzata): torna alla foto di Google o all'iniziale.
export default function PhotoDialog({ onClose, onSave, onRemove }) {
  const [img, setImg] = useState(null); // { url, w, h, bmp }
  const [crop, setCrop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ref = useOverlayDismiss(() => { if (!busy) onClose(); });
  const size = Math.min(280, window.innerWidth - 72);

  // Libera l'immagine precedente (cambio sorgente o chiusura).
  useEffect(() => () => { if (img) { URL.revokeObjectURL(img.url); img.bmp.close(); } }, [img]);

  const load = async (getBlob) => {
    setBusy(true);
    setError(null);
    try {
      const blob = await getBlob();
      const bmp = await createImageBitmap(blob).catch(() => { throw new Error('This file is not an image Proxoteca can read.'); });
      const next = { url: URL.createObjectURL(blob), w: bmp.width, h: bmp.height, bmp };
      setImg(next);
      setCrop(fit(next, 1, next.w / 2, next.h / 2));
    } catch (e) {
      setError(e.message || 'Could not load the image.');
    } finally {
      setBusy(false);
    }
  };
  const loadArt = (p) => load(async () => {
    const res = await fetch(p.art);
    if (!res.ok) throw new Error(`Image download failed (${res.status})`);
    return res.blob();
  });

  const save = () => {
    const s = side(img, crop.z);
    const c = document.createElement('canvas');
    c.width = OUT;
    c.height = OUT;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0a15'; // PNG trasparenti: sfondo scuro invece del nero del JPEG
    g.fillRect(0, 0, OUT, OUT);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img.bmp, crop.cx - s / 2, crop.cy - s / 2, s, s, 0, 0, OUT, OUT);
    onSave(c.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal modal-photo" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Change photo" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{img ? 'Center your photo' : 'Change photo'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><IconX size={18} /></button>
        </div>
        {error && <div className="info-box info-box-error"><span>{error}</span></div>}
        {busy && <div className="import-status"><span className="import-spinner" /> Loading the image…</div>}
        {!img && <SourcePicker busy={busy} onFile={(f) => load(async () => f)} onArt={loadArt} />}
        {!img && onRemove && (
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onRemove} disabled={busy}><IconTrash size={15} /> Remove current photo</button>
          </div>
        )}
        {img && (
          <>
            <div className="photo-crop">
              <CropArea img={img} crop={crop} setCrop={setCrop} size={size} />
              <div className="photo-side">
                <label className="field photo-zoom">
                  <span className="profile-h">Zoom</span>
                  <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.z}
                    style={{ '--fill': `${((crop.z - 1) / (MAX_ZOOM - 1)) * 100}%` }}
                    onChange={(e) => setCrop((c) => fit(img, Number(e.target.value), c.cx, c.cy))} />
                </label>
                <p className="field-hint">Drag to move. Scroll, pinch or use the slider to zoom.</p>
                <div className="photo-previews" aria-hidden="true">
                  <figure><CropView img={img} crop={crop} size={72} className="photo-preview" /><figcaption>Profile</figcaption></figure>
                  <figure><CropView img={img} crop={crop} size={34} className="photo-preview" /><figcaption>Menu</figcaption></figure>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setImg(null)}>Choose another</button>
              <button type="button" className="btn-generate import-btn" onClick={save}>Save photo</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
