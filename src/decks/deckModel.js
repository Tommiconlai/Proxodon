/**
 * Logica pura dei mazzi (niente React, niente Firebase): la usano editor, lista, import ed export.
 * Un mazzo è { v, name, format, groupBy, sections, cards }; ogni riga di `cards` è
 * { id, qty, board: 'main'|'side'|'maybe', commander, section, card: Snapshot }.
 * Le funzioni non mutano: ritornano sempre un mazzo nuovo.
 */

import { parseCardList, deckLine, MAX_LINES, TOO_MANY_LINES } from '../utils/scryfall.js';

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

// Tag dei mazzi: solo da questa lista, al massimo MAX_TAGS. deckTags scarta quelli ignoti (backup, copie vecchie).
export const DECK_TAGS = [
  '+1/+1 Counters', '-1/-1 Counters', 'Abzan (WBG)', 'Affinity', 'Aggression (WBRG)', 'Aggro', 'Aikido', 'Altruism (WURG)',
  'Aristocrats', 'Artifacts', 'Artifice (WUBR)', 'Attractions', 'Auras', 'Azorius (WU)', 'Bant (GWU)', 'Battlecruiser',
  'Birthing Pod / Pod', 'Blink / Flicker', 'Blue Moon', 'Boros (RW)', 'Budget', 'Burn', 'Cascade', 'Casual', 'cEDH', 'Chaos',
  'Chaos (UBRG)', 'Clones', 'Coin Flips', 'Colorless', 'Combo', 'Competitive', 'Control', 'Cycling', 'Death & Taxes',
  'Defender', 'Delver', 'Devotion', 'Dimir (UB)', 'Discard', 'Discover', 'Donation', 'Dredge', 'Dungeons', 'Eggs',
  'Enchantments', 'Energy', 'Equipment', 'Esper (WUB)', 'Extra Combats', 'Extra Turns', 'Farm', 'Five Color (WUBRG)',
  'Flying', 'Formula X-1', 'Goad', 'Golgari (BG)', 'Goodstuff', 'Grixis (UBR)', 'Group Hug', 'Group Slug', 'Growth (WUBG)',
  'Gruul (RG)', 'Hatebears', 'Help Wanted', 'Historic', 'Infect', 'Izzet (UR)', 'Jank', 'Jeskai (URW)', 'Jund (BRG)',
  'Kindred', 'Land Destruction', 'Lands Matter', 'Legends Matter', 'Life Bargain', 'Life Gain', 'Mardu (RWB)', 'Maverick',
  'Midrange', 'Mill', 'Miracles', 'Modified', 'Modular', 'Monarch', 'Mono Black', 'Mono Blue', 'Mono Green', 'Mono Red',
  'Mono White', 'Morph', 'Mutate', 'Naya (RGW)', 'Orzhov (WB)', 'Pillowfort', 'Poison', 'Primer', 'Prison', 'Rakdos (BR)',
  'Ramp', 'Reanimator', 'Rock', 'Rule Zero', 'Selesnya (GW)', 'Simic (GU)', 'Snow', 'Spellslinger', 'Stax', 'Stoneblade',
  'Storm', 'Sultai (BGU)', 'Super Friends', 'Tempo', 'Temur (GUR)', 'Thieves', 'Tokens', 'Toolbox', 'Tron', 'Turbo',
  'Unmaintained', 'Vehicles', 'Voltron', 'Vorthos', 'Webcam Friendly', 'Wheels', 'X Spells', 'Zoo',
];
export const MAX_TAGS = 5;
export const deckTags = (deck) => (Array.isArray(deck?.tags) ? [...new Set(deck.tags)].filter((t) => DECK_TAGS.includes(t)).slice(0, MAX_TAGS) : []);

// Dilemmi: da 2 a MAX_DILEMMA_CARDS carte. splitSlices(n) = il riquadro del dilemma diviso in n fette da
// linee oblique (in alto 20/n % a destra del confine diritto, in basso 20/n % a sinistra; con 2 carte 60 / 40).
// Per fetta: left / width (%) del riquadro dell'immagine e clip-path dentro di lui; lines = [x in alto, x in basso].
export const MAX_DILEMMA_CARDS = 4;
export function splitSlices(n) {
  const r = (v) => Math.round(v * 100) / 100;
  const edge = (k, s) => (k === 0 || k === n ? (k / n) * 100 : (k / n) * 100 + (s * 20) / n);
  const top = (k) => edge(k, 1);
  const bot = (k) => edge(k, -1);
  return {
    slices: Array.from({ length: n }, (_, i) => {
      const left = bot(i);
      const width = top(i + 1) - left;
      const x = (v) => `${r(((v - left) / width) * 100)}%`;
      return { left: r(left), width: r(width), clip: `polygon(${x(top(i))} 0, ${x(top(i + 1))} 0, ${x(bot(i + 1))} 100%, ${x(bot(i))} 100%)` };
    }),
    lines: Array.from({ length: n - 1 }, (_, k) => [r(top(k + 1)), r(bot(k + 1))]),
  };
}

