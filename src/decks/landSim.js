// Simulazione goldfish delle terre (spec LAND-COUNT-ANALYSIS §6): partite senza avversario con seed fisso, mulligan
// London, ramp col suo mana vero, pescate, terre tappate e fetch che assottigliano la libreria. Il numero di terre
// varia (sweep) col resto del mazzo fermo; l'obiettivo è il mana speso "composto" (prima si spende, più vale).
// Modulo puro: gira nel worker (landSim.worker.js) e nel self-check. Libreria: la cima è la fine dell'array.

// Default per formato (§6.2). keep: carte in mano dopo il mulligan → terre (con le MDFC) da tenere, estremi inclusi;
// sotto le 5 carte si tiene sempre. keepRamp: a 7 carte va bene anche 2 terre più un ramp di valore di mana fino a 2.
export const SIM_DEFAULTS = {
  commander: { turns: 8, freeMulligans: 1, keep: { 7: [3, 5], 6: [2, 5], 5: [0, 7] }, keepRamp: true },
  other: { turns: 7, freeMulligans: 0, keep: { 7: [2, 5], 6: [2, 4], 5: [1, 4] }, keepRamp: false },
};

export function simParams(m, over = {}) {
  const d = SIM_DEFAULTS[m.settings.format === 'commander' ? 'commander' : 'other'];
  return { ...d, play: m.settings.play, mulligans: true, discounts: true, games: 20000, below: 5, above: 6, seed: 12345, ...over };
}

