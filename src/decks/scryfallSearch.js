/**
 * Ricerca carte per l'editor mazzi: autocompletamento, carta per nome esatto, ricerca a pagine,
 * carte per id (riallineamento) e risoluzione delle liste importate in snapshot.
 */
import { scryfallFetch, lookupCards, sleep } from '../utils/scryfall.js';
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
// testi si tolgono (Scryfall non ha escape). Incolore vince sui colori; identity usa id: invece di c:.
const phrase = (s) => `"${s.trim().replace(/"/g, '').replace(/\s+/g, ' ')}"`;
const filled = (v) => v != null && String(v).trim() !== '';
export function advancedQuery(f) {
  const out = [];
  // Il nome pieno delle carte a due facce su Scryfall usa " // ": "Fire/Ice" diventa "Fire // Ice".
  if (filled(f.name)) out.push(phrase(f.name.replace(/\s*\/+\s*/g, ' // ')));
  if (filled(f.oracle)) out.push(`o:${phrase(f.oracle)}`);
  if (filled(f.manaCost)) out.push(`m:${f.manaCost.replace(/\s+/g, '')}`);
  if (filled(f.mv)) out.push(`mv${f.mvOp || '='}${Number(f.mv)}`);
  const col = f.identity ? 'id' : 'c';
  if (f.colorless) out.push(`${col}:c`);
  else if (f.colors?.length) out.push(`${col}${f.colorMode || '>='}${f.colors.join('').toLowerCase()}`);
  if (filled(f.type)) f.type.trim().split(/\s+/).forEach((t) => out.push(`t:${t}`));
  if (f.rarity) out.push(`r:${f.rarity}`);
  if (filled(f.set)) out.push(`s:${f.set.trim().toLowerCase()}`);
  if (filled(f.pow)) out.push(`pow${f.powOp || '='}${Number(f.pow)}`);
  if (filled(f.tou)) out.push(`tou${f.touOp || '='}${Number(f.tou)}`);
  if (filled(f.keyword)) out.push(`kw:${phrase(f.keyword)}`);
  if (filled(f.artist)) out.push(`a:${phrase(f.artist)}`);
  if (f.isCommander) out.push('is:commander');
  if (filled(f.extra)) out.push(f.extra.trim());
  return out.join(' ');
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
