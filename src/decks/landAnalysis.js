/**
 * Analisi delle terre (logica pura, niente React né DOM: gira anche nel worker della simulazione).
 * 1. classifyCard: dal testo Oracle di Scryfall il ruolo di una carta (land, mdfc, ramp, draw, spell) e i dati che
 *    servono a formula e simulazione;
 * 2. landModel: il main board del mazzo come carte classificate (comandanti a parte, override dell'utente applicati);
 * 3. karsten: quante terre secondo la regressione di Frank Karsten su 95.000 mazzi da torneo.
 * I dati Oracle arrivano dalla cache di scryfallSearch (oracleCards), non dallo snapshot delle righe.
 */

export const ROLES = ['land', 'mdfc', 'ramp', 'draw', 'spell'];
export const ROLE_LABEL = { land: 'Land', mdfc: 'MDFC', ramp: 'Ramp', draw: 'Draw', spell: 'Spell' };
export const LAND_FORMATS = [['commander', 'Commander'], ['60', '60 cards'], ['other', 'Other']];

const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const count = (w) => WORDS[w?.toLowerCase()] ?? (Number(w) || 1);
const LAND_WORD = '(?:land|plains|island|swamp|mountain|forest)s?';

// Valore di mana di un costo: {2/W} vale 2, X / Y / Z 0, ogni altro simbolo 1.
export function manaValue(cost) {
  let mv = 0;
  for (const t of (cost || '').match(/\{[^}]+\}/g) || []) {
    const parts = t.slice(1, -1).split('/');
    const n = parts.filter((p) => /^\d+$/.test(p)).map(Number);
    mv += n.length ? Math.max(...n) : /^[XYZ]$/.test(parts[0]) ? 0 : 1;
  }
  return mv;
}

const noReminder = (t) => (t || '').replace(/\([^)]*\)/g, '');
const faces = (c) => (c.card_faces?.length ? c.card_faces : [c]);
const isLandType = (t) => /\bLand\b/.test(t || '');
const isSpellType = (t) => /\b(Instant|Sorcery)\b/.test(t || '');

// Entra tappata senza condizioni: una frase che finisce in "enters (the battlefield) tapped" e non comincia con "If"
// ("If you don't, it enters tapped" e "... tapped unless you control ..." sono condizionali).
export const entersTapped = (text) => noReminder(text).split(/(?<=\.)\s+|\n/)
  .some((s) => /enters (the battlefield )?tapped\.?$/i.test(s.trim()) && !/^if\b/i.test(s.trim()));

// "Search your library for <terra> ... onto the battlefield": la frase intera (per "tapped" e per quante), o null.
const SEARCH_LAND = new RegExp(`\\bsearch your library for [^.,]*\\b${LAND_WORD}\\b[^.]*?\\bonto the battlefield\\b[^.]*`, 'i');

// Righe di un permanente che contano per draw: trigger quando entra o quando lo lanci, abilità attivate con
// costo solo {T} e/o "Sacrifice ...". Instant e sorcery: tutto il testo.
function drawText(face) {
  const text = noReminder(face.oracle_text);
  if (isSpellType(face.type_line)) return text;
  const name = (face.name || '').split(',')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const etb = new RegExp(`^when (this [a-z]+|${name || 'this'}[^,]*?) enters\\b|^when you cast this spell\\b`, 'i');
  return text.split('\n').filter((l) => etb.test(l.trim())
    || /^(\{T\}|sacrifice [^,:]+)(, (\{T\}|sacrifice [^,:]+))?:/i.test(l.trim())).join('\n');
}

// Mana della prima clausola "Add": {C}{C} = 2, "one mana" = 1, "three mana" = 3; alternative ("{W} or {U}") = la prima.
function addAmount(text) {
  const m = noReminder(text).match(/\badds? (?:an additional )?([^.]*)/i);
  if (!m) return 1;
  const first = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/)[0];
  const syms = first.match(/\{[^}]+\}/g);
  if (syms) return syms.length;
  const w = first.match(/^(\w+) mana\b/i);
  return w && WORDS[w[1].toLowerCase()] ? WORDS[w[1].toLowerCase()] : 1;
}

