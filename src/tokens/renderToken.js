import { borderStops, coverRect, parseRules, fitSize, ellipsize, layoutRules, tokenFileName, typeLine, isCreature, artWindow } from './tokenModel.js';
import { templateById } from './templates.js';
import { symUrl } from '../utils/manaSymbols.js';
import { WORDMARK_X_CORE, WORDMARK_X_V } from '../components/wordmarkPaths.js';

// Disegno del token su un canvas, lo stesso per l'anteprima e per il PNG a 600 DPI: livelli dal basso, fondo, arte
// (nella finestra della cornice, coverRect di state.pos), livelli della cornice, testi, overlay (l'immagine scontornata,
// sopra cornice e testi e non tagliata dalla finestra, coverRect di state.overlayPos). scale = pixel per unità (630 = la
// larghezza della carta); b = bleed in unità attorno alla carta (1 mm = 10): il disegno continua fuori, le zone restano
// dove sono.
// state = { template, colors, name, types, subtypes, rules, power, toughness, credit, pos, overlayPos, sync, target }.

export const PX_PER_UNIT = 1488 / 630; // 63 mm a 600 DPI

const FAMILY = { display: '"Chakra Petch"', body: '"Space Grotesk"', mono: '"JetBrains Mono"' };
export const fontOf = (z, size) => `${z.weight} ${size}px ${FAMILY[z.font]}`;

// I font del bundle si caricano solo quando servono: il canvas li vuole già pronti (altrimenti usa quello di sistema).
let fontsP = null;
export const ensureFonts = () => (fontsP ??= Promise.all([
  '700 40px "Chakra Petch"', '600 30px "Chakra Petch"', '400 30px "Space Grotesk"', '500 18px "JetBrains Mono"',
].map((f) => document.fonts.load(f))).catch(() => {}));

