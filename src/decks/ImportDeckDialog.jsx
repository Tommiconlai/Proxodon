import { useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { fetchDeckBoards } from '../utils/scryfall';
import { resolveEntries } from './scryfallSearch';
import { FORMATS, newDeck, addEntries, parseDeckText } from './deckModel';
import { IconX } from '../components/icons';

// Import mazzo: link (Moxfield/Archidekt/Tappedout, con le zone) oppure lista incollata
// (intestazioni Commander / Deck / Sideboard / Maybeboard riconosciute).
export default function ImportDeckDialog({ onClose, onImported }) {
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [format, setFormat] = useState('commander');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const close = () => { if (!busy) onClose(); };
  const ref = useOverlayDismiss(close);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      let rows;
      let deckName = name.trim();
      if (link.trim()) {
        const r = await fetchDeckBoards(link.trim());
        rows = r.rows;
        deckName = deckName || r.name;
      } else {
        rows = parseDeckText(text);
      }
      if (!rows.length) throw new Error('No cards found. Check the link or the list.');
      const { items, notFound } = await resolveEntries(rows);
      if (!items.length) throw new Error(`None of the ${notFound.length} cards was found. Check the spelling, or the (SET) number.`);
      onImported(addEntries(newDeck({ name: deckName || 'Imported deck', format }), items), notFound);
    } catch (e) {
      setError(e.message || 'Import failed.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Import deck" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import deck</h2>
          <button type="button" className="modal-close" onClick={close} aria-label="Close" disabled={busy}><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Paste a deck link, or the list by hand. Lines like <code>1 Sol Ring (C21) 263</code>; headers <code>Commander</code>, <code>Deck</code>, <code>Sideboard</code> and <code>Maybeboard</code> pick the board.</p>
        <input type="url" className="import-link-input" value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Deck link (Moxfield, Archidekt, Tappedout)" disabled={busy} spellCheck={false} />
        <textarea className="import-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={8}
          placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Command Tower'} disabled={busy || !!link.trim()} spellCheck={false} />
        <div className="import-meta-row">
          <input className="import-link-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name (optional)" maxLength={80} disabled={busy} aria-label="Deck name" />
          <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={busy} aria-label="Format">
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        {error && <div className="info-box info-box-error"><span>{error}</span></div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={close} disabled={busy}>Cancel</button>
          <button type="button" className="btn-generate import-btn" onClick={run} disabled={busy || (!link.trim() && !text.trim())}>
            {busy ? <><span className="spinner" /> Importing…</> : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
