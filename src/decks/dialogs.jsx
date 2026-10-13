import { useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { FORMATS } from './deckModel';
import { IconX } from '../components/icons';

// Cosa salviamo e come cancellarlo (menu account).
export function PrivacyPanel({ onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Privacy" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Privacy</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Signing in with Google lets Proxoteca keep your decks on Firebase (Google Cloud), so they sync between your devices.</p>
        <ul className="privacy-list">
          <li><b>Stored:</b> your Google account id, name, email and photo (kept by Firebase Authentication) and your decks.</li>
          <li><b>Where:</b> Firebase, with the deck database in the EU.</li>
          <li><b>Who can read it:</b> only you. Access rules block every other account.</li>
          <li><b>How to delete it:</b> account menu, Delete account and data. It removes your decks and your account.</li>
        </ul>
        <p className="modal-hint">The print area works without an account and keeps nothing on a server.</p>
      </div>
    </div>
  );
}

// Nuovo mazzo (nome + formato) e Rinomina (solo nome).
export function NameFormatDialog({ title, confirmLabel, initialName = '', initialFormat = 'commander', showFormat = true, onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const [format, setFormat] = useState(initialFormat);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onSubmit({ name: name.trim(), format });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal modal-confirm deck-form" ref={ref} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header"><h2>{title}</h2></div>
        <label className="field-label" htmlFor="deck-name">Name</label>
        <input id="deck-name" className="import-link-input" value={name} onChange={(e) => setName(e.target.value)}
          autoFocus maxLength={80} placeholder="Atraxa superfriends" spellCheck={false} />
        {showFormat && (
          <>
            <label className="field-label" htmlFor="deck-format">Format</label>
            <select id="deck-format" value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-generate import-btn" disabled={!name.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
