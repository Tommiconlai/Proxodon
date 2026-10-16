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

// Wordmark "PROXODON": P R O X O dal Figma "Portfolio-TG" (nodo 4025:2465, gruppo 4034:2496, era
// PROXOTECA), lettere come tracciati pieni ciano; la X è il marchio in 3 parti: centro ciano (due chevron
// fusi) e V magenta sopra/sotto (tratto 3 tondo). viewBox del design, largo fino alla N; centro della X
// (56.5, 15.25).
const WORDMARK_LETTERS = [
  'M8.7538 18.4802H4.53901V15.3802H8.81459C9.76697 15.3802 10.4762 14.7002 10.4762 13.7202C10.4762 12.7002 9.76697 12.0402 8.81459 12.0402H3.52583V21.7002H0V8.7002H8.7538C11.8136 8.7002 14.002 10.6802 14.002 13.6002C14.002 16.5002 11.8136 18.4802 8.7538 18.4802Z',
  'M30.6655 21.7002H26.0455L23.4112 18.4002H20.2906V15.3602H24.8297C25.8023 15.3602 26.4913 14.7002 26.4913 13.7002C26.4913 12.7002 25.8023 12.0402 24.8297 12.0402H19.2775V21.7002H15.7516V8.7002H24.8297C27.8489 8.7002 30.0374 10.6602 30.0374 13.5602C30.0374 15.5402 28.9837 17.1002 27.3423 17.8802L30.6655 21.7002Z',
  'M38.0822 18.3402H40.4733C42.3173 18.3402 43.6547 17.0602 43.6547 15.2002C43.6547 13.3202 42.3173 12.0402 40.4733 12.0402H38.0822C36.2383 12.0402 34.8806 13.3202 34.8806 15.2002C34.8806 17.0602 36.218 18.3402 38.0822 18.3402ZM40.2302 21.7002H38.3254C34.293 21.7002 31.3548 19.0802 31.3548 15.2002C31.3548 11.3202 34.293 8.7002 38.3254 8.7002H40.2302C44.2423 8.7002 47.1805 11.3202 47.1805 15.2002C47.1805 19.0802 44.2423 21.7002 40.2302 21.7002Z',
  'M72.3131 18.3402H74.7042C76.5482 18.3402 77.8856 17.0602 77.8856 15.2002C77.8856 13.3202 76.5482 12.0402 74.7042 12.0402H72.3131C70.4691 12.0402 69.1115 13.3202 69.1115 15.2002C69.1115 17.0602 70.4489 18.3402 72.3131 18.3402ZM74.461 21.7002H72.5563C68.5239 21.7002 65.5857 19.0802 65.5857 15.2002C65.5857 11.3202 68.5239 8.7002 72.5563 8.7002H74.461C78.4732 8.7002 81.4114 11.3202 81.4114 15.2002C81.4114 19.0802 78.4732 21.7002 74.461 21.7002Z',
  // D, O, N di PROXODON (2026-10-16): disegnate sulle altre, aste 3.53 e curve della O.
  'M83 8.7002H89C93.0122 8.7002 95.9504 11.3202 95.9504 15.2002C95.9504 19.0802 93.0122 21.7002 89 21.7002H83ZM86.5258 12.0402V18.3402H89.2432C91.0872 18.3402 92.4246 17.0602 92.4246 15.2002C92.4246 13.3202 91.0872 12.0402 89.2432 12.0402Z',
  'M104.1774 18.3402H106.5685C108.4125 18.3402 109.7499 17.0602 109.7499 15.2002C109.7499 13.3202 108.4125 12.0402 106.5685 12.0402H104.1774C102.3334 12.0402 100.9758 13.3202 100.9758 15.2002C100.9758 17.0602 102.3132 18.3402 104.1774 18.3402ZM106.3253 21.7002H104.4206C100.3882 21.7002 97.45 19.0802 97.45 15.2002C97.45 11.3202 100.3882 8.7002 104.4206 8.7002H106.3253C110.3375 8.7002 113.2757 11.3202 113.2757 15.2002C113.2757 19.0802 110.3375 21.7002 106.3253 21.7002Z',
  'M114.78 21.7002V8.7002H119.08L124.4542 16.5502V8.7002H127.98V21.7002H123.68L118.3058 13.8502V21.7002Z',
];
const WORDMARK_X_CORE = 'M67.4393 3.18934C68.0251 2.60355 68.9746 2.60355 69.5604 3.18934C70.1462 3.77513 70.1462 4.72465 69.5604 5.31043L62.4494 12.4215C60.8873 13.9836 60.8873 16.5162 62.4494 18.0783L64.0604 19.6893C64.6462 20.2751 64.6462 21.2247 64.0604 21.8104C63.4746 22.3962 62.5251 22.3962 61.9393 21.8104L59.3283 19.1994C57.7662 17.6373 55.2336 17.6373 53.6715 19.1994L45.5604 27.3104C44.9747 27.8961 44.0251 27.896 43.4393 27.3104C42.8536 26.7246 42.8536 25.7751 43.4393 25.1893L50.5504 18.0783C52.1125 16.5162 52.1125 13.9836 50.5504 12.4215L48.9393 10.8104C48.3536 10.2246 48.3536 9.27513 48.9393 8.68934C49.5251 8.10356 50.4746 8.10355 51.0604 8.68934L53.6715 11.3004C55.2336 12.8625 57.7662 12.8625 59.3283 11.3004L67.4393 3.18934Z';
const WORDMARK_X_V = [
  'M65 1.5L57.774 9.00395C56.9873 9.82091 55.6794 9.82091 54.8927 9.00395L52 6',
  'M48 29L55.226 21.496C56.0127 20.6791 57.3206 20.6791 58.1073 21.4961L61 24.5',
];

export function Wordmark({ height = 30, ...props }) {
  return (
    <svg height={height} width={(height * 128) / 30.5} viewBox="0 0 128 30.5" role="img" aria-label="Proxodon" {...props}>
      {/* .x-v = V sopra/sotto: all'hover ruotano di 180° sull'asse verticale del centro della X (CSS .wordmark). */}
      <g fill="#00e5ff">
        {WORDMARK_LETTERS.map((d) => <path key={d} d={d} />)}
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

export function IconLayout(props) {
  return (
    <Svg {...props}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
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
