// Cornici dei token, originali nello stile di Proxodon (niente cornici ufficiali di Magic). Ogni cornice = un SVG
// 630x880 che prende i colori del token (c = TOKEN_COLORS[...]: main, light, dark) e le sue zone, nelle stesse unità:
// art = la finestra dell'immagine, name / type / text / pt / credit = i riquadri dei testi (con corpo massimo e minimo,
// font: display Chakra Petch, body Space Grotesk, mono JetBrains Mono), indicator = il pallino del colore accanto al
// tipo. b = bleed in unità: il disegno continua fuori dalla carta (fondo e sfumature), le zone restano dove sono.
// Le cornici dell'utente (da Figma) seguiranno lo stesso schema.
import { layoutRules, parseRules } from './tokenModel.js';
import { cutShape } from '../decks/cutShape.js';

// Due angoli tagliati, in alto a sinistra e in basso a destra, come i pannelli dell'app.
const cut = ({ x, y, w, h }, k = 14) =>
  `${x + k},${y} ${x + w},${y} ${x + w},${y + h - k} ${x + w - k},${y + h} ${x},${y + h} ${x},${y + k}`;

const NAME = { x: 34, y: 34, w: 562, h: 64, pad: 20, size: 40, min: 24, font: 'display', weight: 700 };
// Corpi in unità (0.1 mm): 1 punto tipografico = 3.5 unità; i campi sotto il nome sono 1 pt più piccoli di prima.
const PT1 = 3.5;
const BAR = { x: 34, w: 562, h: 54, pad: 20, size: 30 - PT1, min: 18 - PT1, font: 'display', weight: 600 };
const BODY = { pad: 18, size: 30 - PT1, min: 16 - PT1, font: 'body', weight: 400, lineH: 1.28 };
const PT = { size: 40 - PT1, min: 26 - PT1, font: 'display', weight: 700 };
const CREDIT = { x: 44, w: 410, h: 26, size: 18 - PT1, min: 12 - PT1, font: 'mono', weight: 500 };

