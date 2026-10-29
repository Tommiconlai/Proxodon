import { useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { resolveEntries } from './scryfallSearch';
import { FORMATS, newDeck, addEntries, parseDeckText } from './deckModel';
import { IconX, IconCheck } from '../components/icons';
import { getSettings } from '../utils/settings';

// Nuovo mazzo (il + in fondo a My decks): nome, formato, Public (copia subito in Community) e, se si vuole,
// la lista da importare (intestazioni Commander / Deck / Sideboard / Maybeboard riconosciute; carte a due
// facce sia "A // B" sia "A/B"). Senza lista = mazzo vuoto. Raggruppamento, stampa non trovata e righe
// ripetute seguono Settings. onCreate(deck, notFound).
// Team Trios: title del pannello, formats ammessi (il primo formato se quello di Settings non c'è), initialFormat,
// allowPublic = false senza Public.
export default function NewDeckDialog({ onClose, onCreate, title = 'New deck', formats = FORMATS, initialFormat, allowPublic = true }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState(() => initialFormat || [getSettings().deckFormat].find((f) => formats.some((x) => x.id === f)) || formats[0].id);
  const [pub, setPub] = useState(() => allowPublic && getSettings().deckPublic);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const close = () => { if (!busy) onClose(); };
  const ref = useOverlayDismiss(close, true, { focusContainer: false });
  const list = text.trim();
  const label = list ? 'Import deck' : 'Create deck';

  const run = async (e) => {
    e.preventDefault();
    if (busy) return;
    const s = getSettings();
    const deck = { ...newDeck({ name: name.trim() || (list ? 'Imported deck' : ''), format, groupBy: s.deckGroupBy }), public: pub };
    if (!list) { onCreate(deck, []); return; }
    setBusy(true);
    setError(null);
    try {
      const rows = parseDeckText(text);
      if (!rows.length) throw new Error('No cards found. Check the list.');
      const { items, notFound } = await resolveEntries(rows, { fallback: s.importFallback });
      if (!items.length) throw new Error(`None of the ${notFound.length} cards was found. Check the spelling, or the (SET) number.`);
      const made = addEntries(deck, items, { merge: s.importMerge });
      // Copie rimaste fuori (righe oltre MAX_ROWS, quantità oltre MAX_QTY): le dice il toast.
      const left = items.reduce((n, it) => n + (it.qty || 1), 0) - made.cards.reduce((n, r) => n + r.qty, 0);
      onCreate(made, notFound, left);
    } catch (err) {
      setError(err.message || 'Import failed.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <form className="modal deck-form new-deck" ref={ref} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onSubmit={run}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={close} aria-label="Close" title="Close" disabled={busy}><IconX size={18} /></button>
        </div>
        <label className="field-label" htmlFor="deck-name">Name</label>
        <input id="deck-name" className="import-link-input" value={name} onChange={(e) => setName(e.target.value)}
          autoFocus maxLength={80} placeholder="Atraxa superfriends" spellCheck={false} disabled={busy} />
        <label className="field-label" htmlFor="deck-format">Format</label>
        <select id="deck-format" value={format} onChange={(e) => setFormat(e.target.value)} disabled={busy}>
          {formats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {allowPublic && <label className="checkbox-row">
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} disabled={busy} />
          <span className="anim-check" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
              <polyline points="1 9 7 14 15 4" />
            </svg>
          </span>
          Public, shared in Community
        </label>}
        <label className="field-label" htmlFor="deck-list">Import a list <span className="field-hint">Optional</span></label>
        <textarea id="deck-list" className="import-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={6}
          placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Command Tower'} disabled={busy} spellCheck={false} />
        <p className="modal-hint">Lines like <code>1 Sol Ring (C21) 263</code>; headers <code>Commander</code>, <code>Deck</code>, <code>Sideboard</code> and <code>Maybeboard</code> pick the board. Double-faced cards work as <code>A // B</code> or <code>A/B</code>. Leave it empty for an empty deck.</p>
        {error && <div className="info-box info-box-error"><span>{error}</span></div>}
        <div className="modal-actions">
          <button type="submit" className="btn-generate deck-icon-btn" disabled={busy} aria-label={label} title={label}>
            {busy ? <span className="spinner" /> : <IconCheck size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
