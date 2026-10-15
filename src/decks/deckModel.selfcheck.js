// Self-check della logica mazzi. Esegui: node src/decks/deckModel.selfcheck.js
// ponytail: niente framework, un file, assert via throw (come scryfall.selfcheck.js).
import {
  snapshotFromCard, copyLimitFromText, newDeck, addCard, setQty, bumpQty, removeRows, setCommander,
  moveToBoard, boardCounts, countOk, copiesToAdd, MAX_ROWS, MAX_QTY,
} from './deckModel.js';
import {
  groupMain, commanderRows, boardRows, deckIdentity, deckCover, toPrintEntries, exportText,
  parseDeckText, toBackup, fromBackup, duplicateDeck, refreshSnapshots, primaryType,
  addSection, renameSection, deleteSection, moveToSection, overLimit, placeRows, illegalIn, legalityLabel,
  splitRow, changeEdition, manaPips, deckStats, validateDeck, maxCopies, packPiles,
  libraryCards, shuffle, mulliganBottom, hyperAtLeast, deckPrice, addEntries, searchTerms, deckMatches,
} from './deckModel.js';
import { autocompleteUrl, namedUrl, searchUrl, advancedQuery, withLegal } from './scryfallSearch.js';

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
const priced = snapshotFromCard({ ...sc({ id: 'p1', name: 'P' }), prices: { eur: '1.50', usd: null } });
eq([priced.eur, priced.usd, bolt.eur], [1.5, null, null], 'snapshot: prezzi Scryfall in numero, mancante = null');

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
// mano di prova: grimorio = main senza comandanti, una voce per copia
eq(libraryCards(g).map((e) => e.card.name), ['Lightning Bolt', 'Forest', 'Sol Ring', 'Goblin Guide', 'Solemn Simulacrum'], 'grimorio senza comandante né sideboard');
const lib4 = libraryCards(addCard(newDeck({ name: 'l', format: 'modern' }), bolt, { qty: 4 }).deck);
eq([lib4.length, new Set(lib4.map((e) => e.key)).size], [4, 4], 'grimorio: 4 copie, chiavi distinte');
const deckOrder = [1, 2, 3, 4];
eq([shuffle(deckOrder, () => 0), deckOrder], [[2, 3, 4, 1], [1, 2, 3, 4]], 'shuffle: Fisher-Yates su una copia');
eq([...shuffle(deckOrder)].sort(), [1, 2, 3, 4], 'shuffle: permutazione');
eq([mulliganBottom('commander', 1), mulliganBottom('commander', 2), mulliganBottom('modern', 1), mulliganBottom('modern', 0)], [0, 1, 1, 0],
  'mulligan London, il primo gratis in Commander');
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
eq(exportText(g, { specs: false }).split('\n'), ['Commander', "1 Atraxa, Praetors' Voice", '', 'Deck', '1 Lightning Bolt', '1 Forest',
  '1 Sol Ring', '1 Goblin Guide', '1 Solemn Simulacrum', '', 'Sideboard', '1 Pyroblast'], 'export testo semplice, senza set e numero');
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
// Raggruppamenti: tipo avanzato (doppi tipi separati), mana value, sezioni custom
const D = '\u2014'; // trattino dei type line Scryfall
const gx0 = [
  snap({ id: 'golem', name: 'Steel Golem', mv: 3, type: `Artifact Creature ${D} Golem` }),
  snap({ id: 'elf', name: 'Llanowar Elves', mv: 1, type: `Creature ${D} Elf` }),
  snap({ id: 'ench', name: 'Courser of Kruphix', mv: 3, type: `Enchantment Creature ${D} Centaur` }),
  snap({ id: 'cit', name: 'Darksteel Citadel', mv: 0, type: 'Artifact Land' }),
  snap({ id: 'fst', name: 'Forest', mv: 0, type: `Basic Land ${D} Forest` }),
  snap({ id: 'emra', name: 'Emrakul', mv: 15, type: `Legendary Creature ${D} Eldrazi` }),
  snap({ id: 'crib', name: 'Crib Swap', mv: 3, type: `Kindred Instant ${D} Shapeshifter` }),
].reduce((d, c) => addCard(d, c).deck, newDeck({ name: 'G', format: 'casual' }));
const lab = (d, sort) => groupMain(d, sort).map((x) => [x.label, x.rows.map((r) => r.card.name)]);
eq(lab({ ...gx0, groupBy: 'typeAdv' }), [
  ['Creatures', ['Llanowar Elves', 'Emrakul']],
  ['Artifact Creatures', ['Steel Golem']],
  ['Enchantment Creatures', ['Courser of Kruphix']],
  ['Kindred Instants', ['Crib Swap']],
  ['Lands', ['Forest']],
  ['Artifact Lands', ['Darksteel Citadel']],
], 'tipo avanzato: doppi tipi in gruppi propri, nella famiglia del tipo principale');
eq(lab({ ...gx0, groupBy: 'mv' }), [
  ['1 mana', ['Llanowar Elves']],
  ['3 mana', ['Courser of Kruphix', 'Crib Swap', 'Steel Golem']],
  ['7+ mana', ['Emrakul']],
  ['Lands', ['Darksteel Citadel', 'Forest']],
], 'mana value: 7+ in un gruppo, terre a parte');
eq(lab({ ...gx0, groupBy: 'typeAdv' }, 'name')[0], ['Creatures', ['Emrakul', 'Llanowar Elves']], 'ordine per nome dentro il gruppo');
let cu = gx0;
const ramp = addSection(cu, '  Ramp  ');
cu = ramp.deck;
eq([cu.sections, cu.groupBy], [[{ id: ramp.id, name: 'Ramp' }], 'custom'], 'sezione: nome ripulito, il mazzo passa a custom');
const elfRow = () => cu.cards.find((r) => r.card.sid === 'elf' && r.board === 'main');
cu = moveToSection(cu, [elfRow().id], ramp.id);
eq(groupMain(cu).map((x) => [x.label, x.section, x.count]), [['Deck', null, 6], ['Ramp', ramp.id, 1]], 'custom: Deck poi le sezioni, con id');
eq(groupMain({ ...cu, groupBy: 'type' })[0].rows.map((r) => r.card.name), ['Llanowar Elves', 'Courser of Kruphix', 'Steel Golem', 'Emrakul'], 'le sezioni non contano negli altri modi');
cu = renameSection(cu, ramp.id, ' Mana ');
eq(groupMain(cu)[1].label, 'Mana', 'rinomina sezione');
const elfCard = elfRow().card;
cu = addCard(cu, elfCard, { board: 'side' }).deck;
cu = moveToBoard(cu, [cu.cards.find((r) => r.card.sid === 'elf' && r.board === 'side').id], 'main');
eq(cu.cards.filter((r) => r.card.sid === 'elf').map((r) => [r.section, r.qty]), [[ramp.id, 1], [null, 1]], 'stessa carta in Deck e in sezione: righe distinte');
cu = deleteSection(cu, ramp.id);
eq([cu.sections.length, cu.groupBy, cu.cards.filter((r) => r.card.sid === 'elf').map((r) => [r.section, r.qty])], [0, 'type', [[null, 2]]],
  'elimina ultima sezione: righe in Deck e fuse, raggruppamento torna a Type');
