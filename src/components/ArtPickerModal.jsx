import { useState, useEffect, useMemo } from 'react';
import { fetchPrints, downloadAsFile, artName } from '../utils/scryfall';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX } from './icons';

// Box "cambia art": clic su una carta -> tutte le stampe Scryfall -> sostituisci.
// `count` > 1 = la stampa scelta va su tutte le copie selezionate (stessa carta).
// Mazzi ("Change edition"): `name` e `title` espliciti, `current` = { set, cn } evidenziata,
// `onPickPrint(print)` riceve la stampa invece del file scaricato.
export default function ArtPickerModal({ card, name: nameProp, title, current, count = 1, onClose, onPick, onPickPrint }) {
    // ponytail: nome dedotto dal filename; DFC / caratteri speciali -> niente stampe.
    const name = nameProp || artName(card);
    const [prints, setPrints] = useState(null); // null = caricamento, [] = nessuna
    const [error, setError] = useState(null);
    const [picking, setPicking] = useState(false);
    // Filtro locale sulle stampe già scaricate: ogni parola deve comparire in set, codice,
    // numero, artista, anno o "full art"/"borderless" (es. "secret lair 2021").
    const [query, setQuery] = useState('');
    const shown = useMemo(() => {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!prints || !words.length) return prints;
        return prints.filter((p) => {
            const hay = `${p.setName} ${p.set} ${p.collector} ${p.artist} ${p.year}${p.fullArt ? ' full art' : ''}${p.borderless ? ' borderless' : ''}`.toLowerCase();
            return words.every((w) => hay.includes(w));
        });
    }, [prints, query]);
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
            if (onPickPrint) { await onPickPrint(p); return; }
            const file = await downloadAsFile(p.png, name);
            // come l'import Scryfall: full-art/borderless → mirror, altrimenti stretch
            await onPick(file, { bleedMode: (p.fullArt || p.borderless) ? 'mirror' : 'stretch', set: p.set, collector: p.collector });
        } catch (e) { setError(e.message || 'Download failed.'); setPicking(false); }
    };

    return (
        <div className="modal-overlay" onClick={picking ? undefined : onClose}>
            <div className="modal modal-art" ref={dismissRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Change art: ${name}`}>
                <div className="modal-header">
                    <h2>{title || `Change art, ${name}${count > 1 ? ` (${count} cards)` : ''}`}</h2>
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
                    <div className="art-search-row">
                        <input
                            type="search"
                            className="import-link-input"
                            placeholder="Search set, code, artist or year, e.g. Secret Lair, M21, 2021"
                            aria-label="Search printings"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <span className="art-search-count" aria-live="polite">
                            {shown.length === prints.length ? `${prints.length} printings` : `${shown.length} of ${prints.length}`}
                        </span>
                    </div>
                )}
                {prints && prints.length > 0 && shown.length === 0 && (
                    <p className="modal-hint">No printings match “{query.trim()}”.</p>
                )}
                {shown && shown.length > 0 && (
                    <div className="art-grid">
                        {shown.map((p) => (
                            <button key={p.id} className={`art-cell${current && p.set === current.set.toUpperCase() && p.collector === current.cn ? ' current' : ''}`} onClick={() => pick(p)} disabled={picking}
                                title={`${p.setName} (${p.set} #${p.collector})${p.year ? `, ${p.year}` : ''}${p.artist ? `, ${p.artist}` : ''}`}>
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
