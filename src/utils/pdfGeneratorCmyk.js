/**
 * PDF Generator CMYK / PDF-X-1a, Proxodon
 *
 * Esportatore di stampa CMYK, additivo e separato dal path jsPDF (RGB/schermo),
 * che resta intatto. Produce un PDF/X-1a:2003: ogni carta è un'immagine
 * DeviceCMYK (raw FlateDecode, lossless), con UN profilo ICC incorporato come
 * OutputIntent. Niente RGB/ICCBased/trasparenza nel contenuto.
 *
 * Geometria riusata da pdfGenerator.js (getGridInfo/cropMarkSpan/drawCardWithBleed):
 * è pura matematica di layout, indipendente dallo spazio colore.
 *
 * v1 = solo arte RGB (Scryfall/upload RGB) -> CMYK via lcms (profilo tipografia).
 * I file già CMYK nativi (senza canvas) sono Fase 2, non ancora gestiti.
 *
 * pdf-lib e lcms-wasm sono importati on-demand qui dentro: questo modulo è a sua
 * volta caricato con dynamic import() dall'handler di generazione, così il bundle
 * iniziale (utenti RGB) non li include.
 */

import { getGridInfo, cropMarkSpan, resolveBleedMode, drawCardWithBleed, CARD_W, CARD_H } from './pdfGenerator.js';
import { isCmykJpeg, cmykCellBuffer } from './cmykRaster.js';
import { decodeCMYK } from './vendor/jpegCmykDecoder.js';
import { saveFile } from './download.js';

const MM_TO_PT = 72 / 25.4;

/**
 * Renderizza una carta (cella intera trim+bleed) su canvas RGB e ne ritorna il
 * buffer RGBA + dimensioni px. Stessa pipeline del path RGB (sfondo nero dietro
 * i PNG con angoli trasparenti; abbondanza generata da drawCardWithBleed).
 */
function renderCellRGBA(img, cellWmm, cellHmm, dpi, bleedMm, bleedMode) {
  const mmToPx = dpi / 25.4;
  const w = Math.max(1, Math.round(cellWmm * mmToPx));
  const h = Math.max(1, Math.round(cellHmm * mmToPx));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (bleedMode && bleedMode !== 'none') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    drawCardWithBleed(ctx, img, 0, 0, w, h, Math.round(bleedMm * mmToPx), bleedMode);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const b = Math.round(bleedMm * mmToPx);
    ctx.drawImage(img, b, b, w - 2 * b, h - 2 * b);
  }
  const { data } = ctx.getImageData(0, 0, w, h); // copia: il canvas si può liberare
  canvas.width = canvas.height = 0; // memoria del canvas liberata subito: iOS ha un tetto, 100+ carte lo superano
  return { data, w, h };
}

/**
 * Disegna i crocini di taglio in CMYK (100% K) su una pagina pdf-lib.
 * Porta drawCropMarks (jsPDF, mm da alto-sx) alle coordinate pdf-lib
 * (pt da basso-sx). Stessa geometria/clamp di cropMarkSpan.
 */
function drawCropMarksPdf(page, ops, x, y, bleed, limits, cardW, cardH, style, pageHpt) {
  const markLength = 3;
  const gap = 0.5;
  const cx = x + bleed;
  const cy = y + bleed;
  const cw = cardW;
  const ch = cardH;
  const thickness = 0.15 * MM_TO_PT;
  const color = ops.cmyk(0, 0, 0, 1); // 100% nero: visibile, una sola lastra (no TAC)

  // mm (da alto-sx) -> punto pdf-lib (da basso-sx)
  const P = (xmm, ymmTop) => ({ x: xmm * MM_TO_PT, y: pageHpt - ymmTop * MM_TO_PT });
  const line = (x1, y1, x2, y2) => page.drawLine({ start: P(x1, y1), end: P(x2, y2), thickness, color });

  if (style === 'corners') {
    const g = bleed > 0 ? Math.min(0.6, bleed) : 0.6;
    const len = Math.min(markLength, cw * 0.45, ch * 0.45);
    const bracket = (vx, vy, sx, sy) => {
      line(vx, vy, vx + sx * len, vy);
      line(vx, vy, vx, vy + sy * len);
    };
    bracket(cx - g, cy - g, 1, 1);
    bracket(cx + cw + g, cy - g, -1, 1);
    bracket(cx - g, cy + ch + g, 1, -1);
    bracket(cx + cw + g, cy + ch + g, -1, -1);
    return;
  }

  const L = cropMarkSpan(limits.left, gap, markLength);
  const R = cropMarkSpan(limits.right, gap, markLength);
  const U = cropMarkSpan(limits.up, gap, markLength);
  const D = cropMarkSpan(limits.down, gap, markLength);
  if (L) {
    line(cx - L.b, cy, cx - L.a, cy);
    line(cx - L.b, cy + ch, cx - L.a, cy + ch);
  }
  if (R) {
    line(cx + cw + R.a, cy, cx + cw + R.b, cy);
    line(cx + cw + R.a, cy + ch, cx + cw + R.b, cy + ch);
  }
  if (U) {
    line(cx, cy - U.b, cx, cy - U.a);
    line(cx + cw, cy - U.b, cx + cw, cy - U.a);
  }
  if (D) {
    line(cx, cy + ch + D.a, cx, cy + ch + D.b);
    line(cx + cw, cy + ch + D.a, cx + cw, cy + ch + D.b);
  }
}

