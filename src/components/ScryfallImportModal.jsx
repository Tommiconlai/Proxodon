import { useState } from 'react';
import { parseCardList, fetchScryfallImages, MAX_LINES, TOO_MANY_LINES } from '../utils/scryfall';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX } from './icons';
import { lsGet, lsSet } from '../utils/settings';

export default function ScryfallImportModal({ open, onClose, onImport }) {
    const [text, setText] = useState(() => lsGet('ip:cardlist') || ''); // sopravvive al reload
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState(null); // { imported, notFound }
    const [error, setError] = useState(null);

    // Esc chiude (ma non durante un import) + focus dentro al modale.
    const close = () => { if (!busy) onClose(); };
    const dismissRef = useOverlayDismiss(close, open);

    if (!open) return null;

    const handleImport = async () => {
        const entries = parseCardList(text);
        if (!entries.length) { setError('Enter at least one card.'); return; }
        if (entries.length > MAX_LINES) { setError(TOO_MANY_LINES); return; }
        setError(null);
        setResult(null);
        setBusy(true);
        setProgress({ done: 0, total: 0 });
        try {
            const { files, notFound } = await fetchScryfallImages(
                entries,
                (done, total) => setProgress({ done, total }),
            );
            if (files.length) onImport(files);
            // 0 importate ma con "non trovate" = fallimento totale: mostra un errore,
            // non il riquadro "✓ 0 imported" (che leggerebbe come successo).
            if (!files.length && notFound.length) {
                setError(`None of the ${notFound.length} card${notFound.length > 1 ? 's were' : ' was'} found. Check the spelling, or the (SET) number.`);
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
            <div className="modal" ref={dismissRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Import from Scryfall">
                <div className="modal-header">
                    <h2>Import from Scryfall</h2>
                    <button className="modal-close" onClick={close} aria-label="Close" disabled={busy}>
                        <IconX size={18} />
                    </button>
                </div>

                <p className="modal-hint">
                    Paste the list, one card per line, format
                    {' '}<code>1x Card Name</code>; add <code>(SET) num</code> to pick the printing.
                    Double-faced cards import front and back; <code>A // B</code> and <code>A/B</code> both work.
                </p>

                <textarea
                    className="import-textarea"
                    value={text}
                    onChange={(e) => { setText(e.target.value); lsSet('ip:cardlist', e.target.value); if (result) setResult(null); }}
                    placeholder={'1x Sol Ring\n2x Brainstorm\n1x Fable of the Mirror-Breaker'}
                    rows={10}
                    disabled={busy}
                    spellCheck={false}
                />

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
                                ✗ {result.notFound.length} not found: {result.notFound.slice(0, 8).join(', ')}
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
                        disabled={busy || (!result && !text.trim())}
                    >
                        {busy ? <><span className="spinner" /> Importing…</> : result ? 'Done' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
