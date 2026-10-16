import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { getGridInfo, cropMarkSpan, drawCardWithBleed, resolveBleedMode, bleedLabel } from '../utils/pdfGenerator';
import CardMenu from './CardMenu';
import { artName } from '../utils/scryfall';
import { canUpscale } from '../utils/upscale';
import { IconX, IconCopy, IconFrame, IconImage, IconTrash, IconSparkles, IconChevron } from './icons';
import { CardFrame, CardFrameDefs } from './CardFrame';

// Nome carta vero (Scryfall) se presente, altrimenti il filename senza estensione.
const cardName = (img, idx) => img.name || (img.file?.name || `Card ${idx + 1}`).replace(/\.[^.]+$/, '');

// ── Carica un'immagine come HTMLImageElement (async) ─────────
function loadImage(src) {
    return new Promise((resolve) => {
        if (!src) { resolve(null); return; }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// ── Linee di taglio su canvas ────────────────────────────────
function drawCropMarksCanvas(ctx, cellX, cellY, bleedPx, cardWpx, cardHpx, scale, limits, style = 'lines') {
    const gap = 0.5 * scale;
    const len = 3 * scale;

    const cx = cellX + bleedPx;
    const cy = cellY + bleedPx;

    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = Math.max(0.5, 0.3 * scale);

    const seg = (x1, y1, x2, y2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    if (style === 'corners') {
        // Squadrette ad angolo (vedi drawCropMarks PDF): vertice in fuori di g, bracci len verso la carta.
        const g = bleedPx > 0 ? Math.min(0.6 * scale, bleedPx) : 0.6 * scale;
        const len2 = Math.min(len, cardWpx * 0.45, cardHpx * 0.45);
        const bracket = (vx, vy, sx, sy) => { seg(vx, vy, vx + sx * len2, vy); seg(vx, vy, vx, vy + sy * len2); };
        bracket(cx - g, cy - g, 1, 1);
        bracket(cx + cardWpx + g, cy - g, -1, 1);
        bracket(cx - g, cy + cardHpx + g, 1, -1);
        bracket(cx + cardWpx + g, cy + cardHpx + g, -1, -1);
        return;
    }

    const L = cropMarkSpan(limits.left, gap, len);
    const R = cropMarkSpan(limits.right, gap, len);
    const U = cropMarkSpan(limits.up, gap, len);
    const D = cropMarkSpan(limits.down, gap, len);

    // Orizzontali (sinistra/destra dai bordi verticali del trim)
    if (L) {
        seg(cx - L.b, cy, cx - L.a, cy);
        seg(cx - L.b, cy + cardHpx, cx - L.a, cy + cardHpx);
    }
    if (R) {
        seg(cx + cardWpx + R.a, cy, cx + cardWpx + R.b, cy);
        seg(cx + cardWpx + R.a, cy + cardHpx, cx + cardWpx + R.b, cy + cardHpx);
    }
    // Verticali (alto/basso dai bordi orizzontali del trim)
    if (U) {
        seg(cx, cy - U.b, cx, cy - U.a);
        seg(cx + cardWpx, cy - U.b, cx + cardWpx, cy - U.a);
    }
    if (D) {
        seg(cx, cy + cardHpx + D.a, cx, cy + cardHpx + D.b);
        seg(cx + cardWpx, cy + cardHpx + D.a, cx + cardWpx, cy + cardHpx + D.b);
    }
}

// ── Singola pagina canvas ─────────────────────────────────────
export function PageCanvas({ pageImages, formatKey, bleedMm, bleedStyle, cardW, cardH, showCrop, cropStyle, customSheet, previewW, empty }) {
    const canvasRef = useRef();
    // Cache src(objectURL) -> HTMLImageElement decodificata: evita di ri-decodificare
    // le immagini a ogni ridisegno (cancellazione carta, resize, cambio pagina/formato).
    const cacheRef = useRef(new Map());
    const info = useMemo(() => getGridInfo(formatKey, bleedMm, cardW, cardH, customSheet), [formatKey, bleedMm, cardW, cardH, customSheet]);
    // Guardia foglio degenere/0 (campo svuotato → pageW/pageH 0): niente scale/height Infinity.
    const scale = info.pageW > 0 ? previewW / info.pageW : 1;
    const previewH = info.pageH > 0 ? Math.round(info.pageH * scale) : Math.round(previewW * (cardH / cardW));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let cancelled = false;
        // Pixel del canvas × densità dello schermo (telefoni 2-3×), max 2: carte nitide senza canvas enormi.
        // Si disegna sempre in px CSS (setTransform), il resto del codice non cambia.
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(previewW * dpr);
        canvas.height = Math.round(previewH * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingQuality = 'high';

        const cache = cacheRef.current;
        const load = (item) => {
            const src = item?.src;
            if (!src) return null;
            return cache.get(src) || loadImage(src); // hit in cache = nessun re-decode
        };

        const draw = async () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, previewW, previewH);

            const imgs = await Promise.all((pageImages || []).map(load));
            if (cancelled) return;

            // Ricostruisce la cache con le sole immagini della pagina corrente
            // (memoria limitata; le immagini cancellate vengono scartate e liberate).
            const next = new Map();
            (pageImages || []).forEach((item, i) => { if (item?.src && imgs[i]) next.set(item.src, imgs[i]); });
            cacheRef.current = next;

            const { cols, rows, cellW, cellH, offsetX, offsetY } = info;
            const bleedPx = bleedMm * scale;
            const cardWpx = cardW * scale;
            const cardHpx = cardH * scale;

            for (let i = 0; i < cols * rows; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = (offsetX + col * cellW) * scale;
                const y = (offsetY + row * cellH) * scale;
                const w = cellW * scale;
                const h = cellH * scale;

                if (!empty && imgs[i]) {
                    const mode = resolveBleedMode(pageImages[i]?.bleedMode, bleedStyle);
                    if (mode !== 'none') {
                        // Sfondo nero dietro la carta: gli angoli arrotondati
                        // trasparenti dei PNG non lasciano tacche bianche.
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(x, y, w, h);
                        drawCardWithBleed(ctx, imgs[i], x, y, w, h, bleedPx, mode);
                    } else {
                        // niente abbondanza: carta a misura di taglio (63×88), margine vuoto.
                        // Non riempie la cella → togliere l'abbondanza non ingrandisce la carta.
                        ctx.drawImage(imgs[i], x + bleedPx, y + bleedPx, cardWpx, cardHpx);
                    }
                } else {
                    ctx.fillStyle = empty ? '#f0f0f0' : '#d0d0d0';
                    ctx.fillRect(x + bleedPx, y + bleedPx, cardWpx, cardHpx);

                    if (bleedMm > 0) {
                        ctx.fillStyle = empty ? '#f8f8f8' : '#e4e4e4';
                        ctx.fillRect(x, y, w, h);
                        ctx.fillStyle = empty ? '#f0f0f0' : '#d0d0d0';
                        ctx.fillRect(x + bleedPx, y + bleedPx, cardWpx, cardHpx);
                    }
                }

                const limits = {
                    left:  (col === 0 ? offsetX * scale : 0) + bleedPx,
                    right: (col === cols - 1 ? offsetX * scale : 0) + bleedPx,
                    up:    (row === 0 ? offsetY * scale : 0) + bleedPx,
                    down:  (row === rows - 1 ? offsetY * scale : 0) + bleedPx,
                };
                if (showCrop) drawCropMarksCanvas(ctx, x, y, bleedPx, cardWpx, cardHpx, scale, limits, cropStyle);
            }

            ctx.strokeStyle = '#c8c8c8';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0.5, 0.5, previewW - 1, previewH - 1);
        };

        draw();
        return () => { cancelled = true; };
    }, [pageImages, formatKey, bleedMm, bleedStyle, cardW, cardH, showCrop, cropStyle, customSheet, previewW, empty, info, scale, previewH]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: previewW, height: previewH, display: 'block', flexShrink: 0 }}
        />
    );
}

