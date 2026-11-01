/**
 * Calcolatore di potenza Commander (logica pura, niente React né DOM; spec calcolatore-potenza-commander).
 * Lista → ruoli di ogni carta → fattori S, I, C, W, M → indice P → fascia. Le regole ufficiali danno il bracket minimo;
 * il più alto dei due è il bracket da dichiarare. Liste fisse, fasce e regole dei bracket stanno in powerRules.js.
 * I dati Oracle arrivano dalla cache di scryfallSearch, come per l'analisi delle terre.
 */
import { manaValue } from './landAnalysis.js';
import {
  COMBOS, DEFAULT_WEIGHTS, FAST_EXTRA, GAME_CHANGERS, MLD, NOT_FAST, TIERS, TUTOR_EXTRA, WIN_LINES, ruleChecks, tierOf,
} from './powerRules.js';

// Il testo è già preparato: minuscolo, nome della carta sostituito da "~", reminder text tolto.
// Su tutto il testo: RE_ADD, RE_LANDRAMP, RE_LANDDROP, RE_FREE, RE_EXTRA_TURN e le regex delle terre. Le altre riga per riga.
const BASIC_TYPES = String.raw`(?:basic |snow |nonbasic )*(?:land|plains|island|swamp|mountain|forest|desert|gate|cave|town|sphere|locus|lair)`;

