import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import './index.css';
import { useDropzone } from 'react-dropzone';
import PageSettings from './components/PageSettings';
import PagePreview from './components/PagePreview';
import ScryfallImportModal from './components/ScryfallImportModal';
import MpcImportModal from './components/MpcImportModal';
import ArtPickerModal from './components/ArtPickerModal';
import { upscaleFile, canUpscale } from './utils/upscale';
import CookieBanner from './components/CookieBanner';
import ConfirmDialog from './components/ConfirmDialog';
import ExportProgress from './components/ExportProgress';
import Toast from './components/Toast';
import MobileLayout from './components/MobileLayout';
import { useIsMobile } from './hooks/useIsMobile';
import { generatePDF, getGridInfo, PAPER_FORMATS, nextBleedMode } from './utils/pdfGenerator';
import { DEFAULT_PROFILE_ID, UPLOAD_ID, getProfileMeta, loadBundledProfileBytes } from './utils/iccProfiles';
import { buildDeckList, fetchScryfallImages } from './utils/scryfall';
import { IconFile, IconAlert, IconTrash, IconDownload, IconList, IconImage, IconPlus, IconX, Wordmark } from './components/icons';
import NavTabs from './components/NavTabs';
import ErrorBoundary from './components/ErrorBoundary';
import { useHashRoute, navigate } from './hooks/useHashRoute';

// Area mazzi caricata solo quando serve (porta con sé Firebase): la stampa resta leggera.
const DecksView = lazy(() => import('./decks/DecksView'));

// Lettura numerica da localStorage con default (null/NaN → default, 0 valido).
const readNum = (k, d) => {
  const s = localStorage.getItem(k);
  const v = Number(s);
  return s !== null && Number.isFinite(v) ? v : d;
};

