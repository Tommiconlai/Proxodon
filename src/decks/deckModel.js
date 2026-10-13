/**
 * Logica pura dei mazzi (niente React, niente Firebase): la usano editor, lista, import ed export.
 * Un mazzo è { v, name, format, groupBy, sections, cards }; ogni riga di `cards` è
 * { id, qty, board: 'main'|'side'|'maybe', commander, section, card: Snapshot }.
 * Le funzioni non mutano: ritornano sempre un mazzo nuovo.
 */

export const FORMATS = [
  { id: 'commander', label: 'Commander' },
  { id: 'standard', label: 'Standard' },
  { id: 'pioneer', label: 'Pioneer' },
  { id: 'modern', label: 'Modern' },
  { id: 'legacy', label: 'Legacy' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'pauper', label: 'Pauper' },
  { id: 'casual', label: 'Casual' },
];
const LEGAL_FORMATS = FORMATS.filter((f) => f.id !== 'casual').map((f) => f.id);
export const formatLabel = (id) => FORMATS.find((f) => f.id === id)?.label || id;

export const MAX_ROWS = 500;
export const MAX_QTY = 99;

export const rid = () => globalThis.crypto?.randomUUID?.()
  ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const NUM_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

// Limite copie letto dal testo regole: 0 = qualsiasi numero, N = fino a N, null = regola del formato.
export function copyLimitFromText(text) {
  if (/any number of cards named/i.test(text)) return 0;
  const m = text.match(/up to (\w+) cards named/i);
  if (!m) return null;
  const n = NUM_WORDS[m[1].toLowerCase()] ?? parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

// Dati Scryfall copiati nella riga al momento dell'aggiunta. Costo, tipo, colori e immagini
// vengono dalla faccia anteriore (DFC, split, avventure). Nessun campo undefined: Firestore li rifiuta.
export function snapshotFromCard(c) {
  const f0 = c.card_faces?.[0];
  const imgs = c.image_uris || f0?.image_uris || {};
  const text = c.oracle_text ?? (c.card_faces || []).map((f) => f.oracle_text || '').join('\n');
  const legal = {};
  for (const f of LEGAL_FORMATS) legal[f] = c.legalities?.[f] || 'not_legal';
  return {
    sid: c.id,
    oid: c.oracle_id || f0?.oracle_id || c.id,
    name: c.name,
    mana: (f0 ? f0.mana_cost : c.mana_cost) || '',
    mv: c.cmc ?? 0,
    type: (f0 ? f0.type_line : c.type_line) || '',
    colors: f0?.colors || c.colors || [],
    ci: c.color_identity || [],
    produced: c.produced_mana || [],
    legal,
    set: c.set || '',
    cn: c.collector_number || '',
    img: imgs.normal || '',
    art: imgs.art_crop || '',
    limit: copyLimitFromText(text || ''),
  };
}

export const isLand = (s) => /\bLand\b/.test(s.type);
export const isBasicLand = (s) => /\bBasic\b/.test(s.type) && isLand(s);

export function newDeck({ name, format = 'commander' }) {
  return { v: 1, name: String(name || '').trim() || 'Untitled deck', format, groupBy: 'type', sections: [], cards: [] };
}

const clampQty = (n) => Math.max(1, Math.min(MAX_QTY, Math.round(n) || 1));

export function newRow(card, { board = 'main', qty = 1, commander = false } = {}) {
  return { id: rid(), qty: clampQty(qty), board, commander: board === 'main' && commander, section: null, card };
}

// Stessa stampa nella stessa zona = +quantità; altrimenti riga nuova (se c'è posto).
export function addCard(deck, card, { board = 'main', qty = 1 } = {}) {
  const i = deck.cards.findIndex((r) => r.board === board && r.card.sid === card.sid);
  if (i !== -1) {
    const cards = deck.cards.map((r, k) => (k === i ? { ...r, qty: clampQty(r.qty + qty) } : r));
    return { deck: { ...deck, cards }, added: true };
  }
  if (deck.cards.length >= MAX_ROWS) return { deck, added: false };
  return { deck: { ...deck, cards: [...deck.cards, newRow(card, { board, qty })] }, added: true };
}

// Import: items = [{ card: Snapshot, qty, board, commander }]. Le righe oltre MAX_ROWS si perdono.
export function addEntries(deck, items) {
  let d = deck;
  for (const it of items) {
    d = addCard(d, it.card, { board: it.board || 'main', qty: it.qty || 1 }).deck;
    if (it.commander) {
      const row = d.cards.find((r) => r.board === 'main' && r.card.sid === it.card.sid);
      if (row) d = setCommander(d, [row.id], true);
    }
  }
  return d;
}

export function removeRows(deck, ids) {
  const s = new Set(ids);
  return { ...deck, cards: deck.cards.filter((r) => !s.has(r.id)) };
}

export function setQty(deck, rowId, qty) {
  if (qty <= 0) return removeRows(deck, [rowId]);
  return { ...deck, cards: deck.cards.map((r) => (r.id === rowId ? { ...r, qty: clampQty(qty) } : r)) };
}

// +1 / -1 sulla quantità ATTUALE (non quella del render, che può essere vecchia).
export function bumpQty(deck, rowId, delta) {
  const row = deck.cards.find((r) => r.id === rowId);
  return row ? setQty(deck, rowId, row.qty + delta) : deck;
}

// Righe uguali (stessa zona, stampa, sezione e ruolo) diventano una sola.
function mergeSame(cards) {
  const out = [];
  const seen = new Map();
  for (const r of cards) {
    const k = `${r.board}|${r.card.sid}|${r.section ?? ''}|${r.commander}`;
    const i = seen.get(k);
    if (i === undefined) { seen.set(k, out.length); out.push(r); }
    else out[i] = { ...out[i], qty: clampQty(out[i].qty + r.qty) };
  }
  return out;
}

export function setCommander(deck, ids, on) {
  const s = new Set(ids);
  return { ...deck, cards: deck.cards.map((r) => (s.has(r.id) ? { ...r, commander: on, board: on ? 'main' : r.board } : r)) };
}

export function moveToBoard(deck, ids, board) {
  const s = new Set(ids);
  const cards = deck.cards.map((r) => (s.has(r.id) ? { ...r, board, commander: board === 'main' && r.commander } : r));
  return { ...deck, cards: mergeSame(cards) };
}

const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);

export function boardCounts(deck) {
  const of = (b) => deck.cards.filter((r) => r.board === b);
  return { main: sum(of('main')), side: sum(of('side')), maybe: sum(of('maybe')), commanders: deck.cards.filter((r) => r.board === 'main' && r.commander).length };
}

export const countTarget = (format) => (format === 'commander' ? 100 : format === 'casual' ? null : 60);

export function countOk(format, main) {
  const t = countTarget(format);
  if (t == null) return true;
  return format === 'commander' ? main === t : main >= t;
}

// Copie da aggiungere con le scorciatoie: Shift chiede 4, ma nel singleton (Commander) solo le
// terre base e le carte "any number" ne prendono 4; le carte "up to N" al massimo N.
export function copiesToAdd(format, card, four) {
  if (!four) return 1;
  if (card.limit != null && card.limit > 0) return Math.min(4, card.limit);
  if (format !== 'commander' || isBasicLand(card) || card.limit === 0) return 4;
  return 1;
}