const RE_ADD = new RegExp(String.raw`\badds? (?:\{|one mana|two mana|three mana|x mana|that much|an amount of|an additional|mana|one additional|two additional|\w+ mana of)`);
const RE_TREASURE_YOU = new RegExp(String.raw`\bcreates? [^.]{0,40}?treasure tokens?`);
const RE_TREASURE_OPP = new RegExp(String.raw`(?:its controller|that player|target opponent|each opponent|an opponent|they|target player) creates?[^.]{0,40}treasure`);
const RE_LANDRAMP = new RegExp(String.raw`search(?:es)? your library for (?:up to (?:one|two|three|x|that many) |a |an |two |three |x |any number of )?${BASIC_TYPES}[^.]{0,120}?(?:put (?:it|them|those cards|that card|one|one of them|both|these cards|the cards) onto the battlefield|onto the battlefield)`);
const RE_LANDDROP = new RegExp(String.raw`put (?:a|up to (?:one|two)) land cards? from your hand onto the battlefield|you may play (?:an|two) additional lands?|play any number of lands`);
const RE_RITUAL_ADD = new RegExp(String.raw`add ([^.]*)`);
const RE_RITUAL_SYMS = new RegExp(String.raw`\{[wubrgc]\}`, 'g');
const RE_DESTROY = new RegExp(String.raw`\b(?:destroy|exile)s? (?:up to (?:one|two|three|four|x|that many) )?(?:other |another )?target (?!player|opponent|card|cards|spell you control|creature you control|permanent you control|land you control|artifact you control|enchantment you control|nontoken creature you control)[a-z ,/-]{0,60}`);
const RE_GRAVE_TARGET = new RegExp(String.raw`target (?:card|cards) (?:from|in) (?:a|an opponent's|target player's|your)? ?graveyard|from (?:a|your|an opponent's) graveyard`);
const RE_DMG = new RegExp(String.raw`deals? (?:\d+|x|that much|damage equal to [^.]{0,40}?|twice x)(?: damage)? (?:damage )?(?:to )?(?:any target|target creature|target (?:creature|planeswalker|attacking|blocking|nonhuman|artifact)|up to (?:one|two|three) (?:other )?targets?|another target|each of up to|target (?:player or planeswalker)|divided as you choose among (?:one|two|any number|up to))`);
const RE_DMG2 = new RegExp(String.raw`divided as you choose among (?:one|two|any number|up to)`);
const RE_BOUNCE = new RegExp(String.raw`return (?:up to (?:one|two|three) )?(?:another )?target (?:creature|nonland permanent|permanent|artifact|enchantment|nonland|planeswalker|attacking|tapped|nontoken|noncreature|spell|artifact or|creature or)[^.]{0,80}?to (?:its|their) owner(?:'s|s'|') hands?`);
const RE_EDICT = new RegExp(String.raw`(?:target|each) (?:player|opponent) sacrifices (?:a|an|one|two|three|x|that many) (?!land)`);
const RE_COUNTER = new RegExp(String.raw`\bcounter (?:up to one )?target [a-z0-9 ,-]{0,60}?(?:spell|ability)(?! you control)|choose up to one target [a-z ]{0,40}?spell[^.]*\.[^.]*(?:top or bottom|library)`);
const RE_MINUS = new RegExp(String.raw`target creature(?: an opponent controls| or planeswalker)? gets -(?:\d+|x)/-(?:\d+|x)|target creature gets [+-]\d+/-(?:\d+|x)`);
const RE_FIGHT = new RegExp(String.raw`fights? (?:up to one )?(?:another )?target creature|target creature you control fights|deals damage equal to its power to (?:up to one )?(?:another )?target`);
const RE_TUCK = new RegExp(String.raw`(?:put|puts) (?:up to one )?(?:another )?target (?:creature|nonland permanent|permanent|artifact|enchantment|attacking|nontoken)[^.]{0,60}?(?:on (?:the )?(?:top|bottom) of|into) (?:its|their) owner(?:'s|s'|') library|owner of target (?:permanent|nonland permanent|creature) shuffles it`);
const RE_STEAL = new RegExp(String.raw`gain control of (?:up to one )?target (?!player)(?![^.]*until end of turn)`);
const RE_WIPE = new RegExp(String.raw`(?:destroy|exile)s? all (?:other )?(?:creatures|nonland permanents|permanents|artifacts|enchantments|nonland|planeswalkers|creatures and|artifacts and|artifacts, creatures|tokens|attacking|nontoken|noncreature|nonartifact|non-|creatures,|artifacts,|creatures your opponents|nonland, nontoken|creatures with|creatures that|colored)|destroy each (?:other )?(?:creature|nonland permanent|artifact|enchantment|permanent|planeswalker)|return all (?:other )?(?:nonland permanents|creatures|permanents|artifacts|enchantments|attacking)[^.]{0,60}?to their owners'? hands?|deals? (?:\d+|x) damage to each (?:other )?creature|deals? (?:\d+|x) damage to each creature and|all (?:other )?creatures get -(?:\d+|x)/-(?:\d+|x)|creatures your opponents control get -(?:\d+|x)/-(?:\d+|x)|each player sacrifices all|each (?:player|opponent) sacrifices (?:all|each)|chooses? a creature they control[^.]{0,80}sacrifices? the rest|\boverload\b`);
const RE_PROTECT = new RegExp(String.raw`(?:creatures|permanents|other permanents|other creatures|nonland permanents) you control (?:gets? [^.]*? and )?gain [a-z, ]*?(?:hexproof|indestructible|shroud|protection)|target (?:creature|permanent|artifact|nonland permanent|legendary creature|commander)(?: you control)? (?:gets [^.]*? and )?gains [a-z, ]*?(?:hexproof|indestructible|protection|shroud)|target creature you control[^.]*\. it gains [a-z, ]*?(?:hexproof|indestructible|protection|shroud)|permanents you control phase out|you and permanents you control phase out|phase out|equipped creature [^.]*?(?:has|have) [a-z, ]*?(?:hexproof|shroud|protection|indestructible)|choose new targets for target (?:spell|activated|ability)|change the target of target|you have hexproof|your commander has (?:hexproof|ward|protection)|commanders you control have (?:hexproof|ward|protection)`);
const RE_FREE = new RegExp(String.raw`rather than pay (?:this spell's|~'s) mana cost|you may cast ~ without paying its mana cost|cast this spell without paying its mana cost|\bevoke\b.*exile`);
const RE_TUTOR = new RegExp(String.raw`search(?:es)? (?:your|their|target player's)? ?library(?: and/or graveyard| and graveyard| and/or outside the game)? for (?!(?:a |an |up to (?:one|two|three|x|that many) |two |three |x |any number of )?${BASIC_TYPES})[^.]{0,120}?cards?`);
const RE_TUTOR_BAD = new RegExp(String.raw`cards? named|same name|for a card with the same|for up to (?:one|two|three|four|five|x) (?:basic )?lands?`);
const RE_DRAW = new RegExp(String.raw`\bdraws? (?:a card|an additional card|one card|two cards|three cards|four cards|five cards|six cards|seven cards|x cards|\w+ additional cards?|cards equal|that many cards|cards|a number of cards|up to (?:one|two|three) cards)`);
const RE_DRAW_OTHER = new RegExp(String.raw`(?:put|puts) [a-z0-9' ,-]{0,40}? into your hand|exile the top (?:card|two cards|three cards|\w+ cards|x cards) of your library[^.]{0,40}\. (?:until|you may play|you may cast|during)|(?:play|cast) [a-z ,]{0,50}? from the top of your library|you may (?:play|cast) (?:the top card|cards) of your library`);
const RE_DRAW_TRIGGER = new RegExp(String.raw`(?:whenever|if) (?:you|a player|an opponent|each player|another player|that player|one or more players|a creature's controller) (?:would )?draws? [^,]*,`, 'g');
const RE_SEARCH_LINE = new RegExp(String.raw`search(?:es)? (?:your|their|target player's)? ?library`);
const RE_OPP_DRAWS = new RegExp(String.raw`(?:an opponent|each opponent|opponents|that player|target opponent) draws?`);
const RE_YOU_DRAW = new RegExp(String.raw`\byou (?:may )?draw|, draw`);
const RE_ONE_USE = new RegExp(String.raw`sacrifice ~|exile ~|sacrifice this`);
const RE_EXTRA_TURN = new RegExp(String.raw`takes? an extra turn|extra turn after this one`);
const RE_SHOCK = new RegExp(String.raw`you may pay 2 life\. if you don't, (?:it|this land) enters`);
const RE_LAND_COND = new RegExp(String.raw`enters(?: the battlefield)? tapped unless|if you don't, (?:it|this land|~) enters(?: the battlefield)? tapped|if you control (?:two|three) or more other lands, ~ enters|enters(?: the battlefield)? tapped if you control|enters(?: the battlefield)? tapped if|unless you pay|you may pay \d life\. if you don't`);
const RE_LAND_TAPPED = new RegExp(String.raw`enters(?: the battlefield)? tapped`);
const RE_FETCH_TAPPED = new RegExp(String.raw`put (?:it|that card|them) onto the battlefield tapped`);