// Classificazione di una carta Scryfall (campi: name, cmc, mana_cost, type_line, oracle_text, layout, card_faces,
// produced_mana, keywords). Regole in ordine, vince la prima: land, mdfc, ramp, draw, spell. cheap si calcola dopo
// (dipende dalla soglia): simMV <= soglia.
export function classifyCard(c) {
  const fs = faces(c);
  const all = fs.map((f) => noReminder(f.oracle_text)).join('\n');
  const out = {
    role: 'spell', mv: c.cmc ?? 0, hasX: /\{X\}/.test(fs[0].mana_cost ?? c.mana_cost ?? ''), entersTapped: false, fetchesLand: false,
    fetchEntersTapped: false, mdfcWeight: 0, rampKind: null, manaProduced: 0, singleUse: false, landsToBattlefield: 0,
    landsToHand: 0, landsEnterTapped: false, fastMana: false, cardsDrawn: 0, landTutor: false, simMV: c.cmc ?? 0, reasons: [],
  };
  const why = (r) => out.reasons.push(r);
  // 1. Terra: ogni faccia è una Land (base, doppie, Pathway, Dryad Arbor).
  if (fs.every((f) => isLandType(f.type_line ?? c.type_line))) {
    out.role = 'land';
    out.mv = 0;
    out.simMV = 0;
    out.entersTapped = fs.every((f) => entersTapped(f.oracle_text));
    const fetch = all.match(SEARCH_LAND);
    if (fetch && /\bput (it|that card) onto the battlefield/i.test(fetch[0])) {
      out.fetchesLand = true;
      out.fetchEntersTapped = /onto the battlefield tapped/i.test(fetch[0]);
      why(`Fetches a land${out.fetchEntersTapped ? ' (enters tapped)' : ''}`);
    }
    why(out.entersTapped ? 'Land, enters tapped' : 'Land');
    return out;
  }
  // 2. MDFC: una faccia terra e una no. Valore di mana dalla faccia magia; peso 0.38 se la terra entra sempre tappata.
  const landFaces = fs.filter((f) => isLandType(f.type_line));
  if (c.layout === 'modal_dfc' && landFaces.length === 1 && fs.length === 2) {
    const spell = fs.find((f) => !isLandType(f.type_line));
    const tapped = entersTapped(landFaces[0].oracle_text);
    out.role = 'mdfc';
    out.mv = manaValue(spell.mana_cost);
    out.simMV = out.mv;
    out.hasX = /\{X\}/.test(spell.mana_cost || '');
    out.entersTapped = tapped;
    out.mdfcWeight = tapped ? 0.38 : 0.74;
    why(`Spell // land, the land ${tapped ? 'always enters tapped' : 'can enter untapped'}: counts ${out.mdfcWeight} of a land`);
    return out;
  }
  const type = c.type_line || fs[0].type_line || '';
  // 3. Ramp: artefatti, creature e incantesimi che producono mana (i rituali, instant e sorcery, restano spell)...
  if (/\b(Artifact|Creature|Enchantment)\b/.test(type) && (c.produced_mana?.length || /\{T\}[^:]*:\s*Add\b/i.test(all))) {
    out.role = 'ramp';
    out.rampKind = /\bCreature\b/.test(type) ? 'dork' : 'rock';
    out.manaProduced = addAmount(all);
    const ability = all.split('\n').find((l) => /\badds?\b/i.test(l)) || '';
    out.singleUse = /^[^:]*\bsacrifice\b[^:]*:/i.test(ability);
    out.fastMana = out.manaProduced > out.mv;
    why(`${out.rampKind === 'dork' ? 'Mana creature' : 'Mana rock'}, adds ${out.manaProduced}${out.singleUse ? ' once' : ''}`);
    if (out.fastMana) why('Fast mana: makes more than it costs');
    return out;
  }
  // ...e tutto ciò che mette terre dalla libreria sul campo (Nature's Lore cerca una "Forest card").
  const search = all.match(SEARCH_LAND);
  if (search) {
    const s = search[0];
    out.role = 'ramp';
    out.rampKind = 'landSearch';
    const upTo = s.match(/\bup to (\w+)/i);
    out.landsToHand = /\bthe other into your hand\b/i.test(s) ? 1 : 0;
    out.landsToBattlefield = !out.landsToHand && /\bput (them|those cards) onto the battlefield/i.test(s) ? count(upTo?.[1]) : 1;
    out.landsEnterTapped = /onto the battlefield tapped/i.test(s);
    why(`Puts ${out.landsToBattlefield} land${out.landsToBattlefield > 1 ? 's' : ''} onto the battlefield${out.landsEnterTapped ? ' tapped' : ''}${out.landsToHand ? ', 1 into your hand' : ''}`);
    return out;
  }
  // 4. Draw: pesca (senza scarto né carte rimesse in cima = N carte, sennò 1), Impulse, tutor, cycling.
  const text = fs.map(drawText).join('\n');
  const draw = text.match(/\bdraws? (?:up to )?(?:(a|an|one|two|three|four|five|six|seven|x|\d+) )?(?:additional )?cards?\b/i);
  if (draw) {
    out.role = 'draw';
    out.cardsDrawn = /\bdiscards?\b/i.test(text) || /from your hand on (top|the bottom) of/i.test(text) ? 1 : count(draw[1]);
    why(`Draws ${out.cardsDrawn === 1 ? 'a card' : `${out.cardsDrawn} cards`}`);
    return out;
  }
  if (/\blook at the top [^.]*(?:\.\s*[^.]*)?\binto your hand\b/i.test(text)) {
    out.role = 'draw';
    out.cardsDrawn = 1;
    why('Puts a card from the top of the library into your hand');
    return out;
  }
  const tutor = text.match(/\bsearch your library for ([^.,]*)[^.]*\binto your hand\b/i);
  if (tutor) {
    out.role = 'draw';
    out.cardsDrawn = 1;
    out.landTutor = new RegExp(`\\b${LAND_WORD}\\b`, 'i').test(tutor[1]);
    why(out.landTutor ? 'Puts a land from the library into your hand' : 'Tutor: puts a card from the library into your hand');
    return out;
  }
  // Cycling, anche typecycling: "Cycling {2}", "Swampcycling {2}", "Cycling" + trattino + "Pay 2 life" (= 0 mana).
  const cyc = all.match(/^([a-z ]*?)cycling\b([^\n]*)/im);
  if (cyc && !/^when\b/i.test(cyc[0])) {
    const cost = cyc[2].match(/^\W*((?:\{[^}]+\})+)/);
    out.role = 'draw';
    out.cardsDrawn = 1;
    out.simMV = cost ? manaValue(cost[1]) : 0;
    out.landTutor = new RegExp(`\\b(basic )?${LAND_WORD}$`, 'i').test(cyc[1].trim())
      || new RegExp(`when you cycle [^.]*search your library for [^.,]*\\b${LAND_WORD}\\b`, 'i').test(all);
    why(`${out.landTutor ? 'Landcycling' : 'Cycling'} for ${out.simMV}`);
    return out;
  }
  why('Other spell');
  return out;
}

