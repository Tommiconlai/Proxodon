# Deck manager, phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 1 of the deck manager: Decks/Print tabs, Google sign-in, a synced deck list, a deck editor with name search and add shortcuts, commander / sideboard / maybeboard, text import/export, JSON backup, privacy and account deletion, and "Print deck" into the existing print queue.

**Architecture:** A lazy-loaded `src/decks/` area (React.lazy) holds Firebase (Auth Google + Firestore with persistent offline cache), a pure `deckModel.js` (all deck logic, node self-checked), a thin `deckStore.js` (one Firestore document per deck at `users/{uid}/decks/{deckId}`) and the screens. `App.jsx` gains hash routes (`#/print` default, `#/decks`, `#/decks/:id`), header tabs, and `handlePrintDeck(entries)` which reuses `fetchScryfallImages`.

**Tech Stack:** React 19, Vite 7, plain CSS (`src/index.css` tokens), Firebase JS SDK (modular: `firebase/app`, `firebase/auth`, `firebase/firestore`), Scryfall REST API.

**Spec:** `docs/superpowers/specs/2026-10-13-deck-manager-design.md` (phases 2 and 3 get their own plans later).

## Global Constraints

- Never write the character U+2014 (em dash) in code, comments, docs, commit messages or UI copy; use a period or a comma.
- UI copy in English, sentence case for buttons ("New deck", "Print deck"); code comments in Italian, matching the surrounding code.
- Only one new dependency: `firebase`. No router, chart or UI libraries.
- Hash routes: empty hash means `#/print`; Decks area routes are `#/decks` and `#/decks/:id`.
- The Decks area requires Google sign-in; the print area keeps working without an account.
- Firestore path `users/{uid}/decks/{deckId}`, one document per deck, rules allow only the owner, `cards.size() <= 500`.
- Limits: 500 rows per deck (`MAX_ROWS`), 99 copies per row (`MAX_QTY`).
- Scryfall: autocomplete debounced 250 ms with the previous request aborted, `/cards/collection` in batches of 75 with 100 ms between batches, every search adds `game:paper`.
- Add shortcuts: Enter = 1 to main, Alt+Enter = 1 to sideboard (maybeboard in Commander), Shift+Enter = 4 (or the format limit), Alt+Shift+Enter = 4 to sideboard; same modifiers on mouse clicks of **+**.
- Design identity: cyberpunk tokens from `src/index.css` (`--cyan`, `--accent`, `--font-display`, `--font-mono`, `[ BRACKET ]` headings); the print sheet stays pure white.
- After every task: `node src/decks/deckModel.selfcheck.js` (once it exists), `npm run lint`, `npm run build`, HANDOFF.md updated (file table + "Done recently"), then commit and push to `main` (the user's standing rule). End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verify UI changes live in the Browser pane (`preview_start` name `vite-dev`) before committing; the user signs in to Google personally (never type their credentials).

## Review Focus

1. Double-faced, split and adventure cards: costs, types and images must come from the front face while printing still prints both faces (tests in Task 1, live check in Task 11).
2. Pasted lists in other tools' formats: CRLF line endings, "SIDEBOARD:" in capitals, `// Maybeboard`, blank lines and "4x" quantities must import into the right boards (test in Task 2).
3. A backup file from somewhere else or hand-edited: a readable error for a foreign file, invalid rows dropped, unknown formats mapped to Casual (test in Task 2).
4. Card names with quotes, commas or non-ASCII letters ("Kongming, \"Sleeping Dragon\"", "Æther Vial") must survive Scryfall URLs (test in Task 3).
5. Decks at the limits: the 501st row is refused with a message, a row never exceeds 99, Shift+Enter in Commander adds 1 except for basic lands and "any number" cards (tests in Task 1).

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/decks/deckModel.js` | create | Pure deck logic: snapshots, rows, counts, grouping, print entries, text import/export, backup, refresh |
| `src/decks/deckModel.selfcheck.js` | create | node-runnable asserts for `deckModel.js` and the Scryfall URL builders |
| `src/decks/scryfallSearch.js` | create | Autocomplete, named lookup, search, cards by id, resolve parsed entries to snapshots |
| `src/utils/scryfall.js` | modify | Export `scryfallFetch` (abort passthrough, `status` on 4xx), extract `lookupCards`, add `fetchDeckBoards` |
| `src/components/CardMenu.jsx` | create | Context menu extracted from `PagePreview.jsx` (unchanged behaviour) |
| `src/components/PagePreview.jsx` | modify | Import `CardMenu` instead of defining it |
| `src/components/MobileLayout.jsx` | modify | Export `MobilePage`; accept `tabs` and `altBody` |
| `src/components/NavTabs.jsx` | create | "Decks / Print" header tabs |
| `src/components/icons.jsx` | modify | New icons (log out, info, printer, arrow left, search, upload, pencil, minus, crown) |
| `src/hooks/useHashRoute.js` | create | `useHashRoute()` and `navigate(path)` |
| `src/hooks/useLongPress.js` | create | Long-press handlers for touch context menus |
| `src/App.jsx` | modify | Tabs, routes, lazy Decks area, `notify`, `handlePrintDeck` |
| `src/decks/firebaseConfig.js` | create | Public Firebase web config (values from the user) |
| `src/decks/firebase.js` | create | Init (auth, Firestore persistent cache), sign in/out, watch user, delete account |
| `src/decks/deckStore.js` | create | Firestore listen/create/save/delete for decks |
| `src/decks/useDeck.js` | create | Editor hook: local state + debounced save + sync state |
| `src/decks/DecksView.jsx` | create | Lazy root: auth gate, sign-in panel, routes list/editor |
| `src/decks/AccountMenu.jsx` | create | Avatar menu: privacy, sign out, delete account and data |
| `src/decks/dialogs.jsx` | create | `NameFormatDialog`, `PrintDeckDialog`, `PrivacyPanel` |
| `src/decks/Mana.jsx` | create | `ManaCost` and `ManaPips` (Scryfall symbol SVGs) |
| `src/decks/DeckList.jsx` | create | Deck tiles, new/rename/duplicate/delete, export text, backup/restore |
| `src/decks/ImportDeckDialog.jsx` | create | Import from link or pasted list |
| `src/decks/DeckEditor.jsx` | create | Editor shell: top bar, search column / mobile sheet, sections, print |
| `src/decks/DeckSections.jsx` | create | Commander block, type groups, sideboard, maybeboard, rows, selection, row menu |
| `src/decks/CardSearch.jsx` | create | Search box, autocomplete, add shortcuts, results grid, zoom |
| `src/components/CookieBanner.jsx` | modify | Mention the sign-in session |
| `src/index.css` | modify | Tabs, decks, editor, search styles |
| `firestore.rules` | create | Security rules to publish in the Firebase console |
| `HANDOFF.md` | modify | File table rows and "Done recently" per task |

---

### Task 1: Deck model core (snapshots, rows, counts, add copies)

**Files:**
- Create: `src/decks/deckModel.js`
- Test: `src/decks/deckModel.selfcheck.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all named exports of `deckModel.js`):
  - `FORMATS: {id, label}[]` (commander, standard, pioneer, modern, legacy, vintage, pauper, casual), `formatLabel(id): string`
  - `MAX_ROWS = 500`, `MAX_QTY = 99`, `rid(): string`
  - `copyLimitFromText(text): number|null`, `snapshotFromCard(scryfallCard): Snapshot`, `isBasicLand(snap)`, `isLand(snap)`
  - `newDeck({name, format}): Deck` (fields `v, name, format, groupBy, sections, cards`)
  - `newRow(snap, {board, qty, commander}): Row`
  - `addCard(deck, snap, {board='main', qty=1}): {deck, added}`; `addEntries(deck, items: {card, qty, board, commander}[]): Deck`
  - `setQty(deck, rowId, qty)`, `bumpQty(deck, rowId, delta)`, `removeRows(deck, ids)`, `setCommander(deck, ids, on)`, `moveToBoard(deck, ids, board)`: all return a new `Deck`
  - `boardCounts(deck): {main, side, maybe, commanders}`, `countTarget(format): number|null`, `countOk(format, mainCount): boolean`
  - `copiesToAdd(format, snap, four: boolean): number`

- [ ] **Step 1: Write the failing self-check**

Create `src/decks/deckModel.selfcheck.js`:

```js
// Self-check della logica mazzi. Esegui: node src/decks/deckModel.selfcheck.js
// ponytail: niente framework, un file, assert via throw (come scryfall.selfcheck.js).
import {
  snapshotFromCard, copyLimitFromText, newDeck, addCard, setQty, bumpQty, removeRows, setCommander,
  moveToBoard, boardCounts, countOk, copiesToAdd, MAX_ROWS, MAX_QTY,
} from './deckModel.js';

const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}\n  atteso ${JSON.stringify(b)}\n  ottenuto ${JSON.stringify(a)}`);
  }
};

// Carta Scryfall minima (solo i campi letti da snapshotFromCard).
const sc = (o) => ({
  id: o.id, oracle_id: `o-${o.id}`, name: o.name, mana_cost: o.mana ?? '', cmc: o.mv ?? 0,
  type_line: o.type ?? 'Creature', colors: o.colors ?? [], color_identity: o.ci ?? o.colors ?? [],
  produced_mana: o.produced, legalities: o.legal ?? { commander: 'legal', modern: 'legal' },
  set: o.set ?? 'tst', collector_number: o.cn ?? '1', oracle_text: o.text ?? '',
  image_uris: { normal: `n-${o.id}`, art_crop: `a-${o.id}` },
});
const snap = (o) => snapshotFromCard(sc(o));

// snapshot base
const bolt = snap({ id: 'bolt', name: 'Lightning Bolt', mana: '{R}', mv: 1, type: 'Instant', colors: ['R'] });
eq([bolt.sid, bolt.oid, bolt.mana, bolt.mv, bolt.type, bolt.colors, bolt.ci, bolt.produced, bolt.set, bolt.cn, bolt.img, bolt.art, bolt.limit],
  ['bolt', 'o-bolt', '{R}', 1, 'Instant', ['R'], ['R'], [], 'tst', '1', 'n-bolt', 'a-bolt', null], 'snapshot base');
eq(Object.keys(bolt.legal), ['commander', 'standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper'], 'legal: 7 formati');
eq([bolt.legal.commander, bolt.legal.standard], ['legal', 'not_legal'], 'legal: mancante = not_legal');

// DFC (Review Focus 1): faccia anteriore per costo, tipo, colori, immagini; nome pieno
const delver = snapshotFromCard({
  id: 'dlv', name: 'Delver of Secrets // Insectile Aberration', cmc: 1, color_identity: ['U'],
  legalities: { modern: 'legal' }, set: 'isd', collector_number: '51',
  card_faces: [
    { name: 'Delver of Secrets', mana_cost: '{U}', type_line: 'Creature', colors: ['U'], oracle_id: 'o-dlv',
      oracle_text: 'At the beginning of your upkeep, look at the top card of your library.', image_uris: { normal: 'n-front', art_crop: 'a-front' } },
    { name: 'Insectile Aberration', mana_cost: '', type_line: 'Creature', colors: ['U'], oracle_text: 'Flying', image_uris: { normal: 'n-back' } },
  ],
});
eq([delver.name, delver.oid, delver.mana, delver.type, delver.colors, delver.img, delver.art],
  ['Delver of Secrets // Insectile Aberration', 'o-dlv', '{U}', 'Creature', ['U'], 'n-front', 'a-front'], 'DFC: faccia anteriore');

// limite copie dal testo regole
eq(copyLimitFromText('A deck can have any number of cards named Relentless Rats.'), 0, 'any number');
eq(copyLimitFromText('A deck can have up to seven cards named Seven Dwarves.'), 7, 'up to seven');
eq(copyLimitFromText('Flying'), null, 'nessun limite');

// aggiunta e quantità
let d = newDeck({ name: '  Test  ', format: 'commander' });
eq([d.name, d.format, d.groupBy, d.sections, d.cards.length], ['Test', 'commander', 'type', [], 0], 'nuovo mazzo');
d = addCard(d, bolt, { qty: 1 }).deck;
d = addCard(d, bolt, { qty: 2 }).deck;
eq(d.cards.map((r) => [r.board, r.qty]), [['main', 3]], 'stessa stampa e zona = +qty');
d = addCard(d, bolt, { board: 'side' }).deck;
eq(d.cards.map((r) => r.board), ['main', 'side'], 'altra zona = riga nuova');
d = addCard(d, bolt, { qty: 500 }).deck;
eq(d.cards[0].qty, MAX_QTY, 'tetto 99 copie (Review Focus 5)');
d = setQty(d, d.cards[0].id, 0);
eq(d.cards.map((r) => r.board), ['side'], 'qty 0 rimuove la riga');
d = bumpQty(d, d.cards[0].id, -1);
eq(d.cards.length, 0, 'bump a 0 rimuove');

// tetto righe (Review Focus 5)
let big = newDeck({ name: 'Big' });
for (let i = 0; i < MAX_ROWS; i++) big = addCard(big, snap({ id: `c${i}`, name: `Card ${i}` })).deck;
const over = addCard(big, snap({ id: 'extra', name: 'Extra' }));
eq([over.added, over.deck.cards.length], [false, MAX_ROWS], 'oltre 500 righe non aggiunge');
eq(addCard(big, snap({ id: 'c0', name: 'Card 0' })).added, true, 'a 500 righe una copia in più di una riga esistente va bene');

// comandante e zone
const atraxa = snap({ id: 'atx', name: "Atraxa, Praetors' Voice", mana: '{G}{W}{U}{B}', mv: 4, type: 'Legendary Creature', ci: ['W', 'U', 'B', 'G'] });
d = addCard(newDeck({ name: 'C' }), atraxa, { board: 'maybe' }).deck;
d = setCommander(d, [d.cards[0].id], true);
eq([d.cards[0].board, d.cards[0].commander], ['main', true], 'il comandante va nel main');
d = moveToBoard(d, [d.cards[0].id], 'side');
eq([d.cards[0].board, d.cards[0].commander], ['side', false], 'fuori dal main non è comandante');
d = addCard(d, atraxa, { board: 'main' }).deck;
d = moveToBoard(d, d.cards.map((r) => r.id), 'main');
eq(d.cards.map((r) => [r.board, r.qty]), [['main', 2]], 'lo spostamento unisce righe uguali');
d = removeRows(d, [d.cards[0].id]);
eq(d.cards.length, 0, 'rimozione');

