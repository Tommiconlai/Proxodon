import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { TEMPLATES, templateById } from './templates';
import { frameColors, artWindow, moveLayers, layerDims, MAX_ZOOM } from './tokenModel';
import { renderTokenFile } from './renderToken';
import TokenCard from './TokenCard';
import { ManaCost } from '../decks/Mana';
import { saveFile } from '../utils/download';
import { navigate } from '../hooks/useHashRoute';
import { IconUpload, IconTrash, IconReplay, IconDownload, IconNavPrint, IconPlus, IconImage, IconCopy, IconX } from '../components/icons';

const COLORS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']];
const P0 = { x: 0, y: 0, zoom: 1 };
const EMPTY = {
  template: 'classic', colors: [], name: '', types: [], subtypes: [], rules: '', power: '', toughness: '', credit: '',
  pos: P0, overlayPos: P0, sync: true, target: 'overlay',
};
// Il token in lavorazione resta finché la scheda è aperta (andando su Print e tornando c'è ancora); niente salvataggio.
const memory = { state: EMPTY, art: null, overlay: null };

const thumb = (t, colors) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.svg(frameColors(colors), { pt: true }))}`;
const readImage = async (file, notify) => {
  if (!file?.type?.startsWith('image/')) { notify('That file is not an image.', 'error'); return null; }
  try { return await createImageBitmap(file); } catch { notify('Could not read that image.', 'error'); return null; }
};

// Pagina Tokens (#/tokens): a sinistra (telefono: sotto la carta) la cornice con i colori, zoom, bleed e l'overlay (la
// seconda immagine, scontornata, sopra la cornice: con Sync si muove con quella di fondo), in basso i pulsanti; i testi
// si scrivono sulla carta (TokenCard). Il bleed è quello di Print (bleedMm, setBleedMm di App): il PNG lo contiene e in
// Print entra come "Bleed in art" (bleedMode full). Add to Print = addItems di App, Download lo salva.
// demo (tutorial) = { state, apiRef }: un token demo al posto di quello in lavorazione (memory resta com'è), niente
// incolla; in apiRef.current set e setArt per i gesti del tutorial.
export default function TokensPage({ onAdd, notify, mobile, bleedMm, setBleedMm, demo }) {
  const [state, setState] = useState(demo ? demo.state : memory.state);
  const [art, setArtNow] = useState(demo ? null : memory.art);
  const [overlay, setOverlayNow] = useState(demo ? null : memory.overlay);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const overlayRef = useRef(null);
  const id = useId();
  useEffect(() => { if (!demo) Object.assign(memory, { state, art, overlay }); }, [demo, state, art, overlay]);
  useLayoutEffect(() => {
    if (demo) demo.apiRef.current = { set: (patch) => setState((s) => ({ ...s, ...patch })), setArt: setArtNow };
  }, [demo]);
  const set = (patch) => setState((s) => ({ ...s, ...patch }));
  const win = artWindow(templateById(state.template).zones.art, bleedMm * 10);

  const setArt = async (file) => {
    const bmp = await readImage(file, notify);
    if (bmp) { setArtNow(bmp); set({ pos: P0, overlayPos: P0 }); }
  };
  // L'overlay di solito ha le dimensioni dell'immagine di fondo: parte allineato a lei.
  const setOverlay = async (file) => {
    const bmp = await readImage(file, notify);
    if (bmp) { setOverlayNow(bmp); setState((s) => ({ ...s, overlayPos: s.pos })); }
  };
  // Incolla (Ctrl+V, "Copia immagine" da un altro sito): un'immagine negli appunti diventa l'arte; il testo resta ai campi.
  const setArtRef = useRef(setArt);
  useEffect(() => { setArtRef.current = setArt; });
  useEffect(() => {
    if (demo) return undefined;
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!file || document.getElementById('root')?.inert) return; // tutorial aperto: la pagina sotto non si tocca
      e.preventDefault();
      setArtRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [demo]);
  const toggleColor = (c) => set({ colors: state.colors.includes(c) ? state.colors.filter((x) => x !== c) : [...state.colors, c] });
  const pick = () => fileRef.current?.click();

  // Zoom del livello che si muove: con Sync (o senza overlay) l'immagine di fondo e l'overlay insieme, altrimenti quello scelto.
  const onOverlay = !!overlay && (!art || (!state.sync && state.target === 'overlay'));
  const zoomNow = onOverlay ? state.overlayPos.zoom : state.pos.zoom;
  const zoomMin = onOverlay ? 0.2 : 1;
  const setZoom = (z) => {
    const r = moveLayers({ art: state.pos, overlay: state.overlayPos }, { dx: 0, dy: 0, k: z / zoomNow },
      { sync: state.sync, target: state.target, dims: layerDims(art, overlay), win });
    set({ pos: r.art, overlayPos: r.overlay });
  };

  const create = async (then) => {
    setBusy(true);
    try {
      then(await renderTokenFile(state, { art, overlay, bleedMm }));
    } catch (e) {
      notify(e.message || 'Could not create the token.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const addToPrint = () => create((file) => {
    onAdd([{ file, bleedMode: 'full' }]);
    notify('Token added to Print', 'success', { label: 'Open Print', onClick: () => navigate('/print') });
  });
  const download = () => create((file) => saveFile(file.name, file));

  // Sei pulsanti uguali: crea (Print, Download, New) e immagine (Upload, Reset, Remove).
  const actions = (
    <div className="token-actions">
      <button type="button" className="btn-secondary deck-icon-btn token-primary" onClick={addToPrint} disabled={busy} aria-label="Add to Print" title="Add to Print"><IconNavPrint size={20} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={download} disabled={busy} aria-label="Download PNG" title="Download PNG"><IconDownload size={18} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={() => { setState(EMPTY); setArtNow(null); setOverlayNow(null); }} disabled={busy}
        aria-label="New token" title="New token (clears this one)"><IconPlus size={18} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={pick} aria-label="Upload an image" title="Upload an image"><IconUpload size={18} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={() => set({ pos: P0, overlayPos: P0 })} disabled={!art && !overlay}
        aria-label="Reset position and zoom" title="Reset position and zoom"><IconReplay size={18} /></button>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setArtNow(null)} disabled={!art}
        aria-label="Remove the image" title="Remove the image"><IconTrash size={18} /></button>
    </div>
  );
  const controls = (
    <section className="sidebar-section">
      <h2>Frame</h2>
      <div className="token-frames" role="radiogroup" aria-label="Frame">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={t.id === state.template} className="token-frame-btn"
            aria-label={t.name} title={t.name} onClick={() => set({ template: t.id, pos: P0, overlayPos: P0 })}>
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
      <div className="field token-zoom">
        <label className="field-label token-range-label" htmlFor={`${id}-zoom`}>Zoom<span>{onOverlay ? 'overlay' : overlay && state.sync ? 'image + overlay' : 'image'}</span></label>
        <input id={`${id}-zoom`} type="range" min={zoomMin} max={MAX_ZOOM} step="0.01" value={zoomNow} disabled={!art && !overlay}
          style={{ '--fill': `${((zoomNow - zoomMin) / (MAX_ZOOM - zoomMin)) * 100}%` }}
          onChange={(e) => setZoom(Number(e.target.value))} />
      </div>
      <div className="field token-bleed">
        <label className="field-label token-range-label" htmlFor={`${id}-bleed`} title="The same bleed as the Print page">Bleed<span>{bleedMm.toFixed(1)} mm</span></label>
        <input id={`${id}-bleed`} type="range" min="0" max="3" step="0.5" value={bleedMm} style={{ '--fill': `${(bleedMm / 3) * 100}%` }}
          onChange={(e) => setBleedMm(Number(e.target.value))} aria-valuetext={`${bleedMm} mm`} />
      </div>
      {/* Overlay: la seconda immagine (scontornata) sopra la cornice. Sync = si muove e si ingrandisce con quella di fondo;
          senza, si sceglie quale dei due livelli spostare. */}
      <input ref={overlayRef} type="file" accept="image/*" hidden tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) setOverlay(f); }} />
      <div className="token-row token-overlay-row">
        <button type="button" className="btn-secondary token-text-btn" onClick={() => overlayRef.current?.click()}
          title={overlay ? 'Replace the overlay (a cut-out image over the frame)' : 'Add an overlay (a cut-out image over the frame)'}>Overlay</button>
        <button type="button" className={`btn-secondary token-text-btn${state.sync ? ' on' : ''}`} aria-pressed={state.sync} disabled={!overlay || !art}
          onClick={() => set({ sync: !state.sync })} title="Sync: the overlay moves and zooms with the image">Sync</button>
        {overlay && (
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setOverlayNow(null)} aria-label="Remove the overlay" title="Remove the overlay"><IconX size={16} /></button>
        )}
      </div>
      {overlay && art && !state.sync && (
        <div className="token-row" role="radiogroup" aria-label="Layer to move">
          <button type="button" role="radio" aria-checked={state.target === 'art'} className={`btn-secondary deck-icon-btn${state.target === 'art' ? ' on' : ''}`}
            onClick={() => set({ target: 'art' })} aria-label="Move the image" title="Move the image"><IconImage size={18} /></button>
          <button type="button" role="radio" aria-checked={state.target === 'overlay'} className={`btn-secondary deck-icon-btn${state.target === 'overlay' ? ' on' : ''}`}
            onClick={() => set({ target: 'overlay' })} aria-label="Move the overlay" title="Move the overlay"><IconCopy size={18} /></button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) setArt(f); }} />
    </section>
  );
  const card = <TokenCard state={state} art={art} overlay={overlay} set={set} onPick={pick} onFile={setArt} mobile={mobile} bleedMm={bleedMm} />;

  if (mobile) {
    return (
      <div className="tokens-mobile">
        <div className="tokens-head"><h1 className="decks-title">Tokens</h1></div>
        {card}
        {actions}
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
      <main className="main-content tokens-main">{card}</main>
    </div>
  );
}
