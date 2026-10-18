/* ============================================================
   ICONS. Lucide-style, stroke = currentColor (themeable)
   ============================================================ */

function Svg({ size = 18, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// Wordmark "PROXODON", logo definitivo dal Figma "Proxoteca" (file M8c1qKltd3Wxh3Ii42zn0v, nodo 41:104):
// tracciati copiati tali e quali (non ridisegnati), inline e non <img> perché le V si animano. Lettere
// piene ciano ad angoli arrotondati; la X è il marchio in 3 parti: centro ciano (due chevron fusi) e V
// magenta sopra/sotto (tratto 3 tondo). viewBox del design 132x31; centro della X (57.5, 15.75).
const WORDMARK_LETTERS = [
  'M8.7538 18.9802H5.53901C4.98672 18.9802 4.53901 18.5325 4.53901 17.9802V16.8802C4.53901 16.3279 4.98672 15.8802 5.53901 15.8802H8.81459C9.76697 15.8802 10.4762 15.2002 10.4762 14.2202C10.4762 13.2002 9.76697 12.5402 8.81459 12.5402H4.52583C3.97355 12.5402 3.52583 12.9879 3.52583 13.5402V21.2002C3.52583 21.7525 3.07812 22.2002 2.52583 22.2002H1C0.447716 22.2002 0 21.7525 0 21.2002V10.2002C0 9.64791 0.447715 9.2002 1 9.2002H8.7538C11.8136 9.2002 14.002 11.1802 14.002 14.1002C14.002 17.0002 11.8136 18.9802 8.7538 18.9802Z',
  'M29.2246 20.5439C29.7876 21.191 29.3279 22.2002 28.4701 22.2002H26.5267C26.2226 22.2002 25.935 22.0618 25.7452 21.8241L23.7115 19.2763C23.5217 19.0386 23.2341 18.9002 22.9299 18.9002H21.2906C20.7384 18.9002 20.2906 18.4525 20.2906 17.9002V16.8602C20.2906 16.3079 20.7384 15.8602 21.2906 15.8602H24.8297C25.8023 15.8602 26.4913 15.2002 26.4913 14.2002C26.4913 13.2002 25.8023 12.5402 24.8297 12.5402H20.2775C19.7252 12.5402 19.2775 12.9879 19.2775 13.5402V21.2002C19.2775 21.7525 18.8298 22.2002 18.2775 22.2002H16.7516C16.1994 22.2002 15.7516 21.7525 15.7516 21.2002V10.2002C15.7516 9.64791 16.1994 9.2002 16.7516 9.2002H24.8297C27.8489 9.2002 30.0374 11.1602 30.0374 14.0602C30.0374 16.0402 28.9837 17.6002 27.3423 18.3802L29.2246 20.5439Z',
  'M38.0822 18.8402H40.4733C42.3173 18.8402 43.6547 17.5602 43.6547 15.7002C43.6547 13.8202 42.3173 12.5402 40.4733 12.5402H38.0822C36.2383 12.5402 34.8806 13.8202 34.8806 15.7002C34.8806 17.5602 36.218 18.8402 38.0822 18.8402ZM40.2302 22.2002H38.3254C34.293 22.2002 31.3548 19.5802 31.3548 15.7002C31.3548 11.8202 34.293 9.2002 38.3254 9.2002H40.2302C44.2423 9.2002 47.1805 11.8202 47.1805 15.7002C47.1805 19.5802 44.2423 22.2002 40.2302 22.2002Z',
  'M73.64 18.64H76C77.82 18.64 79.14 17.36 79.14 15.5C79.14 13.62 77.82 12.34 76 12.34H73.64C71.82 12.34 70.48 13.62 70.48 15.5C70.48 17.36 71.8 18.64 73.64 18.64ZM75.76 22H73.88C69.9 22 67 19.38 67 15.5C67 11.62 69.9 9 73.88 9H75.76C79.72 9 82.62 11.62 82.62 15.5C82.62 19.38 79.72 22 75.76 22Z',
  'M91.8727 22H85.3927C84.8404 22 84.3927 21.5523 84.3927 21V10C84.3927 9.44772 84.8404 9 85.3927 9H91.8727C95.8327 9 98.7327 11.62 98.7327 15.5C98.7327 19.38 95.8327 22 91.8727 22ZM87.8927 17.64C87.8927 18.1923 88.3404 18.64 88.8927 18.64H92.1127C93.9327 18.64 95.2327 17.36 95.2327 15.5C95.2327 13.62 93.9327 12.34 92.1127 12.34H88.8927C88.3404 12.34 87.8927 12.7877 87.8927 13.34V17.64Z',
  'M106.745 18.64H109.105C110.925 18.64 112.245 17.36 112.245 15.5C112.245 13.62 110.925 12.34 109.105 12.34H106.745C104.925 12.34 103.585 13.62 103.585 15.5C103.585 17.36 104.905 18.64 106.745 18.64ZM108.865 22H106.985C103.005 22 100.105 19.38 100.105 15.5C100.105 11.62 103.005 9 106.985 9H108.865C112.825 9 115.725 11.62 115.725 15.5C115.725 19.38 112.825 22 108.865 22Z',
  'M130.298 22H129.598C128.658 22 128.278 21.66 127.598 20.9L122.632 15.5337C122.014 14.866 120.898 15.3032 120.898 16.2129V21C120.898 21.5523 120.45 22 119.898 22H118.498C117.946 22 117.498 21.5523 117.498 21V10.48C117.498 9.5 118.038 9 119.118 9H119.958C121.038 9 121.478 9.3 122.078 9.96L126.485 14.7113C127.103 15.3779 128.218 14.9404 128.218 14.0313V10C128.218 9.44771 128.666 9 129.218 9H130.598C131.15 9 131.598 9.44772 131.598 10V20.66C131.598 21.54 131.158 22 130.298 22Z',
];
const WORDMARK_X_CORE = 'M46.5604 27.8103C45.9746 28.3961 45.0251 28.3961 44.4393 27.8103C43.8536 27.2245 43.8536 26.275 44.4393 25.6892L51.5504 18.5782C53.1125 17.0161 53.1125 14.4834 51.5504 12.9213L49.9393 11.3103C49.3536 10.7245 49.3536 9.77501 49.9393 9.18923C50.5251 8.60344 51.4746 8.60344 52.0604 9.18923L54.6715 11.8003C56.2336 13.3623 58.7662 13.3623 60.3283 11.8003L68.4393 3.68923C69.025 3.10352 69.9746 3.10367 70.5604 3.68923C71.1462 4.27501 71.1462 5.22453 70.5604 5.81032L63.4494 12.9213C61.8873 14.4834 61.8873 17.0161 63.4494 18.5782L65.0604 20.1892C65.6462 20.775 65.6462 21.7245 65.0604 22.3103C64.4746 22.8961 63.5251 22.8961 62.9393 22.3103L60.3283 19.6993C58.7662 18.1372 56.2336 18.1372 54.6715 19.6993L46.5604 27.8103Z';
const WORDMARK_X_V = [
  'M65.9998 2L58.7737 9.50395C57.987 10.3209 56.6792 10.3209 55.8925 9.50395L52.9998 6.5',
  'M48.9998 29.5L56.2258 21.996C57.0125 21.1791 58.3204 21.1791 59.1071 21.996L61.9998 25',
];

// mark = solo la X (telefono): viewBox quadrato 31x31 attorno al suo centro.
export function Wordmark({ height = 30, mark, ...props }) {
  return (
    <svg height={height} width={mark ? height : (height * 132) / 31} viewBox={mark ? '42 0 31 31' : '0 0 132 31'} role="img" aria-label="Proxodon" {...props}>
      {/* .x-v = V sopra/sotto: all'hover ruotano di 180° sull'asse verticale del centro della X (CSS .wordmark). */}
      <g fill="#00e5ff">
        {!mark && WORDMARK_LETTERS.map((d) => <path key={d} d={d} />)}
        <path d={WORDMARK_X_CORE} />
      </g>
      <g fill="none" stroke="#ff2d95" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {WORDMARK_X_V.map((d) => <path key={d} d={d} className="x-v" />)}
      </g>
    </svg>
  );
}

// Chevron sinistro (‹) o doppio (« con `double`) col pezzo del logo: braccio lungo il doppio
// del corto (come gli angoli delle carte selezionate) e vertice arrotondato come le V del marchio.
// È la metà destra del centro della X, lunga verso l'alto; per la destra il CSS lo ruota di 180°
// (= metà sinistra, lunga verso il basso).
export function IconChevron({ double, ...props }) {
  return (
    <Svg {...props}>
      {double
        ? <><path d="M13.5 5.25 6 12.75C5.18 13.57 5.18 14.93 6 15.75L9 18.75" /><path d="M19.5 5.25 12 12.75C11.18 13.57 11.18 14.93 12 15.75L15 18.75" /></>
        : <path d="M16.5 5.25 9 12.75C8.18 13.57 8.18 14.93 9 15.75L12 18.75" />}
    </Svg>
  );
}

export function IconImage(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </Svg>
  );
}

export function IconFile(props) {
  return (
    <Svg {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </Svg>
  );
}

export function IconTrash(props) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </Svg>
  );
}

