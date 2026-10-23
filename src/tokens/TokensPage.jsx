import { useEffect, useRef, useState } from 'react';
import { TEMPLATES, templateById } from './templates';
import { frameColors } from './tokenModel';
import { renderTokenFile } from './renderToken';
import TokenCard from './TokenCard';
import { ManaCost } from '../decks/Mana';
import { saveFile } from '../utils/download';
import { navigate } from '../hooks/useHashRoute';
import { IconUpload, IconTrash, IconReplay, IconDownload, IconNavPrint, IconPlus } from '../components/icons';

const COLORS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']];
const EMPTY = {
  template: 'classic', colors: [], name: '', types: [], subtypes: [], rules: '', power: '', toughness: '', credit: '',
  pos: { x: 0, y: 0, zoom: 1 },
};
// Il token in lavorazione resta finché la scheda è aperta (andando su Print e tornando c'è ancora); niente salvataggio.
const memory = { state: EMPTY, art: null };

const thumb = (t, colors) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.svg(frameColors(colors), { pt: true }))}`;

// Pagina Tokens (#/tokens): a sinistra (telefono: sotto la carta) la cornice con i colori, i pulsanti dell'immagine e
// quelli per creare; i testi si scrivono sulla carta (TokenCard). Add to Print manda il PNG alla coda di stampa
// (onAdd = addItems di App), Download lo salva.
export default function TokensPage({ onAdd, notify, mobile }) {
  const [state, setState] = useState(memory.state);
  const [art, setArtNow] = useState(memory.art);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { memory.state = state; memory.art = art; }, [state, art]);
  const set = (patch) => setState((s) => ({ ...s, ...patch }));
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
  useEffect(() => { setArtRef.current = setArt; });
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
  const pick = () => fileRef.current?.click();

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
  const controls = (
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
      {/* Pulsanti dell'immagine: un pulsante vero (raggiungibile da tastiera) apre il selettore nascosto. */}
      <input ref={fileRef} type="file" accept="image/*" hidden tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) setArt(f); }} />
      <div className="token-row">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={pick} aria-label="Upload an image" title="Upload an image"><IconUpload size={18} /></button>
        <button type="button" className="btn-secondary deck-icon-btn" onClick={() => set({ pos: { x: 0, y: 0, zoom: 1 } })} disabled={!art}
          aria-label="Reset position and zoom" title="Reset position and zoom"><IconReplay size={18} /></button>
        <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setArtNow(null)} disabled={!art}
          aria-label="Remove the image" title="Remove the image"><IconTrash size={18} /></button>
      </div>
    </section>
  );
  const card = <TokenCard state={state} art={art} set={set} onPick={pick} onFile={setArt} mobile={mobile} />;

  if (mobile) {
    return (
      <div className="tokens-mobile">
        <div className="tokens-head">
          <h1 className="decks-title">Tokens</h1>
          {actions}
        </div>
        {card}
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
