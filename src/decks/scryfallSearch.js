/**
 * Ricerca carte per l'editor mazzi: autocompletamento, carta per nome esatto, ricerca a pagine,
 * carte per id (riallineamento) e risoluzione delle liste importate in snapshot.
 */
import { scryfallFetch, lookupCards } from '../utils/scryfall.js';
import { snapshotFromCard } from './deckModel.js';

const API = 'https://api.scryfall.com';

export const autocompleteUrl = (q) => `${API}/cards/autocomplete?q=${encodeURIComponent(q)}`;
export const namedUrl = (name) => `${API}/cards/named?exact=${encodeURIComponent(name)}`;
// Sempre game:paper: niente carte solo digitali. order: name, cmc, edhrec (popolarità), released.
export const searchUrl = (q, order = 'name') => `${API}/cards/search?q=${encodeURIComponent(`${q} game:paper`)}&unique=cards&order=${order}`;

// Solo carte giocabili nel formato del mazzo (fuori bandite e non legali); Casual senza filtro. identity
// (searchIdentity) = i colori del comandante: solo carte con l'identità dentro quella (comandante incolore: id:c).
const idQuery = (ci) => (ci.length ? `id<=${ci.join('').toLowerCase()}` : 'id:c');
export const withLegal = (q, format, identity) =>
  `${format === 'casual' ? q : `${q} legal:${format}`} ${identity ? idQuery(identity) : ''}`.trim();

// Filtri della ricerca avanzata → sintassi Scryfall. Campi vuoti ignorati; le virgolette dentro i
// testi si tolgono (Scryfall non ha escape). Colori della carta (c:) e identità (id:) a parte; in tutti e due
// incolore vince sui colori.
const phrase = (s) => `"${s.trim().replace(/"/g, '').replace(/\s+/g, ' ')}"`;
const filled = (v) => v != null && String(v).trim() !== '';
const colorQuery = (k, colors, colorless, mode) => (colorless ? `${k}:c`
  : colors?.length ? `${k}${mode || '>='}${colors.join('').toLowerCase()}` : '');
export function advancedQuery(f) {
  const out = [];
  // Il nome pieno delle carte a due facce su Scryfall usa " // ": "Fire/Ice" diventa "Fire // Ice".
  if (filled(f.name)) out.push(phrase(f.name.replace(/\s*\/+\s*/g, ' // ')));
  if (filled(f.oracle)) out.push(`o:${phrase(f.oracle)}`);
  if (filled(f.manaCost)) out.push(`m:${f.manaCost.replace(/\s+/g, '')}`);
  if (filled(f.mv)) out.push(`mv${f.mvOp || '='}${Number(f.mv)}`);
  out.push(colorQuery('c', f.colors, f.colorless, f.colorMode), colorQuery('id', f.idColors, f.idColorless, f.idMode));
  if (filled(f.type)) f.type.trim().split(/\s+/).forEach((t) => out.push(`t:${t}`));
  if (f.rarity) out.push(`r:${f.rarity}`);
  if (filled(f.set)) out.push(`s:${f.set.trim().toLowerCase()}`);
  if (filled(f.pow)) out.push(`pow${f.powOp || '='}${Number(f.pow)}`);
  if (filled(f.tou)) out.push(`tou${f.touOp || '='}${Number(f.tou)}`);
  if (filled(f.keyword)) out.push(`kw:${phrase(f.keyword)}`);
  if (filled(f.artist)) out.push(`a:${phrase(f.artist)}`);
  if (f.isCommander) out.push('is:commander');
  if (filled(f.extra)) out.push(f.extra.trim());
  return out.filter(Boolean).join(' ');
}

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
export async function searchCards(q, signal, pageUrl, order) {
  try {
    const j = await (await scryfallFetch(pageUrl || searchUrl(q, order), { signal })).json();
    return { cards: j.data || [], next: j.has_more ? j.next_page : null, total: j.total_cards || 0 };
  } catch (e) {
    if (e.status === 404) return { cards: [], next: null, total: 0 };
    throw e;
  }
}

// Carte per id Scryfall, a blocchi da 75 (riallineamento snapshot all'apertura del mazzo), al ritmo di scryfallFetch.
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
  }
  return out;
}