function frame(c, pt, z, full, b) {
  const a = z.art;
  const bar = (r) => `<polygon points="${cut(r)}" fill="#12101c" fill-opacity="${full ? 0.72 : 0.92}" stroke="${c.main}" stroke-width="3"/>`;
  const border = cut({ x: 10, y: 10, w: 610, h: 860 }, 22);
  // Fondo della cornice (fuori dalla finestra dell'arte): scuro, con una velatura del colore che sfuma in basso.
  const body = `M${-b} ${-b}H${630 + b}V${880 + b}H${-b}Z M${a.x} ${a.y}h${a.w}v${a.h}h-${a.w}Z`;
  // Angoli della finestra dell'arte, tratti chiari da HUD.
  const ticks = [[a.x, a.y, 1, 1], [a.x + a.w, a.y, -1, 1], [a.x, a.y + a.h, 1, -1], [a.x + a.w, a.y + a.h, -1, -1]]
    .map(([x, y, dx, dy]) => `<path d="M${x + 26 * dx} ${y}H${x}V${y + 26 * dy}" fill="none" stroke="${c.light}" stroke-width="3"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-b} ${-b} ${630 + 2 * b} ${880 + 2 * b}" width="${630 + 2 * b}" height="${880 + 2 * b}">`
    + '<defs>'
    + `<linearGradient id="tint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.dark}" stop-opacity=".6"/><stop offset="1" stop-color="#0b0b14" stop-opacity="0"/></linearGradient>`
    + '<linearGradient id="low" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b14" stop-opacity="0"/><stop offset="1" stop-color="#0b0b14" stop-opacity=".92"/></linearGradient>'
    + '<linearGradient id="high" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b14" stop-opacity=".8"/><stop offset="1" stop-color="#0b0b14" stop-opacity="0"/></linearGradient>'
    + '<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>'
    + '</defs>'
    + (full
      ? `<rect x="${-b}" y="${-b}" width="${630 + 2 * b}" height="${170 + b}" fill="url(#high)"/><rect x="${-b}" y="500" width="${630 + 2 * b}" height="${380 + b}" fill="url(#low)"/>`
      : `<path fill-rule="evenodd" fill="#0b0b14" d="${body}"/><path fill-rule="evenodd" fill="url(#tint)" d="${body}"/>`
        + `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="none" stroke="${c.main}" stroke-width="2"/>${ticks}`)
    + `<polygon points="${border}" fill="none" stroke="${c.light}" stroke-width="8" opacity=".35" filter="url(#glow)"/>`
    + `<polygon points="${border}" fill="none" stroke="${c.main}" stroke-width="3"/>`
    + bar(z.name) + bar(z.type)
    + (z.text ? `<rect x="${z.text.x}" y="${z.text.y}" width="${z.text.w}" height="${z.text.h}" fill="#12101c" fill-opacity="${full ? 0.62 : 0.86}" stroke="${c.main}" stroke-opacity=".55" stroke-width="2"/>` : '')
    + (pt ? `<polygon points="${cut(z.pt, 12)}" fill="${c.dark}" stroke="${c.main}" stroke-width="3"/><polygon points="${cut(z.pt, 12)}" fill="none" stroke="${c.light}" stroke-width="6" opacity=".3" filter="url(#glow)"/>` : '')
    + '</svg>';
}

const template = (id, name, zones, full = false) => ({
  id, name, zones, svg: (c, { pt, b = 0 }) => frame(c, pt, zones, full, b),
});

// Glitch: il riquadro dei mazzi (DeckTile) fatto carta, le sue misure (209 px) per 2.78. L'arte riempie il pannello con
// le tasche (cutShape), velata come nei riquadri: scura in basso, un po' in alto, ombra ai bordi; fuori dal pannello e
// nelle tasche il fondo dell'app, bordo sfumato ciano, viola, magenta come CutFrame. Tasche: in alto a sinistra i colori
// (simboli di Scryfall in una pillola larga quanti sono, n), in alto a destra il simbolo dell'edizione in un tondo, in
// basso a destra F/C in una pillola. Il tipo in alto col punto ciano, maiuscolo, i sottotipi in ciano (come il bracket
// nei riquadri); in basso nome, testo e credito impilati dal fondo (zonesOf). I colori del token non tingono la cornice.
const PANEL = { x: 24, y: 24, w: 582, h: 832, r: 39 };
const DOT = { x: 64, y: 150, r: 7 };
function glitchFrame(n, pt, b) {
  const { x, y, w, h, r } = PANEL;
  const d = cutShape(w, h, r, { tl: [51.5 * n + 36, 72], tr: [89, 89], ...(pt ? { br: [134, 72] } : {}) });
  // Nelle coordinate del pannello (translate): il fondo copre carta e bleed tranne il pannello, tasche comprese.
  const out = `M${-b - x} ${-b - y}H${630 + b - x}V${880 + b - y}H${-b - x}Z`;
  const pill = (px, py, pw) => `<rect x="${px}" y="${py}" width="${pw}" height="61" rx="30.5" fill="#fff" fill-opacity=".06" stroke="#fff" stroke-opacity=".14" stroke-width="2.5"/>`;
  const blur = (id, s) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${w + 200}" height="${h + 200}"><feGaussianBlur stdDeviation="${s}"/></filter>`;
  const ring = (attrs) => `<circle cx="${w - 39}" cy="39" r="38" ${attrs}/>`;
  const dot = (attrs) => `<circle cx="${DOT.x - x}" cy="${DOT.y - y}" r="${DOT.r}" fill="#00E5FF" ${attrs}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-b} ${-b} ${630 + 2 * b} ${880 + 2 * b}" width="${630 + 2 * b}" height="${880 + 2 * b}">`
    + '<defs>'
    + '<linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset=".1" stop-color="#00E5FF"/><stop offset=".5" stop-color="#AB61ED"/><stop offset=".9" stop-color="#FF2E96"/></linearGradient>'
    + '<linearGradient id="low" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#05040a" stop-opacity=".96"/><stop offset=".4" stop-color="#05040a" stop-opacity=".55"/><stop offset=".66" stop-color="#05040a" stop-opacity="0"/></linearGradient>'
    + '<linearGradient id="high" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040a" stop-opacity=".5"/><stop offset=".32" stop-color="#05040a" stop-opacity="0"/></linearGradient>'
    + `<clipPath id="panel"><path d="${d}"/></clipPath>${blur('soft', 14)}${blur('glow', 5)}${blur('halo', 6)}`
    + '</defs>'
    + `<g transform="translate(${x} ${y})">`
    + `<g clip-path="url(#panel)"><rect width="${w}" height="${h}" fill="#07060d" fill-opacity=".2"/><rect width="${w}" height="${h}" fill="url(#low)"/>`
    + `<rect width="${w}" height="${h}" fill="url(#high)"/><path d="${d}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="40" filter="url(#soft)"/></g>`
    + `<path fill-rule="evenodd" fill="#0b0b14" d="${out}${d}"/>`
    + `<path d="${d}" fill="none" stroke="url(#edge)" stroke-width="8" opacity=".35" filter="url(#glow)"/><path d="${d}" fill="none" stroke="url(#edge)" stroke-width="3"/>`
    + pill(0, 0, 51.5 * n + 25)
    + ring('fill="#0d0c16" stroke="#00E5FF" stroke-opacity=".6" stroke-width="2.5"') + ring('fill="none" stroke="#00E5FF" stroke-width="8" opacity=".25" filter="url(#glow)"')
    + (pt ? pill(w - 122, h - 61, 122) : '')
    + dot('filter="url(#halo)"') + dot('')
    + '</g></svg>';
}
// Zone sul pannello: tipo in alto (dopo il punto), nome e testo in fondo (y e h da zonesOf), F/C nella pillola, simbolo
// dell'edizione nel tondo (centro e lato), simboli dei colori nella pillola (passo e margine).
const GLITCH = {
  art: { x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h },
  name: { ...NAME, x: 37, y: 600, w: 536, size: 47, min: 28, upper: true },
  type: { x: 44, y: 128, w: 529, h: 44, pad: 13, size: 25, min: 17, font: 'mono', weight: 500, upper: true, color: 'rgba(255, 255, 255, 0.78)', subColor: '#00E5FF' },
  text: { ...BODY, x: 45, y: 640, w: 528, h: 140, pad: 12 },
  pt: { ...PT, x: 484, y: 795, w: 122, h: 61 },
  credit: { ...CREDIT, x: 57, y: 806, w: 400 },
  dot: DOT,
  set: { x: 567, y: 63, s: 36 },
  pips: { x: 24, y: 24, h: 61, size: 38, step: 51.5, pad: 19 },
};

export const TEMPLATES = [
  template('classic', 'Classic', {
    art: { x: 40, y: 104, w: 550, h: 404 },
    name: NAME,
    type: { ...BAR, y: 512 },
    text: { ...BODY, x: 44, y: 574, w: 542, h: 200 },
    pt: { ...PT, x: 470, y: 778, w: 122, h: 60 },
    credit: { ...CREDIT, y: 812 },
    indicator: { x: 66, y: 539, r: 13 },
  }),
  template('fullart', 'Full art', {
    art: { x: 0, y: 0, w: 630, h: 880 },
    name: NAME,
    type: { ...BAR, y: 596 },
    text: { ...BODY, x: 44, y: 658, w: 542, h: 112, size: 28 - PT1 },
    pt: { ...PT, x: 470, y: 778, w: 122, h: 60 },
    credit: { ...CREDIT, y: 812 },
    indicator: { x: 66, y: 623, r: 13 },
  }, true),
  template('vanilla', 'Vanilla', {
    art: { x: 40, y: 104, w: 550, h: 610 },
    name: NAME,
    type: { ...BAR, y: 720 },
    pt: { ...PT, x: 470, y: 784, w: 122, h: 58 },
    credit: { ...CREDIT, y: 808 },
    indicator: { x: 66, y: 747, r: 13 },
  }),
  { id: 'glitch', name: 'Glitch', zones: GLITCH, stack: { bottom: 780, maxH: 170 }, svg: (c, { pt, b = 0, n = 1 }) => glitchFrame(Math.max(1, n), pt, b) },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

// Zone per lo stato: nella cornice Glitch il testo è alto quanto le sue righe (al massimo stack.maxH dentro i margini) e
// poggia su stack.bottom, il nome subito sopra, come nome e tag in fondo ai riquadri dei mazzi; le altre hanno zone
// fisse. measure(z) = (testo, corpo) => larghezza col font di z. +0.5: margine contro gli arrotondamenti, così
// layoutRules ritrova le stesse righe nel riquadro calcolato.
export function zonesOf(t, rules, measure) {
  if (!t.stack) return t.zones;
  const { text, name } = t.zones;
  const { size, lines } = layoutRules(measure(text), parseRules(rules), { w: text.w - 2 * text.pad, h: t.stack.maxH }, text);
  const h = lines.length * size * text.lineH + 2 * text.pad + 0.5;
  const y = t.stack.bottom - h;
  return { ...t.zones, text: { ...text, y, h }, name: { ...name, y: y - name.h } };
}
