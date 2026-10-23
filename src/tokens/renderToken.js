import { frameColors, TOKEN_COLORS, coverRect, parseRules, fitSize, ellipsize, layoutRules, tokenFileName, typeLine, isCreature, artWindow } from './tokenModel.js';
import { templateById, zonesOf } from './templates.js';
import { symUrl } from '../utils/manaSymbols.js';
import { WORDMARK_X_CORE, WORDMARK_X_V } from '../components/wordmarkPaths.js';

// Disegno del token su un canvas, lo stesso per l'anteprima e per il PNG a 600 DPI: livelli dal basso, fondo, arte
// (nella finestra della cornice, coverRect di state.pos), cornice SVG, testi, overlay (l'immagine scontornata, sopra
// cornice e testi e non tagliata dalla finestra, coverRect di state.overlayPos). scale = pixel per unità (630 = la
// larghezza della carta); b = bleed in unità attorno alla carta (1 mm = 10): il disegno continua fuori, le zone restano
// dove sono.
// state = { template, colors, name, types, subtypes, rules, power, toughness, credit, pos, overlayPos, sync, target }.

export const PX_PER_UNIT = 1488 / 630; // 63 mm a 600 DPI

const FAMILY = { display: '"Chakra Petch"', body: '"Space Grotesk"', mono: '"JetBrains Mono"' };
export const fontOf = (z, size) => `${z.weight} ${size}px ${FAMILY[z.font]}`;
// Spazio del pennello davanti al credito dell'immagine, in unità della carta (l'editor ci lascia lo stesso margine).
export const CREDIT_ICON = 30;
// Simbolo dell'edizione a destra della riga del tipo: lato del quadrato e spazio che il tipo gli lascia, in unità.
export const SET_ICON = 34;
export const SET_GAP = 10;
// Spazio prima del tipo: il pallino dei colori (se ce ne sono) o il punto fisso della cornice (Glitch); dopo, quello del
// simbolo dell'edizione, se la cornice non lo mette altrove (Glitch: nel tondo in alto a destra).
export const typeIndent = (zones, colors) => { const d = zones.dot || (colors.length > 0 && zones.indicator); return d ? d.r * 2 + 10 : 0; };
export const typeRight = (zones) => (zones.set ? 0 : SET_ICON + SET_GAP);
// Colori nella pillola della cornice Glitch: i simboli di Scryfall in ordine WUBRG, {C} senza colori.
const pipColors = (colors) => { const l = ['W', 'U', 'B', 'R', 'G'].filter((c) => colors.includes(c)); return l.length ? l : ['C']; };

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