const ENGINE_STARTS = ['whenever', 'at the beginning', 'at the start', 'you may look at the top card', 'you may play', 'you may cast', 'play ', 'during each'];

// I codici dei ruoli, nell'ordine in cui si mostrano.
export const ROLE_CODES = 'rfxwcpztednmgTK';
export const K = { rampBonus: 0.03, sTop: 4.2, sSpan: 2.7, iDiv: 2, cScale: 0.8, mLand: 6, mFastCap: 4 };
const clamp = (v) => Math.min(10, Math.max(0, v));

// Confronto dei nomi: accenti tolti, apostrofi tipografici dritti, minuscolo, spazi compattati.
export const normName = (s) => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'")
  .toLowerCase().replace(/\s+/g, ' ').trim();
const frontName = (n) => n.split(' // ')[0];
const nameSet = (list) => new Set(list.map(normName));
const inList = (set, name) => set.has(normName(name)) || set.has(normName(frontName(name)));
const GC_SET = nameSet(GAME_CHANGERS);
const FAST_SET = nameSet(FAST_EXTRA);
const NOT_FAST_SET = nameSet(NOT_FAST);
const TUTOR_SET = nameSet(TUTOR_EXTRA);
const MLD_SET = nameSet(MLD);

// Fronte della carta: costo, tipi, CMC (X vale 0, le split sommano le metà: lo fa già il cmc di Scryfall).
function frontOf(c) {
  const f = c.card_faces?.[0] ?? c;
  const cost = f.mana_cost ?? c.mana_cost ?? '';
  const type = (f.type_line ?? c.type_line ?? '').split(' // ')[0];
  return { cost, type, cmc: c.cmc ?? manaValue(cost), land: /\bLand\b/.test(type) };
}

