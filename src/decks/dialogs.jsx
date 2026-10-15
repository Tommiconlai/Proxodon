import { useMemo, useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { FORMATS, coverRow, exportText } from './deckModel';
import { IconX, IconCopy, IconDownload } from '../components/icons';
import { downloadText } from '../utils/download';

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck';

// Copertina del mazzo: l'arte di una sua carta (una per carta, maybeboard escluso) oppure
// "Automatic" (primo comandante, sennò prima carta del main). onPick(oid | null).
export function CoverDialog({ deck, onPick, onClose }) {
  const ref = useOverlayDismiss(onClose);
  const [q, setQ] = useState('');
  const cards = useMemo(() => {
    const by = new Map();
    for (const r of deck.cards) if (r.board !== 'maybe' && r.card.art && !by.has(r.card.oid)) by.set(r.card.oid, r.card);
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [deck]);
  const shown = cards.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const auto = coverRow({ ...deck, cover: null })?.card;
  const current = deck.cover && cards.some((c) => c.oid === deck.cover) ? deck.cover : null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-art" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Deck cover" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deck cover</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <div className="art-search-row">
          <input type="search" className="import-link-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter the deck's cards" aria-label="Filter cards" spellCheck={false} />
          <span className="art-search-count" aria-live="polite">{shown.length} of {cards.length} cards</span>
        </div>
        <div className="art-grid cover-grid">
          {auto && !q.trim() && (
            <button type="button" className={`art-cell${current ? '' : ' current'}`} onClick={() => onPick(null)}
              title={`Automatic: ${auto.name}`}>
              <img src={auto.art} alt="" />
              <span>Automatic</span>
            </button>
          )}
          {shown.map((c) => (
            <button key={c.oid} type="button" className={`art-cell${current === c.oid ? ' current' : ''}`} onClick={() => onPick(c.oid)} title={c.name}>
              <img src={c.art} alt="" loading="lazy" />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export del mazzo: testo semplice ("4 Lightning Bolt") o con espansione e numero
// ("4 Lightning Bolt (M10) 146", reimportabile con la stessa stampa). Copia o scarica .txt.
export function ExportDeckDialog({ deck, onClose }) {
  const [specs, setSpecs] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useOverlayDismiss(onClose);
  const text = exportText(deck, { specs });
  const pick = (v) => { setSpecs(v); setCopied(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* appunti bloccati: il testo resta selezionabile */ }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Export ${deck.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export deck</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <div className="deck-mode export-mode" role="group" aria-label="Export format">
          <button type="button" aria-pressed={!specs} onClick={() => pick(false)}>Plain text</button>
          <button type="button" aria-pressed={specs} onClick={() => pick(true)}>With set and number</button>
        </div>
        <textarea className="import-textarea export-text" value={text} readOnly rows={12} spellCheck={false} aria-label="Deck list"
          onFocus={(e) => e.target.select()} />
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => downloadText(`${safeName(deck.name)}.txt`, `${text}\n`)}>
            <IconDownload size={15} /> Download .txt
          </button>
          <button type="button" className="btn-generate import-btn" onClick={copy}><IconCopy size={15} /> {copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}

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
        <p className="modal-hint">Signing in (with Google, or with email and password) lets Proxoteca keep your decks on Firebase (Google Cloud), so they sync between your devices.</p>
        <ul className="privacy-list">
          <li><b>Stored:</b> your account id and email, plus name and photo with Google, and the nickname and profile photo if you set them (kept by Firebase Authentication; passwords are stored hashed by Firebase, never by Proxoteca) and your decks.</li>
          <li><b>Where:</b> Firebase, with the deck database in the EU.</li>
          <li><b>Who can read it:</b> only you. Access rules block every other account.</li>
          <li><b>How to delete it:</b> account menu, Delete account and data. It removes your decks and your account.</li>
        </ul>
        <p className="modal-hint">The print area works without an account and keeps nothing on a server.</p>
      </div>
    </div>
  );
}

// Nuovo mazzo (nome + formato), Rinomina e le sezioni custom (solo nome).
export function NameFormatDialog({ title, confirmLabel, initialName = '', initialFormat = 'commander', showFormat = true, placeholder = 'Atraxa superfriends', maxLength = 80, onSubmit, onClose }) {
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
          autoFocus maxLength={maxLength} placeholder={placeholder} spellCheck={false} />
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

// Conferma "Print deck": sostituzione della coda (se non vuota) o aggiunta (add, da Settings) e
// sideboard opzionale (spuntata di default se lo dice Settings).
export function PrintDeckDialog({ queueCount, sideCount, add, defaultSide, onConfirm, onClose }) {
  const [side, setSide] = useState(!!defaultSide);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-confirm" ref={ref} role="dialog" aria-modal="true" aria-label="Print deck" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Print deck</h2></div>
        {queueCount > 0 && (add
          ? <p className="modal-hint">The deck goes after the {queueCount} card{queueCount !== 1 ? 's' : ''} already in the print queue.</p>
          : <p className="modal-hint">Replace the {queueCount} card{queueCount !== 1 ? 's' : ''} in the print queue?</p>)}
        {sideCount > 0 && (
          <label className="checkbox-row">
            <input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} />
            <span className="anim-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
                <polyline points="1 9 7 14 15 4" />
              </svg>
            </span>
            Include sideboard ({sideCount})
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} autoFocus>Cancel</button>
          <button type="button" className="btn-generate import-btn" onClick={() => onConfirm(side)}>{queueCount > 0 ? (add ? 'Add and print' : 'Replace and print') : 'Print'}</button>
        </div>
      </div>
    </div>
  );
}