// Trascinamento tra zone: board di destinazione, sezione solo se indicata, mai comandante.
let pl = addSection({ ...gx0, format: 'commander' }, 'Ramp');
const plRamp = pl.id;
pl = pl.deck;
const pid = (sid) => pl.cards.find((r) => r.card.sid === sid).id;
pl = setCommander(pl, [pid('emra')], true);
pl = placeRows(pl, [pid('elf'), pid('golem')], 'side');
pl = placeRows(pl, [pid('emra')], 'main', plRamp);
pl = placeRows(pl, [pid('elf')], 'main');
const pos = (sid) => { const r = pl.cards.find((x) => x.card.sid === sid); return [r.board, r.section, r.commander]; };
eq([pos('golem'), pos('emra'), pos('elf')], [['side', null, false], ['main', plRamp, false], ['main', null, false]],
  'placeRows: sideboard, sezione con comandante tolto, ritorno nel main senza sezione');
eq(boardRows(pl, 'side', 'name').map((r) => r.card.name), ['Steel Golem'], 'boardRows con ordine');
// Alt+trascina: una copia sola. La riga resta con una copia in meno, la copia si fonde con una
// riga uguale nella destinazione; con una copia sola si sposta la riga intera.
let one = addCard(newDeck({ name: 'O', format: 'modern' }), bolt, { qty: 4 }).deck;
one = addCard(one, bolt, { board: 'side' }).deck;
const boltMain = one.cards.find((r) => r.board === 'main').id;
one = placeRows(one, [boltMain], 'side', undefined, { one: true });
eq(one.cards.map((r) => [r.board, r.qty]), [['main', 3], ['side', 2]], 'una copia: 3 restano nel main, la sideboard sale a 2');
one = placeRows(one, [one.cards.find((r) => r.board === 'side').id], 'maybe', undefined, { one: true });
eq(one.cards.map((r) => [r.board, r.qty]), [['main', 3], ['side', 1], ['maybe', 1]], 'una copia in una zona vuota: riga nuova');
const boltSide = one.cards.find((r) => r.board === 'side');
one = placeRows(one, [boltSide.id], 'main', undefined, { one: true });
eq([one.cards.map((r) => [r.board, r.qty]), one.cards.some((r) => r.id === boltSide.id)], [[['main', 4], ['maybe', 1]], false],
  'ultima copia: la riga si sposta e si fonde');