// Testo per i ruoli, a righe: il fronte; per split, avventure e trasformabili anche le altre facce, per le MDFC solo il fronte.
function roleLines(c) {
  const fs = !c.card_faces?.length ? [c] : c.layout === 'modal_dfc' ? c.card_faces.slice(0, 1) : c.card_faces;
  return fs.flatMap((f) => {
    const name = f.name || c.name;
    const text = (f.oracle_text || '').replaceAll(name, '~').replaceAll(name.split(',')[0], '~').replace(/\([^)]*\)/g, '');
    return text.split('\n').map(normName).filter(Boolean);
  });
}

function landRoles(c, full) {
  const out = [];
  if (!RE_SHOCK.test(full) && !full.includes('unless you have two or more opponents')) {
    if (RE_LAND_COND.test(full)) out.push('K');
    else if (RE_LAND_TAPPED.test(full)) out.push('T');
    else if (RE_FETCH_TAPPED.test(full)) out.push(full.includes('untap that land') ? 'K' : 'T');
  }
  if (inList(FAST_SET, c.name)) out.push('f');
  return out;
}

function isFast(c, front, full) {
  if (/\{X\}/.test(c.mana_cost ?? front.cost) || inList(NOT_FAST_SET, c.name)) return false;
  if (/\bArtifact\b/.test(front.type) && front.cmc <= 1 && RE_ADD.test(full)) return true;
  if (full.includes('from your hand: add')) return true;
  if (!/\b(Instant|Sorcery)\b/.test(front.type)) return false;
  const syms = full.match(RE_RITUAL_ADD)?.[1].match(RE_RITUAL_SYMS)?.length ?? 0;
  return syms > front.cmc;
}

// Pescate riga per riga: motore (e) o singola (d). Una carta con entrambe resta motore.
function drawRole(c, front, lines) {
  if (inList(TUTOR_SET, c.name)) return null;
  const spell = /\b(Instant|Sorcery)\b/.test(front.type);
  let role = null;
  for (const raw of lines) {
    const line = raw.replace(RE_DRAW_TRIGGER, '').trim();
    const draws = RE_DRAW.test(line);
    if (RE_SEARCH_LINE.test(line) && !draws) continue;
    if (!draws && !RE_DRAW_OTHER.test(line)) continue;
    if (RE_OPP_DRAWS.test(line) && !RE_YOU_DRAW.test(line)) continue;
    const at = line.indexOf('draw');
    const before = at < 0 ? line : line.slice(0, at);
    const engine = !spell && !RE_ONE_USE.test(before) && (ENGINE_STARTS.some((s) => line.startsWith(s)) || before.includes(':')
      || line.includes('additional card') || line.includes('from the top of your library'));
    if (engine) return 'e';
    role = 'd';
  }
  return role;
}

function spellRoles(c, front, lines, full) {
  const has = new Set();
  const keywords = (c.keywords || []).map((k) => k.toLowerCase());
  if (RE_ADD.test(full) || lines.some((l) => RE_TREASURE_YOU.test(l) && !RE_TREASURE_OPP.test(l)) || RE_LANDRAMP.test(full) || RE_LANDDROP.test(full)) has.add('r');
  if (inList(FAST_SET, c.name)) { has.add('r'); has.add('f'); } else if (has.has('r') && isFast(c, front, full)) has.add('f');
  for (const l of lines) {
    if ((RE_DESTROY.test(l) && !RE_GRAVE_TARGET.test(l)) || [RE_DMG, RE_DMG2, RE_BOUNCE, RE_EDICT, RE_MINUS, RE_FIGHT, RE_TUCK, RE_STEAL].some((re) => re.test(l))) has.add('x');
    if (RE_COUNTER.test(l)) has.add('c');
    if (RE_WIPE.test(l)) has.add('w');
    if (RE_PROTECT.test(l)) has.add('p');
  }
  if (keywords.includes('overload')) has.add('w');
  const symbols = front.cost.match(/\{[^}]+\}/g) || [];
  const free = RE_FREE.test(full) || (symbols.length > 0 && symbols.every((s) => s.includes('/P')))
    || (front.cmc === 0 && !/\{X\}/.test(front.cost) && !/\bCreature\b/.test(front.type));
  if ((free && ['x', 'c', 'w', 'p'].some((r) => has.has(r))) || (keywords.includes('evoke') && (has.has('x') || has.has('c')))) has.add('z');
  if (keywords.includes('transmute') || inList(TUTOR_SET, c.name) || lines.some((l) => RE_TUTOR.test(l) && !RE_TUTOR_BAD.test(l))) has.add('t');
  const draw = drawRole(c, front, lines);
  if (draw) has.add(draw);
  if (RE_EXTRA_TURN.test(full)) has.add('n');
  if (inList(MLD_SET, c.name)) has.add('m');
  return [...has];
}

