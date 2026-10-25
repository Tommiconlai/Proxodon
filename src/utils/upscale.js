/**
 * Upscale AI 2× nel browser: UpscalerJS + TensorFlow.js (WebGL), modello ESRGAN.
 * Tutto lazy (import dinamico al primo uso): niente peso nel bundle iniziale. I pesi del
 * modello (2.7 MB) sono nel sito, in public/models (copiati da @upscalerjs/esrgan-medium/models/x2):
 * niente CDN esterno senza controllo d'integrità. Aggiornando il pacchetto vanno ricopiati.
 */
import { lsGet, lsSet } from './settings';

let upscalerP = null;
const getUpscaler = () => (upscalerP ??= Promise.all([
    import('upscaler'),
    import('@upscalerjs/esrgan-medium/2x'),
]).then(([{ default: Upscaler }, { default: model }]) => new Upscaler({ model: { ...model, path: 'models/esrgan-medium-x2/model.json' } }))
    .catch((e) => { upscalerP = null; throw e; })); // caricamento fallito (rete): il prossimo Upscale riprova
export const loadUpscaler = getUpscaler;
export const upscalerReady = () => upscalerP != null; // caricato o in caricamento

// Stima del tempo (Upscale all): ms per megapixel d'ingresso, misurati a ogni upscale e tenuti nel browser;
// prima della prima misura ~9 s/MP (vedi sotto), più ~16 s per il modello al primo uso della sessione.
export const MODEL_LOAD_MS = 16000;
export const upscaleRate = () => Number(lsGet('ip:upscaleMsPerMp')) || 9000;
export const saveUpscaleRate = (ms) => lsSet('ip:upscaleMsPerMp', String(Math.round(ms)));
export const formatEta = (ms) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${Math.max(5, Math.ceil(s / 5) * 5)} s`;
    if (s < 3600) return `${Math.round(s / 60)} min`;
    return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
};

// Ha senso solo su raster RGB sotto il DPI scelto (i JPEG CMYK nativi perderebbero gli
// inchiostri esatti). DPI effettivi arrotondati: una PNG Scryfall 744px raddoppiata fa
// 599.9 DPI a 63mm e non deve risultare "da rifare" a 600.
export const canUpscale = (item, dpi, cardW) =>
    item.colorKind !== 'cmyk' && !!item.w && Math.round(item.w / (cardW / 25.4)) < dpi;

const loadImg = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = src;
});

/**
 * Restituisce { file, width }: PNG 2× con lo stesso nome base (così "Change art" e
 * "stessa carta" continuano a funzionare). onProgress(0..1) durante l'elaborazione a tasselli;
 * signal (AbortSignal) la interrompe.
 */
export async function upscaleFile(file, onProgress, signal) {
    const upscaler = await getUpscaler();
    const url = URL.createObjectURL(file);
    try {
        const img = await loadImg(url);
        const dataUrl = await upscaler.upscale(img, {
            signal,
            // Misurato (RTX 4070, WebGL, PNG Scryfall 745×1040): ~6 s con tasselli 128, ~7 s
            // cedendo il frame tra i tasselli (UI reattiva + avanzamento visibile). Il primo uso
            // costa ~16 s (compilazione shader + download pesi).
            patchSize: 128,
            padding: 8,
            awaitNextFrame: true,
            progress: (p) => onProgress?.(p),
        });
        const up = await loadImg(dataUrl);
        // ESRGAN lavora in RGB: rimette la trasparenza originale (angoli arrotondati delle PNG
        // Scryfall) ingrandita, sennò gli angoli diventerebbero neri.
        const c = document.createElement('canvas');
        c.width = up.naturalWidth;
        c.height = up.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(up, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
        const width = c.width;
        c.width = c.height = 0; // memoria del canvas liberata subito
        if (!blob) throw new Error('Could not encode the upscaled image.'); // toBlob dà null (memoria finita)
        const name = `${file.name.replace(/\.[^.]+$/, '')}.png`;
        return { file: new File([blob], name, { type: 'image/png' }), width };
    } finally {
        URL.revokeObjectURL(url);
    }
}