// conteggi
d = newDeck({ name: 'Cnt', format: 'modern' });
d = addCard(d, bolt, { qty: 4 }).deck;
d = addCard(d, bolt, { board: 'side', qty: 3 }).deck;
d = addCard(d, atraxa, { board: 'maybe' }).deck;
eq(boardCounts(d), { main: 4, side: 3, maybe: 1, commanders: 0 }, 'conteggi per zona');
eq([countOk('modern', 59), countOk('modern', 60), countOk('modern', 75)], [false, true, true], 'minimo 60');
eq([countOk('commander', 99), countOk('commander', 100), countOk('commander', 101)], [false, true, false], 'esattamente 100');
eq(countOk('casual', 3), true, 'casual senza controlli');

// copie con Shift (Review Focus 5)
const forest = snap({ id: 'for', name: 'Forest', type: 'Basic Land', produced: ['G'] });
const rats = snap({ id: 'rat', name: 'Relentless Rats', text: 'A deck can have any number of cards named Relentless Rats.' });
const dwarves = snap({ id: 'dwf', name: 'Seven Dwarves', text: 'A deck can have up to seven cards named Seven Dwarves.' });
eq([copiesToAdd('commander', bolt, false), copiesToAdd('commander', bolt, true), copiesToAdd('modern', bolt, true)], [1, 1, 4], 'Shift: 4 solo fuori dal singleton');
eq([copiesToAdd('commander', forest, true), copiesToAdd('commander', rats, true), copiesToAdd('commander', dwarves, true), copiesToAdd('casual', bolt, true)],
  [4, 4, 4, 4], 'eccezioni al singleton');

console.log('deckModel selfcheck: ok');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/decks/deckModel.selfcheck.js`
Expected: FAIL with `Cannot find module` (or `ERR_MODULE_NOT_FOUND`) for `./deckModel.js`.

- [ ] **Step 3: Implement `src/decks/deckModel.js` (core)**

```js
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
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node src/decks/deckModel.selfcheck.js`
Expected: `deckModel selfcheck: ok`

- [ ] **Step 5: Lint, HANDOFF, commit**

Run: `npx eslint src/decks` (expected: no output).
In `HANDOFF.md`, add to the file table:
`| src/decks/deckModel.js | Pure deck logic (snapshot from Scryfall card with front-face data, rows, add/qty/commander/board moves, counts, Shift copy rules). Self-check: node src/decks/deckModel.selfcheck.js |`
and a "Done recently" line: "Deck manager phase 1, task 1: deck model core."

```bash
git add src/decks/deckModel.js src/decks/deckModel.selfcheck.js HANDOFF.md
git commit -m "feat(decks): deck model core with self-check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Deck model views and I/O (grouping, print entries, text, backup, refresh)

**Files:**
- Modify: `src/decks/deckModel.js` (append)
- Test: `src/decks/deckModel.selfcheck.js` (append before the final `console.log`)

**Interfaces:**
- Consumes: Task 1 exports; `parseCardList`, `deckLine` from `src/utils/scryfall.js`.
- Produces:
  - `primaryType(typeLine): 'Land'|'Creature'|'Planeswalker'|'Battle'|'Artifact'|'Enchantment'|'Instant'|'Sorcery'|'Other'`
  - `groupMain(deck): {key, label, rows: Row[], count}[]` (main board, commanders excluded, type order)
  - `commanderRows(deck): Row[]`, `boardRows(deck, 'side'|'maybe'): Row[]`
  - `deckIdentity(deck): string[]` (WUBRG order), `deckCover(deck): string`
  - `toPrintEntries(deck, {includeSide=false}): {qty, name, set, collector}[]`
  - `exportText(deck): string`, `parseDeckText(text): {qty, name, set, collector, board, commander}[]`
  - `toBackup(decks, now?): object`, `fromBackup(json): Deck[]` (throws `Error` with a readable message)
  - `duplicateDeck(deck): Deck`, `refreshSnapshots(deck, cardsById: Map<string, scryfallCard>): {deck, changed}`

- [ ] **Step 1: Append the failing checks**

Add to the import list at the top of `deckModel.selfcheck.js`:

```js
import {
  groupMain, commanderRows, boardRows, deckIdentity, deckCover, toPrintEntries, exportText,
  parseDeckText, toBackup, fromBackup, duplicateDeck, refreshSnapshots, primaryType,
} from './deckModel.js';
```

Insert before `console.log('deckModel selfcheck: ok');`:

```js
// tipo primario
eq([primaryType('Artifact Creature'), primaryType('Artifact Land'), primaryType('Legendary Enchantment Creature'), primaryType('Kindred Instant'), primaryType('Conspiracy')],
  ['Creature', 'Land', 'Creature', 'Instant', 'Other'], 'tipo primario');

// raggruppamento per tipo
let g = newDeck({ name: 'G', format: 'commander' });
for (const c of [atraxa, bolt, forest,
  snap({ id: 'ring', name: 'Sol Ring', mana: '{1}', mv: 1, type: 'Artifact' }),
  snap({ id: 'gob', name: 'Goblin Guide', mana: '{R}', mv: 1, type: 'Creature' }),
  snap({ id: 'ac', name: 'Solemn Simulacrum', mana: '{4}', mv: 4, type: 'Artifact Creature' })]) g = addCard(g, c).deck;
g = setCommander(g, [g.cards[0].id], true);
g = addCard(g, snap({ id: 'side1', name: 'Pyroblast', type: 'Instant' }), { board: 'side' }).deck;
eq(groupMain(g).map((x) => [x.label, x.rows.map((r) => r.card.name), x.count]),
  [['Creatures', ['Goblin Guide', 'Solemn Simulacrum'], 2], ['Instants', ['Lightning Bolt'], 1], ['Artifacts', ['Sol Ring'], 1], ['Lands', ['Forest'], 1]],
  'gruppi per tipo: ordine, senza comandante e sideboard, ordinati per costo e nome');
eq(commanderRows(g).map((r) => r.card.name), ["Atraxa, Praetors' Voice"], 'riga comandante');
eq(boardRows(g, 'side').map((r) => r.card.name), ['Pyroblast'], 'righe sideboard');
eq([deckIdentity(g), deckCover(g)], [['W', 'U', 'B', 'G'], 'a-atx'], 'identità e copertina dal comandante');
eq(deckIdentity(addCard(newDeck({ name: 'x', format: 'modern' }), bolt).deck), ['R'], 'identità senza comandante = carte del main');

// verso la stampa
eq(toPrintEntries(g).map((e) => e.name),
  ["Atraxa, Praetors' Voice", 'Lightning Bolt', 'Forest', 'Sol Ring', 'Goblin Guide', 'Solemn Simulacrum'], 'stampa: comandante primo, sideboard esclusa');
eq(toPrintEntries(g, { includeSide: true }).length, 7, 'stampa con sideboard');
eq(toPrintEntries(addCard(newDeck({ name: 'd' }), delver).deck), [{ qty: 1, name: 'Delver of Secrets', set: 'isd', collector: '51' }],
  'stampa: nome della faccia anteriore, set e numero (Review Focus 1)');

// testo: export e re-import con le zone
const txt = exportText(g);
eq(txt.split('\n'), ['Commander', "1 Atraxa, Praetors' Voice (TST) 1", '', 'Deck', '1 Lightning Bolt (TST) 1', '1 Forest (TST) 1',
  '1 Sol Ring (TST) 1', '1 Goblin Guide (TST) 1', '1 Solemn Simulacrum (TST) 1', '', 'Sideboard', '1 Pyroblast (TST) 1'], 'export MTGA');
eq(parseDeckText(txt).map((e) => [e.board, e.commander, e.name]),
  [['main', true, "Atraxa, Praetors' Voice"], ['main', false, 'Lightning Bolt'], ['main', false, 'Forest'], ['main', false, 'Sol Ring'],
    ['main', false, 'Goblin Guide'], ['main', false, 'Solemn Simulacrum'], ['side', false, 'Pyroblast']], 'import con intestazioni');
eq(exportText(addCard(newDeck({ name: 'n', format: 'modern' }), bolt, { qty: 4 }).deck), '4 Lightning Bolt (TST) 1', 'export senza comandante né sideboard');
// input disordinato (Review Focus 2)
eq(parseDeckText('4x Lightning Bolt\r\n\r\nSIDEBOARD:\r\n2 Pyroblast\r\n// Maybeboard\r\n1 Sol Ring (C21) 263').map((e) => [e.board, e.qty, e.name, e.set, e.collector]),
  [['main', 4, 'Lightning Bolt', '', ''], ['side', 2, 'Pyroblast', '', ''], ['maybe', 1, 'Sol Ring', 'c21', '263']], 'import tollerante');

// backup (Review Focus 3)
g = addCard(g, bolt, { board: 'maybe' }).deck;
eq(toPrintEntries(g, { includeSide: true }).length, 7, 'maybeboard mai in stampa');
const bk = toBackup([{ ...g, id: 'x1', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: null }], new Date('2026-10-13T00:00:00Z'));
eq([bk.app, bk.kind, bk.v, bk.exportedAt, bk.decks[0].createdAt, bk.decks[0].updatedAt, 'id' in bk.decks[0]],
  ['proxoteca', 'decks', 1, '2026-10-13T00:00:00.000Z', '2026-01-01T00:00:00.000Z', null, false], 'backup');
const restored = fromBackup(JSON.parse(JSON.stringify(bk)));
eq([restored[0].name, restored[0].cards.length, restored[0].cards[0].id === g.cards[0].id], [g.name, g.cards.length, false], 'ripristino con id riga nuovi');
let threw = '';
try { fromBackup({ app: 'other' }); } catch (e) { threw = e.message; }
eq(threw, 'This file is not a Proxoteca deck backup.', 'file estraneo');
eq(fromBackup({ app: 'proxoteca', kind: 'decks', v: 1, decks: [{ name: 'R', format: 'nope', cards: [
  { board: 'main', qty: 2, card: { sid: 's', name: 'N' } }, { board: 'oops', qty: 1, card: { sid: 's', name: 'N' } }, { qty: -1 }] }] })
  .map((x) => [x.format, x.cards.length]), [['casual', 1]], 'righe non valide scartate, formato ignoto = casual');

// duplicato e riallineamento con Scryfall
const dup = duplicateDeck(g);
eq([dup.name, dup.cards.length, dup.cards[0].id === g.cards[0].id], [`${g.name} (copy)`, g.cards.length, false], 'duplica');
const same = refreshSnapshots(g, new Map());
eq([same.changed, same.deck === g], [false, true], 'refresh senza dati: invariato');
const reordered = { ...g, cards: g.cards.map((r) => ({ ...r, card: Object.fromEntries(Object.entries(r.card).reverse()) })) };
const boltCard = sc({ id: 'bolt', name: 'Lightning Bolt', mana: '{R}', mv: 1, type: 'Instant', colors: ['R'] });
eq(refreshSnapshots(reordered, new Map([['bolt', boltCard]])).changed, false, 'chiavi in ordine diverso (come da Firestore) = invariato');
const banned = refreshSnapshots(g, new Map([['bolt', { ...boltCard, legalities: { commander: 'banned' } }]]));
eq([banned.changed, banned.deck.cards.find((r) => r.card.sid === 'bolt').card.legal.commander], [true, 'banned'], 'refresh aggiorna le legalità');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/decks/deckModel.selfcheck.js`
Expected: FAIL with `SyntaxError: The requested module './deckModel.js' does not provide an export named 'groupMain'`.

- [ ] **Step 3: Append the implementation to `src/decks/deckModel.js`**

Add at the top of the file, under the header comment:

```js
import { parseCardList, deckLine } from '../utils/scryfall.js';
```

Append at the end:

```js
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

const byMvName = (a, b) => a.card.mv - b.card.mv || a.card.name.localeCompare(b.card.name);

export const commanderRows = (deck) => deck.cards.filter((r) => r.board === 'main' && r.commander);
export const boardRows = (deck, board) => deck.cards.filter((r) => r.board === board).sort(byMvName);

// Main board (comandanti esclusi) raggruppato per tipo. ponytail: solo "type" in fase 1;
// mana value, colore e custom arrivano in fase 2 leggendo deck.groupBy.
export function groupMain(deck) {
  const map = new Map();
  for (const r of deck.cards) {
    if (r.board !== 'main' || r.commander) continue;
    const k = primaryType(r.card.type);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return TYPE_ORDER.filter((k) => map.has(k)).map((k) => {
    const rows = map.get(k).sort(byMvName);
    return { key: k, label: TYPE_LABEL[k], rows, count: sum(rows) };
  });
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
    groupBy: ['type', 'mv', 'color', 'custom'].includes(d?.groupBy) ? d.groupBy : 'type',
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node src/decks/deckModel.selfcheck.js`
Expected: `deckModel selfcheck: ok`

- [ ] **Step 5: Lint, HANDOFF, commit**

Run: `npx eslint src/decks` (no output).
HANDOFF: extend the `deckModel.js` row with "grouping by type, print entries, MTGA text export/import with board headers, JSON backup, snapshot refresh". "Done recently": "task 2: deck model views and I/O".