// Ruoli automatici di una carta Scryfall, come stringa di codici. gc: il dato Game Changer; se manca, la lista.
export function cardRoles(c, gc) {
  const front = frontOf(c);
  const lines = roleLines(c);
  const full = lines.join('\n');
  const roles = front.land ? landRoles(c, full) : spellRoles(c, front, lines, full);
  if (gc ?? inList(GC_SET, c.name)) roles.push('g');
  return [...ROLE_CODES].filter((r) => roles.includes(r)).join('');
}

// Ruoli con la correzione dell'utente: T e K si escludono.
function fixedRoles(auto, fix) {
  const add = fix?.add || '';
  const del = fix?.del || '';
  return [...ROLE_CODES].filter((r) => add.includes(r) || (auto.includes(r) && !del.includes(r)
    && !(r === 'K' && add.includes('T')) && !(r === 'T' && add.includes('K')))).join('');
}

// Correzione con un ruolo acceso o spento: restano solo le differenze dai ruoli automatici.
export function toggleRole(fix, code, auto) {
  const { add: a, del: d, ...rest } = fix || {};
  const add = new Set(a);
  const del = new Set(d);
  const on = add.has(code) || (auto.includes(code) && !del.has(code));
  const other = { T: 'K', K: 'T' }[code];
  if (on) {
    add.delete(code);
    if (auto.includes(code)) del.add(code);
  } else {
    del.delete(code);
    if (!auto.includes(code)) add.add(code);
    if (other) {
      add.delete(other);
      if (auto.includes(other)) del.add(other);
    }
  }
  return { ...rest, ...(add.size && { add: [...add].join('') }), ...(del.size && { del: [...del].join('') }) };
}

// Mazzo → ingresso del calcolo: solo il main, stampe diverse insieme (per oracle id).
export function powerInput(deck, oracle) {
  const by = new Map();
  for (const r of deck.cards) {
    if (r.board !== 'main') continue;
    const e = by.get(r.card.oid);
    if (e) {
      e.qty += r.qty;
      e.commander ||= !!r.commander;
    } else by.set(r.card.oid, { name: r.card.name, qty: r.qty, commander: !!r.commander, oracle: oracle.get(r.card.oid) ?? null, gc: r.card.gc });
  }
  return [...by.values()];
}

// Una carta del mazzo con i ruoli effettivi. Non trovata: non terra a CMC 0 senza ruoli, finché l'utente non dice CMC e tipo.
function cardRow(row, fix) {
  const found = !!row.oracle;
  const front = found ? frontOf(row.oracle) : { cmc: 0, land: false, type: '' };
  const auto = found ? cardRoles(row.oracle, row.gc) : row.gc ? 'g' : '';
  const fixed = !!fix && Object.keys(fix).length > 0;
  return {
    name: row.name, qty: row.qty, commander: !!row.commander, found, fixed, auto, roles: fixedRoles(auto, fix), type: front.type,
    cmc: fix?.cmc ?? front.cmc, land: fix?.land ?? front.land,
  };
}

const COMBO_ORDER = ['combo2fast', 'combo2', 'combo3'];

