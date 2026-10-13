import { useState, useEffect } from 'react';
import { fetchPrints, downloadAsFile, artName } from '../utils/scryfall';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX } from './icons';

// Box "cambia art": clic su una carta -> tutte le stampe Scryfall -> sostituisci.
// `count` > 1 = la stampa scelta va su tutte le copie selezionate (stessa carta).
export default function ArtPickerModal({ card, count = 1, onClose, onPick }) {
    // ponytail: nome dedotto dal filename; DFC / caratteri speciali -> niente stampe.
    const name = artName(card);
    const [prints, setPrints] = useState(null); // null = caricamento, [] = nessuna
    const [error, setError] = useState(null);
    const [picking, setPicking] = useState(false);
    // Esc chiude (ma non durante il download della stampa scelta) + focus nel modale.
    const dismissRef = useOverlayDismiss(() => { if (!picking) onClose(); });

    useEffect(() => {
        let alive = true;
        fetchPrints(name)
            .then((p) => { if (alive) setPrints(p); })
            .catch((e) => { if (alive) setError(e.message || 'Scryfall error.'); });
        return () => { alive = false; };
    }, [name]);

    const pick = async (p) => {
        setPicking(true);
        try {
            const file = await downloadAsFile(p.png, name);
            // come l'import Scryfall: full-art/borderless → mirror, altrimenti stretch
            await onPick(file, { bleedMode: (p.fullArt || p.borderless) ? 'mirror' : 'stretch', set: p.set, collector: p.collector });
        } catch (e) { setError(e.message || 'Download failed.'); setPicking(false); }
    };

    return (
        <div className="modal-overlay" onClick={picking ? undefined : onClose}>
            <div className="modal modal-art" ref={dismissRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Change art: ${name}`}>
                <div className="modal-header">
                    <h2>Change art, {name}{count > 1 ? ` (${count} cards)` : ''}</h2>
                    <button className="modal-close" onClick={onClose} aria-label="Close" disabled={picking}>
                        <IconX size={18} />
                    </button>
                </div>

                {error && <div className="info-box info-box-error"><span>{error}</span></div>}
                {prints === null && !error && (
                    <div className="import-status"><span className="import-spinner" /> Searching printings…</div>
                )}
                {prints && prints.length === 0 && (
                    <p className="modal-hint">No printings found for “{name}”.</p>
                )}
                {prints && prints.length > 0 && (
                    <div className="art-grid">
                        {prints.map((p) => (
                            <button key={p.id} className="art-cell" onClick={() => pick(p)} disabled={picking} title={`${p.setName} (${p.set})`}>
                                <img src={p.thumb} alt={p.setName} loading="lazy" />
                                <span>{p.set}</span>
                            </button>
                        ))}
                    </div>
                )}
                {picking && <div className="import-status"><span className="import-spinner" /> Downloading…</div>}
            </div>
        </div>
    );
}
