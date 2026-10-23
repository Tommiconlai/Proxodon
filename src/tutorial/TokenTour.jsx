import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TokensPage from '../tokens/TokensPage';
import { templateById } from '../tokens/templates';
import { artWindow, clampPos } from '../tokens/tokenModel';
import { NavMenu } from '../components/MobileNav';
import { navItems } from '../components/navItems';
import Tutorial from './Tutorial';
import { pointAt } from './control';
import { Shell } from './AccountStages';
import { C } from './demo';

// Tutorial di Tokens: la pagina vera (TokensPage in modalità demo) con un token demo, un Goblin sull'arte di Krenko, Mob
// Boss (art crop di Scryfall), solo in memoria: il token in lavorazione, il bleed di Print e i file dell'utente non si
// toccano. Ogni passo riparte da GOBLIN cambiato da step.token, con l'arte salvo step.noArt; da telefono step.scroll
// porta la zona del passo a metà schermo (i controlli stanno sotto la carta).
const P0 = { x: 0, y: 0, zoom: 1 };
const GOBLIN = {
  template: 'effect', colors: ['R'], name: 'Goblin', types: ['Token', 'Creature'], subtypes: ['Goblin'], rules: 'Haste\n{T}: Add {R}.',
  power: '1', toughness: '1', credit: 'Lie Setiawan', pos: P0, overlayPos: P0, sync: true, target: 'overlay',
};
const BLANK = { name: '', types: [], subtypes: [], rules: '', power: '', toughness: '', credit: '' };
const BLEED = 2; // mm, come la stampa demo
const noop = () => {};

// L'arte, caricata una volta. Senza crossOrigin: il canvas della demo non si esporta mai.
let artP = null;
const loadArt = () => (artP ??= new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => { artP = null; reject(new Error('Tutorial: token art not loaded')); };
  img.src = C.krenko.art;
}));

function TokenStage({ apiRef, step, mobile }) {
  const [bleedMm, setBleedMm] = useState(BLEED);
  const page = useRef(null); // set e setArt di TokensPage
  const [demo] = useState(() => ({ state: { ...GOBLIN, ...step.token }, apiRef: page }));
  useLayoutEffect(() => {
    apiRef.current = { set: (patch) => page.current.set(patch), art: async () => page.current.setArt(await loadArt()), bleed: setBleedMm };
  }, [apiRef]);
  useEffect(() => {
    let on = true;
    if (!step.noArt) loadArt().then((img) => { if (on) page.current.setArt(img); }, noop);
    // Dopo la prima misura della carta, prima che la scheda del passo si fermi.
    const t = mobile && step.scroll && setTimeout(() => document.querySelector(`.tut-stage ${step.target}`)?.scrollIntoView({ block: 'center' }), 150);
    return () => { on = false; clearTimeout(t); };
  }, [step, mobile]);
  const body = <TokensPage demo={demo} onAdd={noop} notify={noop} mobile={mobile} bleedMm={bleedMm} setBleedMm={setBleedMm} />;
  if (!mobile) return body;
  return (
    <Shell mobile>
      <NavMenu {...navItems('/tokens')} open={false} onItem={noop} onToggle={noop} />
      {body}
    </Shell>
  );
}

const CARD = '.token-card';
const artGhost = () => Object.assign(document.createElement('img'), { src: C.krenko.art, className: 'tut-card-img tut-art' });
const artWin = () => artWindow(templateById(GOBLIN.template).zones.art, BLEED * 10);

