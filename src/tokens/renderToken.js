import { frameColors, TOKEN_COLORS, coverRect, parseRules, fitSize, ellipsize, layoutRules, tokenFileName } from './tokenModel.js';
import { templateById } from './templates.js';
import { symUrl } from '../utils/manaSymbols.js';

// Disegno del token su un canvas, lo stesso per l'anteprima e per il PNG a 600 DPI: livelli dal basso, fondo, arte
// (nella finestra della cornice, coverRect di state.pos), cornice SVG, testi. scale = pixel per unità (630 di larghezza).
// state = { template, colors, name, type, rules, power, toughness, credit, pos: { x, y, zoom } }.

export const EXPORT_W = 1488; // 63 mm a 600 DPI
export const EXPORT_H = Math.round(EXPORT_W * 880 / 630);

const FAMILY = { display: '"Chakra Petch"', body: '"Space Grotesk"', mono: '"JetBrains Mono"' };
const fontOf = (z, size) => `${z.weight} ${size}px ${FAMILY[z.font]}`;

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

export const hasPt = (s) => !!(s.power.trim() || s.toughness.trim());

// Cornice colorata come immagine (URL blob dell'SVG, stessa origine: il canvas resta esportabile), una per combinazione.
const frames = new Map();
export function loadFrame(template, colors, pt) {
  const key = `${template.id}|${colors.join('')}|${pt}`;
  if (!frames.has(key)) {
    const url = URL.createObjectURL(new Blob([template.svg(frameColors(colors), { pt })], { type: 'image/svg+xml' }));
    frames.set(key, loadImage(url).catch((e) => { frames.delete(key); throw e; }));
  }
  return frames.get(key);
}

// Simboli di Scryfall ({T}, {G}): quelli che non si caricano (offline) mancano dalla mappa e si scrivono come testo.
const symbols = new Map();
export async function loadSymbols(runs) {
  const codes = [...new Set(runs.filter((r) => r.t === 'sym').map((r) => r.v))];
  const out = new Map();
  await Promise.all(codes.map(async (v) => {
    if (!symbols.has(v)) symbols.set(v, loadImage(symUrl(v), true).catch(() => { symbols.delete(v); return null; }));
    const img = await symbols.get(v);
    if (img) out.set(v, img);
  }));
  return out;
}

// Una riga di testo nel suo riquadro: rimpicciolisce fino al minimo, poi i puntini. align left o center.
function drawLine(ctx, z, text, { dx = 0, align = 'left' } = {}) {
  const w = z.w - 2 * (z.pad || 0) - dx;
  const measure = (t, s) => { ctx.font = fontOf(z, s); return ctx.measureText(t).width; };
  const size = fitSize(measure, text, w, z.size, z.min);
  const t = ellipsize(measure, text, w, size);
  ctx.font = fontOf(z, size);
  ctx.textAlign = align;
  const x = align === 'center' ? z.x + z.w / 2 : z.x + (z.pad || 0) + dx;
  ctx.fillText(t, x, z.y + z.h / 2 + size * 0.36);
  ctx.textAlign = 'left';
}

// Pallino del colore: uno spicchio per colore scelto, bordo scuro e anello chiaro.
function drawIndicator(ctx, { x, y, r }, colors) {
  const step = (Math.PI * 2) / colors.length;
  colors.forEach((c, i) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step);
    ctx.closePath();
    ctx.fillStyle = TOKEN_COLORS[c].main;
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0b0b14';
  ctx.stroke();
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

export function renderToken(ctx, state, { scale, art, frame, symbols: syms }) {
  const { zones } = templateById(state.template);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 0, 630, 880);
  if (art) {
    const a = zones.art;
    const r = coverRect(art.width, art.height, a, state.pos);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    ctx.drawImage(art, r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  if (frame) ctx.drawImage(frame, 0, 0, 630, 880);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  if (state.name.trim()) drawLine(ctx, zones.name, state.name.trim());
  const ind = state.colors.length > 0;
  if (ind) drawIndicator(ctx, zones.indicator, state.colors);
  ctx.fillStyle = '#ffffff';
  if (state.type.trim()) drawLine(ctx, zones.type, state.type.trim(), { dx: ind ? zones.indicator.r * 2 + 10 : 0 });
  if (zones.text && state.rules.trim()) { ctx.fillStyle = '#f1eefc'; drawRules(ctx, zones.text, state.rules.trim(), syms); }
  ctx.fillStyle = '#ffffff';
  if (hasPt(state)) drawLine(ctx, zones.pt, `${state.power.trim()}/${state.toughness.trim()}`, { align: 'center' });
  if (state.credit.trim()) { ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; drawLine(ctx, zones.credit, state.credit.trim()); }
  ctx.restore();
}

// Tutto quello che serve a disegnare: cornice e simboli (in cache dopo la prima volta) e font.
export async function prepare(state) {
  const [frame, syms] = await Promise.all([
    loadFrame(templateById(state.template), state.colors, hasPt(state)),
    loadSymbols(parseRules(state.rules)),
    ensureFonts(),
  ]);
  return { frame, symbols: syms };
}

// Il PNG da stampare: 1488x2079 (63x88 mm a 600 DPI), chiamato come il token.
export async function renderTokenFile(state, art) {
  const parts = await prepare(state);
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  renderToken(canvas.getContext('2d'), state, { scale: EXPORT_W / 630, art, ...parts });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
  return new File([blob], tokenFileName(state.name), { type: 'image/png' });
}