// ── Componente principale ─────────────────────────────────────
export default function PagePreview({ images, formatKey, bleedMm, bleedStyle, dpi, cardW, cardH, showCrop, cropStyle, customSheet, onRemove, onChangeArt, onToggleBleed, onDuplicate, onMove, onUpscale, upscaling, isDragActive, missing, touch, onRemoveMany, onBleedMany }) {
    const [pageOffset, setPageOffset] = useState(0);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const stageRef = useRef(null);
    const footerRef = useRef(null); // bersaglio dello skip-link (salta la griglia carte da tastiera)

    const info = useMemo(() => getGridInfo(formatKey, bleedMm, cardW, cardH, customSheet), [formatKey, bleedMm, cardW, cardH, customSheet]);
    const perPage = Math.max(1, info.perPage);
    const totalPages = images.length === 0 ? 1 : Math.ceil(images.length / perPage);
    // Nessuna cella entra (foglio degenere): pager/contatore/scorciatoie non hanno senso
    // su un foglio vuoto, si mostra solo l'avviso "No cards fit this sheet".
    const fits = info.perPage > 0;

    // Reset pagina al cambio formato/bleed, setState durante il render (no effect).
    const [prevFmt, setPrevFmt] = useState(formatKey);
    const [prevBleed, setPrevBleed] = useState(bleedMm);
    if (prevFmt !== formatKey || prevBleed !== bleedMm) {
        setPrevFmt(formatKey);
        setPrevBleed(bleedMm);
        setPageOffset(0);
    }

    // Pagina corrente con clamp derivato (totalPages >= 1).
    const page = Math.min(pageOffset, totalPages - 1);

    // Misura lo stage (larghezza + altezza disponibili) per dimensionare la pagina.
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const r = entry.contentRect;
            setBox({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // La pagina riempie lo spazio mantenendo le proporzioni carta,
    // limitata sia in larghezza sia in altezza.
    const PAD = 16;
    // Desktop: pager ai lati del foglio («‹ n | N ›»). Spazio riservato sempre (anche a
    // pagina singola) così la 1a carta della pagina 2 non rimpicciolisce il foglio.
    const SIDE_NAV = touch ? 0 : 96;
    // Guardia foglio degenere/0: pageW/pageH possono essere 0 (campo svuotato → sheet 0),
    // che darebbe ratio=Infinity e scale=Infinity (height CSS invalida). Fallback sicuro.
    const ratio = info.pageW > 0 && info.pageH > 0 ? info.pageW / info.pageH : cardW / cardH;
    const availW = Math.max(0, box.w - PAD * 2 - SIDE_NAV * 2);
    const availH = Math.max(0, box.h - PAD * 2);
    const pageW = box.w > 0
        ? Math.max(160, Math.floor(Math.min(availW, availH * ratio)))
        : 360; // fallback prima che il ResizeObserver risponda
    const scale = info.pageW > 0 ? pageW / info.pageW : 1;

    // Immagini della pagina corrente (riferimento stabile finché non cambiano).
    const pageImages = useMemo(
        () => Array.from({ length: perPage }, (_, i) => {
            const it = images[page * perPage + i];
            return it ? { src: it.preview, bleedMode: it.bleedMode } : null;
        }),
        [images, perPage, page]
    );

    const canPrev = page > 0;
    const canNext = page < totalPages - 1;

    // Selezione (desktop e mobile): click/tap = aggiungi/togli, poi azioni dal menu o dalla
    // barra in blocco. `touch` = layout mobile: tap + pressione lunga, niente drag.
    const [selected, setSelected] = useState(() => new Set());
    // Tieni solo gli id ancora esistenti (carte cancellate / pagina cambiata).
    const selectedIds = useMemo(
        () => images.filter(i => selected.has(i.id)).map(i => i.id),
        [images, selected],
    );
    // Selezione che si estende oltre la pagina corrente (per l'etichetta "spans pages",
    // così Ctrl+A → Delete non cancella carte invisibili senza preavviso).
    const selectedSpansPages = useMemo(() => {
        const start = page * perPage;
        const pageIds = new Set(images.slice(start, start + perPage).map(i => i.id));
        return selectedIds.some(id => !pageIds.has(id));
    }, [images, selectedIds, page, perPage]);
    const clearSel = () => setSelected(new Set());
    const hasSel = selectedIds.length > 0;
    const toggleSel = (id) => setSelected(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });
    const anchorRef = useRef(null); // ultima carta selezionata = ancora per lo shift-range
    const handleCardClick = (e, id) => {
        // Il click che segue una pressione lunga (menu già aperto) non deve anche selezionare.
        if (suppressClickRef.current) { suppressClickRef.current = false; return; }
        // Shift-click = range contiguo sulla pagina corrente fra ancora e target (come Finder/Linear),
        // così la copia "Shift-click to select multiple" è vera (non un alias di ctrl).
        if (e.shiftKey && anchorRef.current && anchorRef.current !== id) {
            const start = page * perPage;
            const pageItems = images.slice(start, start + perPage);
            const a = pageItems.findIndex(it => it.id === anchorRef.current);
            const b = pageItems.findIndex(it => it.id === id);
            if (a !== -1 && b !== -1) {
                const [lo, hi] = a < b ? [a, b] : [b, a];
                const range = pageItems.slice(lo, hi + 1).map(it => it.id);
                setSelected(prev => { const n = new Set(prev); range.forEach(x => n.add(x)); return n; });
                anchorRef.current = id;
                return;
            }
        }
        // Click (con o senza Ctrl/⌘) = aggiungi/togli: seleziona, deseleziona e multi-selezione.
        e.preventDefault();
        toggleSel(id);
        anchorRef.current = id;
    };

    // Selezione ad area (solo desktop, mouse): premi sul vuoto e trascina → rettangolo; le carte
    // che tocca si aggiungono alla selezione (come il click, non deseleziona il resto).
    // Sulle carte il trascinamento resta lo scambio. Solo la pagina visibile.
    const [marquee, setMarquee] = useState(null); // { left, top, width, height } relativi allo stage
    const marqueeRef = useRef(null); // { x0, y0, base: Set, active }
    const swallowClickRef = useRef(false); // il click che chiude un'area non deve deselezionare
    const marqueeHandlers = touch ? {} : {
        onPointerDown: (e) => {
            swallowClickRef.current = false; // nuovo gesto
            if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.preview-card-hotspot, .preview-nav')) return;
            e.preventDefault(); // niente selezione di testo mentre si trascina
            marqueeRef.current = { x0: e.clientX, y0: e.clientY, base: new Set(selected), active: false };
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e) => {
            const m = marqueeRef.current;
            if (!m || (!m.active && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 4)) return;
            m.active = true;
            const s = stageRef.current.getBoundingClientRect();
            const cx = Math.min(Math.max(e.clientX, s.left), s.right);
            const cy = Math.min(Math.max(e.clientY, s.top), s.bottom);
            const [x1, x2] = m.x0 < cx ? [m.x0, cx] : [cx, m.x0];
            const [y1, y2] = m.y0 < cy ? [m.y0, cy] : [cy, m.y0];
            const n = new Set(m.base);
            wrapRef.current?.querySelectorAll('.preview-card-hotspot').forEach((h) => {
                const r = h.getBoundingClientRect();
                if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) n.add(h.dataset.cardId);
            });
            setSelected(n);
            setMarquee({ left: x1 - s.left, top: y1 - s.top, width: x2 - x1, height: y2 - y1 });
        },
        onPointerUp: () => {
            if (marqueeRef.current?.active) swallowClickRef.current = true;
            marqueeRef.current = null;
            setMarquee(null);
        },
        onPointerCancel: () => { marqueeRef.current = null; setMarquee(null); },
    };

    // Riordino (solo desktop, `!touch`): trascina una carta su un'altra → le due si scambiano di posto,
    // le altre restano ferme. Alt+frecce = scambio col vicino, alternativa da tastiera.
    // ponytail: solo dentro la pagina visibile; tra pagine si passa da Alt+frecce.
    const [drag, setDrag] = useState(null); // { id, over: indice globale bersaglio | null }
    const wrapRef = useRef(null);
    const refocusRef = useRef(null);
    const dndOn = !touch && !!onMove;
    const startDrag = (e, id) => {
        const dt = e.dataTransfer;
        dt.effectAllowed = 'move';
        dt.setData('application/x-proxodon-card', id);
        // Ghost = ritaglio della carta dal canvas pagina: l'hotspot è trasparente, quello nativo sarebbe vuoto.
        const hs = e.currentTarget;
        const sheet = wrapRef.current?.querySelector('canvas');
        if (sheet) {
            const g = document.createElement('canvas');
            g.width = hs.offsetWidth;
            g.height = hs.offsetHeight;
            g.getContext('2d').drawImage(sheet, hs.offsetLeft, hs.offsetTop, g.width, g.height, 0, 0, g.width, g.height);
            g.style.cssText = 'position:fixed;top:-10000px;left:0';
            document.body.appendChild(g);
            const r = hs.getBoundingClientRect();
            dt.setDragImage(g, e.clientX - r.left, e.clientY - r.top);
            setTimeout(() => g.remove(), 0);
        }
        setDrag({ id, over: null });
    };
    const moveTo = (id, to) => {
        if (to < 0 || to >= images.length) return;
        onMove(id, to);
        setPageOffset(Math.floor(to / perPage)); // segui la carta se cambia pagina
        refocusRef.current = id;
    };
    // Dopo uno spostamento da tastiera il nodo può essere rimontato/spostato: rimetti il focus.
    useEffect(() => {
        const id = refocusRef.current;
        if (!id) return;
        refocusRef.current = null;
        wrapRef.current?.querySelector(`[data-card-id="${CSS.escape(id)}"] .card-surface`)?.focus();
    }, [images, page]);

    // Menu contestuale: { ids, x, y }. Click destro (o pressione lunga su touch) su una carta
    // fuori dalla selezione = seleziona solo quella (come un file manager); dentro una
    // multi-selezione = agisce su tutte.
    const [menu, setMenu] = useState(null);
    const closeMenu = useCallback(() => setMenu(null), []);
    const showMenu = (id, x, y) => {
        const inSel = selected.has(id);
        if (!inSel) { setSelected(new Set([id])); anchorRef.current = id; }
        setMenu({ ids: inSel && selectedIds.length > 1 ? selectedIds : [id], x, y });
    };
    const openMenu = (e, id) => {
        e.preventDefault();
        let { clientX: x, clientY: y } = e;
        // Da tastiera (Shift+F10 / tasto menu) può arrivare 0,0: ancora il menu alla carta.
        if (!x && !y) { const r = e.currentTarget.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
        showMenu(id, x, y);
    };
    // Pressione lunga (touch/penna) = click destro. Annullata se il dito si sposta (scroll)
    // o si alza prima. Android genera anche `contextmenu`: stesso effetto, idempotente.
    const pressRef = useRef(null); // { timer, x, y }
    const suppressClickRef = useRef(false);
    const cancelPress = () => { clearTimeout(pressRef.current?.timer); pressRef.current = null; };
    const pressHandlers = (id) => ({
        onPointerDown: (e) => {
            suppressClickRef.current = false; // nuovo gesto
            if (e.pointerType === 'mouse') return;
            const { clientX: x, clientY: y } = e;
            cancelPress();
            pressRef.current = {
                x, y,
                timer: setTimeout(() => {
                    pressRef.current = null;
                    suppressClickRef.current = true;
                    navigator.vibrate?.(10); // feedback aptico dove esiste (Android)
                    showMenu(id, x, y);
                }, 500),
            };
        },
        onPointerMove: (e) => {
            const p = pressRef.current;
            if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
        },
        onPointerUp: cancelPress,
        onPointerCancel: cancelPress,
    });
    // Carte del menu ancora esistenti (una può sparire con undo/delete mentre è aperto).
    const menuCards = menu ? images.filter(i => menu.ids.includes(i.id)) : [];
    let menuSpec = null;
    if (menuCards.length === 1) {
        const it = menuCards[0];
        // Abbondanza EFFETTIVA (lo stile globale può sovrascrivere il modo per-carta).
        const bleed = resolveBleedMode(it.bleedMode, bleedStyle);
        menuSpec = {
            title: cardName(it, images.indexOf(it)),
            items: [
                { key: 'art', Icon: IconImage, label: 'Change art', run: () => onChangeArt(it.id) },
                // Upscale AI 2× solo se serve (sotto i px del DPI scelto) e non durante un altro upscale.
                {
                    key: 'up', Icon: IconSparkles, label: 'Upscale 2× (AI)', run: () => onUpscale(it.id),
                    disabled: upscaling || !canUpscale(it, dpi, cardW),
                    note: upscaling ? 'running' : it.colorKind === 'cmyk' ? 'CMYK file' : `sharp at ${dpi} DPI`,
                },
                { key: 'dup', Icon: IconCopy, label: 'Duplicate', run: () => onDuplicate(it.id) },
                // Resta aperto: ogni click cicla il modo e l'etichetta mostra l'esito.
                { key: 'bleed', Icon: IconFrame, label: `Bleed: ${bleedLabel(bleed)}`, run: () => onToggleBleed(it.id), keepOpen: true },
                { key: 'rm', Icon: IconTrash, label: 'Remove', run: () => onRemove(it.id), danger: true },
            ],
        };
    } else if (menuCards.length > 1) {
        const ids = menuCards.map(i => i.id);
        // Cambio art multiplo solo se sono tutte la stessa carta (stesso nome di ricerca stampe).
        const sameCard = new Set(menuCards.map(artName)).size === 1;
        // Stessa regola di onBleedMany: qualcuna senza abbondanza → accendi, altrimenti spegni.
        const anyOff = menuCards.some(i => i.bleedMode === 'none');
        const upCount = menuCards.filter(i => canUpscale(i, dpi, cardW)).length;
        menuSpec = {
            title: `${ids.length} cards selected`,
            items: [
                { key: 'art', Icon: IconImage, label: 'Change art', run: () => onChangeArt(ids), disabled: !sameCard, note: 'different cards' },
                {
                    key: 'up', Icon: IconSparkles,
                    label: `Upscale 2× (AI)${upCount && upCount < ids.length ? `, ${upCount} of ${ids.length}` : ''}`,
                    run: () => onUpscale(ids),
                    disabled: upscaling || !upCount,
                    note: upscaling ? 'running' : `all sharp at ${dpi} DPI`,
                },
                { key: 'dup', Icon: IconCopy, label: 'Duplicate all', run: () => onDuplicate(ids) },
                { key: 'bleed', Icon: IconFrame, label: anyOff ? 'Bleed on for all' : 'Bleed off for all', run: () => onBleedMany(ids), keepOpen: true },
                { key: 'rm', Icon: IconTrash, label: 'Remove all', run: () => { onRemoveMany(ids); clearSel(); }, danger: true },
            ],
        };
    }

    // Scorciatoie: Del = elimina selezione, Esc = deseleziona, Ctrl/Cmd+A = seleziona tutto.
    useEffect(() => {
        if (!fits) return;
        const onKey = (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
            if (e.key === 'Escape' && selected.size) {
                clearSel();
            } else if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
                e.preventDefault(); setSelected(new Set(images.map(i => i.id)));
            } else if (e.key === 'Delete' && selected.size
                && (e.target?.closest?.('.preview-card-hotspot') || (tag !== 'BUTTON' && tag !== 'A'))) {
                // Solo Delete (non Backspace = riflesso "indietro"). Consentito sulla griglia carte
                // (dove sta il focus dopo aver selezionato) ma NON su nav/bulk/sidebar, così
                // tabulando tra i controlli non si cancella la selezione per sbaglio.
                e.preventDefault(); onRemoveMany?.(selectedIds); clearSel();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fits, selected, selectedIds, images, onRemoveMany]);

    return (
        <div className={`preview-root${isDragActive ? ' drag-active' : ''}`}>
            {/* Skip-link tastiera: la griglia desktop ha uno stop-tab per carta; questo salta al footer. */}
            {images.length > 0 && (
                <button
                    type="button"
                    className="skip-cards-link"
                    onClick={() => footerRef.current?.focus()}
                >Skip cards</button>
            )}
            <CardFrameDefs />
            {/* Click fuori dalle carte (foglio vuoto/sfondo) = deseleziona; trascinamento = selezione ad area. */}
            <div className="preview-stage" ref={stageRef} {...marqueeHandlers}
                onClick={(e) => {
                    if (swallowClickRef.current) { swallowClickRef.current = false; return; }
                    if (!e.target.closest('.preview-card-hotspot, .preview-nav')) clearSel();
                }}>
                {marquee && <div className="marquee" style={marquee} aria-hidden="true" />}
                <div className="preview-page-wrap" ref={wrapRef} style={{ width: pageW }}>
                    {/* Pager desktop ai lati del foglio: « ‹N | N› ». Il numero accanto alla freccia è
                        la pagina a cui porta (a pagina 2: 1 a sinistra, 3 a destra) e fa parte del
                        bottone. La selezione può coprire più pagine, quindi cambiare pagina non la azzera. */}
                    {!touch && fits && totalPages > 1 && <>
                        <nav className="preview-nav nav-side nav-prev" aria-label={`Page ${page + 1} of ${totalPages}`}>
                            <button className="nav-btn" disabled={!canPrev} onClick={() => setPageOffset(0)} aria-label="First page" title="First page">
                                <IconChevron double size={22} />
                            </button>
                            <button className="nav-btn" disabled={!canPrev} onClick={() => setPageOffset(page - 1)}
                                aria-label={canPrev ? `Previous page, ${page}` : 'Previous page'} title="Previous page">
                                <IconChevron size={22} />
                                <span className="nav-info">{canPrev ? page : ''}</span>
                            </button>
                        </nav>
                        <nav className="preview-nav nav-side nav-next" aria-label="More pages">
                            <button className="nav-btn" disabled={!canNext} onClick={() => setPageOffset(page + 1)}
                                aria-label={canNext ? `Next page, ${page + 2}` : 'Next page'} title="Next page">
                                <span className="nav-info">{canNext ? page + 2 : ''}</span>
                                <IconChevron size={22} />
                            </button>
                            <button className="nav-btn" disabled={!canNext} onClick={() => setPageOffset(totalPages - 1)} aria-label="Last page" title="Last page">
                                <IconChevron double size={22} />
                            </button>
                        </nav>
                    </>}
                    <PageCanvas
                        pageImages={pageImages}
                        formatKey={formatKey}
                        bleedMm={bleedMm}
                        bleedStyle={bleedStyle}
                        cardW={cardW}
                        cardH={cardH}
                        showCrop={showCrop}
                        cropStyle={cropStyle}
                        customSheet={customSheet}
                        previewW={pageW}
                        empty={images.length === 0}
                    />
                    {/* Foglio degenere: nessuna cella entra (foglio troppo piccolo o carta più
                        grande del foglio) → le carte sparirebbero su una pagina bianca senza spiegazione. */}
                    {images.length > 0 && info.perPage === 0 && (
                        <div className="preview-empty-cta preview-warn-cta" role="alert">
                            <p className="empty-cta-title">No cards fit this sheet</p>
                            <p className="empty-cta-sub">The sheet is too small for the card size. Increase the sheet, or reduce the card size or bleed.</p>
                        </div>
                    )}
                    {images.length > 0 && (
                        <p className="sr-only" aria-live="polite">
                            Print sheet preview: {images.length} card{images.length !== 1 ? 's' : ''} placed, page {page + 1} of {totalPages}.
                        </p>
                    )}
                    {/* Annuncio SR del conteggio selezione (la bulk-bar è solo visiva, role=toolbar). */}
                    <p className="sr-only" aria-live="polite">
                        {selectedIds.length > 0
                            ? `${selectedIds.length} card${selectedIds.length !== 1 ? 's' : ''} selected${selectedSpansPages ? ', spanning multiple pages' : ''}.`
                            : ''}
                    </p>
                    {images.length > 0 && (
                        <div className="preview-card-layer">
                            {Array.from({ length: info.perPage }, (_, i) => {
                                const img = images[page * perPage + i];
                                if (!img) return null;
                                const col = i % info.cols;
                                const row = Math.floor(i / info.cols);
                                const left = (info.offsetX + col * info.cellW + bleedMm) * scale;
                                const top = (info.offsetY + row * info.cellH + bleedMm) * scale;
                                const gi = page * perPage + i; // indice globale (= ordine di stampa)
                                const name = cardName(img, gi);
                                // Bassa risoluzione: la sorgente non copre metà dei px richiesti al DPI
                                // scelto → stampa sgranata. ponytail: soglia 0.5× fissa; le PNG Scryfall
                                // (~300 DPI a misura carta) non avvisano fino a >600 DPI.
                                const lowRes = img.w && img.w < dpi * 0.5 * (cardW / 25.4);
                                const isSel = selected.has(img.id);
                                const dnd = dndOn ? {
                                    draggable: true,
                                    onDragStart: (e) => startDrag(e, img.id),
                                    onDragOver: (e) => {
                                        if (!drag) return; // drag esterno (file): lo gestisce la dropzone
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (drag.over !== gi) setDrag({ ...drag, over: gi });
                                    },
                                    onDragLeave: (e) => {
                                        if (drag?.over === gi && !e.currentTarget.contains(e.relatedTarget)) setDrag({ ...drag, over: null });
                                    },
                                    onDrop: (e) => {
                                        if (!drag) return;
                                        e.preventDefault();
                                        if (drag.id !== img.id) onMove(drag.id, gi);
                                        setDrag(null);
                                    },
                                    onDragEnd: () => setDrag(null),
                                } : {};
                                const dragCls = drag?.id === img.id ? ' dragging' : drag?.over === gi ? ' drop-target' : '';
                                return (
                                    <div
                                        key={img.id}
                                        data-card-id={img.id}
                                        className={`preview-card-hotspot${isSel ? ' selected' : ''}${dragCls}`}
                                        style={{ left, top, width: cardW * scale, height: cardH * scale }}
                                        {...dnd}
                                    >
                                        {/* Superficie carta = button a tutta area → selezione raggiungibile da tastiera. */}
                                        <button
                                            type="button"
                                            className="card-surface"
                                            onClick={(e) => handleCardClick(e, img.id)}
                                            onContextMenu={(e) => openMenu(e, img.id)}
                                            {...pressHandlers(img.id)}
                                            onKeyDown={(e) => {
                                                // Space = seleziona/deseleziona (equivalente da tastiera del
                                                // click); Enter = click nativo, stesso effetto.
                                                if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggleSel(img.id); }
                                                // Menu da tastiera (non tutti i browser generano contextmenu da Shift+F10).
                                                if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) openMenu(e, img.id);
                                                // Alt+frecce = scambia col vicino (su/giù = la carta della riga accanto).
                                                const d = e.altKey && dndOn && { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -info.cols, ArrowDown: info.cols }[e.key];
                                                if (d) { e.preventDefault(); moveTo(img.id, gi + d); }
                                            }}
                                            title={touch ? undefined : 'Click: select or deselect. Right-click: options. Drag: swap'}
                                            aria-label={`${name}. Enter or Space to select or deselect, Shift+F10 for options, Alt+arrow keys to move.`}
                                            aria-haspopup="menu"
                                            aria-pressed={isSel}
                                        />
                                        <CardFrame />
                                        {lowRes && <>
                                            {/* Chip HUD "!": all'hover (o focus della carta) si allarga quanto la carta
                                                e spiega il problema. Solo preview, non va in stampa. Click/destro/pressione
                                                lunga passano alla carta come se si cliccasse lei. */}
                                            <span className="lowres-badge" aria-hidden="true"
                                                onClick={(e) => handleCardClick(e, img.id)}
                                                onContextMenu={(e) => openMenu(e, img.id)}
                                                {...pressHandlers(img.id)}>
                                                <span className="lowres-glyph">!</span>
                                                <span className="lowres-label">Low res</span>
                                                <span className="lowres-body"><span>
                                                    ~{Math.round(img.w / (cardW / 25.4))} DPI here, {dpi} set. May print soft.
                                                </span></span>
                                            </span>
                                            <span className="sr-only">Low resolution for {dpi} DPI. May print soft.</span>
                                        </>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {menuSpec && <CardMenu x={menu.x} y={menu.y} {...menuSpec} onClose={closeMenu} />}

            <div className="preview-footer" ref={footerRef} tabIndex={-1}>
                {touch && fits && totalPages > 1 && (
                    <nav className="preview-nav nav-foot" aria-label={`Page ${page + 1} of ${totalPages}`}>
                        <button className="nav-btn nav-prev-btn" disabled={!canPrev} onClick={() => setPageOffset(page - 1)}
                            aria-label={canPrev ? `Previous page, ${page}` : 'Previous page'}>
                            <IconChevron size={20} />
                            <span className="nav-info">{canPrev ? page : ''}</span>
                        </button>
                        <button className="nav-btn nav-next-btn" disabled={!canNext} onClick={() => setPageOffset(page + 1)}
                            aria-label={canNext ? `Next page, ${page + 2}` : 'Next page'}>
                            <span className="nav-info">{canNext ? page + 2 : ''}</span>
                            <IconChevron size={20} />
                        </button>
                    </nav>
                )}
                {/* Barra selezione e contatore nella STESSA cella (grid sovrapposta, l'inattivo è
                    visibility:hidden): il footer ha sempre la stessa altezza, quindi selezionare
                    una carta non sposta il foglio. Il pager sta sopra, sempre raggiungibile. */}
                {fits && images.length > 0 && (
                    <div className="preview-status">
                        <div className={`bulk-bar${hasSel ? '' : ' is-off'}`} role="toolbar" aria-label="Selected cards">
                            <span className="bulk-count">{selectedIds.length} selected{selectedSpansPages ? ' · spans pages' : ''}</span>
                            <button type="button" className="bulk-btn" onClick={() => onBleedMany?.(selectedIds)}>
                                <IconFrame size={13} /> Bleed
                            </button>
                            <button type="button" className="bulk-btn bulk-del" onClick={() => { onRemoveMany?.(selectedIds); clearSel(); }}>
                                <IconX size={13} /> Delete
                            </button>
                            <button type="button" className="bulk-btn bulk-clear" onClick={clearSel}>Clear</button>
                        </div>
                        <div className={`preview-info${hasSel ? ' is-off' : ''}`}>
                            <span className="preview-count">
                                {images.length} card{images.length !== 1 ? 's' : ''}{missing > 0 ? ` · add ${missing} to fill this page` : ''}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