export default function App() {
  const [images, setImages] = useState([]);
  const [formatKey, setFormatKey] = useState(() => {
    const s = localStorage.getItem('ip:format');
    return s && (PAPER_FORMATS[s] || s === 'custom') ? s : 'A3';
  });
  const [bleedMm, setBleedMm] = useState(() => readNum('ip:bleed', 2));
  const [bleedStyle, setBleedStyle] = useState(() => localStorage.getItem('ip:bleedStyle') || 'auto'); // auto | mirror | stretch | black
  const [dpi, setDpi] = useState(() => readNum('ip:dpi', 600));
  // Qualità JPEG dell'export RGB (0.5–1.0). Più bassa = più compressione, file più piccolo.
  // Non si applica al CMYK (FlateDecode lossless).
  const [quality, setQuality] = useState(() => { const q = readNum('ip:quality', 0.85); return q >= 0.3 && q <= 1 ? q : 0.85; });
  const [cardType, setCardType] = useState(() => localStorage.getItem('ip:cardType') || 'mtg');
  const [cardW, setCardW] = useState(() => readNum('ip:cardW', 63) || 63);
  const [cardH, setCardH] = useState(() => readNum('ip:cardH', 88) || 88);
  const [cropMarks, setCropMarks] = useState(() => localStorage.getItem('ip:cropMarks') !== '0'); // default on
  const [cropStyle, setCropStyle] = useState(() => localStorage.getItem('ip:cropStyle') || 'lines'); // lines | corners
  const [sheetUnit, setSheetUnit] = useState(() => (localStorage.getItem('ip:sheetUnit') === 'in' ? 'in' : 'mm'));
  const [sheetW, setSheetW] = useState(() => readNum('ip:sheetW', 210) || 210);
  const [sheetH, setSheetH] = useState(() => readNum('ip:sheetH', 297) || 297);
  // Output: 'rgb' (jsPDF, schermo) | 'cmyk' (PDF/X-1a, stampa). Il profilo ICC NON
  // è persistito (binario; si ri-carica a sessione, come le immagini).
  const [colorMode, setColorMode] = useState(() => (localStorage.getItem('ip:colorMode') === 'cmyk' ? 'cmyk' : 'rgb'));
  const [renderIntent, setRenderIntent] = useState(() => (localStorage.getItem('ip:renderIntent') === 'perceptual' ? 'perceptual' : 'relative'));
  // Profilo CMYK: id incluso ('fogra39'…) o 'upload'. Persistito (solo l'id).
  const [iccProfileId, setIccProfileId] = useState(() => {
    const v = localStorage.getItem('ip:iccProfileId');
    return v === UPLOAD_ID || getProfileMeta(v) ? v : DEFAULT_PROFILE_ID;
  });
  const [uploadedIcc, setUploadedIcc] = useState(null); // { bytes, name } profilo caricato (non persistito)
  const [confirm, setConfirm] = useState(null); // dialog conferma azioni distruttive: { message, confirmLabel, onConfirm }
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState(null); // { done, total } durante l'export PDF
  const genAbortRef = useRef(null); // AbortController dell'export in corso (per Annulla)
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // feedback transitorio { kind:'success'|'error', msg }
  const [upscaling, setUpscaling] = useState(false); // upscale AI in corso (uno alla volta)
  const [importOpen, setImportOpen] = useState(false);
  const [mpcOpen, setMpcOpen] = useState(false); // import da file XML MPCFill
  const [addMenuOpen, setAddMenuOpen] = useState(false); // menu "+" in sidebar (carica file / Scryfall)
  const [helpOpen, setHelpOpen] = useState(false); // tooltip "?" header (apri al click, non hover)
  const [editingIds, setEditingIds] = useState(null); // carte (stessa carta) di cui cambiare l'art
  // Foglio personalizzato in mm (sheetW/H sono nell'unità scelta: mm o inch).
  const customSheet = formatKey === 'custom'
    ? (sheetUnit === 'in' ? [sheetW * 25.4, sheetH * 25.4] : [sheetW, sheetH])
    : null;
  const { perPage } = getGridInfo(formatKey, bleedMm, cardW, cardH, customSheet);
  const editing = editingIds ? images.find(i => i.id === editingIds[0]) : null;

  // Persiste i settaggi (non le immagini: sono blob, si re-importano in 1 click).
  useEffect(() => {
    localStorage.setItem('ip:format', formatKey);
    localStorage.setItem('ip:bleed', String(bleedMm));
    localStorage.setItem('ip:bleedStyle', bleedStyle);
    localStorage.setItem('ip:dpi', String(dpi));
    localStorage.setItem('ip:quality', String(quality));
    localStorage.setItem('ip:cardType', cardType);
    localStorage.setItem('ip:cardW', String(cardW));
    localStorage.setItem('ip:cardH', String(cardH));
    localStorage.setItem('ip:cropMarks', cropMarks ? '1' : '0');
    localStorage.setItem('ip:cropStyle', cropStyle);
    localStorage.setItem('ip:sheetUnit', sheetUnit);
    localStorage.setItem('ip:sheetW', String(sheetW));
    localStorage.setItem('ip:sheetH', String(sheetH));
    localStorage.setItem('ip:colorMode', colorMode);
    localStorage.setItem('ip:renderIntent', renderIntent);
    localStorage.setItem('ip:iccProfileId', iccProfileId);
  }, [formatKey, bleedMm, bleedStyle, dpi, quality, cardType, cardW, cardH, cropMarks, cropStyle, sheetUnit, sheetW, sheetH, colorMode, renderIntent, iccProfileId]);

  // Revoca gli object URL residui allo smontaggio (evita leak di memoria).
  // imagesRef tiene il riferimento aggiornato senza ri-registrare l'effect.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  // URL di carte rimosse con revoke DIFFERITO (finestra Undo): se l'utente chiude/
  // ricarica entro i 5.3s, il timer non scatta → vanno revocati anche questi allo unmount.
  const pendingRevokesRef = useRef(new Set());
  useEffect(() => () => {
    imagesRef.current.forEach(i => URL.revokeObjectURL(i.preview));
    pendingRevokesRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  // Chiude il menu "+" della sidebar al click fuori o con Esc (stesso contratto degli overlay)
  const addMenuRef = useRef(null);
  useEffect(() => {
    if (!addMenuOpen) return;
    const onDoc = (e) => { if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setAddMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setAddMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [addMenuOpen]);

  // Auto-chiusura del toast (tap per chiudere prima). I toast con azione (es. Undo)
  // restano più a lungo, allineati alla finestra di annullamento (revoke a 5.3s).
  useEffect(() => {
    if (!toast || toast.kind === 'progress') return; // l'avanzamento resta finché non finisce
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Le immagini NON sono persistite (blob revocati allo unmount): avvisa prima di
  // ricaricare/chiudere se c'è un lavoro in corso, così non si perde un'impaginazione.
  useEffect(() => {
    if (images.length === 0) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [images.length]);

  // Chiude il tooltip "?" al click fuori o con Esc
  const helpRef = useRef(null);
  useEffect(() => {
    if (!helpOpen) return;
    const onDoc = (e) => { if (helpRef.current && !helpRef.current.contains(e.target)) setHelpOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setHelpOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [helpOpen]);

  // Crea gli item immagine. entries: [{file, bleedMode}].
  const addItems = (entries) => {
    const newItems = entries.map(({ file, bleedMode, name, set, collector, primary }) => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      bleedMode: bleedMode || 'none', // 'stretch'/'mirror' per Scryfall, 'none' per upload
      name, set, collector, primary,  // metadati Scryfall per il salvataggio (undefined sugli upload manuali)
    }));
    setImages(prev => [...prev, ...newItems]);
    setError(null);
    // Decodifica la larghezza nativa (per l'avviso bassa risoluzione vs DPI scelto)
    newItems.forEach((it) => {
      const probe = new Image();
      probe.onload = () => setImages(prev => prev.map(p => (p.id === it.id ? { ...p, w: probe.naturalWidth } : p)));
      probe.src = it.preview;
    });
    // §2: per i JPEG CMYK nativi, leggi il profilo incorporato (APP2) una volta sola
    // qui in add, per l'avviso "profilo diverso dalla destinazione" nell'export CMYK.
    newItems.forEach((it) => {
      (async () => {
        try {
          const raw = new Uint8Array(await it.file.arrayBuffer());
          const { isCmykJpeg, extractIccFromJpeg } = await import('./utils/cmykRaster');
          if (!isCmykJpeg(raw)) return;
          let embeddedIccName = null;
          const icc = extractIccFromJpeg(raw);
          if (icc) {
            const { readProfileInfo } = await import('./utils/cmykEngine');
            embeddedIccName = (await readProfileInfo(icc)).name || null;
          }
          setImages(prev => prev.map(p => (p.id === it.id ? { ...p, colorKind: 'cmyk', embeddedIccName } : p)));
        } catch { /* non bloccante */ }
      })();
    });
  };

  // Upload manuali (drag&drop / file picker): nessuna abbondanza generata.
  // Upload manuali: nessuna abbondanza generata (carta a misura di taglio).
  // Per le carte già al vivo: Bleed style → "Bleed in art", o il toggle per-carta.
  const handleImagesAdded = (files) => addItems(files.map(file => ({ file, bleedMode: 'none' })));

  // Rimozione con UNDO: niente revoke immediato. Cattura gli item + indici (puro,
  // da `images` corrente), mostra un toast con azione Undo, e revoca gli object URL
  // solo se l'utente NON annulla (oltre la vita del toast).
  const removeWithUndo = (ids) => {
    const set = new Set(ids);
    const removed = images.map((it, idx) => ({ it, idx })).filter(x => set.has(x.it.id));
    if (removed.length === 0) return;
    setImages(prev => prev.filter(i => !set.has(i.id)));
    let undone = false;
    removed.forEach(({ it }) => pendingRevokesRef.current.add(it.preview)); // in attesa di revoke
    const undo = () => {
      undone = true;
      removed.forEach(({ it }) => pendingRevokesRef.current.delete(it.preview));
      setImages(prev => {
        const next = [...prev];
        removed.slice().sort((a, b) => a.idx - b.idx)
          .forEach(({ it, idx }) => next.splice(Math.min(idx, next.length), 0, it));
        return next;
      });
      setToast(null);
    };
    setToast({
      kind: 'success',
      msg: `Removed ${removed.length} card${removed.length > 1 ? 's' : ''}`,
      action: { label: 'Undo', onClick: undo },
    });
    setTimeout(() => {
      if (!undone) removed.forEach(({ it }) => { URL.revokeObjectURL(it.preview); pendingRevokesRef.current.delete(it.preview); });
    }, 5300);
  };

  const handleRemove = (id) => removeWithUndo([id]);

  // Elimina tutte: passa SEMPRE dalla conferma (desktop + mobile export + mobile cards).
  const handleClearAll = () => {
    if (images.length === 0) return;
    setConfirm({
      message: 'Delete all cards? This can’t be undone.',
      confirmLabel: 'Delete all',
      onConfirm: () => setImages(prev => { prev.forEach(i => URL.revokeObjectURL(i.preview)); return []; }),
    });
  };

  // Abbondanza on/off per carta: none ↔ stretch. Lo stile globale può poi forzare
  // mirror/black sulle carte che hanno abbondanza. Utile sugli upload manuali.
  // Cambia il modo abbondanza per-carta dopo l'upload, ciclando i 3 stati:
  // none → stretch (genera) → full (già nell'art) → none. Permette di marcare/
  // smarcare una carta come "già con abbondanza" anche se caricata diversamente.
  const handleToggleBleed = (id) => setImages(prev => prev.map(it =>
    it.id === id ? { ...it, bleedMode: nextBleedMode(it.bleedMode) } : it,
  ));

  // Azioni in blocco sulla selezione (preview desktop). Delete passa dall'undo.
  const handleRemoveMany = (ids) => removeWithUndo(ids);
  // Bleed in blocco: esito UNIFORME e prevedibile (no cicli per-carta). Se qualche
  // carta selezionata è senza abbondanza → accendile tutte (stretch); altrimenti
  // spegnile tutte. Un solo setImages + feedback toast.
  const handleBleedMany = (ids) => {
    const set = new Set(ids);
    const anyOff = images.some(it => set.has(it.id) && it.bleedMode === 'none');
    // "on" = accendi SOLO le carte senza abbondanza (none→stretch) e PRESERVA mirror/full
    // (es. full-art Scryfall = mirror): niente downgrade silenzioso. "off" = tutte a none.
    setImages(prev => prev.map(it => {
      if (!set.has(it.id)) return it;
      if (!anyOff) return { ...it, bleedMode: 'none' };
      return it.bleedMode === 'none' ? { ...it, bleedMode: 'stretch' } : it;
    }));
    setToast({ kind: 'success', msg: `Bleed ${anyOff ? 'on' : 'off'} for ${ids.length} card${ids.length > 1 ? 's' : ''}` });
  };

  // Duplica una o più carte: ogni copia (object URL nuovo) va subito dopo il suo originale.
  const handleDuplicate = (ids) => {
    const set = new Set([].concat(ids));
    setImages(prev => prev.flatMap(it => (set.has(it.id)
      ? [it, { ...it, id: `${it.file.name}-${Date.now()}-${Math.random()}`, preview: URL.createObjectURL(it.file) }]
      : [it])));
    if (set.size > 1) setToast({ kind: 'success', msg: `Duplicated ${set.size} cards` });
  };

  // Riordino: la carta `id` va all'indice `to` e quella che c'era prende il suo posto
  // (scambio, le altre restano ferme). Ordine = ordine di stampa.
  const handleMove = (id, to) => setImages(prev => {
    const from = prev.findIndex(i => i.id === id);
    if (from === -1 || from === to || to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });

  // Cambia art: il box ha già scaricato la stampa Scryfall; sostituisce file+preview
  // (id invariato). meta: { bleedMode, set, collector }. bleedMode mirror/stretch in
  // base a full-art/borderless; set/collector aggiornati così "Save list" segue la stampa.
  // Con più carte (stessa carta selezionata) la stampa va su tutte; un object URL a testa
  // perché ogni carta revoca il proprio alla rimozione.
  const handleReplaceArt = (file, { bleedMode, set, collector } = {}) => {
    const ids = new Set(editingIds);
    setImages(prev => prev.map(it => {
      if (!ids.has(it.id)) return it;
      URL.revokeObjectURL(it.preview);
      return {
        ...it, file, preview: URL.createObjectURL(file),
        bleedMode: bleedMode != null ? bleedMode : it.bleedMode,
        // set lowercase (coerenza con l'import); collector mantiene il case (Scryfall
        // è case-sensitive).
        set: set != null ? set.toLowerCase() : it.set,
        collector: collector != null ? collector : it.collector,
      };
    }));
    setEditingIds(null);
  };

  // Upscale AI 2× (ESRGAN nel browser) delle carte idonee fra `ids`. I duplicati condividono
  // lo stesso File: si elabora una volta per file. Aggiorna `w` → il "!" bassa risoluzione
  // si ricalcola da solo. Avanzamento in un toast persistente.
  const handleUpscale = async (ids) => {
    if (upscaling) return;
    const set = new Set([].concat(ids));
    const files = [...new Set(images.filter(it => set.has(it.id) && canUpscale(it, dpi, cardW)).map(it => it.file))];
    if (!files.length) return;
    setUpscaling(true);
    const n = files.length;
    const status = (i, p) => setToast({ kind: 'progress', msg: `Upscaling ${n > 1 ? `${i + 1}/${n} ` : ''}${p == null ? '(loading AI model)' : `${Math.round(p * 100)}%`}` });
    status(0, null);
    try {
      const done = new Map();
      for (const [i, f] of files.entries()) {
        done.set(f, await upscaleFile(f, (p) => status(i, p)));
      }
      setImages(prev => prev.map(it => {
        const r = set.has(it.id) && done.get(it.file);
        if (!r) return it;
        URL.revokeObjectURL(it.preview);
        return { ...it, file: r.file, preview: URL.createObjectURL(r.file), w: r.width };
      }));
      setToast({ kind: 'success', msg: `Upscaled ${n} image${n > 1 ? 's' : ''} 2×` });
    } catch (e) {
      setToast({ kind: 'error', msg: `Upscale failed: ${e.message || 'unknown error'}` });
    } finally {
      setUpscaling(false);
    }
  };

  // Salva la lista delle carte Scryfall in un .txt (formato deck-list → ricaricabile
  // incollandola in "Importa da Scryfall"). Gli upload manuali non entrano nel testo.
  const handleSaveProject = () => {
    const { text, cards, custom } = buildDeckList(images);
    if (!cards) {
      setToast({ kind: 'error', msg: custom
        ? 'Only custom images. Save list covers Scryfall cards only.'
        : 'No cards to save.' });
      return;
    }
    const blob = new Blob([text + '\n'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proxoteca.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    setToast({ kind: 'success', msg: custom
      ? `Saved ${cards} Scryfall card${cards > 1 ? 's' : ''}. ${custom} custom image${custom > 1 ? 's' : ''} not included.`
      : `Saved ${cards} Scryfall card${cards > 1 ? 's' : ''} to proxoteca.txt.` });
  };

  // Carica + valida un profilo ICC CMYK personalizzato (.icc). Non persistito (binario).
  // Rifiuta DeviceLink/abstract/named-color: hanno spazio CMYK ma non sono profili di
  // destinazione → non usabili come conversione né come OutputIntent (colori sbagliati).
  const handleIccUpload = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { readProfileInfo } = await import('./utils/cmykEngine');
      const info = await readProfileInfo(bytes);
      const cls = (info.deviceClass || '').toLowerCase();
      if (cls === 'link' || cls === 'abst' || cls === 'nmcl') {
        throw new Error('This file is a DeviceLink / abstract profile, not a destination profile. Use an output (printer) ICC profile.');
      }
      if (info.space !== 'CMYK') throw new Error('That ICC profile is not a CMYK profile.');
      setUploadedIcc({ bytes, name: info.name || file.name });
      setIccProfileId(UPLOAD_ID);
    } catch (err) {
      setError(err.message || 'Could not read the ICC profile.');
    }
  };
  const handleIccClear = () => { setUploadedIcc(null); setIccProfileId(DEFAULT_PROFILE_ID); };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    const ctrl = new AbortController();
    genAbortRef.current = ctrl;
    setGenProgress({ done: 0, total: images.length });
    const onProgress = (done, total) => setGenProgress({ done, total });
    try {
      if (colorMode === 'cmyk') {
        // Risolve il profilo attivo: incluso (fetch byte on-demand) o caricato.
        let iccBytes, iccInfo, condition;
        if (iccProfileId === UPLOAD_ID) {
          if (!uploadedIcc) throw new Error('No ICC profile loaded. In the sidebar’s CMYK settings, pick a bundled profile (e.g. Coated FOGRA39) or upload your print shop’s .icc, then export again.');
          iccBytes = uploadedIcc.bytes; iccInfo = uploadedIcc.name; condition = 'CUSTOM';
        } else {
          const meta = getProfileMeta(iccProfileId) || getProfileMeta(DEFAULT_PROFILE_ID);
          iccBytes = await loadBundledProfileBytes(meta.id); iccInfo = meta.info; condition = meta.condition;
        }
        const { generatePDFCmyk } = await import('./utils/pdfGeneratorCmyk');
        await generatePDFCmyk(images, formatKey, bleedMm, dpi, bleedStyle, cardW, cardH, cropMarks, cropStyle, customSheet, iccBytes, iccInfo, renderIntent, condition, onProgress, ctrl.signal);
      } else {
        await generatePDF(images, formatKey, bleedMm, dpi, bleedStyle, cardW, cardH, cropMarks, cropStyle, customSheet, quality, onProgress, ctrl.signal);
      }
      setToast({ kind: 'success', msg: 'PDF ready. Check your downloads.' });
    } catch (err) {
      // L'utente ha annullato: feedback neutro, non un errore.
      if (err?.name === 'AbortError') setToast({ kind: 'success', msg: 'Export canceled.' });
      else setError(err.message || 'Error generating the PDF.');
    } finally {
      setLoading(false);
      setGenProgress(null);
      genAbortRef.current = null;
    }
  };
  const handleCancelGenerate = () => genAbortRef.current?.abort();

  // Dropzone: drag&drop sull'intera area preview + open() per il bottone "+".
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    onDrop: (accepted) => { if (accepted.length > 0) handleImagesAdded(accepted); },
    noClick: true,
    noKeyboard: true,
  });

  const missing = images.length === 0 || perPage === 0 ? 0 : (perPage - (images.length % perPage)) % perPage;
  // Carte la cui sorgente non regge il DPI scelto, stessa soglia del marker "!" nel preview.
  const lowResCount = images.reduce((n, it) => n + (it.w && it.w < dpi * 0.5 * (cardW / 25.4) ? 1 : 0), 0);
  // §2: nome del profilo di destinazione attivo + n. carte CMYK native con profilo
  // incorporato DIVERSO (confronto descrizione lcms ↔ descrizione lcms, normalizzato).
  const targetProfileName = iccProfileId === UPLOAD_ID ? (uploadedIcc?.name || '') : (getProfileMeta(iccProfileId)?.info || '');
  const norm = (s) => (s || '').trim().toLowerCase();
  const profileMismatchCount = colorMode === 'cmyk'
    ? images.reduce((n, it) => n + (it.embeddedIccName && norm(it.embeddedIccName) !== norm(targetProfileName) ? 1 : 0), 0)
    : 0;

  const isMobile = useIsMobile();
  const route = useHashRoute();
  const inDecks = route.startsWith('/decks') || route === '/profile';
  // Feedback dai mazzi (stabile: i listener Firestore lo hanno tra le dipendenze).
  const notify = useCallback((msg, kind = 'success') => setToast({ kind, msg }), []);

  // "Print deck": scarica le immagini, poi SOSTITUISCE la coda di stampa (la conferma la chiede
  // l'editor) e apre la stampa. La coda vecchia resta intatta se il download fallisce.
  const handlePrintDeck = async (entries) => {
    setToast({ kind: 'progress', msg: 'Downloading card images…' });
    try {
      const { files, notFound } = await fetchScryfallImages(entries,
        (done, total) => setToast({ kind: 'progress', msg: `Downloading card images ${done}/${total}` }));
      // Nessuna immagine scaricata: la coda vecchia resta com'è.
      if (!files.length) throw new Error('Could not download any card image. Your print queue was not changed.');
      setImages((prev) => { prev.forEach((i) => URL.revokeObjectURL(i.preview)); return []; });
      addItems(files);
      navigate('/print');
      setToast(notFound.length
        ? { kind: 'error', msg: `${files.length} images ready. Not found: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ` and ${notFound.length - 5} more` : ''}` }
        : { kind: 'success', msg: `${files.length} images ready to print` });
    } catch (e) {
      setToast({ kind: 'error', msg: e.message || 'Could not download the card images.' });
    }
  };

  const decksNode = (
    <ErrorBoundary>
      <Suspense fallback={<div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>}>
        <DecksView route={route} notify={notify} printQueueCount={images.length} onPrintDeck={handlePrintDeck} />
      </Suspense>
    </ErrorBoundary>
  );

  // Bundle props condivisi: sia il ramo desktop sia MobileLayout (Tasks 2–4) li consumano.
  const settingsProps = {
    formatKey, setFormatKey, bleedMm, setBleedMm, bleedStyle, setBleedStyle, dpi, setDpi,
    cardType, setCardType, cardW, setCardW, cardH, setCardH, cropMarks, setCropMarks,
    cropStyle, setCropStyle, sheetUnit, setSheetUnit, sheetW, setSheetW, sheetH, setSheetH,
    customSheet, quality, setQuality,
    colorMode, setColorMode, renderIntent, setRenderIntent,
    iccProfileId, setIccProfileId, uploadedIcc, onIccUpload: handleIccUpload, onIccClear: handleIccClear,
    profileMismatchCount,
  };
  const previewProps = {
    images, formatKey, bleedMm, bleedStyle, dpi, cardW, cardH, showCrop: cropMarks, cropStyle,
    customSheet, onRemove: handleRemove, onChangeArt: (ids) => setEditingIds([].concat(ids)), onToggleBleed: handleToggleBleed,
    onDuplicate: handleDuplicate, onMove: handleMove, onUpscale: handleUpscale, upscaling, isDragActive, missing,
    onRemoveMany: handleRemoveMany, onBleedMany: handleBleedMany,
  };

  // Ramo mobile: shell a tab + modali condivise (props reali arrivano in Tasks 2–4).
  if (isMobile) {
    return (
      <>
        <MobileLayout
          settingsProps={settingsProps}
          previewProps={previewProps}
          actions={{ onGenerate: handleGenerate, onSave: handleSaveProject, onClear: handleClearAll,
            onClearError: () => setError(null), onCancelGenerate: handleCancelGenerate, genProgress,
            loading, error, count: images.length, missing, lowResCount, dpi }}
          // onFiles: il tasto Upload mobile è un <label><input type=file> nativo (gesto
          // reale → apre il picker su mobile, dove open() di react-dropzone è inaffidabile).
          addMenu={{ onFiles: handleImagesAdded, onImport: () => setImportOpen(true), onImportMpc: () => setMpcOpen(true) }}
          tabs={<NavTabs decks={inDecks} />}
          altBody={inDecks ? decksNode : null}
        />
        <ScryfallImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={addItems} />
        <MpcImportModal open={mpcOpen} onClose={() => setMpcOpen(false)} onImport={addItems} />
        {editing && <ArtPickerModal key={editing.id} card={editing} count={editingIds.length} onClose={() => setEditingIds(null)} onPick={handleReplaceArt} />}
        <CookieBanner />
        <ConfirmDialog open={!!confirm} message={confirm?.message} confirmLabel={confirm?.confirmLabel}
          onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <h1 className="brand"><Wordmark height={30} className="wordmark" /></h1>
        <NavTabs decks={inDecks} />
        {!inDecks && (
          <div className={`help${helpOpen ? ' open' : ''}`} ref={helpRef}>
            <button type="button" className="help-btn" aria-label="How it works"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((o) => !o)}>?</button>
            <div className="help-tooltip" role="tooltip">
              <strong>How it works</strong>
              <ol>
                <li><b>Add cards</b>. Upload images, or import from Scryfall (paste a card list or a deck link).</li>
                <li><b>Set up</b>. Sheet &amp; card size, bleed and crop marks in the sidebar.</li>
                <li><b>Tweak</b>. Select as many cards as you like, then use the menu: change art, duplicate, bleed, remove. With several cards selected the menu acts on all of them.</li>
                <li><b>Export</b>. <b>Generate PDF</b> (print-ready). <b>Save list</b> exports your Scryfall cards as a reloadable deck list.</li>
              </ol>
              <p className="help-controls"><b>Click</b> select or deselect · <b>Right-click</b> options · <b>Drag</b> swap</p>
            </div>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      {inDecks ? decksNode : (
        <div className="app-body">

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-scroll">
            <PageSettings {...settingsProps} />
            </div>
            <div className="sidebar-section sidebar-export">
              <div className="add-menu-wrap" ref={addMenuRef}>
                {addMenuOpen && (
                  <div className="add-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); open(); }}>
                      <IconImage size={15} /> Upload files
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setImportOpen(true); }}>
                      <IconDownload size={15} /> Import from Scryfall
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setMpcOpen(true); }}>
                      <IconFile size={15} /> Import from MPCFill
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className={`btn-add${addMenuOpen ? ' open' : ''}`}
                  onClick={() => setAddMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                >
                  <IconPlus size={18} /> Add cards
                </button>
              </div>
              <ExportProgress loading={loading} progress={genProgress} disabled={images.length === 0}
                onGenerate={handleGenerate} onCancel={handleCancelGenerate} />
              <div className="export-row">
                <button className="btn-secondary btn-save" onClick={handleSaveProject} disabled={images.length === 0}>
                  <IconList size={15} /> Save list
                </button>
                <button className="btn-secondary" onClick={handleClearAll} disabled={images.length === 0}>
                  <IconTrash size={15} /> Delete all
                </button>
              </div>
              {error && (
                <div className="info-box info-box-error">
                  <IconAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                  <button type="button" className="info-box-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">
                    <IconX size={14} />
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Main, area drop + preview grande */}
          <main className="main-content" {...getRootProps()}>
            <input {...getInputProps()} />
            <PagePreview {...previewProps} />
          </main>
        </div>
      )}

      <ScryfallImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={addItems}
      />

      <MpcImportModal open={mpcOpen} onClose={() => setMpcOpen(false)} onImport={addItems} />

      {editing && (
        <ArtPickerModal
          key={editing.id}
          card={editing}
          count={editingIds.length}
          onClose={() => setEditingIds(null)}
          onPick={handleReplaceArt}
        />
      )}

      <CookieBanner />
      <ConfirmDialog open={!!confirm} message={confirm?.message} confirmLabel={confirm?.confirmLabel}
        onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
