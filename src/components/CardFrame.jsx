// ── Cornice carta (hover / selezione) ──
// Usata dalla stampa (PagePreview), dalle carte dei mazzi (griglia, stack) e dei dilemmi, col gradiente
// #FF2E96 → #AB61ED → #00E5FF da sinistra a destra: nella stampa un contorno 3px fuori dal taglio, sulle carte
// dei mazzi e dei dilemmi a filo dentro la carta (CSS). Hover = 60%; selezionata = 100% con un alone sfocato
// dello stesso gradiente. Opacità, posizione e alone li decide il CSS (.card-frame).
export function CardFrame() {
  return (
    <svg className="card-frame" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="100%" height="100%" rx="5%" />
    </svg>
  );
}

// Gradiente e alone della cornice, una volta per vista, referenziati dal CSS (url(#px-frame-grad),
// url(#px-frame-glow): il tratto sfocato sotto quello netto). Non display:none (Firefox lo ignora).
export function CardFrameDefs() {
  return (
    <svg width="0" height="0" className="svg-defs" aria-hidden="true" focusable="false">
      <linearGradient id="px-frame-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ff2e96" />
        <stop offset="0.5" stopColor="#ab61ed" />
        <stop offset="1" stopColor="#00e5ff" />
      </linearGradient>
      <filter id="px-frame-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}
