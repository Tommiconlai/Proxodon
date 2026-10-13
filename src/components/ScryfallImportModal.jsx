import { useState } from 'react';
import { parseCardList, fetchScryfallImages, fetchDeckList } from '../utils/scryfall';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX } from './icons';

export default function ScryfallImportModal({ open, onClose, onImport }) {
    const [text, setText] = useState(() => localStorage.getItem('ip:cardlist') || ''); // sopravvive al reload
    const [link, setLink] = useState('');
    const [loadingLink, setLoadingLink] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState(null); // { imported, notFound }
    const [error, setError] = useState(null);

    // Esc chiude (ma non durante un import/caricamento) + focus dentro al modale.
    const close = () => { if (!busy && !loadingLink) onClose(); };
    const dismissRef = useOverlayDismiss(close, open);

    if (!open) return null;

    // Carica una lista da un link deck nella textarea (poi import normale).
    const handleLoadLink = async () => {
        const u = link.trim();
        if (!u) return;
        setError(null); setResult(null); setLoadingLink(true);
        try {
            const list = await fetchDeckList(u);
            if (!list) { setError('No cards found in the deck (did the site format change?).'); return; }
            setText(list);
            localStorage.setItem('ip:cardlist', list);
        } catch (e) {
            setError(e.message || 'Error loading the deck.');
        } finally {
            setLoadingLink(false);
        }
    };

    const handleImport = async () => {
        const entries = parseCardList(text);
        if (!entries.length) { setError('Enter at least one card.'); return; }
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
                    Paste a deck link or the list by hand. One card per line, format
                    {' '}<code>1x Card Name</code>; add <code>(SET) num</code> to pick the printing.
                    Double-faced cards import front and back.
                </p>

                <div className="import-link-row">
                    <input
                        type="url"
                        className="import-link-input"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLoadLink(); }}
                        placeholder="Deck link (Moxfield, Archidekt, Tappedout)"
                        disabled={busy || loadingLink}
                        spellCheck={false}
                    />
                    <button
                        className="btn-secondary"
                        onClick={handleLoadLink}
                        disabled={busy || loadingLink || !link.trim()}
                    >
                        {loadingLink ? <><span className="spinner" /> Loading…</> : 'Load'}
                    </button>
                </div>

                <textarea
                    className="import-textarea"
                    value={text}
                    onChange={(e) => { setText(e.target.value); localStorage.setItem('ip:cardlist', e.target.value); if (result) setResult(null); }}
                    placeholder={'1x Sol Ring\n2x Brainstorm\n1x Fable of the Mirror-Breaker'}
                    rows={10}
                    disabled={busy || loadingLink}
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
                        <button className="btn-secondary" onClick={close} disabled={busy || loadingLink}>Close</button>
                    )}
                    <button
                        className="btn-generate import-btn"
                        onClick={busy ? undefined : (result ? onClose : handleImport)}
                        disabled={busy || loadingLink || (!result && !text.trim())}
                    >
                        {busy ? <><span className="spinner" /> Importing…</> : result ? 'Done' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