```bash
git add src/decks/deckModel.js src/decks/deckModel.selfcheck.js HANDOFF.md
git commit -m "feat(decks): grouping, print entries, text and backup I/O in the deck model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Scryfall layer (lookup, deck boards from links, search helpers)

**Files:**
- Modify: `src/utils/scryfall.js` (`scryfallFetch` lines 19-38, `fetchScryfallImages` lines 161-217, deck-link section lines 236-366)
- Create: `src/decks/scryfallSearch.js`
- Test: `src/decks/deckModel.selfcheck.js` (append URL checks)

**Interfaces:**
- Consumes: `snapshotFromCard` (Task 1).
- Produces:
  - `scryfall.js`: `export async function scryfallFetch(url, opts, tries = 3)` (AbortError rethrown at once; 4xx errors carry `.status`), `export async function lookupCards(list: {name, set?, collector?}[]): (entry) => scryfallCard|undefined`, `export async function fetchDeckBoards(url): {name: string, rows: {qty, name, set, collector, board, commander}[]}`; `fetchDeckList(url)` unchanged signature (main board incl. commanders, as text).
  - `scryfallSearch.js`: `autocompleteUrl(q)`, `namedUrl(name)`, `searchUrl(q)`, `autocomplete(q, signal): Promise<string[]>`, `namedCard(name, signal): Promise<scryfallCard>`, `searchCards(q, signal, pageUrl?): Promise<{cards, next, total}>`, `cardsByIds(ids): Promise<Map<string, scryfallCard>>`, `resolveEntries(entries): Promise<{items: {card, qty, board, commander}[], notFound: string[]}>`.

- [ ] **Step 1: Append the failing URL checks** (Review Focus 4)

Add to the imports of `deckModel.selfcheck.js`:

```js
import { autocompleteUrl, namedUrl, searchUrl } from './scryfallSearch.js';
```

Insert before the final `console.log`:

```js
// URL Scryfall con nomi difficili (Review Focus 4)
eq(namedUrl('Kongming, "Sleeping Dragon"'), 'https://api.scryfall.com/cards/named?exact=Kongming%2C%20%22Sleeping%20Dragon%22', 'named: virgole e virgolette');
eq(autocompleteUrl('Æther Vi'), 'https://api.scryfall.com/cards/autocomplete?q=%C3%86ther%20Vi', 'autocomplete: unicode');
eq(searchUrl('t:goblin c<=r'), 'https://api.scryfall.com/cards/search?q=t%3Agoblin%20c%3C%3Dr%20game%3Apaper&unique=cards&order=name', 'search: sempre game:paper');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/decks/deckModel.selfcheck.js`
Expected: FAIL with `Cannot find module` for `./scryfallSearch.js`.

- [ ] **Step 3: Update `src/utils/scryfall.js`**

3a. Replace the whole `scryfallFetch` function with:

```js
// Fetch verso Scryfall con retry su 429/5xx e errori di rete. I 503/Cloudflare
// tornano senza header CORS → nel browser appaiono come "Failed to fetch" opaco:
// qui ritentiamo con backoff e, se persiste, diamo un messaggio chiaro.
// AbortError (richiesta annullata dall'utente) esce subito; i 4xx portano `.status`.
export async function scryfallFetch(url, opts, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e; // rete/CORS → ritenta
      if (i < tries - 1) { await sleep(500 * (i + 1)); continue; }
      throw new Error('Could not reach Scryfall (it may be busy or down). Please try again shortly.');
    }
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Scryfall responded ${res.status}`);
      if (i < tries - 1) { await sleep(500 * (i + 1)); continue; }
      throw new Error(`Scryfall is temporarily unavailable (${res.status}). Please try again shortly.`);
    }
    throw Object.assign(new Error(`Scryfall responded ${res.status}`), { status: res.status }); // 4xx: non ritentabile
  }
  throw lastErr || new Error('Scryfall request failed.');
}
```

3b. Add above `fetchScryfallImages`:

```js
/**
 * Risolve carte via /cards/collection (batch da 75). Identifier più preciso:
 * set+collector → stampa esatta; solo set → nome in quel set; altrimenti nome.
 * @param {{name:string, set?:string, collector?:string}[]} list
 * @returns {Promise<(e:{name:string, set?:string, collector?:string}) => object|undefined>}
 */
export async function lookupCards(list) {
  const identifiers = list.map((e) =>
    e.set && e.collector ? { set: e.set, collector_number: e.collector }
      : e.set ? { name: e.name, set: e.set }
        : { name: e.name },
  );
  const cardByKey = new Map(); // "nome|set|collector" (e varianti) -> card
  const reg = (k, card) => { if (!cardByKey.has(k)) cardByKey.set(k, card); };
  const parts = chunk(identifiers, CHUNK);
  for (let p = 0; p < parts.length; p++) {
    const res = await scryfallFetch(COLLECTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: parts[p] }),
    });
    const json = await res.json();
    for (const card of json.data || []) {
      const s = (card.set || '').toLowerCase();
      const c = (card.collector_number || '').toLowerCase();
      // Registra sotto ogni chiave con cui potremmo cercarla (nome + faccia DFC).
      for (const n of [card.name, card.card_faces?.[0]?.name].filter(Boolean)) {
        const nl = n.toLowerCase();
        reg(`${nl}||`, card);
        reg(`${nl}|${s}|`, card);
        reg(`${nl}|${s}|${c}`, card);
      }
    }
    if (p < parts.length - 1) await sleep(100); // gentile con l'API
  }
  return (e) => {
    const nl = e.name.toLowerCase();
    const set = (e.set || '').toLowerCase();
    const ec = (e.collector || '').toLowerCase(); // chiavi case-insensitive (registrate lowercased)
    return cardByKey.get(`${nl}|${set}|${ec}`) || cardByKey.get(`${nl}|${set}|`) || cardByKey.get(`${nl}||`);
  };
}
```

3c. In `fetchScryfallImages`, replace step 1 (from the comment `// 1) Risolvi via /cards/collection` through the end of its `for (let p ...)` loop) with:

```js
  // 1) Risolvi via /cards/collection.
  const find = await lookupCards(list);
```

and in step 2 replace the `const nl = ...`, `const ec = ...` and `const card = ...` lines with:

```js
    const card = find(e);
```

3d. Replace the three functions `archidektList`, `moxfieldList`, `tappedoutList` and `fetchDeckList` (the block after `buildDeckList`) with:

```js
// Righe strutturate di un deck da link: { qty, name, set, collector, board, commander }.
async function archidektRows(id) {
  const j = await (await fetchViaProxy(`https://archidekt.com/api/decks/${id}/`)).json();
  const rows = (j.cards || []).map((c) => {
    const cats = (c.categories || []).join(' ');
    const board = /maybe|considering/i.test(cats) ? 'maybe' : /sideboard/i.test(cats) ? 'side' : 'main';
    return {
      qty: c.quantity || 1, name: c.card?.oracleCard?.name || '',
      set: (c.card?.edition?.editioncode || '').toLowerCase(), collector: c.card?.collectorNumber || '',
      board, commander: board === 'main' && /commander/i.test(cats),
    };
  }).filter((r) => r.name);
  return { name: j.name || '', rows };
}

async function moxfieldRows(pubId) {
  const j = await (await fetchViaProxy(`https://api2.moxfield.com/v3/decks/all/${pubId}`)).json();
  const boards = j.boards || {};
  const rows = [];
  for (const [key, board, commander] of [['commanders', 'main', true], ['mainboard', 'main', false], ['sideboard', 'side', false], ['maybeboard', 'maybe', false]]) {
    const cards = boards[key]?.cards || {};
    for (const k in cards) {
      const c = cards[k].card || {};
      if (c.name) rows.push({ qty: cards[k].quantity || 1, name: c.name, set: (c.set || '').toLowerCase(), collector: c.cn || '', board, commander });
    }
  }
  return { name: j.name || '', rows };
}

async function tappedoutRows(slug) {
  const txt = await (await fetchViaProxy(`https://tappedout.net/mtg-decks/${slug}/?fmt=txt`)).text();
  // fmt=txt è già "1 Nome" per riga; tieni solo le righe che iniziano con la quantità.
  const lines = txt.replace(/\r/g, '').split('\n').filter((l) => /^\d+\s/.test(l.trim())).join('\n');
  return { name: '', rows: parseCardList(lines).map((e) => ({ ...e, board: 'main', commander: false })) };
}

/**
 * Risolve un link deck nelle sue righe per zona (+ nome del deck se il sito lo dà).
 * @param {string} url link Moxfield / Archidekt / Tappedout
 */
export async function fetchDeckBoards(url) {
  const u = (url || '').trim();
  let m;
  if ((m = u.match(/moxfield\.com\/decks\/([\w-]+)/i))) return moxfieldRows(m[1]);
  if ((m = u.match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/i))) return archidektRows(m[1]);
  if ((m = u.match(/tappedout\.net\/mtg-decks\/([\w-]+)/i))) return tappedoutRows(m[1]);
  throw new Error('Unrecognized link. Supported: Moxfield, Archidekt, Tappedout.');
}

/**
 * Lista testuale "qty Nome (SET) num" del main (comandanti inclusi) per l'import in stampa:
 * stesso comportamento di prima (sideboard e maybeboard escluse).
 */
export async function fetchDeckList(url) {
  const { rows } = await fetchDeckBoards(url);
  return rows.filter((r) => r.board === 'main').map((r) => deckLine(r.qty, r.name, r.set, r.collector)).join('\n');
}
```

- [ ] **Step 4: Create `src/decks/scryfallSearch.js`**

```js
/**
 * Ricerca carte per l'editor mazzi: autocompletamento, carta per nome esatto, ricerca a pagine,
 * carte per id (riallineamento) e risoluzione delle liste importate in snapshot.
 */
import { scryfallFetch, lookupCards } from '../utils/scryfall.js';
import { snapshotFromCard } from './deckModel.js';

const API = 'https://api.scryfall.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const autocompleteUrl = (q) => `${API}/cards/autocomplete?q=${encodeURIComponent(q)}`;
export const namedUrl = (name) => `${API}/cards/named?exact=${encodeURIComponent(name)}`;
// Sempre game:paper: niente carte solo digitali.
export const searchUrl = (q) => `${API}/cards/search?q=${encodeURIComponent(`${q} game:paper`)}&unique=cards&order=name`;

export async function autocomplete(q, signal) {
  const text = q.trim();
  if (text.length < 2) return [];
  const res = await scryfallFetch(autocompleteUrl(text), { signal });
  return (await res.json()).data || [];
}

export async function namedCard(name, signal) {
  return (await scryfallFetch(namedUrl(name), { signal })).json();
}

// Una pagina di risultati (175 max); `next` = URL della pagina dopo. Nessun risultato = 404.
export async function searchCards(q, signal, pageUrl) {
  try {
    const j = await (await scryfallFetch(pageUrl || searchUrl(q), { signal })).json();
    return { cards: j.data || [], next: j.has_more ? j.next_page : null, total: j.total_cards || 0 };
  } catch (e) {
    if (e.status === 404) return { cards: [], next: null, total: 0 };
    throw e;
  }
}