// Override dell'utente (deck.landAnalysis.overrides, per nome della carta): ruolo, mana prodotto, peso della MDFC.
// Un ruolo cambiato a mano prende i valori di default di quel ruolo se la carta non li aveva.
function applyOverride(card, o, type) {
  if (!o) return card;
  const c = { ...card, overridden: true };
  if (o.role && o.role !== card.role) {
    c.role = o.role;
    if (o.role === 'ramp' && !card.rampKind) Object.assign(c, { rampKind: /\bCreature\b/.test(type) ? 'dork' : 'rock', manaProduced: 1 });
    if (o.role === 'draw' && !card.cardsDrawn) c.cardsDrawn = 1;
    if (o.role === 'mdfc' && !card.mdfcWeight) c.mdfcWeight = 0.74;
    if (o.role === 'land') Object.assign(c, { mv: 0, simMV: 0 });
  }
  if (c.role === 'ramp' && Number.isFinite(o.mana)) c.manaProduced = o.mana;
  if (c.role === 'mdfc' && Number.isFinite(o.weight)) c.mdfcWeight = o.weight;
  if (c.rampKind === 'rock' || c.rampKind === 'dork') c.fastMana = c.manaProduced > c.mv;
  return c;
}

// Formato dell'analisi: commander se ci sono comandanti o il mazzo è Commander, 60 se il main è di 58-65 carte.
export function detectFormat(deck, n) {
  if (deck.format === 'commander' || deck.cards.some((r) => r.board === 'main' && r.commander)) return 'commander';
  return n >= 58 && n <= 65 ? '60' : 'other';
}

// Settings salvati sul mazzo: format ('auto' o un formato), cheap (soglia, null = 2, o 3 in Commander), fast (fast mana
// come terra intera), cmdr (oracle id del comandante scelto qui se il mazzo non ne ha), play (true / false, null = default).
export function landSettings(deck, n) {
  const s = deck.landAnalysis?.settings || {};
  const auto = detectFormat(deck, n);
  const format = LAND_FORMATS.some(([id]) => id === s.format) ? s.format : auto;
  return {
    format, auto, cheap: Number.isFinite(s.cheap) ? s.cheap : format === 'commander' ? 3 : 2, fast: s.fast === true,
    cmdr: typeof s.cmdr === 'string' ? s.cmdr : null, play: typeof s.play === 'boolean' ? s.play : format !== 'commander',
  };
}

