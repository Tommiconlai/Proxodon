/**
 * Logica pura dei mazzi (niente React, niente Firebase): la usano editor, lista, import ed export.
 * Un mazzo è { v, name, format, groupBy, sections, cards }; ogni riga di `cards` è
 * { id, qty, board: 'main'|'side'|'maybe', commander, section, card: Snapshot }.
 * Le funzioni non mutano: ritornano sempre un mazzo nuovo.
 */

import { parseCardList, deckLine } from '../utils/scryfall.js';

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

// Sezioni custom (solo main board): { id, name } in deck.sections, la riga punta con `section`.
// Creare una sezione porta il mazzo in raggruppamento custom; eliminare l'ultima lo riporta a Type.
const sectionName = (name) => String(name || '').trim().slice(0, 40) || 'Section';
export function addSection(deck, name) {
  const id = rid();
  return { deck: { ...deck, groupBy: 'custom', sections: [...deck.sections, { id, name: sectionName(name) }] }, id };
}
export const renameSection = (deck, id, name) =>
  ({ ...deck, sections: deck.sections.map((s) => (s.id === id ? { ...s, name: sectionName(name) } : s)) });
// Eliminare una sezione riporta le sue righe nella lista principale ("Deck").
export function deleteSection(deck, id) {
  const cards = deck.cards.map((r) => (r.section === id ? { ...r, section: null } : r));
  const sections = deck.sections.filter((s) => s.id !== id);
  const groupBy = !sections.length && deck.groupBy === 'custom' ? 'type' : deck.groupBy;
  return { ...deck, groupBy, sections, cards: mergeSame(cards) };
}
// Trascinamento: righe nella zona di destinazione, nella sezione se indicata (undefined = resta
// la sua). Lasciata in un gruppo o in un'altra zona, una riga non è più comandante.
// `one` (Alt+trascina): una copia per riga; la riga resta con una copia in meno.
export function placeRows(deck, ids, board, section, { one = false } = {}) {
  const s = new Set(ids);
  const moved = (r, extra) => ({ ...r, ...extra, board, commander: false, ...(section !== undefined && { section }) });
  const cards = deck.cards.flatMap((r) => {
    if (!s.has(r.id)) return [r];
    if (one && r.qty > 1) return [{ ...r, qty: r.qty - 1 }, moved(r, { id: rid(), qty: 1 })];
    return [moved(r)];
  });
  const merged = mergeSame(cards);
  // ponytail: oltre MAX_ROWS lo spostamento non avviene (servirebbe un messaggio, caso rarissimo).
  return merged.length > MAX_ROWS ? deck : { ...deck, cards: merged };
}
export function moveToSection(deck, ids, section) {
  const s = new Set(ids);
  return { ...deck, cards: mergeSame(deck.cards.map((r) => (s.has(r.id) ? { ...r, section } : r))) };
}

// Split row: una copia in una riga nuova subito dopo (stessa zona e sezione), per darle un'altra
// edizione. Non si fonde subito; righe uguali tornano una sola al prossimo spostamento.
export function splitRow(deck, rowId) {
  const i = deck.cards.findIndex((r) => r.id === rowId);
  const r = deck.cards[i];
  if (!r || r.qty < 2 || deck.cards.length >= MAX_ROWS) return deck;
  const cards = [...deck.cards];
  cards.splice(i, 1, { ...r, qty: r.qty - 1 }, { ...r, id: rid(), qty: 1 });
  return { ...deck, cards };
}