// Stampa preferita di una carta aggiunta dalla ricerca (Settings, Preferred printing): quella scelta per la carta
// (favPrints, per oracle id), poi il primo dei set preferiti (prefSets, in ordine) in cui esiste, poi la regola
// (printRule: newest, oldest, cheapest col prezzo della valuta di Settings, EUR se è spenta). Niente di questo, o
// Scryfall che non risponde: la carta com'è arrivata (la stampa di default di Scryfall).
const RULES = { newest: 'released&dir=desc', oldest: 'released&dir=asc' };
const printsOf = async (q, order) => {
  try {
    const res = await scryfallFetch(`${API}/cards/search?q=${encodeURIComponent(`${q} game:paper`)}&unique=prints&order=${order}`);
    return (await res.json()).data || [];
  } catch (e) {
    if (e.status === 404) return []; // nessuna stampa
    throw e;
  }
};
export async function preferredPrint(card, s) {
  const oid = card.oracle_id || card.card_faces?.[0]?.oracle_id;
  if (!oid) return card;
  try {
    const fav = s.favPrints[oid];
    if (typeof fav?.sid === 'string') return (await cardsByIds([fav.sid])).get(fav.sid) || card;
    const sets = s.prefSets.map((x) => x?.code).filter((c) => typeof c === 'string' && /^[a-z0-9]+$/.test(c));
    if (sets.length) {
      const found = await printsOf(`oracleid:${oid} (${sets.map((c) => `e:${c}`).join(' or ')})`, 'released');
      const hit = sets.map((c) => found.find((p) => p.set === c)).find(Boolean);
      if (hit) return hit;
    }
    if (s.printRule === 'cheapest') {
      const cur = s.currency === 'usd' ? 'usd' : 'eur';
      return (await printsOf(`oracleid:${oid}`, `${cur}&dir=asc`)).find((p) => Number(p.prices?.[cur]) > 0) || card;
    }
    if (RULES[s.printRule]) return (await printsOf(`oracleid:${oid}`, RULES[s.printRule]))[0] || card;
  } catch { /* Scryfall giù: la stampa di default */ }
  return card;
}

// Set di carta (niente digitali) per i set preferiti di Settings, i più nuovi prima: { code, name }. Una volta per sessione.
let setsP = null;
export const paperSets = () => (setsP ??= scryfallFetch(`${API}/sets`).then((r) => r.json())
  .then((j) => (j.data || []).filter((x) => !x.digital).map((x) => ({ code: x.code, name: x.name })))
  .catch((e) => { setsP = null; throw e; }));

// Token che creano le righe del mazzo, dagli all_parts di Scryfall, uno per oracle (un Treasure creato da tre carte
// compare una volta) con le carte che lo creano (from), in ordine di nome. Risposte in cache per la sessione:
// aggiungendo una carta si chiede solo lei. Li usano la sezione Tokens (DeckTokens) e Print deck (DeckEditor).
const partsBySid = new Map(); // carta del mazzo (sid) → id dei token che crea
const tokenById = new Map(); // id del token → la sua carta di Scryfall

export async function deckTokens(rows) {
  const sids = [...new Set(rows.map((r) => r.card.sid).filter(Boolean))];
  const fresh = sids.filter((s) => !partsBySid.has(s));
  if (fresh.length) {
    const cards = await cardsByIds(fresh);
    for (const s of fresh) partsBySid.set(s, (cards.get(s)?.all_parts || []).filter((p) => p.component === 'token').map((p) => p.id));
  }
  const need = [...new Set(sids.flatMap((s) => partsBySid.get(s)))].filter((id) => !tokenById.has(id));
  if (need.length) (await cardsByIds(need)).forEach((c, id) => tokenById.set(id, c));
  const byOracle = new Map();
  for (const r of rows) {
    for (const id of partsBySid.get(r.card.sid) || []) {
      const card = tokenById.get(id);
      if (!card) continue;
      const key = card.oracle_id || id;
      if (!byOracle.has(key)) byOracle.set(key, { key, card, from: new Set() });
      byOracle.get(key).from.add(r.card.name);
    }
  }
  return [...byOracle.values()].map((t) => ({ ...t, from: [...t.from] })).sort((a, b) => a.card.name.localeCompare(b.card.name));
}

// Voci importate ({ qty, name, set, collector, board, commander }) → righe pronte per addEntries.
// Le DFC si cercano per faccia anteriore (come parseCardList).
// fallback: una stampa (set, numero) che Scryfall non trova si cerca per nome (stampa di default);
// false = la carta resta tra le non trovate (Settings → Import).
export async function resolveEntries(entries, { fallback = true } = {}) {
  const key = (e) => ({ name: e.name.split(' // ')[0], set: e.set || '', collector: e.collector || '' });
  const byName = (e) => ({ name: key(e).name, set: '', collector: '' });
  const find = await lookupCards(entries.map(key));
  const missing = fallback ? entries.filter((e) => e.set && !find(key(e))) : [];
  const findName = missing.length ? await lookupCards(missing.map(byName)) : null;
  const items = [];
  const notFound = [];
  for (const e of entries) {
    const c = find(key(e)) || (e.set && findName?.(byName(e)));
    if (c) items.push({ card: snapshotFromCard(c), qty: e.qty || 1, board: e.board || 'main', commander: !!e.commander });
    else notFound.push(e.set ? `${e.name} (${e.set.toUpperCase()})` : e.name);
  }
  return { items, notFound };
}
