// ── Cornice HUD carta (hover / selezione), dal Figma "Portfolio-TG" ──
// Usata dalla stampa (PagePreview) e dalle carte dei mazzi (griglia, stack).
// Selezionata (nodo 4021:2397): 4 squadrette agli angoli + 4 segmenti centrati sui lati
// (sopra/sotto 13.5→86.5%, lati 15→85%), magenta/ciano alternati come il logo, tratto 2px tondo.
// Hover (nodo 4021:2411): stessi segmenti accorciati in rotazione oraria; li accorcia il CSS
// (scale dall'estremo giusto), così al click crescono fino alla forma "selezionata".
export function CardFrame() {
  return (
    <svg className="card-frame" aria-hidden="true" focusable="false">
      {/* Gruppo: il glow da selezionata va sul gruppo (bbox piena), non sulle linee
          (bbox alta/larga 0 → regione filtro vuota, la linea sparirebbe). */}
      <g className="segs">
        <line className="m t" x1="13.5%" y1="0" x2="86.5%" y2="0" />
        <line className="c r" x1="100%" y1="15%" x2="100%" y2="85%" />
        <line className="m b" x1="13.5%" y1="100%" x2="86.5%" y2="100%" />
        <line className="c l" x1="0" y1="15%" x2="0" y2="85%" />
      </g>
      {/* Squadrette come i chevron del logo: un braccio lungo il doppio dell'altro (10/5px),
          il lungo segue il giro orario (alto-sx → destra, alto-dx → giù, basso-dx → sinistra,
          basso-sx → su), stessa simmetria rotazionale del marchio e dei segmenti. */}
      <path className="m" d="M0 5V0H10" />
      <svg x="100%" overflow="visible"><path className="c" d="M-5 0H0V10" /></svg>
      <svg x="100%" y="100%" overflow="visible"><path className="m" d="M0 -5V0H-10" /></svg>
      <svg y="100%" overflow="visible"><path className="c" d="M5 0H0V-10" /></svg>
    </svg>
  );
}

// Glow dei segmenti di selezione: sfocatura del tratto stesso (stesso colore), una volta per vista e
// referenziata dal CSS (filter: url(#px-seg-glow)). Non display:none (Firefox lo ignora).
export function CardFrameDefs() {
  return (
    <svg width="0" height="0" className="svg-defs" aria-hidden="true" focusable="false">
      <filter id="px-seg-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}