// Carte della simulazione dal modello (landModel): solo i campi che servono, con le copie. Le carte senza dati Oracle
// entrano come magie senza effetti al valore di mana medio; i comandanti (solo il costo) partono dalla zona di comando.
// Solo nei mazzi con effetti sul costo (addendum COST-REDUCTION): art = artefatto (terre comprese), gen / fix = parte
// generica e fissa del costo (non se il costo simulato non è quello stampato, come per il cycling), aff = affinità.
export function simInput(m) {
  const fx = m.cards.some((c) => c.affinity);
  const costs = (c, x) => {
    if (c.isArtifact) x.art = true;
    if (c.role !== 'land' && c.genericCost + c.fixedCost === c.simMV) Object.assign(x, { gen: c.genericCost, fix: c.fixedCost });
    if (c.affinity) x.aff = true;
    return x;
  };
  const one = (c) => {
    if (c.role === 'land') return { role: 'land', mv: 0, fetch: c.fetchesLand, tapped: c.fetchesLand ? c.fetchEntersTapped : c.entersTapped };
    const x = { role: c.role, mv: c.simMV };
    if (c.role === 'mdfc') x.tapped = c.mdfcWeight < 0.5;
    if (c.role === 'ramp') {
      Object.assign(x, c.rampKind === 'landSearch'
        ? { kind: 'search', toBf: c.landsToBattlefield, toHand: c.landsToHand, bfTapped: c.landsEnterTapped }
        : { kind: c.rampKind === 'dork' ? 'dork' : 'rock', mana: c.manaProduced, once: c.singleUse });
    }
    if (c.role === 'draw') Object.assign(x, { draw: c.cardsDrawn || 1, tutor: c.landTutor });
    return x;
  };
  const card = (c) => (fx ? costs(c, one(c)) : one(c));
  const mv = Math.round(m.avgMV);
  return {
    cards: [...m.cards.map((c) => ({ ...card(c), qty: c.qty })), ...m.unknown.map((c) => ({ role: 'spell', mv, qty: c.qty }))],
    commanders: m.commanders.flatMap((c) => Array(c.qty).fill(c.simMV)),
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
}

const isLand = (c) => c.role === 'land' || c.role === 'mdfc';
const removeAt = (a, i) => { a[i] = a[a.length - 1]; a.pop(); };
const TIE = { spell: 0, mdfc: 0, draw: 1, ramp: 2 }; // nel mulligan va sotto prima la magia semplice, poi draw, poi ramp
const gain = (c) => (c.kind === 'search' ? c.toBf : c.mana);
const PLAIN_LAND = { role: 'land', mv: 0, fetch: false, tapped: false };
const regular = (c) => c.role === 'spell';

// Costo effettivo (addendum COST-REDUCTION §3.2): con l'affinità la parte generica scende di uno per artefatto sul
// campo, mai sotto zero; la parte fissa resta. Le carte senza gen costano il loro mv.
export function effectiveCost(c, artifacts) {
  if (c.gen === undefined) return c.mv;
  return c.fix + Math.max(0, c.gen - (c.aff ? artifacts : 0));
}

function keeps(hand, h, p) {
  const r = p.keep[h];
  if (!r) return true;
  const lands = hand.filter(isLand).length;
  return (lands >= r[0] && lands <= r[1]) || (h === 7 && p.keepRamp && lands === 2 && hand.some((c) => c.role === 'ramp' && c.mv <= 2));
}

// Mulligan London (§6.3.1): ogni tentativo rimescola tutto e pesca 7, poi mette sotto 7 - h carte una alla volta (una
// terra se ce ne sono più di metà o non restano altre carte, sennò la carta più cara). Ritorna [mano, mulligan pagati].
// Mazzi con effetti sul costo (addendum §3.6): sotto prima le terre tappate; con gli sconti il costo è quello stimato,
// come se gli altri artefatti della mano fossero sul campo.
function deal(deck, p, rnd, lib, o) {
  const arts = (hand) => hand.reduce((a, c) => a + (c.art ? 1 : 0), 0);
  for (let m = 0; ; m++) {
    lib.length = 0;
    for (const c of deck) lib.push(c);
    shuffle(lib, rnd);
    const hand = lib.splice(lib.length - 7, 7);
    if (!p.mulligans) return [hand, 0];
    const paid = Math.max(0, m - p.freeMulligans);
    const h = 7 - paid;
    const cost = o.disc ? (c) => effectiveCost(c, arts(hand) - (c.art ? 1 : 0)) : (c) => c.mv;
    for (let b = paid; b > 0 && hand.length; b--) {
      const lands = hand.filter(isLand).length;
      let k = -1;
      if (lands > Math.ceil(h / 2) || lands === hand.length) {
        if (o.fx) k = hand.findIndex((c) => c.role === 'land' && c.tapped);
        if (k < 0) k = hand.findIndex((c) => c.role === 'land');
        if (k < 0) k = hand.findIndex((c) => c.role === 'mdfc');
      } else {
        hand.forEach((c, i) => {
          if (!isLand(c) && (k < 0 || cost(c) > cost(hand[k]) || (cost(c) === cost(hand[k]) && TIE[c.role] < TIE[hand[k].role]))) k = i;
        });
      }
      lib.unshift(hand.splice(k, 1)[0]);
    }
    if (keeps(hand, h, p)) return [hand, paid];
  }
}

// Partite per un numero di terre: medie di §6.4 (compounded, deployed = valore messo in campo, manaPaid, onCurve, mana
// disponibile per turno, flood, mulligan). Il punteggio conta il valore di mana stampato, anche quando la carta costa
// meno (addendum §3.3). o: fx (mazzo con effetti sul costo), disc (sconti attivi), enabler (carta da lanciare prima del
// draw), sample (mazzo della partita, per lo sweep campionato). tick(partite fatte) ogni 1000 partite.
function runCount(deck, cmdrs, p, tick, o) {
  const T = p.turns;
  const C = Math.min(T, 8);
  const rnd = mulberry32(p.seed);
  const lib = [];
  const once = []; // rock monouso sul campo: il loro mana si spende per ultimo, poi se ne vanno
  const used = new Uint8Array(cmdrs.length);
  const acc = { compounded: 0, deployed: 0, paid: 0, flood: 0, mull: 0, onCurve: new Array(C).fill(0), available: new Array(T).fill(0) };
  let hand, pool, onceSum, landsUp, landsTapped, rocks, dorks, dorksNew, dropped, seen, artifacts;

  const draw = (n) => {
    for (let i = 0; i < n && lib.length; i++) {
      const c = lib.pop();
      if (c.role === 'land') seen++;
      hand.push(c);
    }
  };
  // Una terra dalla libreria (prima quelle senza fetch); il chiamante rimescola dopo la ricerca.
  const takeLand = () => {
    let k = -1;
    for (let i = 0; i < lib.length; i++) {
      if (lib[i].role !== 'land') continue;
      if (!lib[i].fetch) { k = i; break; }
      if (k < 0) k = i;
    }
    return k < 0 ? null : lib.splice(k, 1)[0];
  };
  // Una terra entra sul campo; una terra artefatto conta per l'affinità anche se entra tappata.
  const enter = (tapped, land) => {
    if (land.art && land.role === 'land') artifacts++;
    if (tapped) landsTapped++; else { landsUp++; pool++; }
  };
  const price = (c) => (o.disc ? effectiveCost(c, artifacts) : c.mv);
  const cost = (k) => (k < hand.length ? price(hand[k]) : cmdrs[k - hand.length]);
  const value = (k) => (k < hand.length ? hand[k].mv : cmdrs[k - hand.length]);
  // Prossima carta da lanciare con avail mana (§6.3.5, addendum §3.4): ramp più economico (a pari costo quello che dà
  // di più), poi gli abilitatori degli sconti (il più economico, a pari costo il valore più alto), poi draw più
  // economico (a pari costo il valore più alto), poi la carta di valore più alto che entra (MDFC tenute come magie,
  // comandanti; a pari valore la meno cara). skip: carte già prese nella prova a secco. Indici oltre la mano = comandanti.
  const pick = (avail, skip) => {
    let r = -1, e = -1, d = -1, x = -1, nr = 0, ne = 0, nd = 0, nx = 0;
    for (let i = 0; i < hand.length; i++) {
      const c = hand[i];
      if ((skip && skip[i]) || c.role === 'land') continue;
      const n = price(c);
      if (n > avail) continue;
      if (c.role === 'ramp') { if (r < 0 || n < nr || (n === nr && gain(c) > gain(hand[r]))) { r = i; nr = n; } }
      else if (o.enabler(c)) { if (e < 0 || n < ne || (n === ne && c.mv > hand[e].mv)) { e = i; ne = n; } }
      else if (c.role === 'draw') { if (d < 0 || n < nd || (n === nd && c.mv > hand[d].mv)) { d = i; nd = n; } }
      else if (x < 0 || c.mv > value(x) || (c.mv === value(x) && n < nx)) { x = i; nx = n; }
    }
    for (let j = 0; j < cmdrs.length; j++) {
      const n = cmdrs[j];
      if (!used[j] && !(skip && skip[hand.length + j]) && n <= avail && (x < 0 || n > value(x) || (n === value(x) && n < nx))) { x = hand.length + j; nx = n; }
    }
    return r >= 0 ? r : e >= 0 ? e : d >= 0 ? d : x;
  };
  // Prova a secco: quanto valore si mette in campo con mana disponibile dopo aver giocato land, stesse priorità e
  // sconti (gli artefatti che entrano contano), senza gli altri effetti.
  const spendWith = (mana, land) => {
    const skip = new Uint8Array(hand.length + cmdrs.length);
    const before = artifacts;
    if (land.art && land.role === 'land') artifacts++;
    let v = 0;
    for (let k = pick(mana, skip); k >= 0; k = pick(mana, skip)) {
      skip[k] = 1;
      mana -= cost(k);
      v += value(k);
      if (k < hand.length && hand[k].art) artifacts++;
    }
    artifacts = before;
    return v;
  };
  // Land drop (§6.3.3): tra una terra che entra stappata e una tappata, la tappata se un mana in più non fa mettere in
  // campo di più in questo turno; senza terre normali, una MDFC (prima quelle che entrano stappate). La fetch prende una
  // terra dalla libreria al posto suo (niente se non ce ne sono) e rimescola.
  const playLand = () => {
    let u = -1, tp = -1, md = -1;
    hand.forEach((c, i) => {
      if (c.role === 'land') { if (c.tapped) { if (tp < 0) tp = i; } else if (u < 0) u = i; }
      else if (c.role === 'mdfc' && (md < 0 || (hand[md].tapped && !c.tapped))) md = i;
    });
    const avail = pool + onceSum;
    const k = u >= 0 && tp >= 0 ? (spendWith(avail + 1, hand[u]) > spendWith(avail, hand[tp]) ? u : tp) : u >= 0 ? u : tp >= 0 ? tp : md;
    if (k < 0) return;
    const c = hand[k];
    removeAt(hand, k);
    dropped = true;
    let land = c;
    if (c.fetch) {
      land = takeLand();
      shuffle(lib, rnd);
      if (!land) return;
    }
    enter(c.tapped, land);
  };
  const pay = (n) => {
    if (n <= pool) { pool -= n; return; }
    let need = n - pool;
    pool = 0;
    while (need > 0) {
      const a = once.pop();
      onceSum -= a;
      if (a >= need) { pool += a - need; need = 0; } else need -= a;
    }
  };

  for (let g = 0; g < p.games; g++) {
    let mulls;
    [hand, mulls] = deal(o.sample ? o.sample(rnd) : deck, p, rnd, lib, o);
    landsUp = landsTapped = rocks = dorks = dorksNew = onceSum = artifacts = 0;
    once.length = 0;
    used.fill(0);
    seen = hand.filter((c) => c.role === 'land').length;
    let compounded = 0, total = 0, paid = 0;
    for (let t = 1; t <= T; t++) {
      landsUp += landsTapped;
      landsTapped = 0;
      dorks += dorksNew;
      dorksNew = 0;
      if (t > 1 || !p.play) draw(1);
      pool = landsUp + rocks + dorks;
      dropped = false;
      playLand();
      const avail = pool + onceSum;
      acc.available[t - 1] += avail;
      if (t <= C && avail >= t) acc.onCurve[t - 1]++;
      let spent = 0;
      for (let k = pick(pool + onceSum); k >= 0; k = pick(pool + onceSum)) {
        const n = cost(k);
        pay(n);
        paid += n;
        spent += value(k);
        if (k >= hand.length) { used[k - hand.length] = 1; continue; }
        const c = hand[k];
        removeAt(hand, k);
        if (c.art) artifacts++;
        if (c.role === 'ramp') {
          if (c.kind === 'rock') {
            if (c.once) { once.push(c.mana); onceSum += c.mana; } else { rocks += c.mana; pool += c.mana; }
          } else if (c.kind === 'dork') dorksNew += c.mana;
          else {
            for (let i = 0; i < c.toBf; i++) { const l = takeLand(); if (l) enter(c.bfTapped, l); }
            for (let i = 0; i < c.toHand; i++) { const l = takeLand(); if (l) hand.push(l); }
            shuffle(lib, rnd);
            if (!dropped) playLand();
          }
        } else if (c.role === 'draw') {
          if (c.tutor) {
            const l = takeLand();
            if (l) hand.push(l);
            shuffle(lib, rnd);
          } else draw(c.draw);
          if (!dropped) playLand();
        }
      }
      compounded += (T - t + 1) * spent;
      total += spent;
    }
    acc.compounded += compounded;
    acc.deployed += total;
    acc.paid += paid;
    if (seen >= T + 2) acc.flood++;
    if (mulls > 0) acc.mull++;
    if ((g + 1) % 1000 === 0) tick?.(g + 1);
  }
  const G = p.games;
  return {
    compounded: acc.compounded / G, deployed: acc.deployed / G, manaPaid: acc.paid / G, onCurve: acc.onCurve.map((x) => x / G),
    available: acc.available.map((x) => x / G), flood: acc.flood / G, mulliganRate: acc.mull / G,
  };
}

// Variante con d terre in più o in meno, stessa dimensione (§6.5). In meno: via le terre semplici (stappate, non fetch;
// le altre solo se servono), al loro posto magie senza effetti al costo filler. In più: via le magie "spell" col valore
// di mana più vicino al filler (a pari distanza la più economica), al loro posto terre semplici. Ramp, draw, MDFC e
// comandanti non si toccano.
function variant(deck, d, filler) {
  const out = deck.slice();
  const idx = (f, key) => out.map((c, i) => i).filter((i) => f(out[i])).sort((a, b) => key(out[a]) - key(out[b]) || a - b);
  if (d < 0) for (const i of idx((c) => c.role === 'land', (c) => (c.tapped || c.fetch ? 1 : 0)).slice(0, -d)) out[i] = { role: 'spell', mv: filler };
  if (d > 0) for (const i of idx(regular, (c) => Math.abs(c.mv - filler) * 100 + c.mv).slice(0, d)) out[i] = PLAIN_LAND;
  return out;
}

// Mazzi con effetti sul costo (addendum §3.7): una variante per partita, col suo RNG, perché un solo filler cambierebbe il
// mix del mazzo (meno artefatti a ogni terra tolta). In meno: via le copie della terra stappata più comune (poi qualsiasi
// terra), dentro magie normali a caso in proporzione alle copie. In più: via magie normali a caso, dentro quella terra.
function sampled(deck, d, plain, spells, filler, rnd) {
  const out = deck.slice();
  for (let i = 0; i < -d; i++) {
    let k = out.indexOf(plain);
    if (k < 0) k = out.findIndex((c) => c.role === 'land');
    out[k] = spells.length ? spells[Math.floor(rnd() * spells.length)] : { role: 'spell', mv: filler };
  }
  for (let i = 0; i < d; i++) {
    const idx = [];
    out.forEach((c, j) => { if (regular(c)) idx.push(j); });
    out[idx[Math.floor(rnd() * idx.length)]] = plain;
  }
  return out;
}

// Sweep (§6.5-6.6): dalle terre attuali - below a + above (finché ci sono terre o magie da scambiare), stesso seed per
// ogni numero di terre. best = il punteggio composto più alto, band = i numeri di terre ad almeno il 99.5% del best.
// Gli sconti (params.discounts, di default attivi) contano solo nei mazzi con effetti sul costo.
export function simulate(input, p, onProgress) {
  const specs = input.cards.map(({ qty, ...c }) => [c, qty]);
  const deck = specs.flatMap(([c, qty]) => Array(qty).fill(c));
  if (deck.length < 7 + p.turns) throw new Error('The deck is too small to simulate.');
  const K = deck.filter((c) => c.role === 'land').length;
  const spells = deck.filter(regular);
  const pool = spells.length ? spells : deck.filter((c) => c.role !== 'land');
  const filler = pool.length ? Math.round(pool.reduce((a, c) => a + c.mv, 0) / pool.length) : 0;
  const fx = deck.some((c) => c.aff);
  const disc = fx && p.discounts !== false;
  const o = { fx, disc, enabler: disc ? (c) => !!c.art : () => false };
  const most = (xs) => xs.reduce((a, s) => (!a || s[1] > a[1] ? s : a), null)?.[0];
  const lands = specs.filter(([c]) => c.role === 'land');
  const plain = most(lands.filter(([c]) => !c.tapped && !c.fetch)) || most(lands) || PLAIN_LAND;
  const lo = K - Math.min(p.below, K);
  const hi = K + Math.min(p.above, spells.length);
  const total = (hi - lo + 1) * p.games;
  const rows = [];
  for (let L = lo; L <= hi; L++) {
    const done = rows.length * p.games;
    const d = L - K;
    const tick = (g) => onProgress?.(done + g, total);
    const sample = fx && d ? (rnd) => sampled(deck, d, plain, spells, filler, rnd) : null;
    rows.push({ lands: L, ...runCount(fx ? deck : variant(deck, d, filler), input.commanders, p, tick, { ...o, sample }) });
  }
  const best = rows.reduce((a, r) => (r.compounded > a.compounded ? r : a));
  const band = rows.filter((r) => r.compounded >= 0.995 * best.compounded).map((r) => r.lands);
  return { rows, current: K, best: best.lands, band: [Math.min(...band), Math.max(...band)], filler };
}
