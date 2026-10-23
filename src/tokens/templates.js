// Cornici dei token: quelle dell'utente, disegnate in Figma (Vanilla senza testo delle regole, Effect con), originali
// nello stile di Proxodon (niente cornici ufficiali di Magic). Ogni cornice = livelli (layers): gli SVG esportati, ognuno
// nella sua posizione in unità della carta 630x880 (= px del disegno; flipY = capovolto in verticale come nel Figma;
// senza src = un rettangolo arrotondato disegnato qui, raggio r, con fill e/o stroke e la sua opacity; bleed = come il
// livello continua fuori dalla carta; tint = il bordo sfumato che prende i colori del token, borderStops). Poi le zone:
// art = la finestra dell'immagine, name / type / text / pt / credit = i riquadri dei testi (corpo massimo e minimo; font
// display Chakra Petch, body Space Grotesk, mono JetBrains Mono), set = il simbolo dell'edizione, pt.split = forza e
// costituzione in due riquadri.

// Corpi in unità (0.1 mm): 1 punto tipografico = 3.5 unità.
const PT1 = 3.5;
const NAME = { size: 40, min: 24, font: 'display', weight: 700 };
const BAR = { size: 30 - PT1, min: 18 - PT1, font: 'display', weight: 600 };
const BODY = { size: 30 - PT1, min: 16 - PT1, font: 'body', weight: 400, lineH: 1.28 };
const PT = { size: 40 - PT1, min: 26 - PT1, font: 'display', weight: 700 };
const CREDIT = { size: 18 - PT1, min: 12 - PT1, font: 'mono', weight: 500 };