// Zoom dallo slider: l'arte si ingrandisce a passi fino a zoom.
async function zoomTo(g, zoom) {
  const img = await loadArt();
  for (let k = 1; k <= 12; k += 1) {
    g.api.set({ pos: clampPos(img.width, img.height, artWin(), { x: 0, y: 0, zoom: 1 + ((zoom - 1) * k) / 12 }) });
    await g.wait(45);
  }
}
// Trascina l'arte (già a zoom, centrata) di [dx, dy] pixel: segue il cursore, dentro i suoi limiti come quella vera.
async function dragArt(g, zoom, [dx, dy], text) {
  const img = await loadArt();
  const k = g.el(CARD).getBoundingClientRect().width / (630 + 2 * BLEED * 10); // pixel per unità della carta
  const a = g.at('.token-canvas', 0.5, 0.35); // dentro la finestra dell'arte
  await g.drag(a, { x: a.x + dx, y: a.y + dy }, {
    text, during: (p) => g.api.set({ pos: clampPos(img.width, img.height, artWin(), { x: (p.x - a.x) / k, y: (p.y - a.y) / k, zoom }) }),
  });
}
// Riga del tipo: il campo di ricerca, poi i tipi uno alla volta (Creature porta forza e costituzione).
async function addTypes(g, text) {
  await g.click('.token-type-search', text);
  for (const patch of [{ types: ['Token'] }, { types: ['Token', 'Creature'] }, { subtypes: ['Goblin'] }]) {
    g.api.set(patch);
    await g.wait(650);
  }
}
async function frameAndColors(g, mobile) {
  await g.click('.token-frame-btn:nth-child(1)', 'Vanilla', () => g.api.set({ template: 'vanilla', pos: P0 }));
  if (mobile) g.spot('.adv-pips');
  await g.click('.adv-pip:nth-child(4)', 'Red', () => g.api.set({ colors: ['R'] }));
  await g.click('.adv-pip:nth-child(5)', 'Green', () => g.api.set({ colors: ['R', 'G'] }));
  if (!mobile) g.spot(CARD); // il risultato, sulla carta
  await g.wait(1500);
}
const overlayAndSync = (g) => pointAt(g, [['.token-overlay-row button:nth-child(1)', 'Overlay'], ['.token-overlay-row button:nth-child(2)', 'Sync']]);
const printIt = (g) => pointAt(g, [['.token-primary', 'Add to Print'], ['[aria-label="Download PNG"]', 'Download']]);

const INTRO = {
  target: CARD, title: 'A demo token',
  text: 'This is a demo token. What you do in the tutorial never touches the token you are making, your settings or your files.',
};
const OVERLAY = 'Overlay puts a second image over the frame and the text: a cut-out PNG with a transparent background, so the subject can step out of the art window. Sync moves and zooms it with the image; with Sync off you pick which one to move.';
const BLEED_TEXT = 'The same bleed as in Print, up to 3 mm: the image runs past the thin red line, the real edge of the card. In Print the token goes in as Bleed in art.';

