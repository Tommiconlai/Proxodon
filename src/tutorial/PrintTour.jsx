import { useLayoutEffect, useState } from 'react';
import PageSettings from '../components/PageSettings';
import PagePreview from '../components/PagePreview';
import ExportProgress from '../components/ExportProgress';
import { IconSliders } from '../components/MobileLayout';
import { getGridInfo } from '../utils/pdfGenerator';
import {
  IconPlus, IconImage, IconDownload, IconFile, IconList, IconTrash, IconCopy, IconFrame, IconSparkles,
} from '../components/icons';
import Tutorial from './Tutorial';
import { touches } from './control';
import { printImages } from './demo';

// Tutorial della stampa: una coda demo (carte vere da Scryfall, solo in memoria) nella stessa pagina della stampa,
// con impostazioni demo; la coda, le impostazioni e il localStorage dell'utente non si toccano.
const SETTINGS = {
  formatKey: 'A4', bleedMm: 2, bleedStyle: 'auto', dpi: 600, quality: 0.85, cardType: 'mtg', cardW: 63, cardH: 88,
  cropMarks: true, cropStyle: 'lines', sheetUnit: 'mm', sheetW: 210, sheetH: 297, colorMode: 'rgb', renderIntent: 'relative', iccProfileId: 'fogra39',
};
const noop = () => {};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function PrintStage({ apiRef, step, mobile }) {
  const [images, setImages] = useState(() => printImages(step.cards ?? 6));
  const [s, setS] = useState(SETTINGS);
  const [dragOver, setDragOver] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  useLayoutEffect(() => {
    apiRef.current = {
      add: (n) => setImages((l) => [...l, ...printImages(n, l.length)]),
      swap: (a, b) => setImages((l) => { const n = [...l]; [n[a], n[b]] = [n[b], n[a]]; return n; }),
      set: (k, v) => setS((o) => ({ ...o, [k]: v })),
      dragOver: setDragOver,
      addMenu: setAddOpen,
    };
  }, [apiRef]);
  // Ogni setter di PageSettings (setFormatKey, setBleedMm…) cambia solo la copia demo.
  const setters = Object.fromEntries(Object.keys(SETTINGS).map((k) => [`set${cap(k)}`, (v) => setS((o) => ({ ...o, [k]: v }))]));
  const { perPage } = getGridInfo(s.formatKey, s.bleedMm, s.cardW, s.cardH, null);
  const missing = perPage ? (perPage - (images.length % perPage)) % perPage : 0;
  const preview = (
    <PagePreview images={images} formatKey={s.formatKey} bleedMm={s.bleedMm} bleedStyle={s.bleedStyle} dpi={s.dpi}
      cardW={s.cardW} cardH={s.cardH} showCrop={s.cropMarks} cropStyle={s.cropStyle} customSheet={null}
      onRemove={noop} onChangeArt={noop} onToggleBleed={noop} onDuplicate={noop} onMove={noop} onUpscale={noop} upscaling={false}
      isDragActive={dragOver} missing={missing} touch={mobile} onRemoveMany={noop} onBleedMany={noop} />
  );
  if (mobile) {
    return (
      <main className="mobile-body">
        <div className="mobile-cards">
          {preview}
          <div className="cards-toolbar">
            <button type="button" className="ct-nav"><IconSliders /><span>Settings</span></button>
            <div className="ct-cluster">
              <div className="ct-item"><button type="button" className="ct-btn ct-danger"><IconTrash size={20} /></button><span className="ct-lbl">Delete</span></div>
              <div className="ct-item"><button type="button" className="fab"><IconPlus size={26} /></button><span className="ct-lbl">Add</span></div>
              <div className="ct-item"><button type="button" className="ct-btn ct-save"><IconList size={20} /></button><span className="ct-lbl">Save</span></div>
            </div>
            <button type="button" className="ct-nav"><IconFile size={22} /><span>Export</span></button>
          </div>
          {addOpen && (
            <div className="sheet-overlay">
              <div className="sheet">
                <div className="sheet-handle" />
                <button type="button"><IconImage size={18} /> Upload files</button>
                <button type="button"><IconDownload size={18} /> Import from Scryfall</button>
                <button type="button"><IconFile size={18} /> Import from MPCFill</button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }
  return (
    <div className="app-body">
      <aside className="sidebar">
        <div className="sidebar-scroll">
          <PageSettings {...s} {...setters} customSheet={null} uploadedIcc={null} onIccUpload={noop} onIccClear={noop} profileMismatchCount={0} />
        </div>
        <div className="sidebar-section sidebar-export">
          <div className="add-menu-wrap">
            {addOpen && (
              <div className="add-menu">
                <button type="button"><IconImage size={15} /> Upload files</button>
                <button type="button"><IconDownload size={15} /> Import from Scryfall</button>
                <button type="button"><IconFile size={15} /> Import from MPCFill</button>
              </div>
            )}
            <button type="button" className={`btn-add${addOpen ? ' open' : ''}`}><IconPlus size={18} /> Add cards</button>
          </div>
          <ExportProgress loading={false} progress={null} disabled={false} onGenerate={noop} onCancel={noop} />
          <div className="export-row">
            <button type="button" className="btn-secondary btn-save"><IconList size={15} /> Save list</button>
            <button type="button" className="btn-secondary"><IconTrash size={15} /> Delete all</button>
          </div>
        </div>
      </aside>
      <main className="main-content">{preview}</main>
    </div>
  );
}

// Carta n della pagina demo (pulsante della superficie: il click vero seleziona, come nella stampa).
const card = (n) => `.preview-card-hotspot:nth-child(${n + 1}) .card-surface`;
const select = (el) => el.click();
// Pila di immagini sotto il cursore mentre si trascinano i file sul foglio.
const files = () => {
  const d = document.createElement('div');
  d.className = 'tut-files';
  printImages(3, 6).forEach((it) => d.append(Object.assign(document.createElement('img'), { src: it.preview, alt: '' })));
  d.append(Object.assign(document.createElement('span'), { textContent: '3' }));
  return d;
};
const cardImg = (g, n) => {
  const img = document.createElement('img');
  img.className = 'tut-card-img';
  img.src = printImages(9).find((it) => it.id === g.el(`.preview-card-hotspot:nth-child(${n + 1})`)?.dataset.cardId)?.preview || '';
  return img;
};
const MENU_ONE = (name) => ({
  title: name,
  items: [[IconImage, 'Change art'], [IconSparkles, 'Upscale 2× (AI)'], [IconCopy, 'Duplicate'], [IconFrame, 'Bleed: No bleed'], [IconTrash, 'Remove', true]],
});

const SHEET = { target: '.preview-page-wrap', title: 'Your print sheet', text: 'This is a demo sheet with sample cards. What you do in the tutorial never touches your own cards, settings or files.' };

const DESKTOP = [
  SHEET,
  {
    target: '.main-content', cards: 3, title: 'Drop images',
    text: 'Drag card images from your computer anywhere on the sheet: they take the next free cells.',
    play: (g) => g.drag({ x: window.innerWidth - 30, y: window.innerHeight * 0.45 }, '.preview-page-wrap', {
      text: 'Drop images', ghost: files(), over: g.api.dragOver, effect: () => g.api.add(3),
    }),
  },
  {
    target: '.sidebar-export', side: 'right', title: 'Add cards',
    text: 'Add cards opens the same upload, plus import from Scryfall (a card list) and from an MPCFill XML.',
    play: async (g) => {
      await g.click('.btn-add', 'Click', () => g.api.addMenu(true));
      g.spot('.sidebar');
      await g.wait(1800);
    },
  },
  {
    target: '.sidebar-scroll', title: 'Set up the sheet',
    text: 'Sheet and card size, bleed, crop marks, DPI and CMYK. The sheet follows every change.',
    play: async (g) => {
      await g.click('[aria-label="Sheet format"]', 'Sheet size');
      await g.click('.sidebar-scroll .checkbox-row', 'Crop marks', () => g.api.set('cropMarks', false));
      await g.wait(900);
      await g.click('.sidebar-scroll .checkbox-row', 'Crop marks', () => g.api.set('cropMarks', true));
    },
  },
  {
    target: '.preview-page-wrap', title: 'Select cards',
    text: 'Click a card to select or deselect it, Shift+click for a range, Ctrl+A for all. The bar under the sheet acts on the selection, Esc clears it.',
    play: async (g) => {
      await g.click(card(0), 'Click', select);
      await g.click(card(2), 'Click', select);
      await g.wait(1200);
    },
  },
  {
    target: '.preview-stage', title: 'Select an area',
    text: 'Press on an empty spot and drag: every card the box touches joins the selection.',
    play: async (g) => {
      const wrap = g.el('.preview-page-wrap').getBoundingClientRect();
      const end = g.at(card(4), 0.6, 0.6);
      await g.marquee({ x: wrap.left - 24, y: wrap.top + 6 }, end, {
        effect: (r) => g.els('.preview-card-hotspot').filter((h) => touches(r, h)).forEach((h) => h.querySelector('.card-surface').click()),
      });
      await g.wait(1200);
    },
  },
  {
    target: '.preview-page-wrap', title: 'Card options',
    text: 'Right-click a card, or press Shift+F10, for its options: change art, upscale, duplicate, bleed, remove. With several cards selected the menu acts on all of them.',
    play: (g) => g.menu(card(1), MENU_ONE('Counterspell'), { effect: select }),
  },
  {
    target: '.preview-page-wrap', title: 'Swap cards',
    text: 'Drag a card onto another to swap them: the order on the sheet is the print order. From the keyboard, Alt+arrow keys.',
    play: async (g) => {
      await g.drag(card(0), card(4), { text: 'Drag', ghost: cardImg(g, 0), effect: () => g.api.swap(0, 4) });
      await g.wait(900);
    },
  },
  {
    target: '.sidebar-export', title: 'Export',
    text: 'Generate PDF makes the print-ready file. Save list downloads your Scryfall cards as a list you can import again.',
    play: async (g) => {
      await g.move('.btn-generate');
      g.say('Generate PDF');
      await g.wait(1300);
      await g.move('.btn-save');
      g.say('Save list');
      await g.wait(1300);
    },
  },
];

const MOBILE = [
  SHEET,
  {
    target: '.fab', cards: 6, title: 'Add cards',
    text: 'Tap + to upload images or import from Scryfall (a card list) and from an MPCFill XML.',
    play: async (g) => {
      await g.click('.fab', 'Tap', () => g.api.addMenu(true));
      g.spot('.sheet');
      await g.move('.sheet button:nth-of-type(2)');
      await g.wait(1800);
    },
  },
  {
    target: '.preview-page-wrap', title: 'Select cards',
    text: 'Tap a card to select or deselect it. The bar under the sheet acts on the selection.',
    play: async (g) => {
      await g.click(card(0), 'Tap', select);
      await g.click(card(4), 'Tap', select);
      await g.wait(1200);
    },
  },
  {
    target: '.preview-page-wrap', title: 'Card options',
    text: 'Long-press a card for its options: change art, upscale, duplicate, bleed, remove. With several cards selected the menu acts on all of them.',
    play: (g) => g.menu(card(1), MENU_ONE('Counterspell'), { text: 'Long press', hold: true, effect: select }),
  },
  { target: '.cards-toolbar .ct-nav:first-child', title: 'Settings', text: 'Sheet and card size, bleed, crop marks, DPI and CMYK.' },
  { target: '.cards-toolbar .ct-nav:last-child', title: 'Export', text: 'Generate PDF makes the print-ready file. Save, in the middle of the bar, downloads your Scryfall cards as a list you can import again.' },
];

const TOURS = {
  desktop: { label: 'Print', Stage: PrintStage, steps: DESKTOP },
  mobile: { label: 'Print', Stage: PrintStage, steps: MOBILE },
};

export default function PrintTour({ mobile, onClose }) {
  return <Tutorial tour={TOURS[mobile ? 'mobile' : 'desktop']} mobile={mobile} onClose={onClose} />;
}
