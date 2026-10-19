import { useState } from 'react';
import { parseMpcXml, fetchMpcImages } from '../utils/mpcfill';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX } from './icons';

// Import da un file XML di MPCFill: seleziona il file → scarica le immagini.
export default function MpcImportModal({ open, onClose, onImport }) {
    const [cards, setCards] = useState(null);    // carte trovate nel file
    const [fileName, setFileName] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState(null);  // { imported, notFound }
    const [error, setError] = useState(null);

    const close = () => { if (!busy) onClose(); };
    const dismissRef = useOverlayDismiss(close, open); // Esc chiude (non durante l'import) + focus

    if (!open) return null;

    const onFile = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setError(null); setResult(null); setCards(null); setFileName(f.name);
        try {
            // Un ordine MPCFill pesa pochi KB: un file enorme bloccherebbe la scheda nel parser XML.
            if (f.size > 5 * 1024 * 1024) throw new Error('This file is too big for an MPCFill order (max 5 MB).');
            const { cards } = parseMpcXml(await f.text());
            setCards(cards);
        } catch (err) {
            setError(err.message || 'Could not read the file.');
        }
    };

    const copies = cards ? cards.reduce((n, c) => n + c.count, 0) : 0;

    const handleImport = async () => {
        if (!cards) return;
        setBusy(true); setError(null); setProgress({ done: 0, total: cards.length });
        try {
            const { files, notFound } = await fetchMpcImages(cards, (done, total) => setProgress({ done, total }));
            if (files.length) onImport(files);
            // 0 scaricate ma con falliti = fallimento totale: errore, non "✓ 0 imported"
            // (stessa logica dell'import Scryfall).
            if (!files.length && notFound.length) {
                setError(`None of the ${notFound.length} download${notFound.length > 1 ? 's' : ''} succeeded. Check your connection, or that the Drive files are still shared.`);
            } else {
                setResult({ imported: files.length, notFound });
            }
        } catch (e) {
            setError(e.message || 'Error during import.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={close}>
            <div className="modal" ref={dismissRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Import from MPCFill">
                <div className="modal-header">
                    <h2>Import from MPCFill</h2>
                    <button className="modal-close" onClick={close} aria-label="Close" disabled={busy}>
                        <IconX size={18} />
                    </button>
                </div>

                <p className="modal-hint">
                    Pick a MPCFill <code>.xml</code> order file. Images are pulled from the
                    Google&nbsp;Drive links inside it and come print-ready with bleed.
                    Set <b>Bleed</b> to <b>3&nbsp;mm</b> for accurate crop marks.
                </p>

                <label className="btn-secondary mpc-file">
                    <input type="file" accept=".xml,text/xml,application/xml" onChange={onFile} disabled={busy} hidden />
                    {fileName || 'Choose .xml file…'}
                </label>

                {cards && !result && (
                    <p className="modal-hint">
                        {cards.length} card{cards.length > 1 ? 's' : ''} found
                        {copies !== cards.length ? ` (${copies} with copies)` : ''}.
                    </p>
                )}

                {error && (
                    <div className="info-box info-box-error"><span>{error}</span></div>
                )}

                {busy && (
                    <div className="import-status">
                        <span className="import-spinner" />
                        Downloading images{progress.total ? ` ${progress.done}/${progress.total}` : '…'}
                    </div>
                )}

                {result && (
                    <div className="import-result">
                        <div>✓ {result.imported} image{result.imported !== 1 ? 's' : ''} imported</div>
                        {result.notFound.length > 0 && (
                            <div className="import-notfound">
                                ✗ {result.notFound.length} failed: {result.notFound.slice(0, 8).join(', ')}
                                {result.notFound.length > 8 ? `, +${result.notFound.length - 8} more` : ''}
                            </div>
                        )}
                    </div>
                )}

                <div className="modal-actions">
                    {!result && (
                        <button className="btn-secondary" onClick={close} disabled={busy}>Close</button>
                    )}
                    <button
                        className="btn-generate import-btn"
                        onClick={busy ? undefined : (result ? onClose : handleImport)}
                        disabled={busy || (!result && !cards)}
                    >
                        {busy ? <><span className="spinner" /> Importing…</> : result ? 'Done' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
