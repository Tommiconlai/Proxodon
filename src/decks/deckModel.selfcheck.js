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
