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

// Wordmark "PROXOTECA" (dal Figma "Portfolio-TG" nodo 4025:2465): lettere come tracciati
// pieni ciano, la X è il marchio (4 chevron ruotati di 90°, tratto 3 tondo). viewBox del design.
const WORDMARK_LETTERS = [
  'M11.688 23.136H6.696V19.416H11.76C12.888 19.416 13.728 18.6 13.728 17.424C13.728 16.2 12.888 15.408 11.76 15.408H5.496V27H1.32V11.4H11.688C15.312 11.4 17.904 13.776 17.904 17.28C17.904 20.76 15.312 23.136 11.688 23.136Z',
  'M37.6403 27H32.1683L29.0483 23.04H25.3522V19.392H30.7283C31.8803 19.392 32.6963 18.6 32.6963 17.4C32.6963 16.2 31.8803 15.408 30.7283 15.408H24.1523V27H19.9763V11.4H30.7283C34.3043 11.4 36.8963 13.752 36.8963 17.232C36.8963 19.608 35.6482 21.48 33.7043 22.416L37.6403 27Z',
  'M46.4246 22.968H49.2566C51.4406 22.968 53.0246 21.432 53.0246 19.2C53.0246 16.944 51.4406 15.408 49.2566 15.408H46.4246C44.2406 15.408 42.6326 16.944 42.6326 19.2C42.6326 21.432 44.2166 22.968 46.4246 22.968ZM48.9686 27H46.7126C41.9366 27 38.4566 23.856 38.4566 19.2C38.4566 14.544 41.9366 11.4 46.7126 11.4H48.9686C53.7206 11.4 57.2006 14.544 57.2006 19.2C57.2006 23.856 53.7206 27 48.9686 27Z',
  'M95.784 22.968H98.616C100.8 22.968 102.384 21.432 102.384 19.2C102.384 16.944 100.8 15.408 98.616 15.408H95.784C93.6 15.408 91.992 16.944 91.992 19.2C91.992 21.432 93.576 22.968 95.784 22.968ZM98.328 27H96.072C91.296 27 87.816 23.856 87.816 19.2C87.816 14.544 91.296 11.4 96.072 11.4H98.328C103.08 11.4 106.56 14.544 106.56 19.2C106.56 23.856 103.08 27 98.328 27Z',
  'M117.197 27H112.997V15.408H107.261V11.4H122.933V15.408H117.197V27Z',
  'M139.55 20.832H130.334V17.496H139.55V20.832ZM139.742 27H124.742V11.4H139.718V15.408H128.942V22.968H139.742V27Z',
  'M157.563 27H149.931C145.155 27 141.675 23.856 141.675 19.2C141.675 14.544 145.155 11.4 149.931 11.4H157.563V15.408H149.643C147.459 15.408 145.851 16.944 145.851 19.2C145.851 21.432 147.459 22.968 149.643 22.968H157.563V27Z',
  'M179.506 27H174.946L173.65 24.6H166.33L168.106 21.264H171.874L169.21 16.248L163.498 27H158.866L166.834 12.552C167.266 11.784 167.89 11.4 168.706 11.4H169.666C170.482 11.4 171.106 11.784 171.538 12.552L179.506 27Z',
];
// Bracci della X in ordine orario (sopra, destra, sotto, sinistra); centro (73.25, 18.25).
// Stessa geometria del marchio in public/favicon.svg, ridisegnata dal design per la taglia piccola.
const WORDMARK_X = [
  'M62.25 3L73.25 14L78.75 8.5',
  'M88.5 7.25L77.5 18.25L83 23.75',
  'M84.25 33.5L73.25 22.5L67.75 28',
  'M58 29.25L69 18.25L63.5 12.75',
];

export function Wordmark({ height = 30, ...props }) {
  return (
    <svg height={height} width={(height * 180) / 37} viewBox="0 0 180 37" role="img" aria-label="Proxoteca" {...props}>
      <g fill="#00e5ff">
        {WORDMARK_LETTERS.map((d) => <path key={d} d={d} />)}
      </g>
      {/* arm-h = sopra/sotto (flip orizzontale all'hover), arm-v = destra/sinistra (flip
          verticale); --i = posizione oraria per lo sfasamento dell'animazione (CSS .wordmark). */}
      <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {WORDMARK_X.map((d, i) => (
          <path key={d} d={d} className={i % 2 ? 'arm arm-v' : 'arm arm-h'} style={{ '--i': i }}
            stroke={i % 2 ? '#00e5ff' : '#ff2d95'} />
        ))}
      </g>
    </svg>
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