// Cambio edizione: le righe prendono lo snapshot della stampa scelta (stessa carta); righe che
// diventano uguali nella stessa zona si fondono.
export function changeEdition(deck, ids, card) {
  const s = new Set(ids);
  return { ...deck, cards: mergeSame(deck.cards.map((r) => (s.has(r.id) ? { ...r, card } : r))) };
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

// Legalità nel formato del mazzo: 'banned' o 'not_legal' (dato mancante = non legale, come in
// snapshotFromCard) bloccano l'aggiunta dalla ricerca; legal e restricted no; Casual nessun controllo.
// Per una carta Scryfall grezza: illegalIn(format, { legal: c.legalities }).
export function illegalIn(format, card) {
  if (format === 'casual') return null;
  const l = card.legal?.[format] || 'not_legal';
  return l === 'banned' || l === 'not_legal' ? l : null;
}
export const legalityLabel = (status, format) => `${status === 'banned' ? 'Banned' : 'Not legal'} in ${formatLabel(format)}`;

// Copie ammesse di una carta: Infinity = nessun limite (Casual, terre base, "any number"),
// "up to N" = N, altrimenti 1 in Commander e 4 nei formati da 60.
export function maxCopies(format, card) {
  if (format === 'casual' || isBasicLand(card) || card.limit === 0) return Infinity;
  if (card.limit > 0) return card.limit;
  return format === 'commander' ? 1 : 4;
}

// Carte oltre il limite, contate per oracle id (stampe diverse insieme) su main e, fuori da
// Commander, sideboard; maybeboard mai. → [{ oid, name, count, max }] nell'ordine del mazzo.
export function overLimit(deck) {
  const by = new Map();
  for (const r of deck.cards) {
    if (r.board === 'maybe' || (r.board === 'side' && deck.format === 'commander')) continue;
    const e = by.get(r.card.oid) || { oid: r.card.oid, name: r.card.name, count: 0, max: maxCopies(deck.format, r.card) };
    e.count += r.qty;
    by.set(r.card.oid, e);
  }
  return [...by.values()].filter((e) => e.count > e.max);
}

// ── Viste ────────────────────────────────────────────────────

// Tipo che decide il gruppo: il primo che combacia in quest'ordine (Artifact Creature → Creature,
// Artifact Land → Land).
const TYPE_PRIORITY = ['Land', 'Creature', 'Planeswalker', 'Battle', 'Artifact', 'Enchantment', 'Instant', 'Sorcery'];
const TYPE_ORDER = ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Other'];
const TYPE_LABEL = {
  Creature: 'Creatures', Planeswalker: 'Planeswalkers', Battle: 'Battles', Instant: 'Instants', Sorcery: 'Sorceries',
  Artifact: 'Artifacts', Enchantment: 'Enchantments', Land: 'Lands', Other: 'Other',
};

export const primaryType = (type) => TYPE_PRIORITY.find((t) => new RegExp(`\\b${t}\\b`).test(type)) || 'Other';

// Modi di raggruppamento del main board (deck.groupBy).
export const GROUP_MODES = [
  { id: 'type', label: 'Type' },
  { id: 'typeAdv', label: 'Type, advanced' },
  { id: 'mv', label: 'Mana value' },
  { id: 'custom', label: 'Custom sections' }, // solo con sezioni: ci si arriva creandone una
];
// Tipi di carta nel type line, nell'ordine scritto ("Artifact Creature"); i sottotipi non
// coincidono mai con questi nomi, i supertipi (Legendary, Basic) restano fuori.
const CARD_TYPES = new Set(['Kindred', 'Tribal', 'Artifact', 'Enchantment', 'Land', 'Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery']);
const cardTypes = (type) => type.split(/\s+/).filter((w) => CARD_TYPES.has(w));
const plural = (t) => TYPE_LABEL[t] || `${t}s`;

const byName = (a, b) => a.card.name.localeCompare(b.card.name);
const byMvName = (a, b) => a.card.mv - b.card.mv || byName(a, b);
// Ordine dentro un gruppo: 'mv' = costo poi nome, 'name' = solo nome.
export const SORT_MODES = [{ id: 'mv', label: 'Mana value' }, { id: 'name', label: 'Name' }];
const sorter = (sort) => (sort === 'name' ? byName : byMvName);

export const commanderRows = (deck) => deck.cards.filter((r) => r.board === 'main' && r.commander);
export const boardRows = (deck, board, sort) => deck.cards.filter((r) => r.board === board).sort(sorter(sort));

const bucket = (rows, keyOf) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
};
const groupOf = (key, label, rows, sort, extra) => ({ key, label, rows: rows.sort(sorter(sort)), count: sum(rows), ...extra });

