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
// Tipi, poi sottotipi dopo il trattino medio (U+2013: quello lungo delle carte vere qui non si usa).
export const typeLine = (types, subtypes) => [types.join(' '), subtypes.join(' ')].filter(Boolean).join(' – ');

// Nome del PNG: niente caratteri vietati nei nomi di file né di controllo, spazi uniti, al massimo 60 caratteri.
export function tokenFileName(name) {
  const s = [...(name || '')].filter((c) => c.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(c)).join('')
    .replace(/\s+/g, ' ').trim().slice(0, 60).trim();
  return `${s || 'token'}.png`;
}