// Carte per id Scryfall, a blocchi da 75 (riallineamento snapshot all'apertura del mazzo).
export async function cardsByIds(ids) {
  const out = new Map();
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 75) {
    const res = await scryfallFetch(`${API}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: uniq.slice(i, i + 75).map((id) => ({ id })) }),
    });
    for (const c of (await res.json()).data || []) out.set(c.id, c);
    if (i + 75 < uniq.length) await sleep(100);
  }
  return out;
}

// Voci importate ({ qty, name, set, collector, board, commander }) → righe pronte per addEntries.
// Le DFC si cercano per faccia anteriore (come parseCardList).
export async function resolveEntries(entries) {
  const key = (e) => ({ name: e.name.split(' // ')[0], set: e.set || '', collector: e.collector || '' });
  const find = await lookupCards(entries.map(key));
  const items = [];
  const notFound = [];
  for (const e of entries) {
    const c = find(key(e));
    if (c) items.push({ card: snapshotFromCard(c), qty: e.qty || 1, board: e.board || 'main', commander: !!e.commander });
    else notFound.push(e.set ? `${e.name} (${e.set.toUpperCase()})` : e.name);
  }
  return { items, notFound };
}
```

- [ ] **Step 5: Run checks**

Run: `node src/decks/deckModel.selfcheck.js && node src/utils/scryfall.selfcheck.js`
Expected: `deckModel selfcheck: ok` and the existing scryfall self-check output with no error.

- [ ] **Step 6: Live regression of the print import**

Start the preview (`preview_start` name `vite-dev`). Open Add cards → Import from Scryfall, paste `1x Sol Ring\n1 Delver of Secrets // Insectile Aberration (ISD) 51`, Import. Expected: 3 images (Sol Ring, Delver front, Insectile back), no console errors. Then load a public Moxfield link in the same dialog and check the textarea shows commanders and main only.

- [ ] **Step 7: Lint, build, HANDOFF, commit**

Run: `npm run lint && npm run build`.
HANDOFF: update the `src/utils/scryfall.js` row (exported `scryfallFetch` with abort and `.status`, `lookupCards`, `fetchDeckBoards` with boards, `fetchDeckList` now derived from it) and add a row for `src/decks/scryfallSearch.js`.

```bash
git add src/utils/scryfall.js src/decks/scryfallSearch.js src/decks/deckModel.selfcheck.js HANDOFF.md
git commit -m "feat(decks): Scryfall search helpers and deck boards from links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: Shared UI pieces (CardMenu, MobilePage, long press, icons, mana symbols)

**Files:**
- Create: `src/components/CardMenu.jsx`, `src/hooks/useLongPress.js`, `src/decks/Mana.jsx`
- Modify: `src/components/PagePreview.jsx` (remove `CardMenu`, lines 39-91; imports), `src/components/MobileLayout.jsx` (export `MobilePage`), `src/components/icons.jsx` (append icons)

**Interfaces:**
- Produces:
  - `export default function CardMenu({ x, y, title, items, onClose })` (items `{key, Icon, label, run, keepOpen?, danger?, disabled?, note?}`), identical behaviour to today.
  - `export function MobilePage({ title, onClose, children })` from `MobileLayout.jsx`.
  - `useLongPress(): { bind(onLong: (x, y) => void): handlers, consumed(): boolean }`.
  - Icons: `IconLogOut`, `IconInfo`, `IconPrinter`, `IconArrowLeft`, `IconSearch`, `IconUpload`, `IconPencil`, `IconMinus`, `IconCrown`.
  - `ManaCost({ cost })`, `ManaPips({ colors })`.

- [ ] **Step 1: Create `src/components/CardMenu.jsx`**

Move the `CardMenu` function from `PagePreview.jsx` verbatim (the block that starts with the comment `// ── Menu contestuale carte` and ends with its closing `}`), with these imports and a default export:

```jsx
import { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';

// ── Menu contestuale (click destro / Shift+F10 / pressione lunga): carte in stampa, mazzi, righe ──
// items: [{ key, Icon, label, run, keepOpen?, danger?, disabled?, note? }].
// In portal sul body: gli antenati animati (transform) romperebbero il position:fixed.
export default function CardMenu({ x, y, title, items, onClose }) {
    // body identical to the current PagePreview.jsx CardMenu
}
```

In `PagePreview.jsx`: delete the moved block, add `import CardMenu from './CardMenu';`, and drop `createPortal` from the imports if nothing else uses it (`useLayoutEffect` stays only if still used; run lint to confirm).

- [ ] **Step 2: Export `MobilePage`**

In `src/components/MobileLayout.jsx` change `function MobilePage(` to `export function MobilePage(`.

- [ ] **Step 3: Create `src/hooks/useLongPress.js`**

```js
import { useRef } from 'react';

// Pressione lunga (touch/penna, 500 ms) = menu contestuale, come le carte in stampa. Annullata se
// il dito si sposta >10 px (scroll) o si alza prima. `consumed()` va chiamato nel click: dice se
// quel click chiude una pressione lunga (allora non deve anche selezionare/aprire).
export function useLongPress() {
  const press = useRef(null);
  const swallow = useRef(false);
  const cancel = () => { clearTimeout(press.current?.timer); press.current = null; };
  const bind = (onLong) => ({
    onPointerDown: (e) => {
      swallow.current = false; // nuovo gesto
      if (e.pointerType === 'mouse') return;
      const { clientX: x, clientY: y } = e;
      cancel();
      press.current = {
        x, y,
        timer: setTimeout(() => {
          press.current = null;
          swallow.current = true;
          navigator.vibrate?.(10);
          onLong(x, y);
        }, 500),
      };
    },
    onPointerMove: (e) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  });
  const consumed = () => {
    if (!swallow.current) return false;
    swallow.current = false;
    return true;
  };
  return { bind, consumed };
}
```

- [ ] **Step 4: Append icons to `src/components/icons.jsx`**

```jsx
export function IconLogOut(props) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </Svg>
  );
}

export function IconInfo(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconPrinter(props) {
  return (
    <Svg {...props}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </Svg>
  );
}

export function IconArrowLeft(props) {
  return (
    <Svg {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Svg>
  );
}

export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function IconUpload(props) {
  return (
    <Svg {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </Svg>
  );
}

export function IconPencil(props) {
  return (
    <Svg {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </Svg>
  );
}

export function IconMinus(props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

// Comandante: corona.
export function IconCrown(props) {
  return (
    <Svg {...props}>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </Svg>
  );
}
```

- [ ] **Step 5: Create `src/decks/Mana.jsx`**

```jsx
// Simboli di mana dalle SVG ufficiali di Scryfall: {2/W} → 2W.svg, {W/U/P} → WUP.svg.
const symUrl = (s) => `https://svgs.scryfall.io/card-symbols/${s.replace(/\//g, '')}.svg`;

export function ManaCost({ cost }) {
  const toks = (cost || '').match(/\{[^}]+\}/g) || [];
  if (!toks.length) return null;
  return (
    <span className="mana" role="img" aria-label={cost}>
      {toks.map((t, i) => <img key={i} src={symUrl(t.slice(1, -1))} alt="" width="14" height="14" loading="lazy" />)}
    </span>
  );
}

// Identità di colore (WUBRG); vuota = incolore.
export function ManaPips({ colors }) {
  const list = colors.length ? colors : ['C'];
  return (
    <span className="mana" role="img" aria-label={`Color identity: ${colors.join('') || 'colorless'}`}>
      {list.map((c) => <img key={c} src={symUrl(c)} alt="" width="16" height="16" loading="lazy" />)}
    </span>
  );
}
```

- [ ] **Step 6: Verify the print menu still works**

Run `npm run lint && npm run build`. In the Browser pane (print tab with a few cards loaded), right-click a card: the menu opens at the cursor with the same items, ↑/↓ move, Esc closes and returns focus to the card. No console errors.

- [ ] **Step 7: HANDOFF, commit**

HANDOFF: add rows for `CardMenu.jsx` (extracted, shared by print, deck list, editor), `useLongPress.js`, `Mana.jsx`; note `MobilePage` is now exported.

```bash
git add src/components/CardMenu.jsx src/components/PagePreview.jsx src/components/MobileLayout.jsx src/components/icons.jsx src/hooks/useLongPress.js src/decks/Mana.jsx HANDOFF.md
git commit -m "refactor(ui): shared CardMenu, MobilePage, long press, deck icons and mana symbols

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: Routes, Decks / Print tabs and the print hand-off

**Files:**
- Create: `src/hooks/useHashRoute.js`, `src/components/NavTabs.jsx`, `src/decks/DecksView.jsx` (stub, replaced in Task 6)
- Modify: `src/App.jsx`, `src/components/MobileLayout.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `fetchScryfallImages` (`src/utils/scryfall.js`), `MobilePage` export (Task 4).
- Produces:
  - `useHashRoute(): string` (path without `#`, default `'/print'`), `navigate(path: string): void`.
  - `DecksView` props (contract used by Tasks 6-11): `{ route: string, notify: (msg: string, kind?: 'success'|'error'|'progress') => void, printQueueCount: number, onPrintDeck: (entries: {qty, name, set, collector}[]) => Promise<void> }`.
  - `MobileLayout` new props: `tabs` (node in the header), `altBody` (node replacing the print body and toolbar).

- [ ] **Step 1: Create `src/hooks/useHashRoute.js`**

```js
import { useSyncExternalStore } from 'react';

// Rotte hash (GitHub Pages: niente server per le rotte). Hash vuoto = stampa.
const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const read = () => window.location.hash.replace(/^#/, '') || '/print';

export function useHashRoute() {
  return useSyncExternalStore(subscribe, read, () => '/print');
}

export const navigate = (path) => { window.location.hash = path; };
```

- [ ] **Step 2: Create `src/components/NavTabs.jsx`**

```jsx
// Tab principali (header desktop e mobile): link hash, quella attiva ha aria-current.
export default function NavTabs({ decks }) {
  return (
    <nav className="nav-tabs" aria-label="Sections">
      <a href="#/decks" className="nav-tab" aria-current={decks ? 'page' : undefined}>Decks</a>
      <a href="#/print" className="nav-tab" aria-current={decks ? undefined : 'page'}>Print</a>
    </nav>
  );
}
```

- [ ] **Step 3: Create the stub `src/decks/DecksView.jsx`**

```jsx
// Stub di fase 1 (task 5): sostituito dal gate di login nel task 6.
export default function DecksView() {
  return <div className="decks-root decks-center"><p className="field-hint">Decks are on the way.</p></div>;
}
```

- [ ] **Step 4: Wire `App.jsx`**

4a. Imports: change the React import to `import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';`, change the scryfall import to `import { buildDeckList, fetchScryfallImages } from './utils/scryfall';`, add:

```jsx
import NavTabs from './components/NavTabs';
import { useHashRoute, navigate } from './hooks/useHashRoute';

// Area mazzi caricata solo quando serve (porta con sé Firebase): la stampa resta leggera.
const DecksView = lazy(() => import('./decks/DecksView'));
```

4b. Inside `App`, after `const isMobile = useIsMobile();`, add:

```jsx
  const route = useHashRoute();
  const inDecks = route.startsWith('/decks');
  // Feedback dai mazzi (stabile: i listener Firestore lo hanno tra le dipendenze).
  const notify = useCallback((msg, kind = 'success') => setToast({ kind, msg }), []);

  // "Print deck": scarica le immagini, poi SOSTITUISCE la coda di stampa (la conferma la chiede
  // l'editor) e apre la stampa. La coda vecchia resta intatta se il download fallisce.
  const handlePrintDeck = async (entries) => {
    setToast({ kind: 'progress', msg: 'Downloading card images…' });
    try {
      const { files, notFound } = await fetchScryfallImages(entries,
        (done, total) => setToast({ kind: 'progress', msg: `Downloading card images ${done}/${total}` }));
      setImages((prev) => { prev.forEach((i) => URL.revokeObjectURL(i.preview)); return []; });
      addItems(files);
      navigate('/print');
      setToast(notFound.length
        ? { kind: 'error', msg: `${files.length} images ready. Not found: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ` and ${notFound.length - 5} more` : ''}` }
        : { kind: 'success', msg: `${files.length} images ready to print` });
    } catch (e) {
      setToast({ kind: 'error', msg: e.message || 'Could not download the card images.' });
    }
  };

  const decksNode = (
    <Suspense fallback={<div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>}>
      <DecksView route={route} notify={notify} printQueueCount={images.length} onPrintDeck={handlePrintDeck} />
    </Suspense>
  );
```

4c. Mobile branch: add two props to `<MobileLayout`:

```jsx
          tabs={<NavTabs decks={inDecks} />}
          altBody={inDecks ? decksNode : null}
```

4d. Desktop header: insert `<NavTabs decks={inDecks} />` right after the `<h1 className="brand">…</h1>` line, and wrap the whole `<div className={`help${...}`} …>…</div>` block in `{!inDecks && ( … )}` (its copy is about printing).

4e. Desktop body: replace `<div className="app-body">` … `</div>` (the sidebar + main block) with `{inDecks ? decksNode : ( <div className="app-body"> …unchanged… </div> )}`.

- [ ] **Step 5: Update `MobileLayout.jsx`**

Signature: `export default function MobileLayout({ settingsProps, previewProps, actions, addMenu, tabs, altBody })`.
In the header, after `<h1 className="brand">…</h1>` add `{tabs}`, and wrap the help `<div className={`help${...}`}>…</div>` in `{!altBody && ( … )}`.
Replace `<main className="mobile-body">` … `</main>` with:

```jsx
      {altBody
        ? <main className="mobile-body mobile-decks">{altBody}</main>
        : (
          <main className="mobile-body">
            {/* …current content unchanged… */}
          </main>
        )}
```

- [ ] **Step 6: CSS (append to `src/index.css`)**

```css
/* ============================================================
   TAB PRINCIPALI (Decks | Print)
   ============================================================ */
.nav-tabs { display: flex; gap: 4px; margin-left: 18px; }
.nav-tab {
  position: relative;
  padding: 6px 10px;
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition);
}
.nav-tab:hover { color: var(--text-primary); }
.nav-tab[aria-current="page"] { color: var(--cyan-soft); }
/* Tab attiva: sottolineatura ciano→magenta come l'hairline dell'header. */
.nav-tab[aria-current="page"]::after {
  content: '';
  position: absolute;
  left: 10px; right: 10px; bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--cyan), var(--accent));
  box-shadow: 0 0 8px var(--cyan-glow);
}
.nav-tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.mobile-header .nav-tabs { margin-left: 6px; }
.mobile-header .nav-tab { padding: 6px 8px; font-size: 0.72rem; letter-spacing: 0.12em; }

/* ============================================================
   MAZZI: contenitore
   ============================================================ */
.decks-root { height: 100%; min-height: 0; overflow-y: auto; padding: 24px 28px 40px; }
.decks-center { display: grid; place-items: center; }
.mobile-decks { overflow: hidden; }
.mobile-decks .decks-root { padding: 16px 14px 96px; }
```

- [ ] **Step 7: Verify live**

Browser pane: with 3 cards in the print queue, click **Decks**: URL `#/decks`, stub text, help `?` hidden. Click **Print**: the same 3 cards are still there. Reload on `#/decks`: Decks tab active. Mobile (`resize_window` preset mobile): tabs in the header, decks stub replaces the cards and the bottom bar; back to Print restores them. Reset with preset desktop. No console errors; `npm run build` shows a separate `DecksView` chunk.

- [ ] **Step 8: Lint, build, HANDOFF, commit**

HANDOFF: App row (hash routes, tabs, lazy Decks area, `notify`, `handlePrintDeck`), MobileLayout row (`tabs`, `altBody`), new rows for `useHashRoute.js` and `NavTabs.jsx`.

