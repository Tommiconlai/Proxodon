import { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';

// ── Menu contestuale (click destro / Shift+F10 / pressione lunga): carte in stampa, mazzi, righe ──
// items: [{ key, Icon, label, run, keepOpen?, danger?, disabled?, note? }].
// In portal sul body: gli antenati animati (transform) romperebbero il position:fixed.
export default function CardMenu({ x, y, title, items, onClose }) {
    // Esc chiude + focus restituito alla carta alla chiusura.
    const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
    // Tieni il menu dentro il viewport (aperto vicino al bordo destro/basso).
    useLayoutEffect(() => {
        const el = ref.current;
        const r = el.getBoundingClientRect();
        el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
        el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
    }, [x, y, ref]);
    // Dopo l'effect dell'hook (che memorizza la carta come focus da ripristinare).
    useEffect(() => { ref.current.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus(); }, [ref]);
    // Click fuori / finestra ridimensionata o persa = chiudi.
    useEffect(() => {
        const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
        document.addEventListener('pointerdown', onDown, true);
        window.addEventListener('resize', onClose);
        window.addEventListener('blur', onClose);
        return () => {
            document.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('blur', onClose);
        };
    }, [onClose, ref]);

    const onKeyDown = (e) => {
        const items = [...ref.current.querySelectorAll('[role="menuitem"]')];
        const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
        if (step) {
            e.preventDefault();
            items[(items.indexOf(document.activeElement) + step + items.length) % items.length].focus();
        } else if (e.key === 'Tab') onClose();
    };
    return createPortal(
        <div className="card-menu" role="menu" aria-label={title} ref={ref} style={{ left: x, top: y }}
            onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
            <div className="card-menu-title" aria-hidden="true">{title}</div>
            {items.map((it) => (
                // aria-disabled (non `disabled`): resta focusabile/leggibile, il click non fa nulla.
                <button key={it.key} type="button" role="menuitem" className={it.danger ? 'danger' : undefined}
                    aria-disabled={it.disabled || undefined}
                    onClick={it.disabled ? undefined : () => { it.run(); if (!it.keepOpen) onClose(); }}>
                    <it.Icon size={15} /> {it.label}
                    {it.disabled && it.note && <span className="card-menu-note">{it.note}</span>}
                </button>
            ))}
        </div>,
        document.body,
    );
}