// Help request: il tipo (stessi id delle regole Firestore) e fino a MAX_HELP_CARDS carte su cui concentrarsi. Nelle
// risposte le carte da aggiungere e da togliere non hanno un limite per chi risponde: MAX_REPLY_CARDS (le righe di un
// mazzo) è solo il tetto di sicurezza, lo stesso delle regole.
export const HELP_KINDS = [
  ['cuts', 'Cuts'], ['upgrades', 'Upgrades'], ['budget', 'Budget'], ['mana', 'Mana base'], ['synergy', 'Synergy'], ['other', 'Other'],
];
export const MAX_HELP_CARDS = 10;
export const MAX_REPLY_CARDS = 500;
// Tipo del trascinamento delle carte del mazzo verso fuori (la zona Cuts delle help request): gli id delle righe in JSON.
export const DRAG_ROWS = 'application/x-proxodon-rows';
export const helpKindLabel = (id) => HELP_KINDS.find(([k]) => k === id)?.[1] || 'Other';
// Apply di una risposta: prima i tagli (cut = oracle id, una copia dal main, mai il comandante), poi le aggiunte
// (add = snapshot, una copia in main, saltate quelle già al limite del formato). → { deck, added: [snapshot],
// cut: [riga com'era prima del taglio] }, quello che è cambiato davvero (serve all'Undo, revertSuggestion).
export function applySuggestion(deck, add, cut) {
  let d = deck;
  const removed = [];
  for (const oid of cut) {
    const row = d.cards.find((r) => r.board === 'main' && !r.commander && r.card.oid === oid);
    if (row) { d = bumpQty(d, row.id, -1); removed.push(row); }
  }
  const added = [];
  for (const card of add) {
    const have = d.cards.filter((r) => r.board === 'main' && r.card.oid === card.oid).reduce((n, r) => n + r.qty, 0);
    if (have >= maxCopies(d.format, card)) continue;
    const r = addCard(d, card);
    if (r.added) { d = r.deck; added.push(card); }
  }
  return { deck: d, added, cut: removed };
}
// Undo di un Apply: toglie solo le copie aggiunte e rimette solo quelle tagliate (la riga com'era, se era sparita);
// le altre modifiche fatte nel frattempo restano.
export function revertSuggestion(deck, { added, cut }) {
  let d = deck;
  for (const card of added) {
    const row = d.cards.find((r) => r.board === 'main' && r.card.sid === card.sid);
    if (row) d = bumpQty(d, row.id, -1);
  }
  for (const row of cut) {
    d = d.cards.some((r) => r.id === row.id) ? bumpQty(d, row.id, 1) : { ...d, cards: [...d.cards, { ...row, qty: 1 }] };
  }
  return d;
}
// Dati delle help request e dei dilemmi letti da Firestore: li scrive chiunque abbia un account (le regole contano
// solo le carte, non le guardano), quindi prima di mostrarli si tengono solo le carte ben fatte, con stringhe corte.
// Senza i caratteri di controllo bidirezionali (U+202A-202E, U+2066-2069): un nome non può rovesciare il testo vicino.
const BIDI = /[‪-‮⁦-⁩]/g;
const str = (v, n) => (typeof v === 'string' ? v.replace(BIDI, '').slice(0, n) : '');
// Immagini solo Scryfall già qui (scryfallImg), non solo dove si mostrano: un componente nuovo non può dimenticarlo.
export const cleanCards = (list, max = MAX_HELP_CARDS) => (Array.isArray(list) ? list : [])
  .filter((c) => c && typeof c === 'object' && typeof c.name === 'string' && typeof c.oid === 'string' && typeof c.sid === 'string')
  .slice(0, max)
  .map((c) => ({ name: str(c.name, 200), img: scryfallImg(str(c.img, 500)), back: scryfallImg(str(c.back, 500)), sid: str(c.sid, 64), oid: str(c.oid, 64), set: str(c.set, 12), cn: str(c.cn, 12) }));
// Il mazzo copiato sulla richiesta quando nasce (nome, autore, formato, copertina): il feed non deve leggere i mazzi.
const cleanDeckInfo = (d) => (d && typeof d === 'object' && typeof d.name === 'string'
  ? { name: str(d.name, 80), owner: str(d.owner, 24) || null, format: str(d.format, 20), cover: scryfallImg(str(d.cover, 500)) } : null);
export const cleanHelp = (h) => ({
  ...h, kind: str(h.kind, 20), text: str(h.text, 500), status: h.status === 'solved' ? 'solved' : 'open',
  cards: cleanCards(h.cards), applied: Array.isArray(h.applied) ? h.applied.filter((x) => typeof x === 'string') : [], deck: cleanDeckInfo(h.deck),
});
export const cleanReply = (r) => ({ ...r, text: str(r.text, 1000), owner: str(r.owner, 24) || null, add: cleanCards(r.add, MAX_REPLY_CARDS), cut: cleanCards(r.cut, MAX_REPLY_CARDS) });
// Notifiche delle schede: dilemmi o richieste (dai feed, con deckId) dei giocatori seguiti (uid) a cui l'account non ha
// ancora risposto (done = id {deck}_{id}, le tracce answered / replied).
export const countUnanswered = (list, following, done) =>
  list.filter((x) => following.has(x.uid) && !done.has(`${x.deckId}_${x.id}`)).length;

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
// vengono dalla faccia anteriore (DFC, split, avventure); back = immagine del retro, solo per le carte a
// due facce stampate (split e avventure hanno un'immagine sola). Nessun campo undefined: Firestore li rifiuta.
export function snapshotFromCard(c) {
  const f0 = c.card_faces?.[0];
  const imgs = c.image_uris || f0?.image_uris || {};
  const text = c.oracle_text ?? (c.card_faces || []).map((f) => f.oracle_text || '').join('\n');
  const legal = {};
  for (const f of LEGAL_FORMATS) legal[f] = c.legalities?.[f] || 'not_legal';
  const type = (f0 ? f0.type_line : c.type_line) || '';
  return {
    sid: c.id,
    oid: c.oracle_id || f0?.oracle_id || c.id,
    name: c.name,
    mana: (f0 ? f0.mana_cost : c.mana_cost) || '',
    mv: c.cmc ?? 0,
    type,
    colors: f0?.colors || c.colors || [],
    ci: c.color_identity || [],
    produced: c.produced_mana || [],
    legal,
    set: c.set || '',
    setName: c.set_name || '',
    cn: c.collector_number || '',
    rarity: c.rarity || '',
    artist: c.artist || f0?.artist || '',
    img: imgs.normal || '',
    back: (!c.image_uris && c.card_faces?.[1]?.image_uris?.normal) || '',
    art: imgs.art_crop || '',
    limit: copyLimitFromText(text || ''),
    // Può guidare un mazzo Commander: creatura leggendaria o "can be your commander".
    cmdr: (/\bLegendary\b/.test(type) && /\bCreature\b/.test(type)) || /can be your commander/i.test(text || ''),
    // Game changer (lista ufficiale dei Commander bracket, campo Scryfall): segnato nei mazzi Commander.
    gc: !!c.game_changer,
    // Prezzi Scryfall (eur = Cardmarket, usd = TCGplayer), aggiornati dal riallineamento all'apertura.
    eur: Number(c.prices?.eur) || null,
    usd: Number(c.prices?.usd) || null,
  };
}