```bash
git add src/App.jsx src/components/MobileLayout.jsx src/components/NavTabs.jsx src/hooks/useHashRoute.js src/decks/DecksView.jsx src/index.css HANDOFF.md
git commit -m "feat(app): Decks and Print tabs with hash routes and the print hand-off

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: Firebase, sign-in, account menu and privacy

**Files:**
- Create: `firestore.rules`, `src/decks/firebaseConfig.js`, `src/decks/firebase.js`, `src/decks/AccountMenu.jsx`, `src/decks/dialogs.jsx` (`PrivacyPanel` now; the other dialogs are added in Tasks 7 and 11)
- Modify: `package.json` (dependency), `src/decks/DecksView.jsx` (replace the stub), `src/components/CookieBanner.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `CardMenu` (Task 4), `ConfirmDialog`, `useOverlayDismiss`, icons (Task 4).
- Produces:
  - `firebase.js`: `auth`, `db`, `signIn(): Promise<void>`, `signOut(): Promise<void>`, `watchUser(cb: (user|null) => void): unsubscribe`, `deleteAccount(deleteData: (uid) => Promise<void>): Promise<void>`.
  - `AccountMenu({ user, notify, onDeleteData })` where `onDeleteData(uid)` deletes all decks (wired in Task 7; until then `async () => {}`).
  - `PrivacyPanel({ onClose })`.

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/decks/{deckId} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.cards.size() <= 500;
    }
  }
}
```

- [ ] **Step 2: USER, create the Firebase project (manual, about 10 minutes)**

Hand these steps to the user and wait for the config object:
1. https://console.firebase.google.com → **Create a project** → name `proxoteca` → Google Analytics off → Create.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, pick the support email, Save.
3. **Authentication → Settings → Authorized domains → Add domain** `tommiconlai.github.io` (`localhost` is there by default).
4. **Build → Firestore Database → Create database** → location **eur3 (europe-west)** → **Start in production mode** → Create.
5. Firestore → **Rules** tab → replace the content with `firestore.rules` from the repo → **Publish**.
6. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `Proxoteca web`, Firebase Hosting **unchecked** → Register → copy the `firebaseConfig` object.

- [ ] **Step 3: Install and configure**

Run: `npm install firebase`
Create `src/decks/firebaseConfig.js` with the object from step 2.6 (values are the user's; keys exactly as the console prints them):

```js
// Config pubblica del progetto Firebase: non è un segreto. L'accesso ai dati lo proteggono le
// regole Firestore (firestore.rules) e i domini autorizzati di Authentication.
export const firebaseConfig = {
  apiKey: 'FROM_CONSOLE',
  authDomain: 'FROM_CONSOLE',
  projectId: 'FROM_CONSOLE',
  storageBucket: 'FROM_CONSOLE',
  messagingSenderId: 'FROM_CONSOLE',
  appId: 'FROM_CONSOLE',
};
```

(Every `FROM_CONSOLE` must be replaced with the user's value before Step 8; a leftover value makes `initializeApp` fail with `auth/invalid-api-key`.)

- [ ] **Step 4: Create `src/decks/firebase.js`**

```js
/**
 * Firebase dell'area mazzi: login Google e Firestore con cache offline persistente (anche con
 * più schede aperte). Caricato solo dentro il chunk lazy di DecksView.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged,
  signOut as fbSignOut, deleteUser, reauthenticateWithPopup,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true, // rete di sicurezza: un campo undefined non fa fallire il salvataggio
});

const provider = new GoogleAuthProvider();

// Popup; se il browser lo blocca, login a pagina intera (redirect). Popup chiuso = nessun errore.
export async function signIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export const signOut = () => fbSignOut(auth);
export const watchUser = (cb) => onAuthStateChanged(auth, cb);

// Prima i dati (servono ancora i permessi), poi l'account. Google può chiedere un login recente.
export async function deleteAccount(deleteData) {
  const user = auth.currentUser;
  if (!user) return;
  await deleteData(user.uid);
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw e;
    await reauthenticateWithPopup(user, provider);
    await deleteUser(user);
  }
}
```

- [ ] **Step 5: Create `src/decks/dialogs.jsx` with `PrivacyPanel`**

```jsx
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX } from '../components/icons';

// Cosa salviamo e come cancellarlo (menu account).
export function PrivacyPanel({ onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Privacy" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Privacy</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Signing in with Google lets Proxoteca keep your decks on Firebase (Google Cloud), so they sync between your devices.</p>
        <ul className="privacy-list">
          <li><b>Stored:</b> your Google account id, name, email and photo (kept by Firebase Authentication) and your decks.</li>
          <li><b>Where:</b> Firebase, with the deck database in the EU.</li>
          <li><b>Who can read it:</b> only you. Access rules block every other account.</li>
          <li><b>How to delete it:</b> account menu, Delete account and data. It removes your decks and your account.</li>
        </ul>
        <p className="modal-hint">The print area works without an account and keeps nothing on a server.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/decks/AccountMenu.jsx`**

```jsx
import { useCallback, useState } from 'react';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { PrivacyPanel } from './dialogs';
import { signOut, deleteAccount } from './firebase';
import { IconInfo, IconLogOut, IconTrash } from '../components/icons';

// Avatar → menu: privacy, esci, elimina account e dati (con conferma).
export default function AccountMenu({ user, notify, onDeleteData }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const [privacy, setPrivacy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const closeMenu = useCallback(() => setMenu(null), []);
  const label = user.displayName || user.email || 'Account';
  const items = [
    { key: 'privacy', Icon: IconInfo, label: 'Privacy', run: () => setPrivacy(true) },
    { key: 'out', Icon: IconLogOut, label: 'Sign out', run: () => signOut().catch((e) => notify(e.message, 'error')) },
    { key: 'del', Icon: IconTrash, label: 'Delete account and data', danger: true, run: () => setConfirmDel(true) },
  ];
  return (
    <>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-label={`Account: ${label}`}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 6 }); }}>
        {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{label[0].toUpperCase()}</span>}
      </button>
      {menu && <CardMenu x={menu.x} y={menu.y} title={user.email || label} items={items} onClose={closeMenu} />}
      {privacy && <PrivacyPanel onClose={() => setPrivacy(false)} />}
      <ConfirmDialog open={confirmDel} message="Delete your account and all your decks? This can’t be undone."
        confirmLabel="Delete everything" onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false);
          deleteAccount(onDeleteData)
            .then(() => notify('Account and decks deleted'))
            .catch((e) => notify(e.message || 'Could not delete the account.', 'error'));
        }} />
    </>
  );
}
```

- [ ] **Step 7: Replace `src/decks/DecksView.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { watchUser, signIn } from './firebase';
import AccountMenu from './AccountMenu';

// Radice dell'area mazzi (lazy): attende lo stato di login, poi lista o editor.
export default function DecksView({ notify }) {
  const [user, setUser] = useState(undefined); // undefined = in verifica, null = non loggato
  useEffect(() => watchUser(setUser), []);
  if (user === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  if (!user) return <SignInPanel />;
  return (
    <div className="decks-root">
      <header className="decks-head">
        <h2 className="decks-title">Your decks</h2>
        <div className="decks-actions">
          <AccountMenu user={user} notify={notify} onDeleteData={async () => {}} />
        </div>
      </header>
    </div>
  );
}

function SignInPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try { await signIn(); } catch (e) { setError(e.message || 'Sign-in failed.'); } finally { setBusy(false); }
  };
  return (
    <div className="decks-root decks-center">
      <div className="signin-panel">
        <h2 className="decks-title">Your decks</h2>
        <p>Sign in to keep your deck lists and sync them between your computer and your phone.</p>
        <button type="button" className="btn-generate" onClick={go} disabled={busy}>
          {busy && <span className="spinner" />} Sign in with Google
        </button>
        {error && <div className="info-box info-box-error"><span>{error}</span></div>}
        <p className="field-hint">The print area works without an account.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Cookie banner copy**

In `CookieBanner.jsx` replace the paragraph text with:
"Proxoteca keeps your settings in your browser's local storage. Signing in to Decks also keeps a session there. With your consent we may also use cookies for anonymous usage analytics."

- [ ] **Step 9: CSS (append)**

```css
/* Titolo sezione mazzi: [ YOUR DECKS ] come le intestazioni della sidebar. */
.decks-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.decks-title {
  margin: 0;
  display: flex; align-items: baseline; gap: 8px;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-primary);
}
.decks-title::before { content: '['; font-family: var(--font-mono); letter-spacing: 0; color: var(--cyan); text-shadow: 0 0 8px rgba(0, 229, 255, 0.6); }
.decks-title::after { content: ']'; font-family: var(--font-mono); letter-spacing: 0; color: var(--accent); text-shadow: 0 0 8px rgba(255, 45, 149, 0.6); }
.decks-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.signin-panel {
  max-width: 380px;
  display: flex; flex-direction: column; gap: 14px;
  padding: 28px;
  background: linear-gradient(180deg, var(--bg-elevated), var(--bg-surface));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.signin-panel p { margin: 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; }

.account-btn {
  width: 34px; height: 34px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(0, 229, 255, 0.4);
  background: var(--bg-elevated);
  color: var(--cyan-soft);
  font-family: var(--font-display);
  font-weight: 600;
  cursor: pointer;
}
.account-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
.account-btn:hover, .account-btn:focus-visible { border-color: var(--cyan); box-shadow: 0 0 12px var(--cyan-glow); outline: none; }

.privacy-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45; }
.privacy-list b { color: var(--text-primary); }
```

- [ ] **Step 10: Verify live (user signs in)**

Browser pane on `#/decks`: sign-in panel. Ask the user to click **Sign in with Google** and complete it themselves. Expected: header "[ YOUR DECKS ]" with the avatar; avatar menu shows Privacy / Sign out / Delete account and data; Privacy opens and closes with Esc; Sign out returns to the panel. Reload while signed in: no sign-in panel flash beyond the spinner. No console errors.

- [ ] **Step 11: Lint, build, HANDOFF, commit**

HANDOFF: rows for `firebase.js`, `firebaseConfig.js`, `AccountMenu.jsx`, `dialogs.jsx`, `firestore.rules` (with the console setup steps summarised: Google provider, EU Firestore, authorized domain, rules published by hand), DecksView now the auth gate; cookie banner copy.

```bash
git add firestore.rules package.json package-lock.json src/decks/firebaseConfig.js src/decks/firebase.js src/decks/AccountMenu.jsx src/decks/dialogs.jsx src/decks/DecksView.jsx src/components/CookieBanner.jsx src/index.css HANDOFF.md
git commit -m "feat(decks): Firebase sign-in, account menu and privacy panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 7: Deck store and deck list (new, rename, duplicate, delete, export, backup)

**Files:**
- Create: `src/decks/deckStore.js`, `src/decks/DeckList.jsx`
- Modify: `src/decks/dialogs.jsx` (add `NameFormatDialog`), `src/decks/DecksView.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `db` (Task 6), deckModel (Tasks 1-2), `CardMenu`, `useLongPress`, `ManaPips` (Task 4), `navigate` (Task 5).
- Produces:
  - `deckStore.js`: `listenDecks(uid, onChange: (decks: Deck&{id}[]) => void, onError): unsubscribe` (sorted by `updatedAt` desc), `listenDeck(uid, id, onChange: (deck|null, hasPendingWrites) => void, onError): unsubscribe`, `createDeck(uid, deck): {id, done: Promise}`, `saveDeck(uid, deckWithId): Promise`, `deleteDeck(uid, id): Promise`, `deleteAllDecks(uid): Promise`.
  - `NameFormatDialog({ title, confirmLabel, initialName?, initialFormat?, showFormat?, onSubmit({name, format}), onClose })`.
  - `DeckList({ uid, notify, account })`.

- [ ] **Step 1: Create `src/decks/deckStore.js`**

```js
/**
 * Mazzi su Firestore: un documento per mazzo in users/{uid}/decks/{deckId}. Le scritture non
 * vanno attese per aggiornare la UI: offline restano in coda nella cache locale.
 */
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const decksCol = (uid) => collection(db, 'users', uid, 'decks');
// serverTimestamps 'estimate': un mazzo appena scritto ha già una data (stimata) per l'ordinamento.
const fromDoc = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
const ms = (t) => t?.toMillis?.() ?? 0;
const payload = (d) => ({
  v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cards: d.cards,
  updatedAt: serverTimestamp(),
});

// ponytail: ordinamento lato client (niente indice); legge i documenti interi, va bene per
// decine di mazzi. Se la lista rallenta: una collezione di riepiloghi.
export function listenDecks(uid, onChange, onError) {
  return onSnapshot(decksCol(uid), (qs) => onChange(qs.docs.map(fromDoc).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))), onError);
}

export function listenDeck(uid, id, onChange, onError) {
  return onSnapshot(doc(decksCol(uid), id), { includeMetadataChanges: true },
    (s) => onChange(s.exists() ? fromDoc(s) : null, s.metadata.hasPendingWrites), onError);
}

export function createDeck(uid, deck) {
  const ref = doc(decksCol(uid));
  return { id: ref.id, done: setDoc(ref, { ...payload(deck), createdAt: serverTimestamp() }) };
}

// merge: createdAt resta; gli array (cards, sections) vengono sostituiti interi.
export const saveDeck = (uid, deck) => setDoc(doc(decksCol(uid), deck.id), payload(deck), { merge: true });

export const deleteDeck = (uid, id) => deleteDoc(doc(decksCol(uid), id));

export async function deleteAllDecks(uid) {
  const snap = await getDocs(decksCol(uid));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
```

- [ ] **Step 2: Add `NameFormatDialog` to `src/decks/dialogs.jsx`**

Add `import { useState } from 'react';` and `import { FORMATS } from './deckModel';` at the top, then:

```jsx
// Nuovo mazzo (nome + formato) e Rinomina (solo nome).
export function NameFormatDialog({ title, confirmLabel, initialName = '', initialFormat = 'commander', showFormat = true, onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const [format, setFormat] = useState(initialFormat);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onSubmit({ name: name.trim(), format });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal modal-confirm deck-form" ref={ref} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header"><h2>{title}</h2></div>
        <label className="field-label" htmlFor="deck-name">Name</label>
        <input id="deck-name" className="import-link-input" value={name} onChange={(e) => setName(e.target.value)}
          autoFocus maxLength={80} placeholder="Atraxa superfriends" spellCheck={false} />
        {showFormat && (
          <>
            <label className="field-label" htmlFor="deck-format">Format</label>
            <select id="deck-format" value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-generate import-btn" disabled={!name.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/decks/DeckList.jsx`**

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDecks, createDeck, saveDeck, deleteDeck } from './deckStore';
import {
  newDeck, duplicateDeck, boardCounts, countTarget, countOk, deckIdentity, deckCover, exportText,
  toBackup, fromBackup, formatLabel,
} from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { useLongPress } from '../hooks/useLongPress';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { ManaPips } from './Mana';
import { NameFormatDialog } from './dialogs';
import { IconPlus, IconList, IconUpload, IconCopy, IconTrash, IconPencil, IconDownload } from '../components/icons';

const download = (filename, text, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck';
// Shift+F10 / tasto menu arrivano con 0,0: ancora il menu all'elemento.
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.top + 24 };
};

