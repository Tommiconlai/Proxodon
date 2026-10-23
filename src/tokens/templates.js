// Cornici dei token, originali nello stile di Proxodon (niente cornici ufficiali di Magic). Ogni cornice = un SVG
// 630x880 che prende i colori del token (c = TOKEN_COLORS[...]: main, light, dark) e le sue zone, nelle stesse unità:
// art = la finestra dell'immagine, name / type / text / pt / credit = i riquadri dei testi (con corpo massimo e minimo,
// font: display Chakra Petch, body Space Grotesk, mono JetBrains Mono), indicator = il pallino del colore accanto al
// tipo. b = bleed in unità: il disegno continua fuori dalla carta (fondo e sfumature), le zone restano dove sono.
// Le cornici dell'utente (da Figma) sono invece livelli: gli SVG esportati, ognuno nella sua posizione (layers; senza
// src = un contorno arrotondato, raggio r, colore stroke, disegnato qui), con set = il simbolo dell'edizione, pt.split =
// forza e costituzione in due riquadri e bleed = come la cornice continua fuori dalla carta.

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

// Vanilla dell'utente (Figma "Proxodon": cornice 68:389, posizioni dei testi e del logo 68:428), unità = px del disegno.
// Livelli dal basso: il velo nero al 60% fuori dal pannello (la carta ha gli angoli tondi, l'arte la riempie), il bordo
// sfumato del pannello con la tasca in basso a destra, la striscia nera in fondo, le barre (il nome in alto, in fondo il
// tipo unito al riquadro di F/C), il contorno della pillola di F/C (nel Figma un rettangolo col bordo). Senza forza e
// costituzione (69:502, "Vanilla no creature") velo, pannello e barre non hanno la tasca e il riquadro di F/C, le barre
// nemmeno il bordo. pt: true = solo sulle creature, false = solo sugli altri, senza = su tutti (frameLayers). I colori
// del token non la tingono e non c'è il pallino: nel disegno non ci sono.
const VANILLA = [
  { src: new URL('./frames/vanilla/background.svg', import.meta.url).href, x: 0, y: 0, w: 630, h: 880, pt: true },
  { src: new URL('./frames/vanilla/background-noncreature.svg', import.meta.url).href, x: 0, y: 0, w: 630, h: 880, pt: false },
  { src: new URL('./frames/vanilla/panel.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 748, pt: true },
  { src: new URL('./frames/vanilla/panel-noncreature.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 748, pt: false },
  { src: new URL('./frames/vanilla/bottom.svg', import.meta.url).href, x: 0, y: 817, w: 630, h: 63 },
  { src: new URL('./frames/vanilla/bars.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 808, pt: true },
  { src: new URL('./frames/vanilla/bars-noncreature.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 808, pt: false },
  { x: 497, y: 723, w: 113, h: 55, r: 25, stroke: '#5e5e5e', pt: true },
];
// Nel bleed (b unità attorno alla carta) la cornice continua: il velo al 60% sull'arte e, accanto e sotto la striscia
// del fondo (che ai lati parte da 817), il nero.
function vanillaBleed(ctx, b) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.rect(-b, -b, 630 + 2 * b, 880 + 2 * b);
  ctx.rect(0, 0, 630, 880);
  ctx.fill('evenodd');
  ctx.fillStyle = '#000000';
  ctx.fillRect(-b, 817, b, 63 + b);
  ctx.fillRect(630, 817, b, 63 + b);
  ctx.fillRect(0, 880, 630, b);
}

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
  {
    id: 'vanilla', name: 'Vanilla', layers: VANILLA, bleed: vanillaBleed,
    zones: {
      art: { x: 0, y: 0, w: 630, h: 880 },
      name: { ...NAME, x: 40, y: 26, w: 379, h: 52, pad: 0 },
      type: { ...BAR, x: 40, y: 786, w: 505, h: 34, pad: 0 },
      pt: { ...PT, x: 512, y: 734, w: 84, h: 34, split: { p: 512, t: 563, w: 33 } },
      credit: { ...CREDIT, x: 40, y: 846, w: 191, h: 16, icon: 15, dx: 19 },
      set: { x: 563, y: 786, w: 33, h: 34 },
    },
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
