import { useId } from 'react';
import { IconAlert } from './icons';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';

/**
 * Conferma generica per azioni distruttive (es. "Elimina tutte"). Riusa lo stile
 * `.modal`; il modificatore `.modal-confirm` lo tiene piccolo/centrato anche su
 * mobile (dove i modali normali sono full-screen).
 */
export default function ConfirmDialog({ open, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  // Esc = annulla + ripristino focus. focusContainer=false: il focus iniziale va su
  // "Cancel" (autoFocus), l'azione meno distruttiva (no Invio accidentale sul Delete).
  const dismissRef = useOverlayDismiss(onCancel, open, { focusContainer: false });
  const msgId = useId(); // il messaggio dà il nome al dialogo
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-confirm" ref={dismissRef} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby={msgId}>
        <div className="confirm-body">
          <IconAlert size={20} />
          <p id={msgId}>{message}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} autoFocus>Cancel</button>
          <button type="button" className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
