// Sagoma con le tasche agli angoli (spunto: la card "GLITCH" dell'utente): un rettangolo arrotondato a cui gli angoli
// scelti sono tolti, così pillole e pulsanti tondi ci stanno dentro come nel vuoto della cornice. La usano i riquadri
// dei mazzi (CutFrame) e la cornice Glitch dei token. cuts = { tl, tr, br, bl: [w, h] } in unità del viewBox w x h;
// l'angolo interno della tasca è tondo (h / 2), quelli accanto hanno il raggio r del pannello. Torna il path SVG.
const f = (v) => +v.toFixed(2);
export function cutShape(w, h, r, cuts = {}) {
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