/**
 * Genera e scarica un PDF/X-1a CMYK.
 * Firma allineata a generatePDF + (iccBytes, iccName, intentKey).
 * iccBytes: Uint8Array del profilo CMYK della tipografia (obbligatorio).
 */
export async function buildCmykPdfBytes(items, formatKey, bleedMm, dpi = 300, bleedStyle = 'auto', cardW = CARD_W, cardH = CARD_H, cropMarks = true, cropStyle = 'lines', customSheet = null, iccBytes = null, iccName = 'CMYK', intentKey = 'relative', condition = null, onProgress = null, signal = null) {
  if (!items || items.length === 0) throw new Error('No images selected.');
  if (!iccBytes || !iccBytes.length) throw new Error('Load the print shop ICC profile first.');

  const { cols, rows, cellW, cellH, pageW, pageH, offsetX, offsetY } = getGridInfo(formatKey, bleedMm, cardW, cardH, customSheet);
  if (cols === 0 || rows === 0) throw new Error('The card size is too small for at least one image.');

  // Caricati on-demand: tengono pdf-lib + lcms/WASM fuori dal bundle iniziale.
  const [pdfLib, engine] = await Promise.all([import('pdf-lib'), import('./cmykEngine.js')]);
  const { PDFDocument, PDFName, PDFString, PDFHexString, cmyk, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = pdfLib;

  // Convertitore RGB→CMYK (lcms) creato solo se serve: un set di soli file CMYK
  // nativi non carica il WASM.
  let conv = null;
  const getConv = async () => conv || (conv = await engine.makeRgbToCmyk(iccBytes, intentKey));

  const doc = await PDFDocument.create();

  // Info dict (PDF/X-1a). Date passate dal chiamante o ora.
  const now = new Date();
  doc.setTitle('Proxodon');
  doc.setCreator('Proxodon');
  doc.setProducer('Proxodon');
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  const info = doc.getInfoDict();
  info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-1a:2003'));
  info.set(PDFName.of('Trapped'), PDFName.of('False')); // /False (mai /Unknown)
  // ID del file nel trailer, obbligatorio in PDF/X (pdf-lib non lo scrive): due volte lo stesso, 16 byte a caso.
  // GTS_PDFXConformance no: nel registro CGATS vale solo per le versioni 2001, per la 2003 basta GTS_PDFXVersion.
  const fileId = PDFHexString.of([...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join(''));
  doc.context.trailerInfo.ID = doc.context.obj([fileId, fileId]);

  // OutputIntent + ICC incorporato (l'unico ICC del documento, /N 4 = CMYK).
  const iccStream = doc.context.flateStream(iccBytes, { N: 4 });
  const iccRef = doc.context.register(iccStream);
  // OutputConditionIdentifier = sigla della condizione (es. FOGRA39) se nota,
  // altrimenti 'CUSTOM'. Info = descrizione leggibile del profilo.
  const condId = (condition || 'CUSTOM').slice(0, 64);
  const infoStr = (iccName || condId).slice(0, 128);
  const outputIntent = doc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of(condId),
    Info: PDFString.of(infoStr),
    RegistryName: PDFString.of('http://www.color.org'),
    DestOutputProfile: iccRef,
  });
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([outputIntent]));

  const ops = { cmyk };
  const pageWpt = pageW * MM_TO_PT;
  const pageHpt = pageH * MM_TO_PT;

  let imgIndex = 0;
  const perPage = cols * rows;
  // Copie della stessa carta (stessi byte, stesso abbondamento): convertite e incorporate una volta, poi lo stesso
  // XObject (30 Forest = un flusso, non 30). Chiave = SHA-1 dei byte, che si leggono comunque per il JPEG CMYK.
  const embedded = new Map();

  while (imgIndex < items.length) {
    const page = doc.addPage([pageWpt, pageHpt]);
    // TrimBox = BleedBox = MediaBox = foglio (l'abbondanza per-carta è gestita
    // dai crocini interni, non dai box pagina). TrimBox ⊆ BleedBox ⊆ MediaBox.
    const box = doc.context.obj([0, 0, pageWpt, pageHpt]);
    page.node.set(PDFName.of('TrimBox'), box);
    page.node.set(PDFName.of('BleedBox'), doc.context.obj([0, 0, pageWpt, pageHpt]));

    let posOnPage = 0;
    while (posOnPage < perPage && imgIndex < items.length) {
      const col = posOnPage % cols;
      const row = Math.floor(posOnPage / cols);
      const xmm = offsetX + col * cellW;
      const ymm = offsetY + row * cellH; // dall'alto

      if (signal?.aborted) { if (conv) conv.close(); throw new DOMException('Export canceled.', 'AbortError'); }

      const item = items[imgIndex];
      const mode = resolveBleedMode(item.bleedMode, bleedStyle);

      // Routing per spazio colore (Fase 2): JPEG CMYK nativo → canali grezzi,
      // niente conversione (numeri preservati); tutto il resto → RGB su canvas + lcms.
      const raw = new Uint8Array(await item.file.arrayBuffer());
      const key = `${mode}|${new Uint8Array(await crypto.subtle.digest('SHA-1', raw)).join(',')}`;
      let imgRef = embedded.get(key);
      if (!imgRef) {
        let cmykBytes, w, h;
        if (isCmykJpeg(raw)) {
          const dec = decodeCMYK(raw); // {width,height,data} DeviceCMYK (0=no ink)
          const cell = cmykCellBuffer(dec, cardW, cardH, bleedMm, mode);
          cmykBytes = cell.data; w = cell.w; h = cell.h;
        } else {
          const imgEl = await createImageBitmap(item.file).catch(() => { throw new Error(`Cannot load ${item.file.name}`); });
          const cell = renderCellRGBA(imgEl, cellW, cellH, dpi, bleedMm, mode);
          imgEl.close();
          cmykBytes = (await getConv()).convert(cell.data, cell.w * cell.h); // RGBA → CMYK 8-bit
          w = cell.w; h = cell.h;
        }

        const imgStream = doc.context.flateStream(cmykBytes, {
          Type: 'XObject',
          Subtype: 'Image',
          Width: w,
          Height: h,
          ColorSpace: 'DeviceCMYK',
          BitsPerComponent: 8,
        });
        imgRef = doc.context.register(imgStream);
        embedded.set(key, imgRef);
      }
      const name = page.node.newXObject('Im', imgRef);

      // Posiziona: angolo basso-sx della cella in pt; matrice = scala cella.
      const xPt = xmm * MM_TO_PT;
      const yPt = pageHpt - (ymm + cellH) * MM_TO_PT;
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(cellW * MM_TO_PT, 0, 0, cellH * MM_TO_PT, xPt, yPt),
        drawObject(name),
        popGraphicsState(),
      );

      if (cropMarks) {
        const limits = {
          left:  (col === 0 ? offsetX : 0) + bleedMm,
          right: (col === cols - 1 ? offsetX : 0) + bleedMm,
          up:    (row === 0 ? offsetY : 0) + bleedMm,
          down:  (row === rows - 1 ? offsetY : 0) + bleedMm,
        };
        drawCropMarksPdf(page, ops, xmm, ymm, bleedMm, limits, cardW, cardH, cropStyle, pageHpt);
      }

      posOnPage++;
      imgIndex++;
      onProgress?.(imgIndex, items.length); // carte renderizzate finora
    }
  }

  if (conv) conv.close();

  // useObjectStreams:false → tabella xref classica + oggetti in chiaro: gli
  // object/xref stream sono feature PDF 1.5+, VIETATE in PDF/X-1a:2003 (PDF 1.4).
  const bytes = await doc.save({ useObjectStreams: false });
  // pdf-lib hardcoda l'header a "%PDF-1.7" (nessuna API per cambiarlo); PDF/X-1a:2003
  // richiede 1.4. Non usiamo feature >1.4, quindi correggiamo il solo byte minor.
  if (bytes[0] === 0x25 && bytes[5] === 0x31 && bytes[6] === 0x2e) bytes[7] = 0x34; // "%PDF-1.x" → "1.4"

  return { bytes, ts: now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-') };
}

/** Genera e scarica il PDF/X-1a CMYK. */
export async function generatePDFCmyk(...args) {
  const { bytes, ts } = await buildCmykPdfBytes(...args);
  const formatKey = args[1];
  await saveFile(`proxies_CMYK_${formatKey}_${ts}.pdf`, new Blob([bytes], { type: 'application/pdf' }));
}