// Mazzo → carte classificate. oracle: Map oracle id → carta Scryfall. Main board raggruppato per oracle id (stampe
// diverse insieme); i comandanti (righe commander, o quello scelto nei settings) a parte; le carte senza dati
// Oracle in unknown. Companion = una carta della sideboard con la keyword Companion.
export function landModel(deck, oracle) {
  const main = deck.cards.filter((r) => r.board === 'main');
  const overrides = new Map((deck.landAnalysis?.overrides || []).map((o) => [o.name, o]));
  const s0 = landSettings(deck, main.reduce((n, r) => n + r.qty, 0));
  const pickCmdr = s0.format === 'commander' && !main.some((r) => r.commander) ? s0.cmdr : null;
  const by = new Map();
  for (const r of main) {
    const e = by.get(r.card.oid) || { oid: r.card.oid, name: r.card.name, type: r.card.type, qty: 0, commander: false, ids: [] };
    e.qty += r.qty;
    e.commander ||= r.commander || r.card.oid === pickCmdr;
    e.ids.push(r.id);
    by.set(r.card.oid, e);
  }
  const cards = [];
  const commanders = [];
  const unknown = [];
  for (const e of by.values()) {
    const o = oracle.get(e.oid);
    if (!o) { unknown.push(e); continue; }
    const base = classifyCard(o);
    const c = { ...e, baseRole: base.role, ...applyOverride(base, overrides.get(e.name), e.type) };
    (e.commander ? commanders : cards).push(c);
  }
  const n = cards.reduce((x, c) => x + c.qty, 0) + unknown.reduce((x, c) => x + c.qty, 0);
  const settings = landSettings(deck, n + commanders.reduce((x, c) => x + c.qty, 0));
  for (const c of [...cards, ...commanders]) c.cheap = c.role !== 'land' && c.simMV <= settings.cheap;
  const companion = deck.cards.some((r) => r.board === 'side' && oracle.get(r.card.oid)?.keywords?.includes('Companion'));
  const of = (f) => cards.filter(f).reduce((x, c) => x + c.qty, 0);
  const fast = (c) => settings.fast && c.role === 'ramp' && c.fastMana;
  const nonland = cards.filter((c) => c.role !== 'land' && !fast(c));
  const nl = nonland.reduce((x, c) => x + c.qty, 0);
  return {
    cards, commanders, unknown, settings, N: n, companion,
    lands: of((c) => c.role === 'land'),
    mdfcUntapped: of((c) => c.role === 'mdfc' && c.mdfcWeight >= 0.5),
    mdfcTapped: of((c) => c.role === 'mdfc' && c.mdfcWeight < 0.5),
    mdfcWeight: cards.filter((c) => c.role === 'mdfc').reduce((x, c) => x + c.qty * c.mdfcWeight, 0),
    avgMV: nl ? nonland.reduce((x, c) => x + c.qty * c.mv, 0) / nl : 0,
    cheapDraw: of((c) => c.role === 'draw' && c.cheap),
    cheapRamp: of((c) => c.role === 'ramp' && c.cheap && !fast(c)),
    fastMana: of((c) => c.role === 'ramp' && c.fastMana),
    fastCounted: of(fast),
  };
}

export const KARSTEN = {
  base60: 19.59, mv60: 1.90, companion: 0.27,
  base99: 31.42, mv99: 3.13,
  cheap: 0.28, mdfcUntapped: 0.74, mdfcTapped: 0.38,
};
export const KARSTEN_URL = 'https://www.tcgplayer.com/content/article/How-Many-Lands-Do-You-Need-in-Your-Deck-An-Updated-Analysis/cd1c1a24-d439-4a8e-b369-b936edb0b38a/';