export const isLand = (s) => /\bLand\b/.test(s.type);
// Fascia della curva (0-7, 7 = 7+) di un valore di mana: mai fuori dall'elenco, anche con un valore strano.
const mvBin = (mv) => Math.max(0, Math.min(7, Math.floor(mv) || 0));
export const isBasicLand = (s) => /\bBasic\b/.test(s.type) && isLand(s);

export function newDeck({ name, format = 'commander', groupBy = 'type' }) {
  return { v: 1, name: String(name || '').trim() || 'Untitled deck', format, groupBy, sections: [], cover: null, cards: [], tags: [] };
}

// Prezzo formattato ("€312.40") o null: valuta 'off' o nessuna carta con prezzo (mazzo non ancora
// riallineato con Scryfall dopo l'aggiunta dei prezzi).
export function priceLabel(deck, cur) {
  if (cur !== 'eur' && cur !== 'usd') return null;
  const p = deckPrice(deck, cur);
  if (!p.total && p.missing) return null;
  return new Intl.NumberFormat('en', { style: 'currency', currency: cur.toUpperCase() }).format(p.total);
}

// Prezzo del mazzo nella valuta scelta ('eur' | 'usd'): main e sideboard, maybeboard esclusa.
// missing = righe senza prezzo (il totale le esclude).
export function deckPrice(deck, cur) {
  let total = 0;
  let missing = 0;
  for (const r of deck.cards) {
    if (r.board === 'maybe') continue;
    if (r.card[cur] == null) missing += 1;
    else total += r.card[cur] * r.qty;
  }
  return { total: Math.round(total * 100) / 100, missing };
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
// merge: false = una riga per voce anche se la stessa stampa compare più volte (impostazione).
export function addEntries(deck, items, { merge = true } = {}) {
  let d = deck;
  for (const it of items) {
    const opts = { board: it.board || 'main', qty: it.qty || 1 };
    d = merge || d.cards.length >= MAX_ROWS ? addCard(d, it.card, opts).deck : { ...d, cards: [...d.cards, newRow(it.card, opts)] };
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
  // Oltre MAX_ROWS lo spostamento non avviene (servirebbe un messaggio, caso rarissimo).
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
  if (card.legal?.[format] === 'restricted') return 1; // Vintage
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
  { id: 'subtype', label: 'Subtype' },
  { id: 'mv', label: 'Mana value' },
  { id: 'color', label: 'Color' },
  { id: 'identity', label: 'Color identity' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'set', label: 'Set' },
  { id: 'artist', label: 'Artist' },
  { id: 'custom', label: 'Custom sections' }, // solo con sezioni: ci si arriva creandone una
];
// Modi a chiave semplice: key = la chiave di una carta ('' = dato che manca, gruppo in fondo), label = il nome del
// gruppo, order = l'ordine delle chiavi (senza, per nome del gruppo).
const DASH = String.fromCharCode(0x2014); // il trattino lungo dei type line di Scryfall
const RARITIES = ['mythic', 'rare', 'uncommon', 'common', 'special', 'bonus'];
const COLOR_NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
const colorKey = (cs) => [...'WUBRG'].filter((c) => cs.includes(c)).join('');
const colorRank = (k) => [...k].map((c) => 'WUBRG'.indexOf(c)).join('');
// Le combinazioni con il nome dei tag dei mazzi ("Azorius (WU)", "Five Color (WUBRG)"), per chiave in ordine WUBRG.
const COMBOS = new Map(DECK_TAGS.map((t) => t.match(/^.+ \(([WUBRG]{2,})\)$/)).filter(Boolean).map((m) => [colorKey(m[1]), m[0]]));
const colorMode = (field) => ({
  key: (s) => colorKey(s[field]),
  label: (k) => (!k ? 'Colorless' : COLOR_NAMES[k] || COMBOS.get(k) || k),
  order: (a, b) => a.length - b.length || colorRank(a).localeCompare(colorRank(b)), // monocolore prima, poi WUBRG
});
const rarityRank = (k) => (RARITIES.includes(k) ? RARITIES.indexOf(k) : RARITIES.length);
const SIMPLE_MODES = {
  subtype: { key: (s) => s.type.split(DASH)[1]?.trim() || '', label: (k) => k || 'No subtype' }, // tutto dopo il trattino
  color: colorMode('colors'),
  identity: colorMode('ci'),
  rarity: { key: (s) => s.rarity, label: (k) => (k ? k[0].toUpperCase() + k.slice(1) : 'Unknown rarity'), order: (a, b) => rarityRank(a) - rarityRank(b) },
  // Nome dell'espansione dalla prima carta che ce l'ha (gli snapshot vecchi hanno solo il codice, fino al riallineamento).
  set: {
    key: (s) => s.set,
    label: (k, rows) => {
      const name = rows.find((r) => r.card.setName)?.card.setName;
      return !k ? 'Unknown set' : name ? `${name} (${k.toUpperCase()})` : k.toUpperCase();
    },
  },
  artist: { key: (s) => s.artist, label: (k) => k || 'Unknown artist' },
};
// Tipi di carta nel type line, nell'ordine scritto ("Artifact Creature"); i sottotipi non
// coincidono mai con questi nomi, i supertipi (Legendary, Basic) restano fuori.
const CARD_TYPES = new Set(['Kindred', 'Tribal', 'Artifact', 'Enchantment', 'Land', 'Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery']);
const cardTypes = (type) => type.split(/\s+/).filter((w) => CARD_TYPES.has(w));
const plural = (t) => TYPE_LABEL[t] || `${t}s`;

const byName = (a, b) => a.card.name.localeCompare(b.card.name);
const byMvName = (a, b) => a.card.mv - b.card.mv || byName(a, b);
// Ordine dentro un gruppo: 'mv' = costo poi nome, 'name' = solo nome.
export const SORT_MODES = [{ id: 'mv', label: 'Mana value' }, { id: 'name', label: 'Name' }];
// Viste dell'editor (menu View by e Settings).
export const VIEWS = [
  { id: 'list', label: 'List' },
  { id: 'grid', label: 'Grid' },
  { id: 'stacks', label: 'Stacks' },
  { id: 'split', label: 'Stacks, every copy' },
];
const sorter = (sort) => (sort === 'name' ? byName : byMvName);

export const commanderRows = (deck) => deck.cards.filter((r) => r.board === 'main' && r.commander);

// Commander bracket. Sul mazzo: 1-5 = scelto a mano, 0 = spento, assente = automatico; altri valori (file, copie
// altrui) contano come assente. Automatico: nessun Game Changer = 2, da 1 a 3 = 3, 4 o più = 4 (1 e 5 solo a mano).
export const BRACKETS = ['Exhibition', 'Core', 'Upgraded', 'Optimized', 'cEDH'];
const okBracket = (b) => Number.isInteger(b) && b >= 0 && b <= 5;
export const bracketField = (b) => (okBracket(b) ? { bracket: b } : {});
// Game Changer distinti tra mazzo e comandante: side e maybeboard non contano.
export const gameChangers = (d) => new Set(d.cards.filter((r) => r.board === 'main' && r.card.gc).map((r) => r.card.oid)).size;
export const autoBracket = (d) => { const n = gameChangers(d); return n === 0 ? 2 : n <= 3 ? 3 : 4; };
// Bracket da mostrare: solo nei mazzi Commander, null se spento.
export const deckBracket = (d) => (d.format !== 'commander' || d.bracket === 0 ? null
  : okBracket(d.bracket) ? d.bracket : autoBracket(d));
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
// famiglia del tipo principale; mv = 0..6, 7+ e terre a parte; custom = "Deck" poi le sezioni; gli altri da
// SIMPLE_MODES (sottotipo, colore, identità, rarità, set, artista).
// `sort` = ordine dentro i gruppi (SORT_MODES).
export function groupMain(deck, sort = 'mv') {
  const main = deck.cards.filter((r) => r.board === 'main' && !r.commander);
  const simple = SIMPLE_MODES[deck.groupBy];
  if (simple) {
    return [...bucket(main, (r) => simple.key(r.card) || '')]
      .map(([k, rows]) => ({ k, label: simple.label(k, rows), rows }))
      .sort((a, b) => !a.k - !b.k || (simple.order ? simple.order(a.k, b.k) : 0) || a.label.localeCompare(b.label))
      .map(({ k, label, rows }) => groupOf(`${deck.groupBy}-${k}`, label, rows, sort));
  }
  if (deck.groupBy === 'custom') {
    const known = new Set(deck.sections.map((s) => s.id));
    const by = bucket(main, (r) => (known.has(r.section) ? r.section : null));
    return [
      groupOf('deck', 'Deck', by.get(null) || [], sort, { section: null }),
      ...deck.sections.map((s) => groupOf(s.id, s.name, by.get(s.id) || [], sort, { section: s.id })),
    ];
  }
  if (deck.groupBy === 'mv') {
    const by = bucket(main, (r) => (isLand(r.card) ? 'land' : mvBin(r.card.mv)));
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
// Identità che la ricerca carte rispetta: solo Commander con almeno un comandante; null = nessun filtro.
export const searchIdentity = (deck) => (deck.format === 'commander' && commanderRows(deck).length ? deckIdentity(deck) : null);

// Firma del contenuto del mazzo, per "Updated": carte per oracle id (un cambio di edizione o d'arte
// non conta), quantità sommate per zona, sezione e comandante (dividere o unire righe non conta). Cambia
// solo se si aggiungono, tolgono o spostano carte. FNV-1a a 32 bit in esadecimale.
export function contentSig(cards) {
  const qty = new Map();
  for (const r of cards) {
    const k = `${r.card.oid}|${r.board}|${r.section ?? ''}|${r.commander ? 1 : 0}`;
    qty.set(k, (qty.get(k) || 0) + r.qty);
  }
  const s = [...qty].map(([k, q]) => `${k}|${q}`).sort().join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

// Ricerca e filtri della lista mazzi: parole del testo (lettere e cifre), poi un mazzo passa se il nome
// le contiene tutte, ha il formato scelto, ogni colore scelto è nella sua identità (C = incolore) e una
// carta fuori dal maybeboard ha nel nome il testo di card.
export const searchTerms = (q) => q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
export function deckMatches(deck, terms, { format, colors, card = '' }) {
  const name = [deck.name, ...deckTags(deck)].join(' ').toLowerCase(); // ricerca su nome e tag
  if (!terms.every((w) => name.includes(w)) || (format && deck.format !== format)) return false;
  const c = card.trim().toLowerCase();
  // Voce dell'indice della Community (cleanIndex): nomi e identità già pronti, niente righe.
  if (c && !(deck.names != null ? deck.names.toLowerCase().includes(c)
    : deck.cards.some((r) => r.board !== 'maybe' && r.card.name.toLowerCase().includes(c)))) return false;
  const id = deck.ci ?? deckIdentity(deck);
  return colors.every((c) => (c === 'C' ? !id.length : id.includes(c)));
}

// Copertina: la carta scelta (deck.cover = oracle id, così segue i cambi di edizione), altrimenti il
// primo comandante, altrimenti la prima carta del main. Carta scelta tolta dal mazzo = automatica.
export const coverRow = (deck) => (deck.cover && deck.cards.find((r) => r.card.oid === deck.cover))
  || commanderRows(deck)[0] || deck.cards.find((x) => x.board === 'main');
export const deckCover = (deck) => coverRow(deck)?.card.art || '';
// Campi dell'indice della Community (publicIndex) calcolati dal mazzo: identità come stringa ("WUG"), copertina,
// nomi delle carte fuori dal maybeboard (per Contains card), uno per riga; tetti come le regole.
export const indexFields = (d) => ({
  ci: deckIdentity(d).join(''), art: scryfallImg(deckCover(d)),
  names: [...new Set(d.cards.filter((r) => r.board !== 'maybe').map((r) => r.card.name))].join('\n').slice(0, 16000),
  bracket: deckBracket(d), // quello da mostrare sul riquadro (l'indice non ha le righe), null = nessuno
});

// Immagini dei mazzi solo da Scryfall (https, cards/svgs.scryfall.io), sennò '' (= segnaposto): i mazzi
// pubblici li scrive il proprietario e li legge chiunque, un altro host farebbe caricare a chi guarda
// immagini da un server qualsiasi (IP, tracciamento). href codifica le virgolette: sicuro dentro url("...").
const IMG_HOSTS = ['cards.scryfall.io', 'svgs.scryfall.io'];
export function scryfallImg(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && IMG_HOSTS.includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : '';
  } catch {
    return '';
  }
}
// Arte della carta (art_crop) da un'immagine Scryfall della carta: stessa immagine, altra versione nel percorso.
export const artCrop = (c) => scryfallImg((typeof c?.img === 'string' ? c.img : '').replace(/\/(small|normal|large|png|border_crop)\//, '/art_crop/').replace(/\.png(?=\?|$)/, '.jpg'));

// ── Verso la stampa ──────────────────────────────────────────

const frontName = (name) => name.split(' // ')[0];

// Voci per fetchScryfallImages: set + numero tengono l'edizione scelta. Comandanti per primi,
// sideboard solo se richiesta, maybeboard mai; in fondo i token (carte di Scryfall), una copia ciascuno.
export function toPrintEntries(deck, { includeSide = false, tokens = [] } = {}) {
  const cards = deck.cards
    .filter((r) => r.board === 'main' || (includeSide && r.board === 'side'))
    .sort((a, b) => Number(b.commander) - Number(a.commander))
    .map((r) => ({ qty: r.qty, name: frontName(r.card.name), set: r.card.set, collector: r.card.cn }));
  return [...cards, ...tokens.map((c) => ({ qty: 1, name: frontName(c.name), set: c.set, collector: c.collector_number }))];
}

// ── Testo ────────────────────────────────────────────────────

// Formato MTGA: "Commander" / "Deck" / "Sideboard" come intestazioni (solo quando servono),
// "qty Nome (SET) num" per riga, solo "qty Nome" con specs: false. La maybeboard resta solo nel backup JSON.
export function exportText(deck, { specs = true } = {}) {
  const line = (r) => deckLine(r.qty, frontName(r.card.name), specs && r.card.set, r.card.cn);
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
  // Companion (export di Arena): nel side, come in Arena; prima diventava una carta "Companion" e un comandante.
  [/^(sideboard|side|companions?)$/, 'side'],
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
  if (out.length > MAX_LINES) throw new Error(TOO_MANY_LINES);
  return out;
}

// ── Backup ───────────────────────────────────────────────────

const iso = (t) => {
  const d = t?.toDate ? t.toDate() : t instanceof Date ? t : t ? new Date(t) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

export function toBackup(decks, now = new Date()) {
  return {
    app: 'proxodon', kind: 'decks', v: 1, exportedAt: now.toISOString(),
    decks: decks.map((d) => ({
      v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cover: d.cover ?? null, cards: d.cards, tags: deckTags(d),
      ...bracketField(d.bracket), createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt),
    })),
  };
}

const BOARDS = ['main', 'side', 'maybe'];
const validRow = (r) => r && BOARDS.includes(r.board) && Number.isInteger(r.qty) && r.qty > 0
  && r.card && typeof r.card.sid === 'string' && typeof r.card.name === 'string';

// Mazzi scritti da altri o arrivati da fuori (copie pubbliche in Community, file di backup): le regole guardano solo i
// tipi di primo livello, il file nessuno. Righe e carte rifatte come le scrive snapshotFromCard (tipi giusti, testi
// corti, immagini solo Scryfall), così un documento scritto a mano non manda in errore chi lo apre; una riga senza
// carta valida si scarta.
const strs = (v, n, len) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x) => x.slice(0, len)) : []);
const num = (v) => (Number.isFinite(v) ? v : null);
function cleanSnap(c) {
  if (!c || typeof c !== 'object' || typeof c.name !== 'string' || typeof c.sid !== 'string') return null;
  const type = str(c.type, 200);
  return {
    // mv tra 0 e 1000: un valore negativo scritto a mano mandava in errore Stats (fascia della curva inesistente).
    sid: str(c.sid, 64), oid: str(c.oid, 64) || str(c.sid, 64), name: str(c.name, 200), mana: str(c.mana, 100),
    mv: Math.min(1000, Math.max(0, num(c.mv) ?? 0)),
    type, colors: strs(c.colors, 6, 1), ci: strs(c.ci, 6, 1), produced: strs(c.produced, 7, 1),
    legal: Object.fromEntries(LEGAL_FORMATS.map((f) => [f, str(c.legal?.[f], 20) || 'not_legal'])),
    set: str(c.set, 12), setName: str(c.setName, 80), cn: str(c.cn, 12), rarity: str(c.rarity, 12), artist: str(c.artist, 100),
    img: scryfallImg(c.img), back: scryfallImg(c.back), art: scryfallImg(c.art),
    limit: Number.isInteger(c.limit) && c.limit >= 0 ? c.limit : null,
    cmdr: typeof c.cmdr === 'boolean' ? c.cmdr : /\bLegendary\b/.test(type) && /\bCreature\b/.test(type),
    gc: c.gc === true, eur: num(c.eur), usd: num(c.usd),
  };
}
const cleanRow = (r) => {
  const card = r && typeof r === 'object' && BOARDS.includes(r.board) ? cleanSnap(r.card) : null;
  return card && {
    id: str(r.id, 64) || rid(), qty: clampQty(r.qty), board: r.board, commander: r.board === 'main' && r.commander === true,
    section: typeof r.section === 'string' ? r.section.slice(0, 64) : null, card,
  };
};
const cleanSections = (list) => (Array.isArray(list) ? list : [])
  .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string').slice(0, 50)
  .map((s) => ({ id: s.id.slice(0, 64), name: s.name.slice(0, 40) }));
const stamp = (t) => (typeof t?.toMillis === 'function' ? t : null);
// Profilo di un altro (pagina pubblica, users/{uid}): lo scrive il suo proprietario, quindi ripulito. Immagini solo come
// le accettano le regole (data URL JPEG / PNG / WebP in base64, sennò null): niente URL di altri host.
const PROFILE_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const profileImg = (v, max) => (typeof v === 'string' && v.length <= max && PROFILE_IMG.test(v) ? v : null);
export const cleanProfile = (p) => ({
  nickname: str(p?.nickname, 24) || null,
  photo: profileImg(p?.photo, 200000), banner: profileImg(p?.banner, 600000), since: stamp(p?.since),
});
// Copia pubblica letta da Firestore. null = da non mostrare: ritirata (resta solo { uid }, vedi unpublishDeck) o malformata.
export function cleanPublicDeck(d) {
  if (!d || typeof d.name !== 'string' || !Array.isArray(d.cards)) return null;
  return {
    id: d.id, v: 1, uid: str(d.uid, 128), owner: str(d.owner, 24) || null, public: true, name: str(d.name, 80),
    format: FORMATS.some((f) => f.id === d.format) ? d.format : 'casual',
    groupBy: GROUP_MODES.some((m) => m.id === d.groupBy) ? d.groupBy : 'type',
    cover: typeof d.cover === 'string' ? d.cover.slice(0, 64) : null, tags: deckTags(d), sections: cleanSections(d.sections),
    cards: d.cards.slice(0, MAX_ROWS).map(cleanRow).filter(Boolean),
    sig: str(d.sig, 32), createdAt: stamp(d.createdAt), changedAt: stamp(d.changedAt), updatedAt: stamp(d.updatedAt),
    ...bracketField(d.bracket),
  };
}
// Voce dell'indice della Community (publicIndex): la scrive chiunque abbia un account, quindi ripulita come le copie.
// Ha ci (identità), art (copertina) e names (nomi delle carte) al posto delle righe: DeckTile e deckMatches li usano.
export function cleanIndex(d) {
  if (!d || typeof d.name !== 'string') return null;
  return {
    id: d.id, uid: str(d.uid, 128), owner: str(d.owner, 24) || null, public: true, name: str(d.name, 80),
    format: FORMATS.some((x) => x.id === d.format) ? d.format : 'casual', tags: deckTags(d),
    ci: WUBRG.filter((c) => str(d.ci, 5).includes(c)), art: scryfallImg(d.art), names: str(d.names, 16000),
    bracket: Number.isInteger(d.bracket) && d.bracket >= 1 && d.bracket <= 5 ? d.bracket : null,
    createdAt: stamp(d.createdAt), changedAt: stamp(d.changedAt),
  };
}

// Backup → mazzi nuovi (id riga nuovi). Righe rotte scartate, carte ripulite (cleanRow: il file può venire da
// chiunque), formato ignoto = Casual; al massimo MAX_RESTORE mazzi (ognuno è una scrittura). 'proxoteca' = backup
// fatti prima del cambio di nome.
const BACKUP_APPS = ['proxodon', 'proxoteca'];
const MAX_RESTORE = 500;
export function fromBackup(json) {
  if (!json || !BACKUP_APPS.includes(json.app) || json.kind !== 'decks' || !Array.isArray(json.decks)) {
    throw new Error('This file is not a Proxodon deck backup.');
  }
  if (json.v !== 1) throw new Error(`Unsupported backup version (${json.v}).`);
  if (json.decks.length > MAX_RESTORE) throw new Error(`This backup has ${json.decks.length} decks: restore at most ${MAX_RESTORE} at a time.`);
  return json.decks.map((d) => ({
    ...newDeck({ name: str(d?.name, 80), format: FORMATS.some((f) => f.id === d?.format) ? d.format : 'casual' }),
    groupBy: GROUP_MODES.some((m) => m.id === d?.groupBy) ? d.groupBy : 'type',
    cover: typeof d?.cover === 'string' ? d.cover.slice(0, 64) : null,
    tags: deckTags(d),
    sections: cleanSections(d?.sections),
    cards: (Array.isArray(d?.cards) ? d.cards : []).filter(validRow).slice(0, MAX_ROWS).map(cleanRow).filter(Boolean)
      .map((r) => ({ ...r, id: rid(), commander: r.board === 'main' && !!r.commander })),
    ...bracketField(d?.bracket),
  }));
}

export function duplicateDeck(deck) {
  return {
    ...newDeck({ name: `${deck.name} (copy)`, format: deck.format }),
    groupBy: deck.groupBy,
    cover: deck.cover ?? null,
    tags: deckTags(deck),
    sections: deck.sections.map((s) => ({ ...s })),
    cards: deck.cards.map((r) => ({ ...r, id: rid() })),
    ...bracketField(deck.bracket),
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

// ── Statistiche e validazione ────────────────────────────────

const PIP_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];
// Simboli colorati di un costo: un ibrido conta per ogni suo colore, un phyrexian per il suo colore,
// {C} come incolore; generico, X e neve no.
export function manaPips(cost) {
  const out = Object.fromEntries(PIP_COLORS.map((c) => [c, 0]));
  for (const t of (cost || '').match(/\{[^}]+\}/g) || []) {
    for (const p of t.slice(1, -1).split('/')) if (p in out) out[p] += 1;
  }
  return out;
}

// Tipi per la probabilità di pescata, terre per prime (la domanda più comune).
const DRAW_TYPES = ['Land', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];
const PERMANENT = /\b(Creature|Artifact|Enchantment|Planeswalker|Battle)\b/;
const round2 = (x) => Math.round(x * 100) / 100;
const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
// Statistiche del main board (comandanti inclusi; sideboard e maybeboard mai). Curva dei non terra
// 0..7+: permanenti e magie, righe della barra e le stesse divise per tipo. Media e mediana del
// costo con e senza terre, costo totale. Per colore: simboli nei costi (anche per costo) contro
// carte che producono quel mana (e quante sono terre). library = main senza comandanti;
// drawTypes = copie per tipo nel grimorio (una carta multi-tipo conta in ognuno), solo i presenti.
export function deckStats(deck) {
  const main = deck.cards.filter((r) => r.board === 'main');
  const spells = main.filter((r) => !isLand(r.card));
  const curve = Array.from({ length: 8 }, (_, mv) => ({ mv, count: 0, perm: 0, spell: 0, ids: [], groups: [] }));
  for (const r of spells) {
    const b = curve[mvBin(r.card.mv)];
    b.count += r.qty;
    b[PERMANENT.test(r.card.type) ? 'perm' : 'spell'] += r.qty;
    b.ids.push(r.id);
  }
  for (const b of curve) {
    const rows = spells.filter((r) => b.ids.includes(r.id)).sort(byName);
    b.groups = TYPE_ORDER.map((t) => ({ label: TYPE_LABEL[t], rows: rows.filter((r) => primaryType(r.card.type) === t) })).filter((g) => g.rows.length);
  }
  const mvs = (rows) => rows.flatMap((r) => Array(r.qty).fill(r.card.mv));
  const all = mvs(main);
  const nonLand = mvs(spells);
  const total = all.reduce((n, x) => n + x, 0);
  const makers = main.filter((r) => r.card.produced?.length);
  const colors = PIP_COLORS.map((c) => {
    const byMv = Array(8).fill(0);
    for (const r of main) byMv[mvBin(r.card.mv)] += manaPips(r.card.mana)[c] * r.qty;
    const src = makers.filter((r) => r.card.produced.includes(c));
    return { c, pips: byMv.reduce((n, x) => n + x, 0), byMv, sources: sum(src), landSources: sum(src.filter((r) => isLand(r.card))) };
  });
  return {
    cards: sum(main), lands: sum(main) - sum(spells), library: sum(main.filter((r) => !r.commander)),
    avgMv: nonLand.length ? round2(total / nonLand.length) : null, avgAll: all.length ? round2(total / all.length) : null,
    medianMv: median(nonLand), medianAll: median(all), totalMv: total,
    curve, colors, pips: colors.reduce((n, c) => n + c.pips, 0), sources: sum(makers),
    drawTypes: DRAW_TYPES.map((type) => ({
      type, label: TYPE_LABEL[type], count: sum(main.filter((r) => !r.commander && new RegExp(`\\b${type}\\b`).test(r.card.type))),
    })).filter((t) => t.count),
  };
}

// Probabilità ipergeometrica di avere almeno k successi pescando n carte da N con K successi
// (es. almeno 3 terre entro il turno 3). Coefficienti binomiali in virgola mobile: bastano fino a ~1000 carte.
const choose = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};
export function hyperAtLeast(N, K, n, k) {
  const draws = Math.min(n, N);
  let p = 0;
  for (let i = 0; i < k; i++) p += (choose(K, i) * choose(N - K, draws - i)) / choose(N, draws);
  return Math.min(1, Math.max(0, 1 - p));
}

// Snapshot vecchi senza cmdr: si deduce dal tipo finché il riallineamento non lo aggiunge.
const canCommand = (s) => s.cmdr ?? (/\bLegendary\b/.test(s.type) && /\bCreature\b/.test(s.type));

// Problemi del mazzo (mai bloccanti), ognuno con le righe da evidenziare. Il numero di carte sta
// nelle statistiche e nel riquadro della lista mazzi. Casual: nessun controllo.
export function validateDeck(deck) {
  const f = deck.format;
  if (f === 'casual') return [];
  const out = [];
  const counted = (r) => r.board === 'main' || (r.board === 'side' && f !== 'commander');
  const names = (rows) => [...new Set(rows.map((r) => r.card.name))].join(', ');
  const ids = (rows) => rows.map((r) => r.id);
  const side = deck.cards.filter((r) => r.board === 'side');
  if (f === 'commander') {
    const cmd = commanderRows(deck);
    if (!cmd.length) out.push({ key: 'nocmd', level: 'warn', label: 'No commander yet', ids: [] });
    if (cmd.length > 2) out.push({ key: 'toomany', level: 'warn', label: `${cmd.length} commanders, max 2`, ids: ids(cmd) });
    const bad = cmd.filter((r) => !canCommand(r.card));
    if (bad.length) out.push({ key: 'notcmd', level: 'warn', label: `Can't be a commander: ${names(bad)}`, ids: ids(bad) });
    if (cmd.length) {
      const allowed = new Set(cmd.flatMap((r) => r.card.ci));
      const off = deck.cards.filter((r) => r.board === 'main' && !r.commander && r.card.ci.some((c) => !allowed.has(c)));
      if (off.length) out.push({ key: 'identity', level: 'warn', label: `Outside the commander's colors: ${names(off)}`, ids: ids(off) });
    }
    if (side.length) out.push({ key: 'side', level: 'warn', label: 'Commander has no sideboard', ids: ids(side) });
  } else if (sum(side) > 15) {
    out.push({ key: 'sidesize', level: 'warn', label: `Sideboard ${sum(side)}/15`, ids: ids(side) });
  }
  const over = overLimit(deck);
  if (over.length) {
    const oids = new Set(over.map((e) => e.oid));
    out.push({
      key: 'copies', level: 'warn', label: `Over the copy limit: ${over.map((e) => `${e.name} ${e.count}/${e.max}`).join(', ')}`,
      ids: ids(deck.cards.filter((r) => counted(r) && oids.has(r.card.oid))),
    });
  }
  const illegal = deck.cards.filter((r) => counted(r) && illegalIn(f, r.card));
  if (illegal.length) {
    const label = [...new Map(illegal.map((r) => [r.card.oid, `${r.card.name}${illegalIn(f, r.card) === 'banned' ? ' (banned)' : ''}`])).values()].join(', ');
    out.push({ key: 'illegal', level: 'error', label: `Not allowed in ${formatLabel(f)}: ${label}`, ids: ids(illegal) });
  }
  return out;
}

// Vista stack: pile (altezze in px, nell'ordine dei gruppi) in colonne alte al massimo quanto la
// pila più alta. Ogni pila va nella prima colonna in cui ci sta (es. sotto il comandante), sennò
// ne apre una nuova. Ritorna gli indici delle pile per colonna.
export function packPiles(heights, gap) {
  const max = Math.max(0, ...heights);
  const cols = [];
  heights.forEach((h, i) => {
    const col = cols.find((c) => c.h + gap + h <= max);
    if (col) { col.ids.push(i); col.h += gap + h; } else cols.push({ h, ids: [i] });
  });
  return cols.map((c) => c.ids);
}

// Vista stack da telefono e tablet: pile (altezze, nell'ordine dei gruppi) in n colonne contigue, la più alta il
// più bassa possibile (ricerca binaria sull'altezza massima, riempimento in ordine). Indici delle pile per colonna.
export function splitPiles(heights, n) {
  const fill = (max) => heights.reduce((cols, h, i) => {
    const c = cols[cols.length - 1];
    if (c && c.h + h <= max) { c.h += h; c.ids.push(i); } else cols.push({ h, ids: [i] });
    return cols;
  }, []);
  let lo = Math.max(0, ...heights);
  let hi = heights.reduce((a, h) => a + h, 0);
  for (let k = 0; k < 40 && hi - lo > 0.5; k++) {
    const mid = (lo + hi) / 2;
    if (fill(mid).length <= n) hi = mid; else lo = mid;
  }
  return fill(hi).map((c) => c.ids);
}

// ── Mano di prova ────────────────────────────────────────────

// Grimorio: una voce per copia del main board, comandanti esclusi (partono dalla zona di comando).
export function libraryCards(deck) {
  return deck.cards.filter((r) => r.board === 'main' && !r.commander)
    .flatMap((r) => Array.from({ length: r.qty }, (_, i) => ({ key: `${r.id}:${i}`, card: r.card })));
}

// Fisher-Yates su una copia; rng iniettabile per il self-check.
export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Mulligan London: dopo N mulligan si pescano 7 carte e se ne mettono N in fondo. In Commander
// (multiplayer) il primo non conta (regola 103.5c).
export const mulliganBottom = (format, mulls) => Math.max(0, format === 'commander' ? mulls - 1 : mulls);