eq(fromBackup({ app: 'proxoteca', kind: 'decks', v: 1, decks: [{ name: 'B', groupBy: 'typeAdv', cards: [] }] })[0].groupBy, 'typeAdv', 'backup: tipo avanzato accettato');

// Avviso copie: 4 nei formati da 60 (main + sideboard, stampe diverse insieme), 1 in Commander
// (solo main); terre base e "any number" esenti, "up to N" = N; Casual e maybeboard mai.
let lim = newDeck({ name: 'L', format: 'modern' });
lim = addCard(lim, bolt, { qty: 3 }).deck;
lim = addCard(lim, { ...bolt, sid: 'bolt-m10', set: 'm10' }).deck;
lim = addCard(lim, forest, { qty: 20 }).deck;
lim = addCard(lim, rats, { qty: 30 }).deck;
lim = addCard(lim, dwarves, { qty: 7 }).deck;
lim = addCard(lim, bolt, { board: 'maybe', qty: 9 }).deck;
eq(overLimit(lim), [], '4 Bolt su due stampe, base, any number, up to seven, maybeboard: nessun avviso');
lim = addCard(lim, bolt, { board: 'side' }).deck;
lim = addCard(lim, dwarves).deck;
const overL = (d) => overLimit(d).map((e) => [e.name, e.count, e.max]);
eq(overL(lim), [['Lightning Bolt', 5, 4], ['Seven Dwarves', 8, 7]], 'sideboard conta; up to N alza il limite');
eq(overL({ ...lim, format: 'commander' }), [['Lightning Bolt', 4, 1], ['Seven Dwarves', 8, 7]], 'Commander: 1 copia, sideboard fuori');
eq(overL({ ...lim, format: 'casual' }), [], 'Casual: nessun limite');

// Legalità nel formato: banned e not_legal bloccano, legal e restricted no, Casual mai.
const legalCard = (l) => ({ legal: { modern: l, commander: 'legal' } });
eq(['banned', 'not_legal', 'legal', 'restricted'].map((l) => illegalIn('modern', legalCard(l))), ['banned', 'not_legal', null, null], 'illegalIn per stato');
eq([illegalIn('casual', legalCard('banned')), illegalIn('pioneer', { legal: {} }), illegalIn('modern', {})], [null, 'not_legal', 'not_legal'], 'Casual libero, dato mancante = non legale');
eq([legalityLabel('banned', 'modern'), legalityLabel('not_legal', 'pauper')], ['Banned in Modern', 'Not legal in Pauper'], 'etichette');

// Split row: una copia in una riga nuova subito dopo; poi cambio edizione di quella copia sola.
let ed = addCard(newDeck({ name: 'E', format: 'modern' }), bolt, { qty: 4 }).deck;
ed = addCard(ed, forest).deck;
ed = splitRow(ed, ed.cards[0].id);
eq(ed.cards.map((r) => [r.card.name, r.qty]), [['Lightning Bolt', 3], ['Lightning Bolt', 1], ['Forest', 1]], 'split: copia subito dopo, righe uguali non fuse');
const boltM10 = { ...bolt, sid: 'bolt-m10', set: 'm10', cn: '146', img: 'n-m10', art: 'a-m10' };
ed = changeEdition(ed, [ed.cards[1].id], boltM10);
eq(ed.cards.map((r) => [r.qty, r.card.set]), [[3, 'tst'], [1, 'm10'], [1, 'tst']], 'cambio edizione della copia separata');
ed = changeEdition(ed, [ed.cards[0].id], boltM10);
eq(ed.cards.map((r) => [r.card.name, r.qty, r.card.set]), [['Lightning Bolt', 4, 'm10'], ['Forest', 1, 'tst']], 'stessa edizione nella stessa zona: righe fuse');
eq([splitRow(ed, 'nope') === ed, splitRow(ed, ed.cards[1].id) === ed], [true, true], 'riga inesistente o da una copia: invariato');

