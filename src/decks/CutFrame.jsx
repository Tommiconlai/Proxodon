import { useState } from 'react';

// Pannello con le tasche agli angoli (spunto: la card "GLITCH" dell'utente): un rettangolo arrotondato a cui gli
// angoli scelti sono tolti, così pillole e pulsanti tondi ci stanno dentro come nel vuoto della cornice. Le tasche
// sono buchi veri (maschera), sotto si vede la pagina coi suoi riflessi. cuts = { tl, tr, br, bl: [w, h] } in unità
// del viewBox w x h; l'angolo interno della tasca è tondo (h / 2), quelli accanto hanno il raggio r del pannello.
const f = (v) => +v.toFixed(2);
function cutShape(w, h, r, cuts = {}) {
  const { tl, tr, br, bl } = cuts;
  // Accanto a una tasca il raggio del pannello si stringe quanto serve perché i due archi stiano sul lato.
  const ra = ([cw, ch]) => Math.min(r, ch / 2, cw - ch / 2);
  const pts = [ // [x, y, raggio], in senso orario dall'angolo in alto a sinistra
    ...(tl ? [[0, tl[1], ra(tl)], [tl[0], tl[1], tl[1] / 2], [tl[0], 0, ra(tl)]] : [[0, 0, r]]),
    ...(tr ? [[w - tr[0], 0, ra(tr)], [w - tr[0], tr[1], tr[1] / 2], [w, tr[1], ra(tr)]] : [[w, 0, r]]),
    ...(br ? [[w, h - br[1], ra(br)], [w - br[0], h - br[1], br[1] / 2], [w - br[0], h, ra(br)]] : [[w, h, r]]),
    ...(bl ? [[bl[0], h, ra(bl)], [bl[0], h - bl[1], bl[1] / 2], [0, h - bl[1], ra(bl)]] : [[0, h, r]]),
  ];
  let d = '';
  pts.forEach(([x, y, rad], i) => {
    const [px, py] = pts[(i + pts.length - 1) % pts.length];
    const [nx, ny] = pts[(i + 1) % pts.length];
    const ix = Math.sign(x - px), iy = Math.sign(y - py), ox = Math.sign(nx - x), oy = Math.sign(ny - y);
    const sweep = ix * oy - iy * ox > 0 ? 1 : 0; // girata a destra = angolo convesso
    d += `${i ? 'L' : 'M'}${f(x - ix * rad)} ${f(y - iy * rad)}A${f(rad)} ${f(rad)} 0 0 ${sweep} ${f(x + ox * rad)} ${f(y + oy * rad)}`;
  });
  return `${d}Z`;
}

const masks = new Map();
const maskOf = (w, h, d) => {
  const k = `${w} ${h} ${d}`;
  if (!masks.has(k)) {
    masks.set(k, `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'><path d='${d}' fill='white'/></svg>`)}")`);
  }
  return masks.get(k);
};

let frames = 0; // id del gradiente del bordo, uno per pannello
// children = l'arte, ritagliata dalla sagoma; sopra il bordo sfumato ciano → viola → magenta (dashed = tratteggio ciano).
export function CutFrame({ w, h, r = 14, cuts, dashed, children }) {
  const [k] = useState(() => `cut-g${++frames}`);
  const d = cutShape(w, h, r, cuts);
  const mask = maskOf(w, h, d);
  return (
    <>
      <span className="cut-shape" style={{ maskImage: mask, WebkitMaskImage: mask }}>{children}</span>
      <svg className="cut-frame" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {!dashed && (
          <linearGradient id={k} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.1" stopColor="#00E5FF" /><stop offset="0.5" stopColor="#AB61ED" /><stop offset="0.9" stopColor="#FF2E96" />
          </linearGradient>
        )}
        <path d={d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={dashed ? 1.5 : 1}
          stroke={dashed ? 'rgba(0, 229, 255, 0.55)' : `url(#${k})`} strokeDasharray={dashed ? '6 5' : undefined} />
      </svg>
    </>
  );
}
