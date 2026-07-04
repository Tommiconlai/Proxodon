import { IconFile } from './icons';

/**
 * Blocco export PDF: bottone Generate / barra di avanzamento + Annulla.
 * Condiviso da sidebar desktop (App) e pagina Export mobile (MobileLayout) —
 * stesso markup, un solo posto da mantenere.
 * props: loading, progress {done,total}|null, disabled, onGenerate, onCancel.
 */
export default function ExportProgress({ loading, progress, disabled, onGenerate, onCancel }) {
  if (!loading) {
    return (
      <button className="btn-generate" onClick={onGenerate} disabled={disabled}>
        <IconFile size={18} /> Generate PDF
      </button>
    );
  }
  return (
    <div className="gen-progress">
      <button className="btn-generate" disabled>
        <span className="spinner" />
        {progress ? `Rendering ${progress.done}/${progress.total}…` : 'Generating…'}
      </button>
      <div className="gen-bar" role="progressbar" aria-label="Export progress"
        aria-valuenow={progress?.done || 0} aria-valuemin={0} aria-valuemax={progress?.total || 0}>
        <div className="gen-bar-fill" style={{ transform: `scaleX(${progress?.total ? progress.done / progress.total : 0})` }} />
      </div>
      <button type="button" className="btn-secondary gen-cancel" onClick={onCancel}>Cancel export</button>
    </div>
  );
}