export function IconAlert(props) {
  return (
    <Svg {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </Svg>
  );
}

export function IconX(props) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

export function IconPlus(props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconDownload(props) {
  return (
    <Svg {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </Svg>
  );
}

// Salva lista: glifo "elenco", distinto dalle frecce-giù di Download/Export (evita
// la collisione "due download" adiacenti nella barra mobile).
export function IconList(props) {
  return (
    <Svg {...props}>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </Svg>
  );
}

export function IconSparkles(props) {
  return (
    <Svg {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </Svg>
  );
}

export function IconCopy(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

// Trim + abbondanza: cornice esterna (cella) e interna (taglio).
export function IconFrame(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </Svg>
  );
}

export function IconLogOut(props) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </Svg>
  );
}

// Divieto: carta bandita o non legale nel formato del mazzo.
export function IconBan(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </Svg>
  );
}

export function IconUser(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </Svg>
  );
}

export function IconInfo(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconPrinter(props) {
  return (
    <Svg {...props}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </Svg>
  );
}

export function IconArrowLeft(props) {
  return (
    <Svg {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Svg>
  );
}

export function IconArrowRight(props) {
  return (
    <Svg {...props}>
      <path d="m12 5 7 7-7 7" />
      <path d="M5 12h14" />
    </Svg>
  );
}

// Occhio: View card (la carta a tutto schermo).
export function IconEye(props) {
  return (
    <Svg {...props}>
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconArrowUp(props) {
  return (
    <Svg {...props}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Svg>
  );
}

// Freccia circolare: ripeti (il gesto del passo nel tutorial).
export function IconReplay(props) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  );
}

// Play (triangolo verso destra): avvia i dilemmi a caso.
export function IconPlay(props) {
  return (
    <Svg {...props}>
      <path d="M6 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 6 4.5Z" />
    </Svg>
  );
}

export function IconCheck(props) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}


// Cartella dei mazzi (My decks).
export function IconFolder(props) {
  return (
    <Svg {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </Svg>
  );
}

// Bilancia: Dilemma (quale delle due carte) nel menu delle carte.
export function IconScale(props) {
  return (
    <Svg {...props}>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </Svg>
  );
}

// Due rami che si uniscono: Apply di una risposta a una help request (i suggerimenti entrano nel mazzo).
export function IconMerge(props) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </Svg>
  );
}