// Combo con tutte le carte nel mazzo (nome normalizzato o del fronte), una volta per insieme di carte. Solo 2 o 3 carte.
function findCombos(cards, extra) {
  const byName = new Map(cards.flatMap((c) => [[normName(c.name), c], [normName(frontName(c.name)), c]]));
  const seen = new Set();
  const out = [];
  for (const names of [...COMBOS, ...extra]) {
    if (names.length < 2 || names.length > 3) continue;
    const hit = names.map((n) => byName.get(normName(n)) ?? byName.get(normName(frontName(n))));
    if (hit.some((c) => !c)) continue;
    const key = hit.map((c) => c.name).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const cmc = hit.reduce((n, c) => n + c.cmc, 0);
    const kind = hit.length === 3 ? 'combo3' : cmc <= 4 || hit.some((c) => c.commander) ? 'combo2fast' : 'combo2';
    out.push({ cards: hit.map((c) => c.name), kind, cmc });
  }
  return out.sort((a, b) => COMBO_ORDER.indexOf(a.kind) - COMBO_ORDER.indexOf(b.kind) || a.cmc - b.cmc);
}

// I nomi della copia, normalizzati una volta sola: da telefono il pannello si ricalcola a ogni carta cambiata.
const snapshotNames = new WeakMap();
const normalNames = (snapshot) => {
  if (!snapshotNames.has(snapshot)) snapshotNames.set(snapshot, snapshot.names.map((n) => [normName(n), normName(frontName(n))]));
  return snapshotNames.get(snapshot);
};

// Le combo di Spellbook presenti nel mazzo. snapshot = public/combos.json: { names, combos }, indici in names; ~i = deve essere il comandante.
export function spellbookCombos(snapshot, rows) {
  const marks = (list) => {
    const set = nameSet(list.flatMap((r) => [r.name, frontName(r.name)]));
    return normalNames(snapshot).map(([full, front]) => set.has(full) || set.has(front));
  };
  const deck = marks(rows);
  const cmd = marks(rows.filter((r) => r.commander));
  return snapshot.combos.filter((c) => c.every((i) => (i < 0 ? cmd[~i] : deck[i])))
    .map((c) => c.map((i) => snapshot.names[i < 0 ? ~i : i]));
}

const has = (c, r) => c.roles.includes(r);
const sumBy = (rows, f) => rows.reduce((n, x) => n + x.card.qty * f(x), 0);
const interactionWeight = (c) => {
  if (has(c, 'z')) return 2;
  if (c.cmc <= 1) return 1.5;
  if (c.cmc <= 2) return 1;
  return c.cmc <= 3 ? 0.5 : 0.25;
};

function speed(cards) {
  const spells = cards.filter((c) => !c.land && !c.commander);
  const nonLands = spells.reduce((n, c) => n + c.qty, 0);
  const avgMV = nonLands ? spells.reduce((n, c) => n + c.cmc * c.qty, 0) / nonLands : 0;
  const cheapCards = spells.filter((c) => has(c, 'r') && c.cmc <= 2);
  const cheap = cheapCards.reduce((n, c) => n + c.qty, 0);
  const effMV = avgMV - K.rampBonus * cheap;
  return { value: nonLands ? clamp(10 * (K.sTop - effMV) / K.sSpan) : 0, avgMV, nonLands, cheap, effMV, cheapCards };
}

function interaction(cards) {
  const rows = cards.filter((c) => !c.land && ['x', 'w', 'c', 'p'].some((r) => has(c, r))).map((card) => ({ card, weight: interactionWeight(card) }));
  const sum = sumBy(rows, (x) => x.weight);
  return { value: clamp(sum / K.iDiv), sum, rows };
}

function consistency(cards) {
  const tutors = cards.filter((c) => has(c, 't')).map((card) => ({ card, weight: card.cmc <= 2 ? 1 : 0.5 }));
  const draws = cards.filter((c) => has(c, 'e') || has(c, 'd')).map((card) => ({ card, weight: has(card, 'e') ? 1 : 0.3 }));
  const tutorSum = sumBy(tutors, (x) => x.weight);
  const drawSum = sumBy(draws, (x) => x.weight);
  return { value: clamp(K.cScale * (tutorSum + 0.5 * drawSum)), tutorSum, drawSum, tutors, draws };
}

function winLine(combos, settings) {
  const autoMode = combos[0]?.kind ?? 'value';
  const mode = WIN_LINES[settings.mode] ? settings.mode : autoMode;
  const redundant = Math.max(0, combos.length - 1);
  const extra = Math.min(6, Math.max(0, settings.extra || 0));
  return { value: clamp(WIN_LINES[mode] + redundant + extra), combos, autoMode, mode, base: WIN_LINES[mode], redundant, extra };
}

