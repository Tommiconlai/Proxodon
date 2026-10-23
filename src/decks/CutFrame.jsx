import { useState } from 'react';
import { cutShape } from './cutShape';

// Pannello con le tasche agli angoli (cutShape): le tasche sono buchi veri (maschera), sotto si vede la pagina coi suoi
// riflessi.

const masks = new Map();
const maskOf = (w, h, d) => {
  const k = `${w} ${h} ${d}`;
  if (!masks.has(k)) {
    if (masks.size > 200) masks.clear(); // la testata del profilo ne fa una per misura, ridimensionando
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