const DESKTOP = [
  INTRO,
  {
    target: CARD, noArt: true, title: 'Add an image',
    text: 'Drop an image from your computer on the card, or paste one with Ctrl+V: Copy image on any website works too. A click on the empty art window opens the file picker.',
    play: (g) => g.drag({ x: window.innerWidth - 30, y: window.innerHeight * 0.4 }, CARD, { text: 'Drop an image', ghost: artGhost(), effect: g.api.art }),
  },
  {
    target: CARD, title: 'Move and zoom',
    text: 'Zoom with the mouse wheel or the Zoom slider, then drag the image to place it. From the keyboard, arrow keys move it and + − zoom.',
    play: async (g) => {
      await g.click('.token-zoom input', 'Zoom');
      await zoomTo(g, 1.8);
      await dragArt(g, 1.8, [-120, 70], 'Drag');
    },
  },
  {
    target: '.tokens-body .sidebar-scroll', token: { colors: [] }, title: 'Frame and colors',
    text: 'Pick a frame: Vanilla for tokens without rules text, Effect for the ones with it. Then the colors: the border around the art takes them, none keeps the Proxodon gradient.',
    play: (g) => frameAndColors(g, false),
  },
  {
    target: CARD, token: BLANK, title: 'Write on the card',
    text: 'Click a field right on the card and write. In the type line, type to search the card types and the subtypes of the ones you picked: Enter adds one, a chip changes or removes it. Creatures get power and toughness.',
    play: async (g) => {
      await g.type('.token-zone input[aria-label="Name"]', GOBLIN.name, (v) => g.api.set({ name: v }));
      await addTypes(g, 'Type to search');
    },
  },
  {
    target: CARD, token: { rules: '', power: '', toughness: '', credit: '' }, title: 'Rules, power, credit',
    text: 'In the rules text {T}, {R} and the other mana symbols become icons as you type. Then power and toughness, and the artist on the credit line, next to the brush.',
    play: async (g) => {
      await g.type('.token-zone textarea', GOBLIN.rules, (v) => g.api.set({ rules: v }));
      await g.type('[aria-label="Power"]', '1', (v) => g.api.set({ power: v }));
      await g.type('[aria-label="Toughness"]', '1', (v) => g.api.set({ toughness: v }));
      await g.type('[aria-label="Image credit"]', GOBLIN.credit, (v) => g.api.set({ credit: v }));
      await g.wait(900);
    },
  },
  {
    target: '.token-bleed', title: 'Bleed', text: BLEED_TEXT,
    play: async (g) => {
      await g.click('.token-bleed input', 'Bleed', () => g.api.bleed(3));
      g.spot(CARD);
      await g.wait(1800);
    },
  },
  { target: '.token-overlay-row', title: 'Overlay', text: OVERLAY, play: overlayAndSync },
  {
    target: '.tokens-body .sidebar-export', title: 'Print it',
    text: 'Add to Print puts the token in the print queue, Download saves the PNG. New starts over, the other three upload, reset and remove the image. The token is not saved: it stays here until you close the tab.',
    play: printIt,
  },
];

const MOBILE = [
  INTRO,
  {
    target: CARD, noArt: true, title: 'Add an image',
    text: 'Tap the empty art window, or Upload under the card, and pick an image from your phone.',
    play: (g) => g.click('.token-art-pick', 'Tap', g.api.art),
  },
  {
    target: CARD, token: { pos: { ...P0, zoom: 1.8 } }, title: 'Move and zoom',
    text: 'Drag the image with a finger to move it, pinch with two fingers to zoom. The Zoom slider is further down.',
    play: (g) => dragArt(g, 1.8, [-70, 45], 'Drag'),
  },
  {
    target: CARD, token: BLANK, title: 'Write on the card',
    text: 'Tap a field right on the card and write: name, type line, rules text, power and toughness, credit. In the type line, type to search types and subtypes.',
    play: async (g) => {
      await g.type('.token-zone input[aria-label="Name"]', GOBLIN.name, (v) => g.api.set({ name: v }));
      await addTypes(g, 'Tap');
    },
  },
  {
    target: '.token-frames', scroll: true, token: { colors: [] }, title: 'Frame and colors',
    text: 'Under the buttons: pick a frame, Vanilla without rules text or Effect with it, then the colors. The border around the art takes them, none keeps the Proxodon gradient.',
    play: (g) => frameAndColors(g, true),
  },
  { target: '.token-bleed', scroll: true, title: 'Bleed', text: BLEED_TEXT, play: (g) => g.click('.token-bleed input', 'Tap', () => g.api.bleed(3)) },
  { target: '.token-overlay-row', scroll: true, title: 'Overlay', text: OVERLAY, play: overlayAndSync },
  {
    target: '.tokens-mobile > .token-actions', scroll: true, title: 'Print it',
    text: 'Add to Print, the first button, puts the token in the print queue; Download saves the PNG. The token is not saved: it stays until you close the tab.',
    play: printIt,
  },
];

const TOURS = {
  desktop: { label: 'Tokens', Stage: TokenStage, steps: DESKTOP },
  mobile: { label: 'Tokens', Stage: TokenStage, steps: MOBILE },
};

export default function TokenTour({ mobile, onClose }) {
  return <Tutorial tour={TOURS[mobile ? 'mobile' : 'desktop']} mobile={mobile} onClose={onClose} />;
}