function manaBase(cards) {
  const lands = cards.filter((c) => c.land);
  const n = lands.reduce((x, c) => x + c.qty, 0);
  const untapped = lands.reduce((x, c) => x + c.qty * (has(c, 'T') ? 0 : has(c, 'K') ? 0.75 : 1), 0);
  const fraction = n ? untapped / n : 0;
  const fast = cards.filter((c) => has(c, 'f'));
  return { value: clamp(K.mLand * fraction + Math.min(K.mFastCap, fast.reduce((x, c) => x + c.qty, 0))), lands: n, untapped, fraction, fast };
}

// Pesi normalizzati: conta solo il rapporto; tutti a zero = quelli predefiniti.
function normalWeights(w) {
  const raw = Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((k) => [k, Math.max(0, w?.[k] || 0)]));
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return sum ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum])) : DEFAULT_WEIGHTS;
}

function declaredBracket(tier, ruleMin) {
  const value = Math.max(ruleMin, tier.value);
  const label = value === 2 && ruleMin === 2 ? 'B2' : TIERS.find((t) => t.value === value).label;
  let note = 'Rules and power agree.';
  if (tier.value > ruleMin && tier.value >= 3) note = `Follows the rules of B${ruleMin} but plays like ${tier.name}: declare it as ${label}.`;
  else if (tier.value < ruleMin) note = `Power is ${tier.name} but the rules push it to at least B${ruleMin}.`;
  return { value, label, note };
}

/**
 * input: cards = righe { name, qty, commander, oracle (dati Scryfall o null), gc }; settings = { weights, strength, mode, extra };
 * fixes = correzioni dell'utente per nome { add, del, cmc, land }; combos = combo in più (liste di nomi, da Spellbook).
 */
export function powerAnalysis({ cards: rows, settings = {}, fixes = {}, combos = [] }) {
  const cards = rows.map((r) => cardRow(r, fixes[r.name]));
  const found = findCombos(cards, combos);
  const details = { S: speed(cards), I: interaction(cards), C: consistency(cards), W: winLine(found, settings), M: manaBase(cards) };
  const factors = Object.fromEntries(Object.entries(details).map(([k, d]) => [k, d.value]));
  const weights = normalWeights(settings.weights ?? DEFAULT_WEIGHTS);
  const pRaw = Object.keys(factors).reduce((n, k) => n + weights[k] * factors[k], 0);
  const strength = settings.strength ?? 1;
  const P = clamp(pRaw * strength);
  const tier = tierOf(P);
  const rules = {
    gameChangers: cards.filter((c) => has(c, 'g')), mld: cards.filter((c) => has(c, 'm')), extraTurns: cards.filter((c) => has(c, 'n')),
    twoCardCombos: found.filter((c) => c.cards.length === 2), earlyCombo: found.some((c) => c.kind === 'combo2fast'),
  };
  const checks = ruleChecks(rules).filter((c) => c.on);
  rules.ruleMin = Math.max(1, ...checks.map((c) => c.min));
  rules.reasons = checks.map((c) => c.text);
  return {
    cards, unknown: cards.filter((c) => !c.found), factors, details, weights, pRaw, commanderMultiplier: strength, P, tier, rules,
    declared: declaredBracket(tier, rules.ruleMin),
  };
}

// La pill del bracket del mazzo contraddice il bracket da dichiarare? B3+ sta nel 3, B1–2 sta nell'1 e nel 2.
export const pillDisagrees = (pill, declared) => pill != null && (declared <= 2 ? pill > 2 : Math.floor(declared) !== pill);

// Una voce delle impostazioni (correzioni, mazzi): la toccata va in fondo, vuota si toglie, oltre max escono le più vecchie.
export function withEntry(map, key, value, max) {
  const clean = Object.fromEntries(Object.entries(value).filter(([, v]) => v != null));
  const rest = Object.entries(map).filter(([k]) => k !== key);
  if (Object.keys(clean).length) rest.push([key, clean]);
  return Object.fromEntries(rest.slice(-max));
}