const loadImage = (src, cors) => new Promise((resolve, reject) => {
  const img = new Image();
  if (cors) img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Could not load ${src}`));
  img.src = src;
});

// Forza e costituzione solo sulle creature: lì la cornice ha il riquadro anche vuoto.
export const ptBox = (s) => isCreature(s.types);
const ptText = (s) => (ptBox(s) && (s.power.trim() || s.toughness.trim()) ? `${s.power.trim()}/${s.toughness.trim()}` : '');

// Livelli di una cornice con o senza forza e costituzione: l.pt true = solo con, false = solo senza.
export const frameLayers = (t, pt) => t.layers.filter((l) => l.pt === undefined || l.pt === pt);

// Bordo sfumato del pannello nei colori del token (l.tint): lo stesso SVG con le tappe del gradiente rifatte (URL blob,
// stessa origine: il canvas resta esportabile).
async function tintedImage(src, stops) {
  const svg = (await (await fetch(src)).text()).replace(/(<linearGradient[^>]*>)[\s\S]*?(<\/linearGradient>)/,
    (_, open, close) => open + stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') + close);
  return loadImage(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
}

// I livelli della cornice (frameLayers) con l'immagine caricata, uno per cornice, F/C e colori del bordo.
const frames = new Map();
export function loadFrame(template, colors, pt) {
  const stops = borderStops(colors);
  const key = `${template.id}|${pt}|${JSON.stringify(stops)}`;
  if (!frames.has(key)) {
    frames.set(key, Promise.all(frameLayers(template, pt).map(async (l) => {
      if (!l.src) return l;
      return { ...l, img: await (l.tint && stops ? tintedImage(l.src, stops) : loadImage(l.src)) };
    })).catch((e) => { frames.delete(key); throw e; }));
  }
  return frames.get(key);
}

// Simboli di Scryfall ({T}, {G}): quelli che non si caricano (offline) mancano dalla mappa e si scrivono come testo.
// ?cors=1: Scryfall manda Access-Control-Allow-Origin (e Vary) solo alle richieste con Origin; le <img> dei pallini
// (ManaCost) mettono in cache lo stesso file senza, e il canvas lo rifiuterebbe. Un indirizzo suo, una cache sua.
const symbols = new Map();
export async function loadSymbols(runs) {
  const codes = [...new Set(runs.filter((r) => r.t === 'sym').map((r) => r.v))];
  const out = new Map();
  await Promise.all(codes.map(async (v) => {
    if (!symbols.has(v)) symbols.set(v, loadImage(`${symUrl(v)}?cors=1`, true).catch(() => { symbols.delete(v); return null; }));
    const img = await symbols.get(v);
    if (img) out.set(v, img);
  }));
  return out;
}

// Una riga di testo nel suo riquadro: rimpicciolisce fino al minimo, poi i puntini. dx = spazio a sinistra (il pennello).
function drawLine(ctx, z, text, { dx = 0 } = {}) {
  const w = z.w - 2 * (z.pad || 0) - dx;
  const measure = (t, s) => { ctx.font = fontOf(z, s); return ctx.measureText(t).width; };
  const size = fitSize(measure, text, w, z.size, z.min);
  ctx.font = fontOf(z, size);
  ctx.fillText(ellipsize(measure, text, w, size), z.x + (z.pad || 0) + dx, z.y + z.h / 2 + size * 0.36);
}

// Forza e costituzione ognuna al centro del suo riquadro (z.split), stesso corpo, e la barra a metà tra i due.
function drawPT(ctx, z, s) {
  const { p, t, w } = z.split;
  const [power, tough] = [s.power.trim(), s.toughness.trim()];
  const measure = (x, size) => { ctx.font = fontOf(z, size); return ctx.measureText(x).width; };
  const size = Math.min(fitSize(measure, power, w, z.size, z.min), fitSize(measure, tough, w, z.size, z.min));
  const y = z.y + z.h / 2 + size * 0.36;
  ctx.font = fontOf(z, size);
  ctx.textAlign = 'center';
  ctx.fillText(power, p + w / 2, y);
  ctx.fillText('/', z.x + z.w / 2, y);
  ctx.fillText(tough, t + w / 2, y);
  ctx.textAlign = 'left';
}

// Simbolo dell'edizione: la X del logo Proxodon tutta bianca, in un quadrato di lato s con l'angolo in alto a sinistra
// in x, y (come il simbolo d'espansione dei token veri).
function drawSetSymbol(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 31, s / 31);
  ctx.translate(-42, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(WORDMARK_X_CORE));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of WORDMARK_X_V) ctx.stroke(new Path2D(d));
  ctx.restore();
}

// Pennello del credito (disegnato qui, non copiato da una carta): manico in diagonale e setole a goccia, in un quadrato
// di lato s con l'angolo in alto a sinistra in x, y.
function drawBrush(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineCap = 'round';
  ctx.lineWidth = 13;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(92, 8);
  ctx.lineTo(50, 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(52, 46);
  ctx.bezierCurveTo(38, 38, 20, 44, 16, 62);
  ctx.bezierCurveTo(12, 78, 8, 88, 4, 96);
  ctx.bezierCurveTo(22, 92, 42, 86, 52, 72);
  ctx.bezierCurveTo(60, 62, 60, 52, 52, 46);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Testo delle regole: a capo, simboli come immagini, blocco centrato in verticale nel riquadro.
function drawRules(ctx, z, text, syms) {
  const box = { w: z.w - 2 * z.pad, h: z.h - 2 * z.pad };
  const measure = (t, s) => { ctx.font = fontOf(z, s); return ctx.measureText(t).width; };
  const { size, lines } = layoutRules(measure, parseRules(text), box, z);
  const lh = size * z.lineH;
  let y = z.y + z.pad + (box.h - lines.length * lh) / 2 + size * 0.95;
  ctx.font = fontOf(z, size);
  for (const line of lines) {
    let x = z.x + z.pad;
    for (const r of line) {
      const img = r.t === 'sym' && syms.get(r.v);
      if (img) ctx.drawImage(img, x + size * 0.04, y - size * 0.78, size * 0.92, size * 0.92);
      else ctx.fillText(r.t === 'sym' ? `{${r.v}}` : r.v, x, y);
      x += r.w;
    }
    y += lh;
  }
}

// La carta a pixel interi (i bordi di taglio sul bordo di un pixel, scala e spostamento cambiano di meno di un pixel):
// lì i livelli della cornice incontrano il loro seguito nel bleed, e a metà pixel i due orli sfumati lascerebbero una
// riga chiara.
const placeCard = (ctx, scale, b) => ctx.setTransform(Math.round(630 * scale) / 630, 0, 0, Math.round(880 * scale) / 880,
  Math.round(b * scale), Math.round(b * scale));

// L'overlay dove lo mette state.overlayPos, a partire dalla finestra dell'arte (con il bleed b).
function drawOverlay(ctx, state, overlay, b) {
  const r = coverRect(overlay.width, overlay.height, artWindow(templateById(state.template).zones.art, b), state.overlayPos);
  ctx.drawImage(overlay, r.x, r.y, r.w, r.h);
}

// skip = i campi da non disegnare (nell'editor: quello che si sta scrivendo sulla carta e la riga del tipo, che lì è a
// tendine); editor = il pennello del credito c'è anche a campo vuoto, per dire cosa va lì. L'editor non passa overlay:
// lo disegna renderOverlay, sul canvas sopra i campi.
export function renderToken(ctx, state, { scale, b = 0, art, overlay, frame = [], symbols: syms, skip = new Set(), editor = false }) {
  const { zones } = templateById(state.template);
  ctx.save();
  placeCard(ctx, scale, b);
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(-b, -b, 630 + 2 * b, 880 + 2 * b);
  const a = artWindow(zones.art, b);
  if (art) {
    const r = coverRect(art.width, art.height, a, state.pos);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    ctx.drawImage(art, r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  for (const l of frame) { // livelli della cornice, ognuno dov'è nel disegno (con il suo bleed)
    ctx.save();
    if (l.img) {
      l.bleed?.(ctx, b); // prima il suo seguito fuori dalla carta
      if (l.flipY) { ctx.translate(0, 2 * l.y + l.h); ctx.scale(1, -1); } // capovolto sul posto, come nel Figma
      ctx.drawImage(l.img, l.x, l.y, l.w, l.h);
    } else { // rettangolo arrotondato del Figma: riempimento e bordo spesso 1 dentro il suo riquadro, con l'opacità
      ctx.globalAlpha = l.opacity ?? 1;
      ctx.beginPath();
      ctx.roundRect(l.x + 0.5, l.y + 0.5, l.w - 1, l.h - 1, l.r - 0.5);
      if (l.fill) { ctx.fillStyle = l.fill; ctx.fill(); }
      if (l.stroke) { ctx.strokeStyle = l.stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.restore();
  }
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  const draw = (k, v) => v && !skip.has(k);
  if (draw('name', state.name.trim())) drawLine(ctx, zones.name, state.name.trim());
  const st = zones.set;
  const side = Math.min(st.w, st.h);
  drawSetSymbol(ctx, st.x + (st.w - side) / 2, st.y + (st.h - side) / 2, side);
  const type = typeLine(state.types, state.subtypes);
  if (draw('type', type)) drawLine(ctx, zones.type, type);
  if (zones.text && draw('rules', state.rules.trim())) { ctx.fillStyle = '#f1eefc'; drawRules(ctx, zones.text, state.rules.trim(), syms); }
  ctx.fillStyle = '#ffffff';
  if (draw('pt', ptText(state))) drawPT(ctx, zones.pt, state);
  const z = zones.credit;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  if (state.credit.trim() || editor) drawBrush(ctx, z.x, z.y + (z.h - z.icon) / 2, z.icon);
  if (draw('credit', state.credit.trim())) drawLine(ctx, z, state.credit.trim(), { dx: z.dx });
  if (overlay) drawOverlay(ctx, state, overlay, b);
  ctx.restore();
}

// Editor: sul canvas sopra i campi della carta (che sono HTML) l'overlay, che li copre come copre i testi nel PNG, e
// sopra tutto il contorno rosso del bordo vero della carta, spesso trim unità.
export function renderOverlay(ctx, state, { scale, b, overlay, trim }) {
  ctx.save();
  placeCard(ctx, scale, b);
  if (overlay) drawOverlay(ctx, state, overlay, b);
  ctx.strokeStyle = '#ff3b3b';
  ctx.lineWidth = trim;
  ctx.strokeRect(0, 0, 630, 880);
  ctx.restore();
}

// Tutto quello che serve a disegnare: cornice e simboli (in cache dopo la prima volta) e font.
export async function prepare(state) {
  const [frame, syms] = await Promise.all([
    loadFrame(templateById(state.template), state.colors, ptBox(state)),
    loadSymbols(parseRules(state.rules)),
    ensureFonts(),
  ]);
  return { frame, symbols: syms };
}

// Il PNG da stampare a 600 DPI, con il bleed dentro (in Print è "Bleed in art": riempie la cella così com'è): 63x88 mm
// più bleedMm per lato, 1488x2079 senza bleed. Chiamato come il token.
export async function renderTokenFile(state, { art, overlay, bleedMm }) {
  const b = bleedMm * 10;
  const parts = await prepare(state);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((630 + 2 * b) * PX_PER_UNIT);
  canvas.height = Math.round((880 + 2 * b) * PX_PER_UNIT);
  renderToken(canvas.getContext('2d'), state, { scale: PX_PER_UNIT, b, art, overlay, ...parts });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
  return new File([blob], tokenFileName(state.name), { type: 'image/png' });
}
