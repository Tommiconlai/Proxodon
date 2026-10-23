import { SYMBOL } from '../utils/manaSymbols.js';

// Logica dei token senza canvas (provata da tokenModel.selfcheck.js). Unità di disegno: la carta è 630x880 (0.1 mm);
// measure(testo, corpo) = larghezza nelle stesse unità, la dà il canvas (o un finto nel self-check).

// Colori della cornice per colore del token: main = linee e pallino, light = alone, dark = fondo dei riquadri colorati.
// M = multicolore (oro), C = incolore.
export const TOKEN_COLORS = {
  W: { main: '#f2e6b8', light: '#fffbe6', dark: '#8a7c4e' },
  U: { main: '#3b9be8', light: '#b5e0ff', dark: '#123d66' },
  B: { main: '#9b7fc0', light: '#e0d2f2', dark: '#2a1f3a' },
  R: { main: '#ff5a4a', light: '#ffc1b8', dark: '#6e1a12' },
  G: { main: '#3fd37f', light: '#b9f5d2', dark: '#0f4a2b' },
  M: { main: '#f0c24a', light: '#fff0bf', dark: '#6b4f10' },
  C: { main: '#a9b4c0', light: '#e8eef4', dark: '#3b4350' },
};
export const frameColors = (colors) => TOKEN_COLORS[colors.length === 0 ? 'C' : colors.length === 1 ? colors[0] : 'M'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const MAX_ZOOM = 5;

// Dove va l'immagine (natW x natH) perché copra la finestra win: zoom 1 = la più piccola che la copre, centrata, poi
// spostata di pos.x / pos.y.
export function coverRect(natW, natH, win, pos) {
  const s = Math.max(win.w / natW, win.h / natH) * pos.zoom;
  const w = natW * s;
  const h = natH * s;
  return { x: win.x + (win.w - w) / 2 + pos.x, y: win.y + (win.h - h) / 2 + pos.y, w, h };
}

// Zoom tra 1 e MAX_ZOOM e spostamento entro i bordi: la finestra resta sempre coperta, nessun buco.
export function clampPos(natW, natH, win, pos) {
  const zoom = clamp(pos.zoom, 1, MAX_ZOOM);
  const { w, h } = coverRect(natW, natH, win, { x: 0, y: 0, zoom });
  const mx = (w - win.w) / 2;
  const my = (h - win.h) / 2;
  return { x: clamp(pos.x, -mx, mx) || 0, y: clamp(pos.y, -my, my) || 0, zoom };
}

// Bleed di b unità attorno alla carta: la finestra dell'arte che tocca un bordo della carta continua nel bleed (l'arte a
// tutta carta lo riempie), quella interna a una cornice resta dov'è.
export function artWindow(a, b) {
  const x0 = a.x <= 0 ? -b : a.x;
  const y0 = a.y <= 0 ? -b : a.y;
  const x1 = a.x + a.w >= 630 ? 630 + b : a.x + a.w;
  const y1 = a.y + a.h >= 880 ? 880 + b : a.y + a.h;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// L'overlay (l'immagine scontornata sopra cornice e testi) non deve coprire la finestra: zoom da 0.2 a MAX_ZOOM, spostamento
// libero entro una carta abbondante.
export const clampOverlay = (p) => ({ x: clamp(p.x, -1000, 1000), y: clamp(p.y, -1000, 1000), zoom: clamp(p.zoom, 0.2, MAX_ZOOM) });

// Dimensioni naturali [w, h] delle due immagini per moveLayers (null se manca).
export const layerDims = (art, overlay) => ({ art: art ? [art.width, art.height] : null, overlay: overlay ? [overlay.width, overlay.height] : null });

// Spostamento dei due livelli dai punti di partenza (start = { art, overlay }) di change = { dx, dy, k } (k = fattore di
// zoom). Con sync l'immagine si muove nei suoi limiti e l'overlay la segue come un pezzo solo (stesso spostamento vero,
// stesso fattore, la distanza tra i due scalata); senza, si muove solo target ('art' o 'overlay'). dims = dimensioni
// naturali [w, h] delle due immagini (null se manca); senza immagine di fondo si muove l'overlay.
export function moveLayers(start, change, { sync, target, dims, win }) {
  const out = { art: start.art, overlay: start.overlay };
  const ov = (p) => clampOverlay(p);
  if (dims.art && (sync || target === 'art' || !dims.overlay)) {
    const a = clampPos(dims.art[0], dims.art[1], win, { x: start.art.x + change.dx, y: start.art.y + change.dy, zoom: start.art.zoom * change.k });
    out.art = a;
    if (sync && dims.overlay) {
      const ak = a.zoom / start.art.zoom;
      out.overlay = ov({ x: a.x + (start.overlay.x - start.art.x) * ak, y: a.y + (start.overlay.y - start.art.y) * ak, zoom: start.overlay.zoom * ak });
    }
  } else if (dims.overlay) {
    out.overlay = ov({ x: start.overlay.x + change.dx, y: start.overlay.y + change.dy, zoom: start.overlay.zoom * change.k });
  }
  return out;
}

// Testo delle regole → pezzi: testo, simbolo ({T}, {2/W}: solo quelli validi, al massimo 40) e a capo.
const MAX_SYMBOLS = 40;
export function parseRules(text) {
  const out = [];
  let syms = 0;
  const push = (v) => {
    const last = out[out.length - 1];
    if (last?.t === 'text') last.v += v;
    else out.push({ t: 'text', v });
  };
  for (const part of (text || '').split(/(\{[^}\n]*\}|\n)/)) {
    if (!part) continue;
    if (part === '\n') out.push({ t: 'br' });
    else if (SYMBOL.test(part) && syms < MAX_SYMBOLS) { syms += 1; out.push({ t: 'sym', v: part.slice(1, -1) }); }
    else push(part);
  }
  return out;
}

// Il corpo più grande tra min e size con cui il testo sta in maxW (altrimenti min).
export function fitSize(measure, text, maxW, size, min) {
  for (let s = size; s >= min; s -= 1) if (measure(text, s) <= maxW) return s;
  return min;
}

// Il testo tagliato con "…" finché sta in maxW.
export function ellipsize(measure, text, maxW, size) {
  if (measure(text, size) <= maxW) return text;
  for (let n = text.length - 1; n > 0; n -= 1) {
    const t = `${text.slice(0, n).trimEnd()}…`;
    if (measure(t, size) <= maxW) return t;
  }
  return '…';
}

// Righe del testo a corpo s, larghe al massimo maxW: a capo sulle parole (una parola più larga della riga si spezza
// sui caratteri); un simbolo è un quadrato di lato s. Ogni pezzo della riga ha la sua larghezza w.
function wrap(measure, runs, s, maxW) {
  const lines = [[]];
  let width = 0;
  const line = () => lines[lines.length - 1];
  const newLine = () => {
    while (line().length && line()[line().length - 1].space) width -= line().pop().w; // niente spazi in coda
    lines.push([]);
    width = 0;
  };
  const place = (item) => {
    if (width + item.w > maxW && line().length) newLine();
    line().push(item);
    width += item.w;
  };
  for (const r of runs) {
    if (r.t === 'br') { newLine(); continue; }
    if (r.t === 'sym') { place({ t: 'sym', v: r.v, w: s }); continue; }
    for (const word of r.v.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) {
        if (line().length) { const w = measure(' ', s); line().push({ t: 'text', v: ' ', w, space: true }); width += w; }
        continue;
      }
      let rest = word;
      while (measure(rest, s) > maxW && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && measure(rest.slice(0, n), s) > maxW) n -= 1;
        if (line().length) newLine();
        place({ t: 'text', v: rest.slice(0, n), w: measure(rest.slice(0, n), s) });
        rest = rest.slice(n);
      }
      place({ t: 'text', v: rest, w: measure(rest, s) });
    }
  }
  while (line().length && line()[line().length - 1].space) line().pop();
  return lines.map((l) => l.map(({ t, v, w }) => ({ t, v, w })));
}

