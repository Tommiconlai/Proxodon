/**
 * Toast transitorio (feedback azioni rapide, es. "Save list"). Mostrato in
 * entrambi gli alberi (mobile + desktop), si auto-chiude (gestito in App).
 * `aria-live="polite"` per l'annuncio screen-reader senza rubare il focus.
 */
export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind || 'success'}`} role="status" aria-live="polite" onClick={onClose}>
      {toast.kind === 'progress'
        ? <span className="import-spinner" aria-hidden="true" />
        : <span className="toast-ic" aria-hidden="true">{toast.kind === 'error' ? '!' : '✓'}</span>}
      <span>{toast.msg}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={(e) => { e.stopPropagation(); toast.action.onClick(); }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
