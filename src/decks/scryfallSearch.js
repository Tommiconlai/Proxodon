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