// Vanilla dell'utente (Figma "Proxodon": cornice 68:389, posizioni dei testi e del logo 68:428), unità = px del disegno.
// Livelli dal basso: il velo nero al 60% fuori dal pannello (l'arte riempie la carta; angoli retti, nel Figma erano tondi
// per sbaglio dell'utente), il bordo sfumato del pannello con la tasca in basso a destra, la striscia nera in fondo, le
// barre (il nome in alto, in fondo il tipo unito al riquadro di F/C), il contorno della pillola di F/C (nel Figma un
// rettangolo col bordo). Senza forza e costituzione (69:502, "Vanilla no creature") velo, pannello e barre non hanno la
// tasca e il riquadro di F/C, le barre nemmeno il bordo. pt: true = solo sulle creature, false = solo sugli altri, senza
// = su tutti (frameLayers). I colori del token non la tingono e non c'è il pallino: nel disegno non ci sono.
// Nel bleed (b unità attorno alla carta) i livelli che toccano il bordo continuano (bleed del livello): il velo al 60%
// tutto intorno, il nero della striscia ai lati (dove lei parte da 817) e sotto.
function veilBleed(ctx, b) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.rect(-b, -b, 630 + 2 * b, 880 + 2 * b);
  ctx.rect(0, 0, 630, 880);
  ctx.fill('evenodd');
}
function stripBleed(ctx, b) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-b, 817, b, 63 + b);
  ctx.fillRect(630, 817, b, 63 + b);
  ctx.fillRect(0, 880, 630, b);
}
const VANILLA = [
  { src: new URL('./frames/vanilla/background.svg', import.meta.url).href, x: 0, y: 0, w: 630, h: 880, pt: true, bleed: veilBleed },
  { src: new URL('./frames/vanilla/background-noncreature.svg', import.meta.url).href, x: 0, y: 0, w: 630, h: 880, pt: false, bleed: veilBleed },
  { src: new URL('./frames/vanilla/panel.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 748, pt: true, tint: true },
  { src: new URL('./frames/vanilla/panel-noncreature.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 748, pt: false, tint: true },
  { src: new URL('./frames/vanilla/bottom.svg', import.meta.url).href, x: 0, y: 817, w: 630, h: 63, bleed: stripBleed },
  { src: new URL('./frames/vanilla/bars.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 808, pt: true },
  { src: new URL('./frames/vanilla/bars-noncreature.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 808, pt: false },
  { x: 497, y: 723, w: 113, h: 55, r: 25, stroke: '#5e5e5e', pt: true },
];
// Effect dell'utente, per i token con il testo delle regole (Figma "Proxodon": creatura 75:528 con posizioni 75:602,
// non creatura 75:566 con 75:637). Come la Vanilla, con il riquadro del testo in fondo: velo (angoli retti come chiesto
// dall'utente, nel Figma erano tondi), bordo del pannello, pillola del nome (nel Figma un rettangolo: riempimento, bordo e
// opacità, disegnato qui), la striscia nera della Vanilla, la barra del tipo (sulle creature unita al riquadro di F/C) e il
// riquadro del testo, capovolti come nel Figma (flipY), il contorno della pillola di F/C.
const EFFECT = [
  { src: new URL('./frames/effect/background.svg', import.meta.url).href, x: 0, y: 0, w: 630, h: 880, pt: true, bleed: veilBleed },
  { src: new URL('./frames/effect/background-noncreature.svg', import.meta.url).href, x: 0, y: 0, w: 630, h: 880, pt: false, bleed: veilBleed },
  { src: new URL('./frames/effect/panel.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 658, pt: true, tint: true },
  { src: new URL('./frames/effect/panel-noncreature.svg', import.meta.url).href, x: 20, y: 20, w: 590, h: 658, pt: false, tint: true },
  { x: 20, y: 20, w: 418, h: 64, r: 25, fill: '#17161e', stroke: '#37373d', opacity: 0.8 },
  { src: new URL('./frames/vanilla/bottom.svg', import.meta.url).href, x: 0, y: 817, w: 630, h: 63, bleed: stripBleed },
  { src: new URL('./frames/effect/type-bar.svg', import.meta.url).href, x: 20, y: 633, w: 590, h: 105, flipY: true, pt: true },
  { src: new URL('./frames/effect/type-bar-noncreature.svg', import.meta.url).href, x: 20, y: 688, w: 590, h: 50, flipY: true, pt: false },
  { src: new URL('./frames/effect/text-box.svg', import.meta.url).href, x: 20, y: 748, w: 590, h: 90, flipY: true },
  { x: 497, y: 633, w: 113, h: 55, r: 25, stroke: '#37373d', pt: true },
];

export const TEMPLATES = [
  {
    id: 'vanilla', name: 'Vanilla', layers: VANILLA,
    zones: {
      art: { x: 0, y: 0, w: 630, h: 880 },
      name: { ...NAME, x: 40, y: 26, w: 379, h: 52, pad: 0 },
      type: { ...BAR, x: 40, y: 786, w: 505, h: 34, pad: 0 },
      pt: { ...PT, x: 512, y: 734, w: 84, h: 34, split: { p: 512, t: 563, w: 33 } },
      credit: { ...CREDIT, x: 40, y: 846, w: 191, h: 16, icon: 15, dx: 19 },
      set: { x: 563, y: 786, w: 33, h: 34 },
    },
  },
  {
    id: 'effect', name: 'Effect', layers: EFFECT,
    zones: {
      art: { x: 0, y: 0, w: 630, h: 880 },
      name: { ...NAME, x: 37, y: 26, w: 385, h: 52, pad: 0 },
      type: { ...BAR, x: 37, y: 696, w: 505, h: 34, pad: 0 },
      text: { ...BODY, x: 37, y: 756, w: 556, h: 74, pad: 0 },
      pt: { ...PT, x: 512, y: 644, w: 81, h: 34, split: { p: 512, t: 560, w: 33 } },
      credit: { ...CREDIT, x: 40, y: 846, w: 191, h: 16, icon: 15, dx: 19 },
      set: { x: 560, y: 696, w: 33, h: 34 },
    },
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