const r2 = (x) => Math.round(x * 100) / 100;
// Formula di Karsten. Commander: 31.42 + 3.13 avgMV - 0.28 cheap. 60 e altri: (N/60)(19.59 + 1.90 avgMV + 0.27 companion)
// - 0.28 cheap, esatta a 60 carte, un'estrapolazione altrove. Terre vere = equiv meno le MDFC (peso ciascuna) e, con
// l'opzione, 1 per fast mana. terms = ogni addendo, per il dettaglio nella UI.
export function karsten(m) {
  const K = KARSTEN;
  const cheap = m.cheapDraw + m.cheapRamp;
  const terms = [];
  let equiv;
  if (m.settings.format === 'commander') {
    terms.push(['Base (99 cards)', K.base99], [`${K.mv99} x avg MV ${r2(m.avgMV)}`, K.mv99 * m.avgMV]);
    equiv = K.base99 + K.mv99 * m.avgMV;
  } else {
    const f = m.N / 60;
    const scaled = m.N !== 60 ? ` x ${m.N}/60` : '';
    terms.push([`Base (60 cards)${scaled}`, K.base60 * f], [`${K.mv60} x avg MV ${r2(m.avgMV)}${scaled}`, K.mv60 * m.avgMV * f]);
    if (m.companion) terms.push([`Companion${scaled}`, K.companion * f]);
    equiv = (K.base60 + K.mv60 * m.avgMV + (m.companion ? K.companion : 0)) * f;
  }
  terms.push([`${K.cheap} x ${cheap} cheap draw / ramp`, -K.cheap * cheap]);
  equiv -= K.cheap * cheap;
  if (m.mdfcWeight) terms.push(['MDFCs counted as lands', -m.mdfcWeight]);
  if (m.fastCounted) terms.push([`${m.fastCounted} fast mana as full lands`, -m.fastCounted]);
  const recommendedLands = equiv - m.mdfcWeight - m.fastCounted;
  return {
    equiv, recommendedLands, rounded: Math.round(recommendedLands), delta: recommendedLands - m.lands, terms,
    extrapolated: m.settings.format !== 'commander' && m.N !== 60,
  };
}

// Ipergeometrica (spec §5.1): N carte nel mazzo, K terre, n carte viste, k terre volute. log-fattoriali in tabella,
// allungata quando serve.
const LOG_FACT = [0];
export function logFactorial(n) {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);
  return LOG_FACT[n];
}
export const logChoose = (n, k) => logFactorial(n) - logFactorial(k) - logFactorial(n - k);

export function hypergeomPmf(N, K, n, i) {
  if (i < 0 || i > K || i > n || n - i > N - K || n > N) return 0;
  return Math.exp(logChoose(K, i) + logChoose(N - K, n - i) - logChoose(N, n));
}

export function hypergeomAtLeast(N, K, n, k) {
  let p = 0;
  for (let i = Math.max(0, k); i <= Math.min(K, n); i++) p += hypergeomPmf(N, K, n, i);
  return Math.min(1, Math.max(0, p));
}

// Carte viste al turno t: 7 + t - 1 se si gioca per primi (niente pescata al turno 1), 7 + t se si pesca.
export const cardsSeen = (turn, onThePlay) => 7 + turn - (onThePlay ? 1 : 0);

// K frazionario (MDFC, ramp pesato): interpolazione lineare tra floor e ceil.
export function atLeastFractional(N, Kf, n, k) {
  const lo = Math.floor(Kf);
  const f = Kf - lo;
  return f ? (1 - f) * hypergeomAtLeast(N, lo, n, k) + f * hypergeomAtLeast(N, lo + 1, n, k) : hypergeomAtLeast(N, lo, n, k);
}

// Viste della Fase 2 (§5.2): mano iniziale (P di i terre su 7, i = 0..7) e tabella dei land drop fino al turno 6 (8 in
// Commander). exact: solo terre vere; ideal: mazzo di N - cheapDraw carte, terre + pesi MDFC + w x cheapRamp.
export function landOdds(m, w = 0) {
  const N = m.N;
  const K = m.lands;
  const hand = Array.from({ length: 8 }, (_, i) => hypergeomPmf(N, K, 7, i));
  const Ni = N - m.cheapDraw;
  const Ki = Math.min(Ni, K + m.mdfcWeight + w * m.cheapRamp);
  const turns = m.settings.format === 'commander' ? 8 : 6;
  const drops = Array.from({ length: turns }, (_, j) => {
    const t = j + 1;
    const n = cardsSeen(t, m.settings.play);
    return { t, n, exact: hypergeomAtLeast(N, K, n, t), ideal: atLeastFractional(Ni, Ki, Math.min(n, Ni), t) };
  });
  return { hand, keepable: hand.slice(2, 6).reduce((a, b) => a + b, 0), mean: N ? (7 * K) / N : 0, drops, Ni, Ki };
}