// Main board (comandanti esclusi) raggruppato secondo deck.groupBy:
// type = tipo principale; typeAdv = combinazione di tipi ("Artifact Creatures" a parte), nella
// famiglia del tipo principale; mv = 0..6, 7+ e terre a parte; custom = "Deck" poi le sezioni.
// `sort` = ordine dentro i gruppi (SORT_MODES).
export function groupMain(deck, sort = 'mv') {
  const main = deck.cards.filter((r) => r.board === 'main' && !r.commander);
  if (deck.groupBy === 'custom') {
    const known = new Set(deck.sections.map((s) => s.id));
    const by = bucket(main, (r) => (known.has(r.section) ? r.section : null));
    return [
      groupOf('deck', 'Deck', by.get(null) || [], sort, { section: null }),
      ...deck.sections.map((s) => groupOf(s.id, s.name, by.get(s.id) || [], sort, { section: s.id })),
    ];
  }
  if (deck.groupBy === 'mv') {
    const by = bucket(main, (r) => (isLand(r.card) ? 'land' : Math.min(7, Math.floor(r.card.mv))));
    return [0, 1, 2, 3, 4, 5, 6, 7, 'land'].filter((k) => by.has(k))
      .map((k) => groupOf(`mv${k}`, k === 'land' ? 'Lands' : `${k}${k === 7 ? '+' : ''} mana`, by.get(k), sort));
  }
  if (deck.groupBy === 'typeAdv') {
    const by = bucket(main, (r) => cardTypes(r.card.type).join(' ') || 'Other');
    const rank = (k) => TYPE_ORDER.indexOf(primaryType(k));
    const keys = [...by.keys()].sort((a, b) => rank(a) - rank(b) || a.split(' ').length - b.split(' ').length || a.localeCompare(b));
    return keys.map((k) => {
      const t = k.split(' ');
      return groupOf(k, [...t.slice(0, -1), plural(t[t.length - 1])].join(' '), by.get(k), sort);
    });
  }
  const by = bucket(main, (r) => primaryType(r.card.type));
  return TYPE_ORDER.filter((k) => by.has(k)).map((k) => groupOf(k, TYPE_LABEL[k], by.get(k), sort));
}

const WUBRG = ['W', 'U', 'B', 'R', 'G'];

// Identità del mazzo: quella dei comandanti, o (senza comandante) l'unione del main.
export function deckIdentity(deck) {
  const cmd = commanderRows(deck);
  const src = cmd.length ? cmd : deck.cards.filter((r) => r.board === 'main');
  const set = new Set(src.flatMap((r) => r.card.ci));
  return WUBRG.filter((c) => set.has(c));
}

export function deckCover(deck) {
  const r = commanderRows(deck)[0] || deck.cards.find((x) => x.board === 'main');
  return r?.card.art || '';
}

// ── Verso la stampa ──────────────────────────────────────────

const frontName = (name) => name.split(' // ')[0];

// Voci per fetchScryfallImages: set + numero tengono l'edizione scelta. Comandanti per primi,
// sideboard solo se richiesta, maybeboard mai.
export function toPrintEntries(deck, { includeSide = false } = {}) {
  return deck.cards
    .filter((r) => r.board === 'main' || (includeSide && r.board === 'side'))
    .sort((a, b) => Number(b.commander) - Number(a.commander))
    .map((r) => ({ qty: r.qty, name: frontName(r.card.name), set: r.card.set, collector: r.card.cn }));
}

// ── Testo ────────────────────────────────────────────────────

// Formato MTGA: "Commander" / "Deck" / "Sideboard" come intestazioni (solo quando servono),
// "qty Nome (SET) num" per riga. La maybeboard resta solo nel backup JSON.
export function exportText(deck) {
  const line = (r) => deckLine(r.qty, frontName(r.card.name), r.card.set, r.card.cn);
  const cmd = commanderRows(deck).map(line);
  const main = deck.cards.filter((r) => r.board === 'main' && !r.commander).map(line);
  const side = deck.cards.filter((r) => r.board === 'side').map(line);
  const out = cmd.length ? ['Commander', ...cmd, '', 'Deck', ...main] : [...main];
  if (side.length) out.push('', 'Sideboard', ...side);
  return out.join('\n');
}