// Statistiche: simboli per colore (ibridi a ogni colore, phyrexian al suo, generico e X ignorati).
eq(manaPips('{X}{2}{W}{W}{U/B}{2/R}{G/P}{C}{S}'), { W: 2, U: 1, B: 1, R: 1, G: 1, C: 1 }, 'simboli di mana per colore');
eq(manaPips(''), { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, 'costo vuoto');
let st = newDeck({ name: 'S', format: 'modern' });
st = addCard(st, bolt, { qty: 4 }).deck;
st = addCard(st, snap({ id: 'gob', name: 'Goblin Guide', mana: '{R}', mv: 1, type: `Creature ${D} Goblin` }), { qty: 2 }).deck;
st = addCard(st, snap({ id: 'golem2', name: 'Steel Golem', mana: '{3}', mv: 3, type: `Artifact Creature ${D} Golem` })).deck;
st = addCard(st, snap({ id: 'big2', name: 'Emrakul', mana: '{15}', mv: 15, type: `Legendary Creature ${D} Eldrazi` })).deck;
st = addCard(st, snap({ id: 'mtn', name: 'Mountain', type: `Basic Land ${D} Mountain`, produced: ['R'] }), { qty: 10 }).deck;
st = addCard(st, snap({ id: 'rock', name: 'Mind Stone', mana: '{2}', mv: 2, type: 'Artifact', produced: ['C'] })).deck;
st = addCard(st, bolt, { board: 'side', qty: 3 }).deck;
const ss = deckStats(st);
eq([ss.cards, ss.lands, ss.avgMv], [19, 10, 2.89], 'statistiche: solo main, media dei non terra a 2 decimali');
eq(ss.curve.map((b) => b.count), [0, 6, 1, 1, 0, 0, 0, 1], 'curva 0..7+, terre escluse');
eq(ss.curve[1].ids.length, 2, 'la barra conosce le sue righe');
eq(ss.colors.filter((c) => c.pips || c.sources).map((c) => [c.c, c.pips, c.sources]), [['R', 6, 10], ['C', 0, 1]], 'colori: simboli contro fonti');
eq(ss.curve.map((b) => [b.perm, b.spell]), [[0, 0], [2, 4], [1, 0], [1, 0], [0, 0], [0, 0], [0, 0], [1, 0]], 'curva: permanenti e magie');
eq(ss.curve[1].groups.map((g) => [g.label, g.rows.map((r) => r.card.name)]), [['Creatures', ['Goblin Guide']], ['Instants', ['Lightning Bolt']]],
  'carte di una barra divise per tipo');
eq([ss.avgAll, ss.medianAll, ss.medianMv, ss.totalMv, ss.library], [1.37, 0, 1, 26, 19], 'media con terre, mediane, totale, grimorio');
eq(ss.colors.filter((c) => c.pips || c.sources).map((c) => [c.c, c.landSources, c.byMv[1]]), [['R', 10, 6], ['C', 0, 0]], 'colori: fonti terra e simboli per costo');
eq([ss.pips, ss.sources], [6, 11], 'totale simboli e carte che producono mana');
eq(ss.drawTypes.map((t) => [t.type, t.label, t.count]), [['Land', 'Lands', 10], ['Creature', 'Creatures', 4], ['Instant', 'Instants', 4], ['Artifact', 'Artifacts', 2]],
  'tipi nel grimorio per la probabilità di pescata (multi-tipo in ognuno)');
eq(Math.round(hyperAtLeast(60, 24, 7, 1) * 1e4), 9784, 'ipergeometrica: almeno una terra in 7 carte, 24 terre su 60');
eq([Math.round(hyperAtLeast(60, 41, 7, 1) * 1e5), Math.round(hyperAtLeast(60, 41, 7, 5) * 1e4)], [99987, 6112],
  'ipergeometrica: 41 artefatti su 60, almeno 1 (99,987%, non 100) e almeno 5 in 7 carte (valori esatti con BigInt)');
eq([hyperAtLeast(10, 0, 7, 1), hyperAtLeast(10, 10, 7, 7), hyperAtLeast(5, 2, 9, 2)], [0, 1, 1], 'ipergeometrica: casi limite');
// Vintage restricted = 1 copia
eq([maxCopies('vintage', { legal: { vintage: 'restricted' } }), maxCopies('vintage', { legal: { vintage: 'legal' } })], [1, 4], 'restricted = 1');
// Comandante: legendary creature o "can be your commander"
eq([snap({ id: 'c1', name: 'L', type: `Legendary Creature ${D} Elf` }).cmdr, snap({ id: 'c2', name: 'P', type: `Legendary Planeswalker ${D} Teferi`, text: 'Teferi can be your commander.' }).cmdr, snap({ id: 'c3', name: 'E', type: 'Legendary Enchantment' }).cmdr], [true, true, false], 'snapshot: può essere comandante');
// Validazione (mai bloccante): righe coinvolte per evidenziarle
const issues = (d) => validateDeck(d).map((i) => [i.key, i.ids.length]);
let vc = addCard(newDeck({ name: 'V', format: 'commander' }), snap({ id: 'atx', name: 'Atraxa', mana: '{G}{W}{U}{B}', mv: 4, type: `Legendary Creature ${D} Phyrexian Angel`, colors: ['G', 'W', 'U', 'B'] })).deck;
eq(issues(vc), [['nocmd', 0]], 'Commander senza comandante');
vc = setCommander(vc, [vc.cards[0].id], true);
vc = addCard(vc, bolt).deck;
vc = addCard(vc, forest, { qty: 3 }).deck;
vc = addCard(vc, snap({ id: 'ench', name: 'Pacifism', type: 'Enchantment', colors: ['W'] }), { board: 'side' }).deck;
eq(issues(vc), [['identity', 1], ['side', 1]], 'fuori identità (Bolt rosso con Atraxa), sideboard in Commander');
vc = setCommander(vc, [vc.cards.find((r) => r.card.sid === 'for').id], true);
eq(issues(vc).map((x) => x[0]), ['notcmd', 'identity', 'side'], 'comandante non valido');
let v60 = addCard(newDeck({ name: 'M', format: 'modern' }), bolt, { qty: 5 }).deck;
v60 = addCard(v60, forest, { board: 'side', qty: 16 }).deck;
eq(issues(v60), [['sidesize', 1], ['copies', 1]], '60 carte: sideboard oltre 15, copie oltre 4');
eq(validateDeck({ ...v60, format: 'casual' }), [], 'Casual: nessun controllo');

// Copertina scelta: per oracle id (resta col cambio edizione); carta tolta = torna automatica.
let cv = addCard(newDeck({ name: 'C', format: 'modern' }), bolt).deck;
cv = addCard(cv, forest).deck;
eq([newDeck({ name: 'x' }).cover, deckCover(cv)], [null, 'a-bolt'], 'senza scelta: la prima del main');
cv = { ...cv, cover: forest.oid };
eq(deckCover(cv), 'a-for', 'copertina scelta');
eq(deckCover(changeEdition(cv, [cv.cards[1].id], { ...forest, sid: 'for2', art: 'a-for2' })), 'a-for2', 'cambio edizione: la copertina segue la carta');
eq(deckCover(removeRows(cv, [cv.cards[1].id])), 'a-bolt', 'carta tolta: copertina automatica');
eq([duplicateDeck(cv).cover, fromBackup(JSON.parse(JSON.stringify(toBackup([cv]))))[0].cover], [forest.oid, forest.oid], 'copertina in duplicato e backup');
eq(fromBackup({ app: 'proxoteca', kind: 'decks', v: 1, decks: [{ name: 'B', cover: 42, cards: [] }] })[0].cover, null, 'backup: copertina non valida = automatica');

// URL Scryfall con nomi difficili (Review Focus 4)
eq(namedUrl('Kongming, "Sleeping Dragon"'), 'https://api.scryfall.com/cards/named?exact=Kongming%2C%20%22Sleeping%20Dragon%22', 'named: virgole e virgolette');
eq(autocompleteUrl('Æther Vi'), 'https://api.scryfall.com/cards/autocomplete?q=%C3%86ther%20Vi', 'autocomplete: unicode');
eq(searchUrl('t:goblin c<=r'), 'https://api.scryfall.com/cards/search?q=t%3Agoblin%20c%3C%3Dr%20game%3Apaper&unique=cards&order=name', 'search: sempre game:paper');

eq(searchUrl('t:elf', 'edhrec'), 'https://api.scryfall.com/cards/search?q=t%3Aelf%20game%3Apaper&unique=cards&order=edhrec', 'search: ordine scelto');
// Ricerca avanzata: filtri → sintassi Scryfall; la legalità del formato si aggiunge sempre (tranne Casual).
eq(advancedQuery({
  name: ' Lightning "Bolt" ', oracle: 'deal 3', manaCost: '{2} {R}', mvOp: '<=', mv: '3', colors: ['R', 'G'], colorMode: '>=',
  type: 'creature  goblin', rarity: 'rare', set: 'M10', powOp: '>=', pow: '2', touOp: '=', tou: '0', keyword: 'first strike',
  artist: 'Kev Walker', extra: 'is:spell',
}), '"Lightning Bolt" o:"deal 3" m:{2}{R} mv<=3 c>=rg t:creature t:goblin r:rare s:m10 pow>=2 tou=0 kw:"first strike" a:"Kev Walker" is:spell',
'avanzata: tutti i campi, virgolette tolte, spazi del costo tolti');
eq(advancedQuery({ colors: ['W'], colorless: true, identity: true, isCommander: true }), 'id:c is:commander', 'incolore vince sui colori, identità');
eq(advancedQuery({ colors: ['U', 'B'], colorMode: '<=', identity: true, mv: '', pow: '' }), 'id<=ub', 'identità al massimo UB, numeri vuoti ignorati');
eq(advancedQuery({}), '', 'nessun filtro');
eq([advancedQuery({ name: 'Fire/Ice' }), advancedQuery({ name: 'Delver of Secrets / Insectile' })], ['"Fire // Ice"', '"Delver of Secrets // Insectile"'], 'nome con barra singola → separatore // di Scryfall');
eq([withLegal('t:elf', 'modern'), withLegal('t:elf', 'casual'), withLegal('', 'pauper')], ['t:elf legal:modern', 't:elf', 'legal:pauper'], 'legalità del formato');

// Stack: colonne alte al massimo quanto la pila più alta, ogni pila nella prima colonna dove ci sta.
eq(packPiles([300, 500, 150, 400, 100], 20), [[0, 2], [1], [3], [4]], 'pile: la 3a sotto la 1a, le altre non ci stanno');
eq(packPiles([100, 100, 100, 340], 20), [[0, 1, 2], [3]], 'pile: tre piccole in una colonna alta quanto la grande');
eq(packPiles([], 20), [], 'pile: nessuna');

// Impostazioni: prezzo del mazzo, raggruppamento del nuovo mazzo, import con righe separate.
let pd = addCard(newDeck({ name: 'p', format: 'modern' }), priced, { qty: 4 }).deck;
pd = addCard(pd, { ...priced, sid: 'p2', eur: 2 }, { board: 'side' }).deck;
pd = addCard(pd, { ...priced, sid: 'p3', eur: 10 }, { board: 'maybe' }).deck;
pd = addCard(pd, bolt).deck;
eq(deckPrice(pd, 'eur'), { total: 8, missing: 1 }, 'prezzo: main + sideboard, maybeboard esclusa, senza prezzo contate a parte');
eq(newDeck({ name: 'g', groupBy: 'mv' }).groupBy, 'mv', 'nuovo mazzo con il raggruppamento scelto');
const twice = [{ card: bolt, qty: 2 }, { card: bolt, qty: 1 }];
eq([addEntries(newDeck({ name: 'm' }), twice).cards.map((r) => r.qty), addEntries(newDeck({ name: 'k' }), twice, { merge: false }).cards.map((r) => r.qty)],
  [[3], [2, 1]], 'import: righe uguali unite o tenute separate');

// Lista mazzi: ricerca per parole del nome, formato, colori dell'identità.
const sd = { ...addCard(newDeck({ name: 'Mono-Red Burn', format: 'modern' }), bolt).deck };
const none = { format: '', colors: [] };
eq(searchTerms('  Red, burn! '), ['red', 'burn'], 'ricerca: parole senza punteggiatura');
eq([deckMatches(sd, searchTerms('burn mono'), none), deckMatches(sd, searchTerms('blue'), none)], [true, false], 'ricerca: tutte le parole nel nome');
eq([deckMatches(sd, [], { format: 'modern', colors: ['R'] }), deckMatches(sd, [], { format: 'legacy', colors: [] }),
  deckMatches(sd, [], { format: '', colors: ['C'] }), deckMatches(newDeck({ name: 'x' }), [], { format: '', colors: ['C'] })],
[true, false, false, true], "filtri: formato, colore nell'identità, C = incolore");

console.log('deckModel selfcheck: ok');