// Cornice colorata come immagine (URL blob dell'SVG, stessa origine: il canvas resta esportabile), una per combinazione.
const frames = new Map();
export function loadFrame(template, colors, pt, b) {
  const key = `${template.id}|${colors.join('')}|${pt}|${b}`;
  if (!frames.has(key)) {
    const url = URL.createObjectURL(new Blob([template.svg(frameColors(colors), { pt, b, n: colors.length })], { type: 'image/svg+xml' }));
    frames.set(key, loadImage(url).catch((e) => { frames.delete(key); throw e; }));
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

// Una riga di testo nel suo riquadro: rimpicciolisce fino al minimo, poi i puntini. align left o center; z.upper = in
// maiuscolo; tail = la fine della riga, in z.subColor se la riga ci sta intera (i sottotipi di Glitch).
function drawLine(ctx, z, text, { dx = 0, dr = 0, align = 'left', tail = '' } = {}) {
  const up = (s) => (z.upper ? s.toUpperCase() : s);
  const full = up(text + tail);
  const w = z.w - 2 * (z.pad || 0) - dx - dr;
  const measure = (t, s) => { ctx.font = fontOf(z, s); return ctx.measureText(t).width; };
  const size = fitSize(measure, full, w, z.size, z.min);
  const t = ellipsize(measure, full, w, size);
  ctx.font = fontOf(z, size);
  ctx.textAlign = align;
  const x = align === 'center' ? z.x + z.w / 2 : z.x + (z.pad || 0) + dx;
  const y = z.y + z.h / 2 + size * 0.36;
  if (tail && t === full) {
    const head = up(text);
    ctx.fillText(head, x, y);
    const color = ctx.fillStyle;
    ctx.fillStyle = z.subColor;
    ctx.fillText(up(tail), x + ctx.measureText(head).width, y);
    ctx.fillStyle = color;
  } else ctx.fillText(t, x, y);
  ctx.textAlign = 'left';
}

function drawPips(ctx, p, colors, syms) {
  pipColors(colors).forEach((c, i) => {
    const img = syms.get(c);
    if (img) ctx.drawImage(img, p.x + p.pad + i * p.step, p.y + (p.h - p.size) / 2, p.size, p.size);
  });
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

// L'overlay dove lo mette state.overlayPos, a partire dalla finestra dell'arte (con il bleed b).
function drawOverlay(ctx, state, overlay, b) {
  const r = coverRect(overlay.width, overlay.height, artWindow(templateById(state.template).zones.art, b), state.overlayPos);
  ctx.drawImage(overlay, r.x, r.y, r.w, r.h);
}

// skip = i campi da non disegnare (nell'editor: quello che si sta scrivendo sulla carta e la riga del tipo, che lì è a
// tendine); editor = il pennello del credito c'è anche a campo vuoto, per dire cosa va lì. L'editor non passa overlay:
// lo disegna renderOverlay, sul canvas sopra i campi.
export function renderToken(ctx, state, { scale, b = 0, art, overlay, frame, symbols: syms, skip = new Set(), editor = false }) {
  ctx.save(); // anche il font delle misure di zonesOf resta qui dentro
  const zones = zonesOf(templateById(state.template), state.rules, (z) => (t, s) => { ctx.font = fontOf(z, s); return ctx.measureText(t).width; });
  ctx.setTransform(scale, 0, 0, scale, b * scale, b * scale);
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
  if (frame) ctx.drawImage(frame, -b, -b, 630 + 2 * b, 880 + 2 * b);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  const draw = (k, v) => v && !skip.has(k);
  if (draw('name', state.name.trim())) drawLine(ctx, zones.name, state.name.trim());
  if (zones.indicator && state.colors.length) drawIndicator(ctx, zones.indicator, state.colors);
  if (zones.pips) drawPips(ctx, zones.pips, state.colors, syms);
  const type = typeLine(state.types, state.subtypes);
  const tz = zones.type;
  const st = zones.set;
  if (st) drawSetSymbol(ctx, st.x - st.s / 2, st.y - st.s / 2, st.s);
  else drawSetSymbol(ctx, tz.x + tz.w - tz.pad - SET_ICON, tz.y + (tz.h - SET_ICON) / 2, SET_ICON);
  const tail = tz.subColor ? state.subtypes.join(' ') : ''; // la riga del tipo finisce con i sottotipi
  ctx.fillStyle = tz.color || '#ffffff';
  if (draw('type', type)) drawLine(ctx, tz, type.slice(0, type.length - tail.length), { dx: typeIndent(zones, state.colors), dr: typeRight(zones), tail });
  if (zones.text && draw('rules', state.rules.trim())) { ctx.fillStyle = '#f1eefc'; drawRules(ctx, zones.text, state.rules.trim(), syms); }
  ctx.fillStyle = '#ffffff';
  if (draw('pt', ptText(state))) drawLine(ctx, zones.pt, ptText(state), { align: 'center' });
  const z = zones.credit;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  if (state.credit.trim() || editor) drawBrush(ctx, z.x, z.y + z.h * 0.1, z.h * 0.8);
  if (draw('credit', state.credit.trim())) drawLine(ctx, z, state.credit.trim(), { dx: CREDIT_ICON });
  if (overlay) drawOverlay(ctx, state, overlay, b);
  ctx.restore();
}

// Editor: sul canvas sopra i campi della carta (che sono HTML) l'overlay, che li copre come copre i testi nel PNG, e
// sopra tutto il contorno rosso del bordo vero della carta, spesso trim unità.
export function renderOverlay(ctx, state, { scale, b, overlay, trim }) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, b * scale, b * scale);
  if (overlay) drawOverlay(ctx, state, overlay, b);
  ctx.strokeStyle = '#ff3b3b';
  ctx.lineWidth = trim;
  ctx.strokeRect(0, 0, 630, 880);
  ctx.restore();
}

// Tutto quello che serve a disegnare: cornice e simboli (in cache dopo la prima volta) e font.
export async function prepare(state, b) {
  const t = templateById(state.template);
  const pips = t.zones.pips ? pipColors(state.colors).map((v) => ({ t: 'sym', v })) : [];
  const [frame, syms] = await Promise.all([
    loadFrame(t, state.colors, ptBox(state), b),
    loadSymbols([...parseRules(state.rules), ...pips]),
    ensureFonts(),
  ]);
  return { frame, symbols: syms };
}

// Il PNG da stampare a 600 DPI, con il bleed dentro (in Print è "Bleed in art": riempie la cella così com'è): 63x88 mm
// più bleedMm per lato, 1488x2079 senza bleed. Chiamato come il token.
export async function renderTokenFile(state, { art, overlay, bleedMm }) {
  const b = bleedMm * 10;
  const parts = await prepare(state, b);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((630 + 2 * b) * PX_PER_UNIT);
  canvas.height = Math.round((880 + 2 * b) * PX_PER_UNIT);
  renderToken(canvas.getContext('2d'), state, { scale: PX_PER_UNIT, b, art, overlay, ...parts });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'));
  return new File([blob], tokenFileName(state.name), { type: 'image/png' });
}
