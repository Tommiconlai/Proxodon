/**
 * CMYK raster utils, Proxoteca (Fase 2: file CMYK nativi)
 *
 * Rilevamento JPEG CMYK + generazione abbondanza sui canali grezzi C/M/Y/K
 * SENZA canvas (il canvas è solo-RGB e distruggerebbe il CMYK). L'abbondanza
 * è pura riflessione/replica di pixel: lossless e indipendente dallo spazio
 * colore. Lo scaling alla cella fisica lo fa la matrice PDF (il RIP ricampiona).
 */

/**
 * Vero se il buffer è un JPEG a 4 componenti (CMYK). Legge il marker SOFn.
 * (PNG non può MAI essere CMYK; qualsiasi non-JPEG → false.)
 */
export function isCmykJpeg(bytes) {
  const d = bytes;
  if (!d || d.length < 4 || d[0] !== 0xFF || d[1] !== 0xD8) return false; // no SOI
  let i = 2;
  while (i < d.length - 1) {
    if (d[i] !== 0xFF) { i++; continue; }
    let m = d[i + 1];
    while (m === 0xFF && i + 2 < d.length) { i++; m = d[i + 1]; } // salta i fill 0xFF
    if (m === 0xD8 || m === 0xD9 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
    if (i + 3 >= d.length) break;
    const len = (d[i + 2] << 8) | d[i + 3];
    if (len < 2) break;
    // SOFn (frame header): C0-CF tranne C4(DHT)/C8(JPG)/CC(DAC). Nf = numero componenti.
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      const nf = d[i + 9]; // FF, marker, len(2), precision(1), H(2), W(2), Nf(1)
      return nf === 4;
    }
    i += 2 + len;
  }
  return false;
}

/**
 * Estrae il profilo ICC incorporato da un JPEG (segmenti APP2 "ICC_PROFILE\0",
 * multi-chunk: concatenati per numero di sequenza). Ritorna Uint8Array o null se
 * assente. Per l'avviso di mismatch profilo sui file CMYK nativi (§2).
 */
export function extractIccFromJpeg(bytes) {
  const d = bytes;
  if (!d || d.length < 4 || d[0] !== 0xFF || d[1] !== 0xD8) return null;
  const SIG = [0x49, 0x43, 0x43, 0x5F, 0x50, 0x52, 0x4F, 0x46, 0x49, 0x4C, 0x45, 0x00]; // 'ICC_PROFILE\0'
  const chunks = []; // { seq, data }
  let i = 2;
  while (i < d.length - 1) {
    if (d[i] !== 0xFF) { i++; continue; }
    let m = d[i + 1];
    while (m === 0xFF && i + 2 < d.length) { i++; m = d[i + 1]; }
    if (m === 0xD8 || m === 0xD9 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
    if (m === 0xDA) break; // SOS: fine header, stop
    if (i + 3 >= d.length) break;
    const len = (d[i + 2] << 8) | d[i + 3];
    if (len < 2) break;
    if (m === 0xE2) { // APP2
      const p = i + 4;
      let ok = true;
      for (let k = 0; k < SIG.length; k++) if (d[p + k] !== SIG[k]) { ok = false; break; }
      if (ok) {
        const seq = d[p + 12];
        const start = p + 14; // dopo sig(12)+seq(1)+count(1)
        const end = i + 2 + len;
        chunks.push({ seq, data: d.subarray(start, end) });
      }
    }
    i += 2 + len;
  }
  if (!chunks.length) return null;
  chunks.sort((a, b) => a.seq - b.seq);
  const total = chunks.reduce((n, c) => n + c.data.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c.data, o); o += c.data.length; }
  return out;
}

/**
 * Costruisce il buffer CMYK della cella piena (trim + abbondanza) dai canali
 * grezzi decodificati. `dec` = {width,height,data} (CMYK 8-bit interleaved,
 * convenzione DeviceCMYK: 0 = niente inchiostro).
 * Modi allineati a drawCardWithBleed: full | none | black | stretch | mirror.
 * Ritorna {data, w, h}; va piazzato sull'intera cella (la matrice PDF scala).
 */
export function cmykCellBuffer(dec, cardWmm, cardHmm, bleedMm, mode, N = 4) {
  const { width: W, height: H, data: src } = dec;
  // 'full' = immagine già con abbondanza (riempie la cella); bleed 0 = solo trim.
  if (mode === 'full' || bleedMm <= 0) return { data: src, w: W, h: H };
  const bx = Math.max(0, Math.round((W * bleedMm) / cardWmm));
  const by = Math.max(0, Math.round((H * bleedMm) / cardHmm));
  if (bx === 0 && by === 0) return { data: src, w: W, h: H };

  const ow = W + 2 * bx, oh = H + 2 * by;
  const out = new Uint8Array(ow * oh * N);
  const clamp = (v, max) => (v < 0 ? 0 : v >= max ? max - 1 : v);
  const sAt = (x, y) => ((clamp(y, H) * W) + clamp(x, W)) * N;
  const oAt = (x, y) => ((y * ow) + x) * N;

  // centro = trim 1:1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = sAt(x, y), o = oAt(x + bx, y + by);
      for (let c = 0; c < N; c++) out[o + c] = src[s + c];
    }
  }

  // margine di abbondanza
  for (let gy = 0; gy < oh; gy++) {
    for (let gx = 0; gx < ow; gx++) {
      if (gx >= bx && gx < bx + W && gy >= by && gy < by + H) continue; // trim, già fatto
      const o = oAt(gx, gy);
      if (mode === 'none') continue;                 // 0 = niente inchiostro (carta bianca)
      if (mode === 'black') { out[o + 3] = 255; continue; } // K pieno
      // stretch = replica bordo (clamp); mirror = riflette la fascia esterna
      const tx = gx - bx, ty = gy - by;
      let sx, sy;
      if (mode === 'mirror') {
        sx = tx < 0 ? -tx - 1 : tx >= W ? 2 * W - tx - 1 : tx;
        sy = ty < 0 ? -ty - 1 : ty >= H ? 2 * H - ty - 1 : ty;
      } else { // stretch (default)
        sx = tx; sy = ty;
      }
      const s = sAt(sx, sy);
      for (let c = 0; c < N; c++) out[o + c] = src[s + c];
    }
  }
  return { data: out, w: ow, h: oh };
}