// Testo delle regole nel riquadro box: il corpo più grande tra min e size con cui tutte le righe ci stanno (altezza
// riga = corpo * lineH); al minimo tiene le righe che ci stanno, l'ultima finisce con "…", cut = true.
export function layoutRules(measure, runs, box, { size, min, lineH }) {
  for (let s = size; s > min; s -= 1) {
    const lines = wrap(measure, runs, s, box.w);
    if (lines.length * s * lineH <= box.h) return { size: s, lines, cut: false };
  }
  const lines = wrap(measure, runs, min, box.w);
  const keep = Math.max(1, Math.floor(box.h / (min * lineH)));
  if (lines.length <= keep) return { size: min, lines, cut: false };
  const kept = lines.slice(0, keep);
  kept[keep - 1] = [...kept[keep - 1], { t: 'text', v: '…', w: measure('…', min) }];
  return { size: min, lines: kept, cut: true };
}

// Tipi della riga del tipo, scelti da una tendina (non scritti): supertipi e tipi di carta, Token per primo.
export const CARD_TYPES = ['Token', 'Legendary', 'Snow', 'Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle', 'Kindred', 'Instant', 'Sorcery'];
// Il catalogo dei sottotipi di Scryfall per ogni tipo (api.scryfall.com/catalog/<nome>); i supertipi non ne hanno.
const SUBTYPE_CATALOG = {
  Artifact: 'artifact-types', Creature: 'creature-types', Kindred: 'creature-types', Enchantment: 'enchantment-types',
  Land: 'land-types', Planeswalker: 'planeswalker-types', Battle: 'battle-types', Instant: 'spell-types', Sorcery: 'spell-types',
};
export const subtypeCatalogs = (types) => [...new Set(types.map((t) => SUBTYPE_CATALOG[t]).filter(Boolean))];
export const isCreature = (types) => types.includes('Creature');
// Voci per la ricerca nella riga del tipo: i tipi di carta e i sottotipi dei tipi scelti (subs), tranne quelli già nella
// riga; prima chi comincia con il testo, poi chi lo contiene (maiuscole indifferenti), i tipi prima dei sottotipi; testo
// vuoto = tutte. Al massimo max voci { v, kind: 'type' | 'subtype' }.
export function typeSuggestions(query, types, subtypes, subs, max = 8) {
  const q = query.trim().toLowerCase();
  const all = [
    ...CARD_TYPES.filter((t) => !types.includes(t)).map((v) => ({ v, kind: 'type' })),
    ...subs.filter((t) => !subtypes.includes(t)).map((v) => ({ v, kind: 'subtype' })),
  ];
  if (!q) return all.slice(0, max);
  const starts = all.filter((o) => o.v.toLowerCase().startsWith(q));
  const inside = all.filter((o) => !o.v.toLowerCase().startsWith(q) && o.v.toLowerCase().includes(q));
  return [...starts, ...inside].slice(0, max);
}

