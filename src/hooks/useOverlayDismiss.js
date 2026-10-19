import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBackClose } from './useBackClose';

// Overlay aperti, l'ultimo in cima: Esc chiude solo quello (lo zoom di una carta dentro la ricerca, non tutti e due).
const layers = [];

// Esc per chiudere + gestione focus per overlay (modali, sheet, dialog).
// - Escape → onClose (capturato a livello documento), solo per l'overlay in cima.
// - Back del sistema → onClose (useBackClose: una voce in cronologia finché è aperto).
// - Al "apri" sposta il focus dentro l'overlay (sul contenitore tabIndex=-1).
// - Alla chiusura ripristina il focus all'elemento che l'aveva quando si è aperto (il trigger).
// `active` = se l'overlay è aperto (per i componenti sempre montati che fanno
// `if (!open) return null`: passa il flag, non si possono chiamare hook dopo il return).
// `focusContainer` = false per non rubare un autoFocus interno (es. ConfirmDialog
// mette il focus su Annulla, l'azione meno distruttiva).
// ponytail: niente focus-trap completo sul Tab; Esc + focus-in + restore coprono
// il grosso. Aggiungere il trap se un audit lo richiede.
export function useOverlayDismiss(onClose, active = true, { focusContainer = true } = {}) {
    const ref = useRef(null);
    // Ref "ultima versione" della callback, aggiornata in effect (non in render:
    // la regola react-hooks/refs vieta la scrittura del ref durante il render).
    const cb = useRef(onClose);
    useEffect(() => { cb.current = onClose; });
    // Chi aveva il focus quando l'overlay si è aperto (prima di un autoFocus interno, che nel commit arriva prima
    // degli effect): serve per restituirgli il focus alla chiusura. Preso a ogni apertura, non al mount: un
    // ConfirmDialog sempre montato si apre molto dopo (il cestino che l'ha aperto, non il body).
    const [opener, setOpener] = useState(null);
    const [wasActive, setWasActive] = useState(false);
    if (active !== wasActive) {
        setWasActive(active);
        if (active && typeof document !== 'undefined') setOpener(document.activeElement);
    }
    // Focus dato da un autoFocus interno nel commit: un overlay che si chiude nello stesso momento (il menu da cui
    // si è aperto) lo riporta al suo elemento negli effect, qui sotto si rimette dentro.
    const mountFocus = useRef(null);
    useLayoutEffect(() => {
        // Tenuto finché è aperto: lo StrictMode di sviluppo rilancia questo effect quando il focus è già fuori.
        if (!active) mountFocus.current = null;
        else if (ref.current?.contains(document.activeElement)) mountFocus.current = document.activeElement;
    }, [active]);
    useBackClose(active, onClose);

    useEffect(() => {
        if (!active) return undefined;
        const me = {};
        layers.push(me);
        // Un campo interno con autoFocus (es. la ricerca carte) ha già il focus: non rubarlo.
        const inside = ref.current?.contains(document.activeElement);
        const prev = inside ? opener : document.activeElement;
        const onKey = (e) => {
            if (e.key === 'Escape' && layers[layers.length - 1] === me) { e.stopPropagation(); cb.current?.(); }
        };
        document.addEventListener('keydown', onKey);
        // Un campo marcato data-autofocus vince sul contenitore (anche quando lo StrictMode di
        // sviluppo rimonta l'effect dopo aver già restituito il focus all'opener).
        const auto = ref.current?.querySelector?.('[data-autofocus]') || (!inside && mountFocus.current);
        if (auto) auto.focus();
        else if (focusContainer && !inside) ref.current?.focus?.();
        return () => {
            layers.splice(layers.indexOf(me), 1);
            document.removeEventListener('keydown', onKey);
            if (prev && prev.focus && document.contains(prev)) prev.focus();
        };
    }, [active, focusContainer, opener]);

    return ref;
}
