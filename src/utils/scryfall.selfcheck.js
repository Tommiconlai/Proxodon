// Self-check del parser. Esegui: node src/utils/scryfall.selfcheck.js
// ponytail: niente framework, un file, assert via throw, copre i rami di parseCardList.
import { parseCardList, deckLine, buildDeckList } from './scryfall.js';

const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}\n  atteso ${JSON.stringify(b)}\n  ottenuto ${JSON.stringify(a)}`);
  }
};

eq(parseCardList('1x Sol Ring'), [{ qty: 1, name: 'Sol Ring', set: '', collector: '' }], 'semplice');
eq(parseCardList('3 Brainstorm'), [{ qty: 3, name: 'Brainstorm', set: '', collector: '' }], 'qty senza x');
eq(parseCardList('1x Sol Ring (C21) 263 *F*'), [{ qty: 1, name: 'Sol Ring', set: 'c21', collector: '263' }], 'set+collector+foil');
eq(parseCardList('Lightning Bolt (LEA)'), [{ qty: 1, name: 'Lightning Bolt', set: 'lea', collector: '' }], 'solo set');
eq(parseCardList('1996 World Champion'), [{ qty: 1, name: '1996 World Champion', set: '', collector: '' }], 'numero iniziale non è qty');
eq(parseCardList('2x Fable of the Mirror-Breaker'), [{ qty: 2, name: 'Fable of the Mirror-Breaker', set: '', collector: '' }], 'nome con trattino');
eq(parseCardList('1 Birgi, God of Storytelling // Harnfel, Horn of Bounty'), [{ qty: 1, name: 'Birgi, God of Storytelling', set: '', collector: '' }], 'DFC → faccia anteriore');
eq(parseCardList('1x Fire // Ice (APC) 128'), [{ qty: 1, name: 'Fire', set: 'apc', collector: '128' }], 'split + faccia anteriore + set');
// Barra singola (MTGO e altri export): stessa faccia anteriore, con o senza spazi.
eq(parseCardList('1 Fire/Ice\n2 Delver of Secrets / Insectile Aberration (ISD) 51\n1 Fire//Ice').map((e) => [e.qty, e.name, e.set, e.collector]),
  [[1, 'Fire', '', ''], [2, 'Delver of Secrets', 'isd', '51'], [1, 'Fire', '', '']], 'barra singola o doppia senza spazi → faccia anteriore');
eq(parseCardList('1 Lotus Petal (PLST) TMP-294'), [{ qty: 1, name: 'Lotus Petal', set: 'plst', collector: 'TMP-294' }], 'collector case preservato (Scryfall è case-sensitive)');
eq(parseCardList('\n  \n'), [], 'righe vuote');
// Nomi che iniziano per X: la x della quantità vuole uno spazio dopo.
eq(parseCardList('2 Xenagos, God of Revels\n1 Xathrid Necromancer\n3x Xenagos, the Reveler\n1 x Xathrid Gorgon').map((e) => [e.qty, e.name]),
  [[2, 'Xenagos, God of Revels'], [1, 'Xathrid Necromancer'], [3, 'Xenagos, the Reveler'], [1, 'Xathrid Gorgon']], 'nomi con X iniziale');

// deckLine (lista salvata) deve pinnare la stampa: round-trip set+collector
eq(deckLine(1, 'Command Tower', 'eld', '333'), '1 Command Tower (ELD) 333', 'deckLine set+cn');
eq(parseCardList(deckLine(2, 'Sol Ring', 'c21', '263')),
  [{ qty: 2, name: 'Sol Ring', set: 'c21', collector: '263' }], 'deckLine→parse pinna la stampa');
eq(deckLine(1, 'Lightning Bolt', '', ''), '1 Lightning Bolt', 'deckLine senza stampa → solo nome');
eq(deckLine(1, ''), '', 'deckLine senza nome → vuoto');

// buildDeckList (salvataggio progetto): raggruppa, conta solo front, ignora custom
const save = buildDeckList([
  { name: 'Sol Ring', set: 'c21', collector: '263', primary: true },
  { name: 'Sol Ring', set: 'c21', collector: '263', primary: true },          // 2a copia
  { name: 'Birgi, God of Storytelling', set: 'neo', collector: '128', primary: true },
  { name: 'Harnfel, Horn of Bounty', set: 'neo', collector: '128', primary: false }, // retro DFC
  { file: { name: 'foto.png' }, bleedMode: 'none' },                          // upload custom
]);
eq(save.text, '2 Sol Ring (C21) 263\n1 Birgi, God of Storytelling (NEO) 128', 'buildDeckList: raggruppa qty, solo front');
eq(save.cards, 2, 'buildDeckList: carte uniche');
eq(save.custom, 1, 'buildDeckList: custom esclusi');
// round-trip: il salvato si re-importa identico (set lowercased dal parser)
eq(parseCardList(save.text), [
  { qty: 2, name: 'Sol Ring', set: 'c21', collector: '263' },
  { qty: 1, name: 'Birgi, God of Storytelling', set: 'neo', collector: '128' },
], 'buildDeckList → parseCardList round-trip');

console.log('parseCardList + deckLine + buildDeckList: tutti i check passati');