// Tipi, poi sottotipi dopo il trattino medio (U+2013: quello lungo delle carte vere qui non si usa).
export const typeLine = (types, subtypes) => [types.join(' '), subtypes.join(' ')].filter(Boolean).join(' – ');

// Token di Scryfall (layout token, anche a due facce: conta quella davanti) → campi del generatore: la riga del tipo si
// divide sul trattino lungo di Scryfall (U+2014) in tipi e sottotipi, i colori in ordine WUBRG, le cornici dell'utente:
// Effect con il testo e Vanilla senza. Immagine e credito restano da mettere.
const WUBRG = ['W', 'U', 'B', 'R', 'G'];
export function tokenFromScryfall(card) {
  const face = card.card_faces?.[0] ?? card;
  const [left = '', right = ''] = (face.type_line || '').split(/\s+\u2014\s+/);
  const colors = face.colors ?? card.colors ?? [];
  const rules = (face.oracle_text || '').trim();
  return {
    template: rules ? 'effect' : 'vanilla', colors: WUBRG.filter((c) => colors.includes(c)), name: face.name || '',
    types: left.split(/\s+/).filter(Boolean), subtypes: right.split(/\s+/).filter(Boolean), rules,
    power: face.power ?? '', toughness: face.toughness ?? '', credit: '',
  };
}

// Nome del PNG: niente caratteri vietati nei nomi di file né di controllo, spazi uniti, al massimo 60 caratteri.
export function tokenFileName(name) {
  const s = [...(name || '')].filter((c) => c.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(c)).join('')
    .replace(/\s+/g, ' ').trim().slice(0, 60).trim();
  return `${s || 'token'}.png`;
}