const HEADERS = [
  [/^commanders?$/, 'commander'],
  [/^(deck|main|mainboard)$/, 'main'],
  [/^(sideboard|side)$/, 'side'],
  [/^(maybeboard|maybe|considering)$/, 'maybe'],
];

// Lista incollata → voci con zona. Le intestazioni (maiuscole o no, con "//" davanti o ":" in
// fondo) cambiano la zona di destinazione; le righe vuote no. Senza intestazioni: tutto nel main.
export function parseDeckText(text) {
  let target = 'main';
  const out = [];
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const h = raw.trim().replace(/^\/\/\s*/, '').replace(/:$/, '').trim().toLowerCase();
    const hit = HEADERS.find(([re]) => re.test(h));
    if (hit) { target = hit[1]; continue; }
    for (const e of parseCardList(raw)) {
      out.push({ ...e, board: target === 'commander' ? 'main' : target, commander: target === 'commander' });
    }
  }
  return out;
}

// ── Backup ───────────────────────────────────────────────────

const iso = (t) => {
  const d = t?.toDate ? t.toDate() : t instanceof Date ? t : t ? new Date(t) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

export function toBackup(decks, now = new Date()) {
  return {
    app: 'proxoteca', kind: 'decks', v: 1, exportedAt: now.toISOString(),
    decks: decks.map((d) => ({
      v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cards: d.cards,
      createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt),
    })),
  };
}

const BOARDS = ['main', 'side', 'maybe'];
const validRow = (r) => r && BOARDS.includes(r.board) && Number.isInteger(r.qty) && r.qty > 0
  && r.card && typeof r.card.sid === 'string' && typeof r.card.name === 'string';

// Backup → mazzi nuovi (id riga nuovi). Righe rotte scartate, formato ignoto = Casual.
export function fromBackup(json) {
  if (!json || json.app !== 'proxoteca' || json.kind !== 'decks' || !Array.isArray(json.decks)) {
    throw new Error('This file is not a Proxoteca deck backup.');
  }
  if (json.v !== 1) throw new Error(`Unsupported backup version (${json.v}).`);
  return json.decks.map((d) => ({
    ...newDeck({ name: d?.name, format: FORMATS.some((f) => f.id === d?.format) ? d.format : 'casual' }),
    groupBy: GROUP_MODES.some((m) => m.id === d?.groupBy) ? d.groupBy : 'type',
    sections: Array.isArray(d?.sections) ? d.sections.filter((s) => s && s.id && s.name) : [],
    cards: (Array.isArray(d?.cards) ? d.cards : []).filter(validRow).slice(0, MAX_ROWS)
      .map((r) => ({ id: rid(), qty: clampQty(r.qty), board: r.board, commander: r.board === 'main' && !!r.commander, section: r.section ?? null, card: r.card })),
  }));
}

export function duplicateDeck(deck) {
  return {
    ...newDeck({ name: `${deck.name} (copy)`, format: deck.format }),
    groupBy: deck.groupBy,
    sections: deck.sections.map((s) => ({ ...s })),
    cards: deck.cards.map((r) => ({ ...r, id: rid() })),
  };
}

// Confronto profondo che ignora l'ordine delle chiavi (Firestore può riordinarle).
const same = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => same(a[k], b[k]));
};

// Riallinea gli snapshot ai dati Scryfall freschi (ban, legalità, immagini). Stesso oggetto
// se non cambia nulla, così l'editor non scrive.
export function refreshSnapshots(deck, cardsById) {
  let changed = false;
  const cards = deck.cards.map((r) => {
    const c = cardsById.get(r.card.sid);
    if (!c) return r;
    const card = snapshotFromCard(c);
    if (same(card, r.card)) return r;
    changed = true;
    return { ...r, card };
  });
  return changed ? { deck: { ...deck, cards }, changed } : { deck, changed };
}