export default function DeckList({ uid, notify, account }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'new' | { rename: deck } | { del: deck }
  const [menu, setMenu] = useState(null); // { deck, x, y }
  const fileRef = useRef(null);
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => listenDecks(uid, setDecks, (e) => notify(`Could not load your decks: ${e.message}`, 'error')), [uid, notify]);

  const writeError = (e) => notify(`Sync error: ${e.message}`, 'error');
  const create = (deck) => {
    const { id, done } = createDeck(uid, deck);
    done.catch(writeError);
    return id;
  };

  const exportBackup = () => {
    download(`proxoteca-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks), null, 2), 'application/json');
    notify(`Backup of ${decks.length} deck${decks.length !== 1 ? 's' : ''} downloaded`);
  };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const restored = fromBackup(JSON.parse(await file.text()));
      restored.forEach(create);
      notify(`Restored ${restored.length} deck${restored.length !== 1 ? 's' : ''}`);
    } catch (err) {
      notify(err instanceof SyntaxError ? 'This file is not valid JSON.' : err.message, 'error');
    }
  };

  const menuItems = menu ? [
    { key: 'rename', Icon: IconPencil, label: 'Rename', run: () => setDialog({ rename: menu.deck }) },
    { key: 'dup', Icon: IconCopy, label: 'Duplicate', run: () => { create(duplicateDeck(menu.deck)); notify('Deck duplicated'); } },
    { key: 'txt', Icon: IconDownload, label: 'Export text', run: () => download(`${safeName(menu.deck.name)}.txt`, `${exportText(menu.deck)}\n`, 'text/plain') },
    { key: 'del', Icon: IconTrash, label: 'Delete', danger: true, run: () => setDialog({ del: menu.deck }) },
  ] : [];

  return (
    <div className="decks-root">
      <header className="decks-head">
        <h2 className="decks-title">Your decks</h2>
        <div className="decks-actions">
          <button type="button" className="btn-secondary" onClick={exportBackup} disabled={!decks?.length}><IconList size={15} /> Backup</button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current.click()}><IconUpload size={15} /> Restore</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
          <button type="button" className="btn-add deck-new" onClick={() => setDialog('new')}><IconPlus size={16} /> New deck</button>
          {account}
        </div>
      </header>

      {decks === null && <span className="import-spinner" aria-label="Loading" />}
      {decks?.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">Start your first deck</p>
          <p className="field-hint">Create one from scratch, or import a list or a Moxfield, Archidekt or Tappedout link.</p>
        </div>
      )}
      {decks?.length > 0 && (
        <ul className="deck-grid">
          {decks.map((d) => {
            const main = boardCounts(d).main;
            const target = countTarget(d.format);
            const cover = deckCover(d);
            return (
              <li key={d.id}>
                <button type="button" className="deck-tile"
                  onClick={() => { if (!press.consumed()) navigate(`/decks/${d.id}`); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ deck: d, ...menuPoint(e) }); }}
                  {...press.bind((x, y) => setMenu({ deck: d, x, y }))}>
                  <span className="deck-tile-art" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden="true" />
                  <span className="deck-tile-body">
                    <span className="deck-tile-name">{d.name}</span>
                    <span className="deck-tile-meta">
                      {formatLabel(d.format)} · <span className={countOk(d.format, main) ? undefined : 'warn'}>{main}{target ? `/${target}` : ''}</span>
                    </span>
                    <ManaPips colors={deckIdentity(d)} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {menu && <CardMenu x={menu.x} y={menu.y} title={menu.deck.name} items={menuItems} onClose={closeMenu} />}
      {dialog === 'new' && (
        <NameFormatDialog title="New deck" confirmLabel="Create" onClose={() => setDialog(null)}
          onSubmit={(v) => { setDialog(null); navigate(`/decks/${create(newDeck(v))}`); }} />
      )}
      {dialog?.rename && (
        <NameFormatDialog title="Rename deck" confirmLabel="Rename" initialName={dialog.rename.name} showFormat={false}
          onClose={() => setDialog(null)}
          onSubmit={({ name }) => { saveDeck(uid, { ...dialog.rename, name }).catch(writeError); setDialog(null); }} />
      )}
      <ConfirmDialog open={!!dialog?.del} message={`Delete “${dialog?.del?.name}”? This can’t be undone.`} confirmLabel="Delete deck"
        onCancel={() => setDialog(null)}
        onConfirm={() => { deleteDeck(uid, dialog.del.id).catch(writeError); setDialog(null); }} />
    </div>
  );
}
```

- [ ] **Step 4: Route the list in `DecksView.jsx`**

Add imports `import DeckList from './DeckList';` and `import { deleteAllDecks } from './deckStore';`. Replace the signed-in `return (...)` with:

```jsx
  return <DeckList uid={user.uid} notify={notify} account={<AccountMenu user={user} notify={notify} onDeleteData={deleteAllDecks} />} />;
```

- [ ] **Step 5: CSS (append)**

```css
/* Lista mazzi: riquadri con l'arte del comandante sfumata nel corpo. */
.deck-new { width: auto; padding: 9px 16px; }
.deck-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.deck-tile {
  width: 100%;
  display: flex; flex-direction: column;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  -webkit-touch-callout: none;
  user-select: none;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
}
.deck-tile:hover, .deck-tile:focus-visible { border-color: var(--border-hover); box-shadow: 0 0 18px rgba(0, 229, 255, 0.16); transform: translateY(-2px); outline: none; }
.deck-tile-art { position: relative; aspect-ratio: 626 / 457; background: var(--bg-elevated) center 22% / cover no-repeat; }
.deck-tile-art::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, var(--bg-surface)); }
.deck-tile-body { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 12px; }
.deck-tile-name { font-family: var(--font-display); font-weight: 600; font-size: 0.95rem; color: var(--text-primary); }
.deck-tile-meta { font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-secondary); }
.deck-tile-meta .warn { color: var(--warning); }
.mana { display: inline-flex; align-items: center; gap: 2px; }
.mana img { display: block; }
.decks-empty { max-width: 420px; padding: 28px 0; }
.decks-empty-title { margin: 0 0 6px; font-family: var(--font-display); font-size: 1.1rem; color: var(--text-primary); }
.deck-form select { width: 100%; }
```

- [ ] **Step 6: Verify live (signed in)**

New deck "Test" (Commander): lands on `#/decks/<id>` (editor not built yet; DecksView shows the list for unknown routes until Task 9, so press the **Decks** tab to come back). The tile appears with "Commander · 0/100". Right-click the tile: Rename (name changes on the tile), Duplicate ("Test (copy)" appears first), Export text (empty .txt downloads), Delete (confirm, tile goes). Backup downloads JSON; Restore of that file adds the decks again; Restore of a random `.json` shows "This file is not a Proxoteca deck backup." Open the same `#/decks` in a second tab: changes appear live in both. Rules: in the Firebase console, Firestore → Rules → **Rules playground**, simulate an authenticated `get` on `/users/someone-else/decks/x` with your uid → **Denied**; on `/users/<your uid>/decks/x` → **Allowed**.

- [ ] **Step 7: Lint, build, HANDOFF, commit**

```bash
git add src/decks/deckStore.js src/decks/DeckList.jsx src/decks/dialogs.jsx src/decks/DecksView.jsx src/index.css HANDOFF.md
git commit -m "feat(decks): synced deck list with new, rename, duplicate, delete, export and backup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 8: Import a deck from a link or a pasted list

**Files:**
- Create: `src/decks/ImportDeckDialog.jsx`
- Modify: `src/decks/DeckList.jsx`

**Interfaces:**
- Consumes: `fetchDeckBoards` (Task 3), `parseDeckText`, `newDeck`, `addEntries`, `FORMATS` (Tasks 1-2), `resolveEntries` (Task 3).
- Produces: `ImportDeckDialog({ onClose, onImported(deck, notFound: string[]) })`.

- [ ] **Step 1: Create `src/decks/ImportDeckDialog.jsx`**

```jsx
import { useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { fetchDeckBoards } from '../utils/scryfall';
import { resolveEntries } from './scryfallSearch';
import { FORMATS, newDeck, addEntries, parseDeckText } from './deckModel';
import { IconX } from '../components/icons';

// Import mazzo: link (Moxfield/Archidekt/Tappedout, con le zone) oppure lista incollata
// (intestazioni Commander / Deck / Sideboard / Maybeboard riconosciute).
export default function ImportDeckDialog({ onClose, onImported }) {
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [format, setFormat] = useState('commander');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const close = () => { if (!busy) onClose(); };
  const ref = useOverlayDismiss(close);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      let rows;
      let deckName = name.trim();
      if (link.trim()) {
        const r = await fetchDeckBoards(link.trim());
        rows = r.rows;
        deckName = deckName || r.name;
      } else {
        rows = parseDeckText(text);
      }
      if (!rows.length) throw new Error('No cards found. Check the link or the list.');
      const { items, notFound } = await resolveEntries(rows);
      if (!items.length) throw new Error(`None of the ${notFound.length} cards was found. Check the spelling, or the (SET) number.`);
      onImported(addEntries(newDeck({ name: deckName || 'Imported deck', format }), items), notFound);
    } catch (e) {
      setError(e.message || 'Import failed.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Import deck" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import deck</h2>
          <button type="button" className="modal-close" onClick={close} aria-label="Close" disabled={busy}><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Paste a deck link, or the list by hand. Lines like <code>1 Sol Ring (C21) 263</code>; headers <code>Commander</code>, <code>Deck</code>, <code>Sideboard</code> and <code>Maybeboard</code> pick the board.</p>
        <input type="url" className="import-link-input" value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Deck link (Moxfield, Archidekt, Tappedout)" disabled={busy} spellCheck={false} />
        <textarea className="import-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={8}
          placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Command Tower'} disabled={busy || !!link.trim()} spellCheck={false} />
        <div className="import-meta-row">
          <input className="import-link-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name (optional)" maxLength={80} disabled={busy} aria-label="Deck name" />
          <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={busy} aria-label="Format">
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        {error && <div className="info-box info-box-error"><span>{error}</span></div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={close} disabled={busy}>Cancel</button>
          <button type="button" className="btn-generate import-btn" onClick={run} disabled={busy || (!link.trim() && !text.trim())}>
            {busy ? <><span className="spinner" /> Importing…</> : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

CSS (append):

```css
.import-meta-row { display: grid; grid-template-columns: 1fr 160px; gap: 8px; }
```

- [ ] **Step 2: Wire it in `DeckList.jsx`**

Import `ImportDeckDialog`. In the header actions, before Backup, add:

```jsx
          <button type="button" className="btn-secondary" onClick={() => setDialog('import')}><IconDownload size={15} /> Import</button>
```

Next to the other dialogs:

```jsx
      {dialog === 'import' && (
        <ImportDeckDialog onClose={() => setDialog(null)}
          onImported={(deck, notFound) => {
            setDialog(null);
            const id = create(deck);
            notify(notFound.length
              ? `Imported. Not found: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ` and ${notFound.length - 5} more` : ''}`
              : 'Deck imported', notFound.length ? 'error' : 'success');
            navigate(`/decks/${id}`);
          }} />
      )}
```

- [ ] **Step 3: Verify live**

Import pasted list `Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Nonexistent Cardname\n\nSideboard\n1 Pyroblast` as Commander: toast "Imported. Not found: Nonexistent Cardname", tile shows Atraxa art, "2/100", WUBG pips. Import a public Moxfield Commander link: deck name taken from Moxfield, commander art on the tile. Bad link → readable error, dialog stays open.

- [ ] **Step 4: Lint, build, HANDOFF, commit**

```bash
git add src/decks/ImportDeckDialog.jsx src/decks/DeckList.jsx src/index.css HANDOFF.md
git commit -m "feat(decks): import a deck from a link or a pasted list with boards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 9: Deck editor (sync, top bar, sections, rows, row menu)

**Files:**
- Create: `src/decks/useDeck.js`, `src/decks/DeckEditor.jsx`, `src/decks/DeckSections.jsx`
- Modify: `src/decks/DecksView.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `listenDeck`, `saveDeck` (Task 7), deckModel (Tasks 1-2), `cardsByIds` (Task 3), `CardMenu`, `useLongPress`, `ManaCost`, icons (Task 4), `navigate` (Task 5), `useIsMobile`.
- Produces:
  - `useDeck(uid, id): { deck: Deck|null|undefined, update(fn: (deck) => deck): void, saving: boolean, error }` (returning the same object from `fn` means "no change", nothing is written).
  - `DeckEditor({ uid, id, notify, printQueueCount, onPrintDeck })`.
  - `DeckSections({ deck, update, touch })`.

- [ ] **Step 1: Create `src/decks/useDeck.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDeck, saveDeck } from './deckStore';

// Mazzo aperto: stato locale + salvataggio dell'intero documento 800 ms dopo l'ultima modifica
// (e subito quando la scheda va in background o l'editor si chiude). Finché c'è una modifica
// locale in attesa, gli snapshot in arrivo non la sovrascrivono.
export function useDeck(uid, id) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = eliminato
  const [pending, setPending] = useState(false); // scritture non ancora confermate dal server
  const [dirty, setDirty] = useState(false); // modifiche in attesa del debounce
  const [error, setError] = useState(null);
  const latest = useRef(undefined);
  const timer = useRef(null);

  const write = useCallback(() => {
    timer.current = null;
    setDirty(false);
    if (latest.current) saveDeck(uid, latest.current).catch(setError);
  }, [uid]);

  useEffect(() => listenDeck(uid, id, (d, hasPending) => {
    setPending(hasPending);
    if (!timer.current) { latest.current = d; setDeck(d); }
  }, setError), [uid, id]);

  useEffect(() => {
    const flush = () => { if (timer.current) { clearTimeout(timer.current); write(); } };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [write]);

  const update = useCallback((fn) => {
    const prev = latest.current;
    if (!prev) return;
    const next = fn(prev);
    if (next === prev) return;
    latest.current = next;
    setDeck(next);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(write, 800);
  }, [write]);

  return { deck, update, saving: dirty || pending, error };
}
```

- [ ] **Step 2: Create `src/decks/DeckSections.jsx`**

```jsx
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import { useLongPress } from '../hooks/useLongPress';
import { ManaCost } from './Mana';
import { groupMain, commanderRows, boardRows, bumpQty, removeRows, setCommander, moveToBoard } from './deckModel';
import { IconPlus, IconMinus, IconTrash, IconCrown, IconList } from '../components/icons';

const BOARD_LABEL = { main: 'main deck', side: 'sideboard', maybe: 'maybeboard' };
const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.bottom };
};

// Corpo dell'editor: comandante, gruppi per tipo, sideboard, maybeboard. Selezione come le carte
// in stampa (click = aggiungi/togli, Shift = intervallo, Esc = svuota); menu su click destro,
// Shift+F10 o pressione lunga, che agisce su tutta la selezione se la riga ne fa parte.
export default function DeckSections({ deck, update, touch }) {
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null); // { ids, x, y }
  const [hover, setHover] = useState(null); // immagine in anteprima (desktop)
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);

  const blocks = useMemo(() => {
    const cmd = commanderRows(deck);
    const side = boardRows(deck, 'side');
    const maybe = boardRows(deck, 'maybe');
    return {
      commander: cmd.length || deck.format === 'commander' ? { label: 'Commander', rows: cmd } : null,
      groups: groupMain(deck),
      side: side.length || deck.format !== 'commander' ? { label: 'Sideboard', rows: side } : null,
      maybe: maybe.length ? { label: 'Maybeboard', rows: maybe } : null,
    };
  }, [deck]);
  const order = useMemo(() => [
    ...(blocks.commander?.rows || []), ...blocks.groups.flatMap((g) => g.rows), ...(blocks.side?.rows || []), ...(blocks.maybe?.rows || []),
  ].map((r) => r.id), [blocks]);
  const selected = order.filter((id) => sel.has(id)); // righe ancora esistenti

  const onRowClick = (e, id) => {
    if (press.consumed()) return;
    if (e.shiftKey && anchor && anchor !== id) {
      const a = order.indexOf(anchor);
      const b = order.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSel((prev) => new Set([...prev, ...order.slice(lo, hi + 1)]));
        setAnchor(id);
        return;
      }
    }
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setAnchor(id);
  };

  const openMenu = (id, x, y) => {
    const inSel = sel.has(id);
    if (!inSel) { setSel(new Set([id])); setAnchor(id); }
    setMenu({ ids: inSel && selected.length > 1 ? selected : [id], x, y });
  };

  const menuRows = menu ? deck.cards.filter((r) => menu.ids.includes(r.id)) : [];
  const items = [];
  if (menuRows.length) {
    const ids = menuRows.map((r) => r.id);
    const allMain = menuRows.every((r) => r.board === 'main');
    const allCmd = menuRows.every((r) => r.commander);
    if (deck.format === 'commander' && allMain) {
      items.push({ key: 'cmd', Icon: IconCrown, label: allCmd ? 'Remove as commander' : 'Set as commander', run: () => update((d) => setCommander(d, ids, !allCmd)) });
    }
    for (const b of ['main', 'side', 'maybe']) {
      if (menuRows.every((r) => r.board === b)) continue;
      if (b === 'side' && deck.format === 'commander') continue; // niente sideboard in Commander
      items.push({ key: b, Icon: IconList, label: `Move to ${BOARD_LABEL[b]}`, run: () => update((d) => moveToBoard(d, ids, b)) });
    }
    items.push({
      key: 'rm', Icon: IconTrash, label: ids.length > 1 ? `Remove ${ids.length} cards` : 'Remove', danger: true,
      run: () => { update((d) => removeRows(d, ids)); setSel(new Set()); },
    });
  }

  const row = (r) => (
    <li key={r.id} className={`deck-row${sel.has(r.id) ? ' selected' : ''}`}
      onMouseEnter={touch ? undefined : () => setHover(r.card.img)} onMouseLeave={touch ? undefined : () => setHover(null)}>
      <button type="button" className="deck-row-main" aria-pressed={sel.has(r.id)}
        onClick={(e) => onRowClick(e, r.id)}
        onContextMenu={(e) => { e.preventDefault(); const p = menuPoint(e); openMenu(r.id, p.x, p.y); }}
        onKeyDown={(e) => {
          if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
            e.preventDefault();
            const rc = e.currentTarget.getBoundingClientRect();
            openMenu(r.id, rc.left + 24, rc.bottom);
          }
        }}
        {...press.bind((x, y) => openMenu(r.id, x, y))}>
        <span className="deck-qty">{r.qty}</span>
        <span className="deck-name-cell">{r.card.name}</span>
        <ManaCost cost={r.card.mana} />
        <span className="deck-set">{r.card.set.toUpperCase()}</span>
      </button>
      <span className="deck-row-qty">
        <button type="button" aria-label={`One less ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, -1))}><IconMinus size={13} /></button>
        <button type="button" aria-label={`One more ${r.card.name}`} onClick={() => update((d) => bumpQty(d, r.id, 1))}><IconPlus size={13} /></button>
      </span>
    </li>
  );
  const group = (key, label, rows, extraClass = '') => (
    <section key={key} className={`deck-group ${extraClass}`} aria-label={label}>
      <h3 className="deck-group-head">{label} <span className="n">{sum(rows)}</span></h3>
      {rows.length ? <ul className="deck-rows">{rows.map(row)}</ul> : <p className="deck-empty">{key === 'commander' ? 'Right-click a card, then Set as commander.' : 'No cards yet.'}</p>}
    </section>
  );

  if (!deck.cards.length) {
    return <p className="deck-empty deck-empty-big">{touch ? 'Tap + to search and add cards.' : 'Search a card on the left and press Enter to add it.'}</p>;
  }
  return (
    <div className="deck-sections" onKeyDown={(e) => { if (e.key === 'Escape' && sel.size) { e.stopPropagation(); setSel(new Set()); } }}>
      {blocks.commander && group('commander', 'Commander', blocks.commander.rows, 'deck-block')}
      <div className="deck-columns">{blocks.groups.map((g) => group(g.key, g.label, g.rows))}</div>
      {blocks.side && group('side', 'Sideboard', blocks.side.rows, 'deck-block')}
      {blocks.maybe && (
        <details className="deck-maybe">
          <summary className="deck-group-head">Maybeboard <span className="n">{sum(blocks.maybe.rows)}</span></summary>
          <ul className="deck-rows">{blocks.maybe.rows.map(row)}</ul>
        </details>
      )}
      {menu && items.length > 0 && (
        <CardMenu x={menu.x} y={menu.y} title={menuRows.length === 1 ? menuRows[0].card.name : `${menuRows.length} cards selected`} items={items} onClose={closeMenu} />
      )}
      {hover && createPortal(<img className="deck-hover" src={hover} alt="" />, document.body)}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/decks/DeckEditor.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { useDeck } from './useDeck';
import { FORMATS, boardCounts, countTarget, countOk, refreshSnapshots } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import DeckSections from './DeckSections';
import { IconArrowLeft } from '../components/icons';

// Editor del mazzo: barra in alto (nome, formato, stato sync, conteggio), corpo con le sezioni.
// Ricerca (task 10) e Print deck (task 11) si aggiungono qui.
export default function DeckEditor({ uid, id, notify }) {
  const { deck, update, saving, error } = useDeck(uid, id);
  const mobile = useIsMobile();
  const [online, setOnline] = useState(() => navigator.onLine);
  const refreshed = useRef(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!error) return;
    notify(error.code === 'resource-exhausted'
      ? 'Daily sync limit reached. Your changes stay on this device and sync after the reset.'
      : `Sync error: ${error.message}`, 'error');
  }, [error, notify]);

  // Eliminato da un altro dispositivo mentre era aperto.
  useEffect(() => {
    if (deck !== null) return;
    notify('This deck was deleted', 'error');
    navigate('/decks');
  }, [deck, notify]);

  // Riallinea una volta gli snapshot con Scryfall (ban, immagini). Scryfall giù = restano quelli salvati.
  useEffect(() => {
    if (!deck || refreshed.current) return;
    refreshed.current = true;
    const ids = deck.cards.map((r) => r.card.sid);
    if (ids.length) cardsByIds(ids).then((map) => update((d) => refreshSnapshots(d, map).deck)).catch(() => {});
  }, [deck, update]);

  if (!deck) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;

  const c = boardCounts(deck);
  const target = countTarget(deck.format);
  const sync = !online ? (saving ? 'Offline, saved on this device' : 'Offline') : saving ? 'Saving…' : 'Saved';
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <header className="deck-bar">
        <a className="deck-back" href="#/decks" aria-label="Back to decks"><IconArrowLeft size={18} /></a>
        <input className="deck-name" value={deck.name} maxLength={80} aria-label="Deck name" spellCheck={false}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          onBlur={() => update((d) => (d.name.trim() ? d : { ...d, name: 'Untitled deck' }))} />
        <select className="deck-format" value={deck.format} aria-label="Format" onChange={(e) => update((d) => ({ ...d, format: e.target.value }))}>
          {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <span className={`deck-sync${online ? '' : ' offline'}`} role="status">{sync}</span>
        <span className={`deck-count ${countOk(deck.format, c.main) ? 'ok' : 'warn'}`} title="Main deck">
          {c.main}{target ? `/${target}` : ''}
        </span>
      </header>
      <div className="deck-body">
        <section className="deck-main"><DeckSections deck={deck} update={update} touch={mobile} /></section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Route the editor in `DecksView.jsx`**

Change the signature to `export default function DecksView({ route, notify, printQueueCount, onPrintDeck })`, import `DeckEditor`, and before the `return <DeckList …` line add:

```jsx
  const id = route.split('/')[2];
  if (id) return <DeckEditor key={id} uid={user.uid} id={id} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />;
```

- [ ] **Step 5: CSS (append)**

```css
/* Editor mazzo: barra + corpo (ricerca a sinistra su desktop, dal task 10). */
.deck-editor { height: 100%; min-height: 0; display: grid; grid-template-rows: auto 1fr; }
.deck-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 18px; background: rgba(10, 9, 18, 0.55); border-bottom: 1px solid rgba(124, 92, 255, 0.16); }
.deck-back { display: flex; padding: 6px; border-radius: 6px; color: var(--text-secondary); }
.deck-back:hover, .deck-back:focus-visible { color: var(--cyan-soft); background: var(--bg-glass-hover); outline: none; }
.deck-name {
  flex: 1 1 180px; min-width: 0;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}
.deck-name:hover { border-color: var(--border); }
.deck-name:focus { outline: none; border-color: var(--cyan); box-shadow: var(--focus-ring); }
.deck-format { width: auto; }
.deck-sync { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); }
.deck-sync.offline { color: var(--warning); }
.deck-count { font-family: var(--font-mono); font-size: 0.8rem; padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; color: var(--warning); }
.deck-count.ok { color: var(--success); border-color: rgba(34, 197, 94, 0.35); }
.deck-body { min-height: 0; display: grid; grid-template-columns: 1fr; }
.deck-main { min-height: 0; overflow-y: auto; padding: 18px 22px 40px; }

.deck-columns { columns: 260px; column-gap: 28px; }
.deck-group { break-inside: avoid; margin: 0 0 18px; }
.deck-block { margin-bottom: 22px; }
.deck-group-head {
  display: flex; align-items: baseline; gap: 8px;
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #c9c4ea;
}
.deck-group-head .n { font-family: var(--font-mono); letter-spacing: 0; color: var(--cyan); }
.deck-rows { list-style: none; margin: 0; padding: 0; }
.deck-row { display: flex; align-items: center; gap: 4px; border-top: 1px solid rgba(124, 92, 255, 0.12); }
.deck-row-main {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 5px 4px;
  background: none; border: none; border-radius: 4px;
  color: var(--text-primary);
  font: inherit; font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  -webkit-touch-callout: none;
  user-select: none;
}
.deck-row-main:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.deck-qty { min-width: 1.6em; text-align: right; font-family: var(--font-mono); color: var(--cyan-soft); }
.deck-name-cell { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deck-set { font-family: var(--font-mono); font-size: 0.66rem; color: var(--text-muted); }
/* Riga selezionata: velo magenta + barretta a sinistra (come il frame delle carte selezionate). */
.deck-row.selected { background: rgba(255, 45, 149, 0.08); box-shadow: inset 2px 0 0 var(--accent); }
.deck-row-qty { display: flex; gap: 2px; opacity: 0; transition: opacity var(--transition); }
.deck-row:hover .deck-row-qty, .deck-row:focus-within .deck-row-qty { opacity: 1; }
@media (hover: none) { .deck-row-qty { opacity: 1; } }
.deck-row-qty button { display: flex; padding: 3px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-elevated); color: var(--text-secondary); cursor: pointer; }
.deck-row-qty button:hover, .deck-row-qty button:focus-visible { color: var(--cyan-soft); border-color: var(--border-hover); outline: none; }
.deck-maybe { margin-top: 8px; }
.deck-maybe summary { cursor: pointer; list-style: none; }
.deck-maybe summary::-webkit-details-marker { display: none; }
.deck-empty { margin: 4px 0; font-size: 0.8rem; color: var(--text-muted); }
.deck-empty-big { padding: 40px 0; font-size: 0.95rem; text-align: center; }
/* Anteprima carta al passaggio (desktop): in basso a sinistra, sopra la colonna di ricerca. */
.deck-hover { position: fixed; left: 24px; bottom: 24px; z-index: 200; width: 250px; border-radius: 12px; pointer-events: none; box-shadow: var(--shadow-lg), 0 0 24px rgba(0, 229, 255, 0.18); }
.deck-editor.is-mobile .deck-bar { padding: 10px 12px; }
.deck-editor.is-mobile .deck-main { padding: 14px 14px 110px; }
.deck-editor.is-mobile .deck-columns { columns: auto; }
```

- [ ] **Step 6: Verify live (signed in, the imported deck from Task 8)**

Open the deck: groups Creatures / Artifacts / Lands … in columns, Commander block with Atraxa, Sideboard block shown when the format is Modern. Hover a row: card image bottom-left. +/− change quantities; − on 1 removes the row. Click two rows and Shift-click a third: range selected; Esc clears. Right-click a selected row: "2 cards selected" menu, Move to maybeboard moves both (Maybeboard section appears, collapsed). Set as commander on a non-commander. Rename in the bar: "Saving…" then "Saved"; the tile name in the list updates. Second tab on the same deck: edits appear there after about a second. Delete the deck from the list in the second tab while open in the first: toast "This deck was deleted", back to the list. Console: no errors.

- [ ] **Step 7: Lint, build, HANDOFF, commit**

```bash
git add src/decks/useDeck.js src/decks/DeckEditor.jsx src/decks/DeckSections.jsx src/decks/DecksView.jsx src/index.css HANDOFF.md
git commit -m "feat(decks): deck editor with debounced sync, type groups, boards and row menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 10: Card search with the add shortcuts

**Files:**
- Create: `src/decks/CardSearch.jsx`
- Modify: `src/decks/DeckEditor.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `autocomplete`, `namedCard`, `searchCards` (Task 3), `snapshotFromCard`, `copiesToAdd`, `addCard` (Task 1), `MobilePage` (Task 4).
- Produces: `CardSearch({ format, onAdd(card: Snapshot, {board, qty}), autoFocus? })`.

- [ ] **Step 1: Create `src/decks/CardSearch.jsx`**

```jsx
import { useEffect, useId, useState } from 'react';
import { autocomplete, namedCard, searchCards } from './scryfallSearch';
import { snapshotFromCard, copiesToAdd } from './deckModel';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconSearch, IconPlus, IconX } from '../components/icons';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const thumb = (c) => c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };

export default function CardSearch({ format, onAdd, autoFocus }) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState(null); // { cards, next, total }
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null); // carta Scryfall ingrandita
  const listId = useId();
  const text = q.trim();
  const visible = text.length >= 2 ? sugg : [];

  // Autocompletamento: 250 ms dopo l'ultima battuta, la richiesta precedente viene annullata.
  useEffect(() => {
    if (text.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      autocomplete(text, ctrl.signal)
        .then((names) => { setSugg(names); setActive(0); })
        .catch((e) => { if (e.name !== 'AbortError') setSugg([]); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);

  const add = async (getCard, e) => {
    const { board, four } = target(e, format); // letti prima dell'await
    setError(null);
    try {
      const snap = snapshotFromCard(await getCard());
      const qty = copiesToAdd(format, snap, four);
      onAdd(snap, { board, qty });
      setStatus(`Added ${qty} ${snap.name}${WHERE[board]}`);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.status === 404 ? 'Card not found.' : err.message || 'Could not add the card.');
    }
  };
  const addSuggestion = (name, e) => { setQ(''); setSugg([]); add(() => namedCard(name), e); };

  const runSearch = async (pageUrl) => {
    if (!text && !pageUrl) return;
    setBusy(true);
    setError(null);
    setSugg([]);
    try {
      const r = await searchCards(text, undefined, pageUrl);
      setResults((prev) => (pageUrl && prev ? { ...r, cards: [...prev.cards, ...r.cards] } : r));
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && visible.length) { e.preventDefault(); setActive((i) => (i + 1) % visible.length); }
    else if (e.key === 'ArrowUp' && visible.length) { e.preventDefault(); setActive((i) => (i - 1 + visible.length) % visible.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (visible.length) addSuggestion(visible[Math.min(active, visible.length - 1)], e);
      else runSearch();
    } else if (e.key === 'Escape' && visible.length) { e.stopPropagation(); setSugg([]); }
  };
  // Enter (con i modificatori) su un risultato o sul suo + aggiunge; il click sull'immagine ingrandisce.
  const enterAdds = (c) => (e) => { if (e.key === 'Enter') { e.preventDefault(); add(async () => c, e); } };

  return (
    <div className="card-search">
      <div className="search-wrap">
        <div className="search-box">
          <IconSearch size={16} />
          <input role="combobox" aria-label="Search cards" aria-expanded={visible.length > 0} aria-controls={listId}
            aria-autocomplete="list" aria-activedescendant={visible.length ? `${listId}-${active}` : undefined}
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search a card name" autoFocus={autoFocus} spellCheck={false} autoComplete="off" />
          <button type="button" className="search-go" onClick={() => runSearch()} disabled={!text || busy} aria-label="Show results">
            {busy ? <span className="import-spinner" /> : <IconSearch size={15} />}
          </button>
        </div>
        {visible.length > 0 && (
          <ul id={listId} role="listbox" className="search-suggest">
            {visible.map((n, i) => (
              <li key={n} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined}
                onMouseDown={(e) => { e.preventDefault(); addSuggestion(n, e); }} onMouseEnter={() => setActive(i)}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="search-hint">Enter adds 1 · Shift+Enter 4 · Alt+Enter to {format === 'commander' ? 'maybeboard' : 'sideboard'}</p>
      <p className="search-status" role="status">{status}</p>
      {error && <div className="info-box info-box-error"><span>{error}</span></div>}

      {results && (
        results.cards.length === 0
          ? <p className="deck-empty">No cards found.</p>
          : (
            <>
              <p className="search-count">{results.total} result{results.total !== 1 ? 's' : ''}</p>
              <ul className="search-results">
                {results.cards.map((c) => (
                  <li key={c.id} className="search-card">
                    <button type="button" className="search-card-img" onClick={() => setZoom(c)} onKeyDown={enterAdds(c)}
                      aria-label={`${c.name}. Enter to add, Space to enlarge`}>
                      <img src={thumb(c)} alt="" loading="lazy" />
                    </button>
                    <button type="button" className="search-card-add" aria-label={`Add ${c.name}`}
                      onClick={(e) => add(async () => c, e)} onKeyDown={enterAdds(c)}>
                      <IconPlus size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              {results.next && <button type="button" className="btn-secondary search-more" onClick={() => runSearch(results.next)} disabled={busy}>Load more</button>}
            </>
          )
      )}
      {zoom && <CardZoom card={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function CardZoom({ card, onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card-zoom-wrap" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={card.name}>
        <img className="card-zoom" src={card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large || thumb(card)} alt={card.name} />
        <button type="button" className="modal-close card-zoom-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it in `DeckEditor.jsx`**

Imports: add `import CardSearch from './CardSearch';`, `import { MobilePage } from '../components/MobileLayout';`, change the deckModel import to also take `addCard`, change the icons import to `{ IconArrowLeft, IconPlus }`.
State: add `const [searchOpen, setSearchOpen] = useState(false);`.
Before `if (!deck) return …` add:

```jsx
  const add = (card, opts) => update((d) => {
    const r = addCard(d, card, opts);
    if (!r.added) notify('This deck already has 500 rows', 'error');
    return r.deck;
  });
```

Replace the `<div className="deck-body">…</div>` block with:

```jsx
      <div className="deck-body">
        {!mobile && <aside className="deck-search"><CardSearch format={deck.format} onAdd={add} /></aside>}
        <section className="deck-main"><DeckSections deck={deck} update={update} touch={mobile} /></section>
      </div>
      {mobile && <button type="button" className="fab deck-fab" onClick={() => setSearchOpen(true)} aria-label="Add cards"><IconPlus size={26} /></button>}
      {mobile && searchOpen && (
        <MobilePage title="Add cards" onClose={() => setSearchOpen(false)}>
          <CardSearch format={deck.format} onAdd={add} autoFocus />
        </MobilePage>
      )}
```

- [ ] **Step 3: CSS (append) and the desktop column**

Change `.deck-body { … grid-template-columns: 1fr; }` to `grid-template-columns: 300px 1fr;` and add `.deck-editor.is-mobile .deck-body { grid-template-columns: 1fr; }`. Append:

```css
.deck-search { min-height: 0; overflow-y: auto; padding: 18px; background: rgba(10, 9, 18, 0.4); border-right: 1px solid rgba(124, 92, 255, 0.16); }
.search-wrap { position: relative; }
.search-box { display: flex; align-items: center; gap: 8px; padding: 0 6px 0 10px; background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); }
.search-box:focus-within { border-color: var(--cyan); box-shadow: var(--focus-ring); }
.search-box input { flex: 1; min-width: 0; padding: 9px 0; background: none; border: none; color: var(--text-primary); font: inherit; font-size: 0.88rem; }
.search-box input:focus { outline: none; }
.search-go { display: flex; padding: 6px; background: none; border: none; border-radius: 4px; color: var(--text-secondary); cursor: pointer; }
.search-go:hover:not(:disabled) { color: var(--cyan-soft); }
.search-suggest {
  position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 20;
  max-height: 320px; overflow-y: auto;
  list-style: none; margin: 0; padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}
.search-suggest li { padding: 7px 10px; border-radius: 6px; font-size: 0.85rem; color: var(--text-primary); cursor: pointer; }
.search-suggest li.active { background: rgba(0, 229, 255, 0.1); color: var(--cyan-soft); }
.search-hint { margin: 8px 0 0; font-family: var(--font-mono); font-size: 0.66rem; color: var(--text-muted); }
.search-status { min-height: 1.2em; margin: 6px 0 0; font-size: 0.75rem; color: var(--success); }
.search-count { margin: 12px 0 0; font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-secondary); }
.search-results { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.deck-editor.is-mobile .search-results, .mobile-page .search-results { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.search-card { position: relative; }
.search-card-img { display: block; width: 100%; padding: 0; border: none; background: none; border-radius: 4.75% / 3.4%; overflow: hidden; cursor: zoom-in; }
.search-card-img img { display: block; width: 100%; aspect-ratio: 63 / 88; object-fit: cover; }
.search-card-img:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.search-card-add { position: absolute; right: 6px; bottom: 6px; display: flex; padding: 6px; border-radius: 50%; border: 1px solid rgba(0, 229, 255, 0.5); background: rgba(8, 7, 15, 0.85); color: var(--cyan-soft); cursor: pointer; }
.search-card-add:hover, .search-card-add:focus-visible { border-color: var(--cyan); box-shadow: 0 0 12px var(--cyan-glow); outline: none; }
.search-more { width: 100%; justify-content: center; margin-top: 12px; }
.card-zoom-wrap { position: relative; outline: none; }
.card-zoom { display: block; max-width: 92vw; max-height: 86vh; border-radius: 18px; box-shadow: var(--shadow-lg); }
.card-zoom-close { position: absolute; top: -12px; right: -12px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 50%; }
.deck-fab { position: fixed; right: 18px; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 50; }
```

- [ ] **Step 4: Verify live**

Commander deck: type `sol r`, suggestions appear, first highlighted; Enter → "Added 1 Sol Ring", focus stays in the box. `forest` + Shift+Enter → 4 Forest. `lightning bolt` + Shift+Enter → 1 (singleton). Alt+Enter → goes to Maybeboard. Switch format to Modern: Alt+Enter → Sideboard, Shift+Enter → 4. Type `t:goblin c:r`, click the search icon: result grid; Tab to a result + Shift+Enter → 4 copies; click an image → zoom, Esc closes; Load more appends. Type `zzzz qqq` and search: "No cards found." Mobile viewport: + button opens "Add cards" full screen with the same search. Console: no errors.

- [ ] **Step 5: Lint, build, HANDOFF, commit**

```bash
git add src/decks/CardSearch.jsx src/decks/DeckEditor.jsx src/index.css HANDOFF.md
git commit -m "feat(decks): card search with autocomplete and Enter, Alt, Shift add shortcuts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 11: Print deck

**Files:**
- Modify: `src/decks/dialogs.jsx` (add `PrintDeckDialog`), `src/decks/DeckEditor.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `toPrintEntries`, `boardCounts` (Tasks 1-2); `onPrintDeck`, `printQueueCount` props (Task 5).
- Produces: `PrintDeckDialog({ queueCount, sideCount, onConfirm(includeSide: boolean), onClose })`.

- [ ] **Step 1: Add `PrintDeckDialog` to `dialogs.jsx`**

```jsx
// Conferma "Print deck": sostituzione della coda (se non vuota) e sideboard opzionale.
export function PrintDeckDialog({ queueCount, sideCount, onConfirm, onClose }) {
  const [side, setSide] = useState(false);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-confirm" ref={ref} role="dialog" aria-modal="true" aria-label="Print deck" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Print deck</h2></div>
        {queueCount > 0 && <p className="modal-hint">Replace the {queueCount} card{queueCount !== 1 ? 's' : ''} in the print queue?</p>}
        {sideCount > 0 && (
          <label className="checkbox-row">
            <input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} />
            <span className="anim-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
                <polyline points="1 9 7 14 15 4" />
              </svg>
            </span>
            Include sideboard ({sideCount})
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} autoFocus>Cancel</button>
          <button type="button" className="btn-generate import-btn" onClick={() => onConfirm(side)}>{queueCount > 0 ? 'Replace and print' : 'Print'}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it in `DeckEditor.jsx`**

Signature `DeckEditor({ uid, id, notify, printQueueCount, onPrintDeck })`. Imports: `toPrintEntries` from deckModel, `PrintDeckDialog` from `./dialogs`, `IconPrinter` from icons. State `const [printOpen, setPrintOpen] = useState(false);`. After `const c = boardCounts(deck);` add:

```jsx
  // Nessuna domanda se la coda è vuota e non c'è sideboard.
  const startPrint = () => {
    if (!printQueueCount && !c.side) onPrintDeck(toPrintEntries(deck));
    else setPrintOpen(true);
  };
```

At the end of `.deck-bar` add:

```jsx
        <button type="button" className="btn-secondary deck-print" onClick={startPrint} disabled={!c.main}><IconPrinter size={15} /> Print deck</button>
```

Before the closing `</div>` of `.deck-editor` add:

```jsx
      {printOpen && (
        <PrintDeckDialog queueCount={printQueueCount} sideCount={c.side} onClose={() => setPrintOpen(false)}
          onConfirm={(side) => { setPrintOpen(false); onPrintDeck(toPrintEntries(deck, { includeSide: side })); }} />
      )}
```

CSS (append): `.deck-print { margin-left: auto; }`

- [ ] **Step 3: Verify end to end**

Empty print queue, Commander deck with a DFC (add Delver of Secrets): Print deck → no dialog, toast with progress, lands on Print with all cards (Delver front and back), commander first. Back to the deck, Print deck again → dialog "Replace the N cards…", Replace and print → queue replaced. Modern deck with a sideboard: dialog shows "Include sideboard (N)"; unchecked → sideboard not printed; checked → printed. Generate a PDF from the result to confirm the print flow is untouched.

- [ ] **Step 4: Lint, build, HANDOFF, commit**

```bash
git add src/decks/dialogs.jsx src/decks/DeckEditor.jsx src/index.css HANDOFF.md
git commit -m "feat(decks): Print deck sends the deck to the print queue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 12: Phone pass, offline check and wrap-up

**Files:**
- Modify: `src/index.css` (only for issues found), `HANDOFF.md`

- [ ] **Step 1: Phone viewport**

`resize_window` preset mobile, reload. Check:
- tabs fit in the header next to the wordmark;
- the deck list is one column of tiles;
- long-press opens the tile menu: the pane cannot hold a touch, so dispatch it with `javascript_tool`: `el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 50, clientY: 50 }))` on a `.deck-tile`, wait 600 ms, then `read_page` must show the menu;
- no horizontal scroll in list and editor (`document.documentElement.scrollWidth <= innerWidth`);
- **+** opens the "Add cards" sheet; rows show +/− without hover.

Fix any overflow in `src/index.css` with rules scoped to `.deck-editor.is-mobile` or `.mobile-decks`. Reset with preset desktop.

- [ ] **Step 2: Offline**

The pane cannot cut the network, so split the check:
- Label logic (in the pane): `javascript_tool` → `window.dispatchEvent(new Event('offline'))`; the label shows "Offline"; change a quantity → "Offline, saved on this device" (the write is still pending only if Firestore is really offline, so "Saving…" then "Offline" is also acceptable here); `window.dispatchEvent(new Event('online'))` → "Saved".
- Real offline (by the user): on the phone, airplane mode on, edit a deck, airplane mode off; the PC shows the change within a few seconds.

- [ ] **Step 3: iOS Safari sign-in**

Ask the user to sign in on an iPhone (Safari) on the deployed site after the push. If the popup fails, note it in HANDOFF under known issues with the error text, for a follow-up.

- [ ] **Step 4: Final checks**

Run: `node src/decks/deckModel.selfcheck.js && node src/utils/scryfall.selfcheck.js && npm run lint && npm run build`
Expected: both self-checks ok, lint clean, build ok with a separate DecksView chunk.

- [ ] **Step 5: HANDOFF**

"Done recently": phase 1 complete (what shipped, how verified, open items: iOS sign-in result, phase 2 and 3 plans to write). Make sure every new file has a row in the file table.

- [ ] **Step 6: Commit**

```bash
git add src/index.css HANDOFF.md
git commit -m "docs(handoff): deck manager phase 1 complete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```