// Salvagente: help request (chiedi aiuto alla community sul mazzo).
export function IconLifebuoy(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 9.17 4.24-4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
      <path d="m9.17 14.83-4.24 4.24" />
    </Svg>
  );
}

// Fulmine: game changer (lista Scryfall dei Commander bracket), sulle carte dei mazzi Commander.
export function IconZap(props) {
  return (
    <Svg {...props}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </Svg>
  );
}

// Chiave inglese: mazzo con una help request aperta (riquadri dei mazzi).
export function IconWrench(props) {
  return (
    <Svg {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  );
}

export function IconTag(props) {
  return (
    <Svg {...props}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </Svg>
  );
}

// Cuore (like): contorno; fill="currentColor" = pieno.

export function IconHeart(props) {
  return (
    <Svg {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  );
}

export function IconFlip(props) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Svg>
  );
}

export function IconGlobe(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </Svg>
  );
}

export function IconFilter(props) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </Svg>
  );
}

export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function IconUpload(props) {
  return (
    <Svg {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </Svg>
  );
}

// Impostazioni: ingranaggio.
export function IconSettings(props) {
  return (
    <Svg {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

// Export del mazzo: scatola aperta con freccia in uscita (distinta da Upload / Restore).
export function IconExport(props) {
  return (
    <Svg {...props}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </Svg>
  );
}

export function IconPencil(props) {
  return (
    <Svg {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </Svg>
  );
}

export function IconMinus(props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

// Comandante: corona.
export function IconCrown(props) {
  return (
    <Svg {...props}>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </Svg>
  );
}

// Icone della testata del mazzo dal Figma "Proxodon" (M8c1qKltd3Wxh3Ii42zn0v, nodo 47:108): tracciati copiati
// tali e quali, colore = currentColor (il design le vuole bianche al 75%, lo dice il CSS) così Public acceso
// può diventare ciano. Stampa e mondo nel design sono 30x30 con il riquadro del pulsante: qui solo il simbolo,
// il riquadro è il pulsante.
const fig = (w, h) => ({ width: w, height: h, viewBox: `0 0 ${w} ${h}`, fill: 'none', 'aria-hidden': true, focusable: 'false' });
export function IconDeckTag() {
  return (
    <svg {...fig(17, 17)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.6662 15.4994C10.5076 15.6581 10.3192 15.784 10.1119 15.8699C9.90459 15.9558 9.68238 16 9.45796 16C9.23355 16 9.01134 15.9558 8.80402 15.8699C8.5967 15.784 8.40833 15.6581 8.24968 15.4994L1.50052 8.75021C1.34173 8.5917 1.21579 8.40341 1.1299 8.19614C1.04401 7.98887 0.999865 7.76668 1 7.54232V2.70841C1 1.76578 1.76578 1 2.70841 1H7.54232C7.99468 1 8.42968 1.18 8.75021 1.50052L15.4994 8.24968C15.6581 8.40833 15.784 8.5967 15.8699 8.80402C15.9558 9.01134 16 9.23355 16 9.45796C16 9.68238 15.9558 9.90459 15.8699 10.1119C15.784 10.3192 15.6581 10.5076 15.4994 10.6662L10.6662 15.4994Z" />
      <path d="M3.76314 3.76314L4.15787 4.15787" />
    </svg>
  );
}
export function IconDeckPrint() {
  return (
    <svg {...fig(30, 30)} fill="currentColor">
      <path d="M10 9.5C10 9.10218 10.158 8.72064 10.4393 8.43934C10.7206 8.15804 11.1022 8 11.5 8H18.5C18.8978 8 19.2794 8.15804 19.5607 8.43934C19.842 8.72064 20 9.10218 20 9.5V10H20.5C21.163 10 21.7989 10.2634 22.2678 10.7322C22.7366 11.2011 23 11.837 23 12.5V17.5C23 17.8978 22.842 18.2794 22.5607 18.5607C22.2794 18.842 21.8978 19 21.5 19H20V20.5C20 20.8978 19.842 21.2794 19.5607 21.5607C19.2794 21.842 18.8978 22 18.5 22H11.5C11.1022 22 10.7206 21.842 10.4393 21.5607C10.158 21.2794 10 20.8978 10 20.5V19H8.5C8.10218 19 7.72064 18.842 7.43934 18.5607C7.15804 18.2794 7 17.8978 7 17.5V12.5C7 11.837 7.26339 11.2011 7.73223 10.7322C8.20107 10.2634 8.83696 10 9.5 10H10V9.5ZM11 10H19V9.5C19 9.36739 18.9473 9.24021 18.8536 9.14645C18.7598 9.05268 18.6326 9 18.5 9H11.5C11.3674 9 11.2402 9.05268 11.1464 9.14645C11.0527 9.24021 11 9.36739 11 9.5V10ZM10 18V16.5C10 16.1022 10.158 15.7206 10.4393 15.4393C10.7206 15.158 11.1022 15 11.5 15H18.5C18.8978 15 19.2794 15.158 19.5607 15.4393C19.842 15.7206 20 16.1022 20 16.5V18H21.5C21.6326 18 21.7598 17.9473 21.8536 17.8536C21.9473 17.7598 22 17.6326 22 17.5V12.5C22 12.1022 21.842 11.7206 21.5607 11.4393C21.2794 11.158 20.8978 11 20.5 11H9.5C9.10218 11 8.72064 11.158 8.43934 11.4393C8.15804 11.7206 8 12.1022 8 12.5V17.5C8 17.6326 8.05268 17.7598 8.14645 17.8536C8.24021 17.9473 8.36739 18 8.5 18H10ZM11.5 16C11.3674 16 11.2402 16.0527 11.1464 16.1464C11.0527 16.2402 11 16.3674 11 16.5V20.5C11 20.6326 11.0527 20.7598 11.1464 20.8536C11.2402 20.9473 11.3674 21 11.5 21H18.5C18.6326 21 18.7598 20.9473 18.8536 20.8536C18.9473 20.7598 19 20.6326 19 20.5V16.5C19 16.3674 18.9473 16.2402 18.8536 16.1464C18.7598 16.0527 18.6326 16 18.5 16H11.5Z" />
    </svg>
  );
}
export function IconDeckExport() {
  return (
    <svg {...fig(16, 16.414)}>
      <path fill="currentColor" d="M8 1.414L7.293 0.707L8 0L8.707 0.707L8 1.414ZM9 10.414C9 10.6792 8.89464 10.9336 8.70711 11.1211C8.51957 11.3086 8.26522 11.414 8 11.414C7.73478 11.414 7.48043 11.3086 7.29289 11.1211C7.10536 10.9336 7 10.6792 7 10.414H9ZM2.293 5.707L7.293 0.707L8.707 2.121L3.707 7.121L2.293 5.707ZM8.707 0.707L13.707 5.707L12.293 7.121L7.293 2.121L8.707 0.707ZM9 1.414V10.414H7V1.414H9Z" />
      <path stroke="currentColor" strokeWidth="2" d="M1 12.414V13.414C1 13.9444 1.21071 14.4531 1.58579 14.8282C1.96086 15.2033 2.46957 15.414 3 15.414H13C13.5304 15.414 14.0391 15.2033 14.4142 14.8282C14.7893 14.4531 15 13.9444 15 13.414V12.414" />
    </svg>
  );
}
export function IconDeckPublic() {
  return (
    <svg {...fig(30, 30)} fill="currentColor">
      <path d="M18.206 16.2C18.274 15.639 18.325 15.078 18.325 14.5C18.325 13.922 18.274 13.361 18.206 12.8H21.079C21.215 13.344 21.3 13.9135 21.3 14.5C21.3 15.0865 21.215 15.656 21.079 16.2M16.7015 20.926C17.2115 19.9825 17.6025 18.9625 17.8745 17.9H20.382C19.5585 19.318 18.252 20.3922 16.7015 20.926ZM16.489 16.2H12.511C12.426 15.639 12.375 15.078 12.375 14.5C12.375 13.922 12.426 13.3525 12.511 12.8H16.489C16.5655 13.3525 16.625 13.922 16.625 14.5C16.625 15.078 16.5655 15.639 16.489 16.2ZM14.5 21.266C13.7945 20.246 13.225 19.1155 12.8765 17.9H16.1235C15.775 19.1155 15.2055 20.246 14.5 21.266ZM11.1 11.1H8.618C9.43285 9.67798 10.7385 8.60206 12.29 8.074C11.78 9.0175 11.3975 10.0375 11.1 11.1ZM8.618 17.9H11.1C11.3975 18.9625 11.78 19.9825 12.29 20.926C10.7415 20.3925 9.43765 19.318 8.618 17.9ZM7.921 16.2C7.785 15.656 7.7 15.0865 7.7 14.5C7.7 13.9135 7.785 13.344 7.921 12.8H10.794C10.726 13.361 10.675 13.922 10.675 14.5C10.675 15.078 10.726 15.639 10.794 16.2M14.5 7.7255C15.2055 8.7455 15.775 9.8845 16.1235 11.1H12.8765C13.225 9.8845 13.7945 8.7455 14.5 7.7255ZM20.382 11.1H17.8745C17.6081 10.0474 17.2142 9.03119 16.7015 8.074C18.2655 8.6095 19.566 9.689 20.382 11.1ZM14.5 6C9.7995 6 6 9.825 6 14.5C6 16.7543 6.89553 18.9163 8.48959 20.5104C9.27889 21.2997 10.2159 21.9258 11.2472 22.353C12.2785 22.7801 13.3838 23 14.5 23C16.7543 23 18.9163 22.1045 20.5104 20.5104C22.1045 18.9163 23 16.7543 23 14.5C23 13.3838 22.7801 12.2785 22.353 11.2472C21.9258 10.2159 21.2997 9.27889 20.5104 8.48959C19.7211 7.70029 18.7841 7.07419 17.7528 6.64702C16.7215 6.21986 15.6162 6 14.5 6Z" />
    </svg>
  );
}
export function IconDeckSearch() {
  return (
    <svg {...fig(15, 15)} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 14L10.9309 10.9254M10.9309 10.9254L10.9306 10.9252M10.9309 10.9254C12.0199 9.83503 12.6316 8.35694 12.6316 6.81579C12.6316 5.27335 12.0188 3.79408 10.9282 2.70341C9.8375 1.61273 8.35823 1 6.81579 1C5.27335 1 3.79408 1.61273 2.70341 2.70341C1.61273 3.79408 1 5.27335 1 6.81579C1 8.35823 1.61273 9.8375 2.70341 10.9282C3.79408 12.0188 5.27335 12.6316 6.81579 12.6316C8.35823 12.6316 9.8375 12.0188 10.9282 10.9282C10.9291 10.9273 10.93 10.9263 10.9309 10.9254Z" />
    </svg>
  );
}
// Cuore accanto al nome del mazzo: contorno; filled = pieno (like messo).
export function IconDeckHeart({ filled }) {
  return (
    <svg {...fig(18, 16)} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 1C2.7912 1 1 2.73973 1 4.88612C1 6.61879 1.7 10.731 8.5904 14.888C8.71398 14.9613 8.85561 15 9 15C9.14439 15 9.28602 14.9613 9.4096 14.888C16.3008 10.731 17 6.61879 17 4.88612C17 2.73973 15.2088 1 13 1C10.7912 1 9 3.35523 9 3.35523C9 3.35523 7.2088 1 5 1Z" />
    </svg>
  );
}
