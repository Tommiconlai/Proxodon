/**
 * Import carte da Scryfall.
 *
 * Flusso: parseCardList(testo) -> [{qty, name}] -> fetchScryfallImages()
 * interroga l'endpoint /cards/collection (batch da 75), scarica le immagini
 * PNG come Blob e le impacchetta in File pronti per la pipeline esistente
 * (handleImagesAdded -> object URL -> preview/cache/PDF).
 */

const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const CHUNK = 75;          // max identifiers per richiesta (limite Scryfall)
const IMG_CONCURRENCY = 8; // fetch immagini in parallelo

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch verso Scryfall con retry su 429/5xx e errori di rete. I 503/Cloudflare
// tornano senza header CORS → nel browser appaiono come "Failed to fetch" opaco:
// qui ritentiamo con backoff e, se persiste, diamo un messaggio chiaro.
async function scryfallFetch(url, opts, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
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
    throw new Error(`Scryfall responded ${res.status}`); // 4xx: non ritentabile
  }
  throw lastErr || new Error('Scryfall request failed.');
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'carta';
}

/**
 * Parsa il testo incollato. Una carta per riga.
 * Accetta "1x Nome", "1 Nome", "Nome". Quantità limitata a 3 cifre per non
 * confondere carte che iniziano con un numero (es. "1996 World Champion").
 * Coda opzionale "(SET) [collector]" (es. "(C21) 263 *F*") → pinna la stampa.
 * @returns {{qty:number, name:string, set:string, collector:string}[]}
 */
export function parseCardList(text) {
  const out = [];
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let qty = 1;
    let name = line;
    let m = line.match(/^(\d{1,3})\s*[xX]\s*(.+)$/);
    if (!m) m = line.match(/^(\d{1,3})\s+(.+)$/);
    if (m) {
      qty = parseInt(m[1], 10) || 1;
      name = m[2];
    }
    // Coda set/collector: set = 2-6 alfanumerici tra parentesi, collector = primo
    // token dopo. Il resto (marcatore foil ecc.) si scarta. Assente → import per nome.
    let set = '';
    let collector = '';
    const tail = name.match(/\s+\(([0-9A-Za-z]{2,6})\)(?:\s+([0-9A-Za-z★-]+))?.*$/);
    if (tail) {
      set = tail[1].toLowerCase();
      // NON lowercase: /cards/collection è case-sensitive sul collector (The List → "TMP-294").
      collector = tail[2] || '';
      name = name.slice(0, tail.index);
    }
    name = name.trim();
    // DFC / split: Scryfall /cards/collection matcha la faccia anteriore ("A"),
    // non il nome pieno "A // B". imageFaces estrae poi entrambe le facce.
    if (name.includes('//')) name = name.split('//')[0].trim();
    if (name) out.push({ qty, name, set, collector });
  }
  return out;
}

/**
 * Immagini PNG di una carta: 1 normalmente, 2 per le doppia-faccia vere
 * (transform / modal_dfc), dove ogni faccia ha la propria immagine.
 * @returns {{url:string, name:string}[]}
 */
export function imageFaces(card) {
  if (card.image_uris?.png) return [{ url: card.image_uris.png, name: card.name }];
  if (Array.isArray(card.card_faces)) {
    const withImg = card.card_faces.filter((f) => f.image_uris?.png || f.image_uris?.large);
    if (withImg.length) {
      return withImg.map((f) => ({ url: f.image_uris.png || f.image_uris.large, name: f.name }));
    }
  }
  if (card.image_uris?.large) return [{ url: card.image_uris.large, name: card.name }];
  return [];
}

/**
 * Tutte le stampe (printings) di una carta, per scambiare l'art.
 * ponytail: solo prima pagina (175 max); +paginazione se una carta ne ha di più.
 * @returns {Promise<{id,set,setName,thumb,png}[]>}
 */
export async function fetchPrints(name) {
  const q = encodeURIComponent(`!"${name}" game:paper`);
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${q}&unique=prints&order=released`);
  if (res.status === 404) return []; // nessuna stampa
  if (!res.ok) throw new Error(`Scryfall responded ${res.status}`);
  const json = await res.json();
  // Per le DFC: scegli la faccia il cui nome combacia con quello cercato (fronte
  // o retro), così cambiando l'art del retro non si prende l'immagine del fronte.
  const target = name.trim().toLowerCase();
  return (json.data || [])
    .map((c) => {
      const face = c.card_faces?.find((f) => f.name?.toLowerCase() === target);
      const u = face?.image_uris || c.image_uris || c.card_faces?.[0]?.image_uris || {};
      return { id: c.id, set: (c.set || '').toUpperCase(), collector: c.collector_number || '', setName: c.set_name || '', thumb: u.small || u.normal, png: u.png || u.large, fullArt: !!c.full_art, borderless: c.border_color === 'borderless' };
    })
    .filter((p) => p.thumb && p.png);
}

/** Scarica un'immagine come File (riusa la pipeline esistente). */
export async function downloadAsFile(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return new File([await res.blob()], `${sanitizeName(name)}.png`, { type: 'image/png' });
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Scarica le immagini delle carte richieste.
 * @param {{qty:number, name:string, set?:string, collector?:string}[]} entries
 * @param {(done:number, total:number)=>void} [onProgress]
 * @returns {Promise<{files: {file: File, bleedMode: string}[], notFound: string[]}>}
 */
export async function fetchScryfallImages(entries, onProgress) {
  // Aggrega le quantità per (nome|set|collector), preservando l'ordine.
  const byKey = new Map();
  for (const e of entries) {
    if (!e.name) continue;
    const set = e.set || '';
    const collector = e.collector || '';
    const key = `${e.name.toLowerCase()}|${set}|${collector}`;
    if (byKey.has(key)) byKey.get(key).qty += e.qty || 1;
    else byKey.set(key, { name: e.name, set, collector, qty: e.qty || 1 });
  }
  const list = [...byKey.values()];
  if (!list.length) return { files: [], notFound: [] };

  // 1) Risolvi via /cards/collection (batch da 75). Identifier più preciso:
  //    set+collector → stampa esatta; solo set → nome in quel set; altrimenti nome.
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

  // 2) Costruisci i task immagine nell'ordine della lista; raccogli i mancanti.
  const notFound = [];
  const tasks = []; // { url, name, qty, bleedMode }
  for (const e of list) {
    const nl = e.name.toLowerCase();
    const ec = e.collector.toLowerCase(); // chiavi case-insensitive (registrate lowercased)
    const card =
      cardByKey.get(`${nl}|${e.set}|${ec}`) ||
      cardByKey.get(`${nl}|${e.set}|`) ||
      cardByKey.get(`${nl}||`);
    if (!card) {
      notFound.push(e.set ? `${e.name} (${e.set.toUpperCase()})` : e.name);
      continue;
    }
    // full-art / borderless → mirror; altrimenti edge-stretch (bordo nero)
    const bleedMode = card.full_art || card.border_color === 'borderless' ? 'mirror' : 'stretch';
    imageFaces(card).forEach((face, idx) => {
      // faceName = nome faccia (filename, retro DFC incluso); name = nome cercato
      // (front) + set/collector → metadati per il salvataggio progetto. primary =
      // faccia anteriore: il salvataggio conta solo quella per non raddoppiare le DFC.
      tasks.push({ url: face.url, faceName: face.name, name: e.name, set: e.set, collector: e.collector, qty: e.qty, bleedMode, primary: idx === 0 });
    });
  }

  // 3) Scarica i Blob (concorrenza limitata) ed espandi in File per quantità.
  let done = 0;
  const blobs = await mapLimit(tasks, IMG_CONCURRENCY, async (t) => {
    let blob = null;
    try {
      const res = await fetch(t.url);
      if (res.ok) blob = await res.blob();
    } catch {
      blob = null;
    }
    done++;
    onProgress?.(done, tasks.length);
    return blob;
  });

  const files = [];
  tasks.forEach((t, i) => {
    const blob = blobs[i];
    if (!blob) {
      notFound.push(t.faceName);
      return;
    }
    for (let k = 0; k < t.qty; k++) {
      files.push({
        file: new File([blob], `${sanitizeName(t.faceName)}.png`, { type: 'image/png' }),
        bleedMode: t.bleedMode,
        name: t.name, set: t.set, collector: t.collector, primary: t.primary,
      });
    }
  });

  return { files, notFound };
}

// ── Import lista da link deck (Moxfield / Archidekt / Tappedout) ───────────
// Questi siti non mandano header CORS e l'app è statica (niente backend) → uso
// proxy CORS pubblici. ponytail: un singolo proxy muore/limita spesso (corsproxy.io
// è passato a richiedere una key), quindi provo una catena di fallback: il primo
// che risponde ok vince. Tutti restituiscono il body raw. Aggiungere/riordinare qui.
const CORS_PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

// Prova ogni proxy finché uno risponde ok; ritorna la Response. Lancia un errore
// leggibile se falliscono tutti (proxy giù o deck privato/inesistente).
async function fetchViaProxy(targetUrl) {
  let lastErr;
  for (const wrap of CORS_PROXIES) {
    try {
      const r = await fetch(wrap(targetUrl));
      if (r.ok) return r;
      lastErr = new Error(`proxy responded ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Could not reach the deck site (CORS proxies failed${lastErr ? `: ${lastErr.message}` : ''}). Try again later, or paste the list by hand.`);
}

// "qty Nome (SET) cn", set+collector pinnano la stampa SCELTA NEL DECK; assenti →
// solo nome (Scryfall sceglie la stampa di default). Il tail lo riparsa parseCardList.
export function deckLine(qty, name, set, cn) {
  if (!name) return '';
  const tail = set && cn ? ` (${String(set).toUpperCase()}) ${cn}` : '';
  return `${qty || 1} ${name}${tail}`;
}

/**
 * Serializza le carte Scryfall presenti in una deck-list "qty Nome (SET) cn"
 * (stesso formato dell'import → ricaricabile incollandola). Conta solo le facce
 * primarie (front) così le DFC non raddoppiano la quantità. Gli upload manuali
 * (senza `name`) non sono salvabili nel testo: vengono contati a parte.
 * @param {{name?:string,set?:string,collector?:string,primary?:boolean}[]} items
 * @returns {{text:string, cards:number, custom:number}}
 */
export function buildDeckList(items) {
  const map = new Map();
  let custom = 0;
  for (const it of items || []) {
    if (!it.name) { custom++; continue; }   // upload manuale: niente metadati
    if (it.primary === false) continue;      // conta solo la faccia anteriore
    const set = it.set || '';
    const collector = it.collector || '';
    const key = `${it.name}|${set}|${collector}`;
    const e = map.get(key) || { name: it.name, set, collector, qty: 0 };
    e.qty++;
    map.set(key, e);
  }
  const text = [...map.values()].map((e) => deckLine(e.qty, e.name, e.set, e.collector)).join('\n');
  return { text, cards: map.size, custom };
}

async function archidektList(id) {
  const r = await fetchViaProxy(`https://archidekt.com/api/decks/${id}/`);
  const j = await r.json();
  return (j.cards || [])
    .filter((c) => !(c.categories || []).some((cat) => /maybe|sideboard|considering/i.test(cat)))
    .map((c) => deckLine(c.quantity, c.card?.oracleCard?.name, c.card?.edition?.editioncode, c.card?.collectorNumber))
    .filter((l) => l.length > 1)
    .join('\n');
}

async function moxfieldList(pubId) {
  const r = await fetchViaProxy(`https://api2.moxfield.com/v3/decks/all/${pubId}`);
  const j = await r.json();
  const out = [];
  const boards = j.boards || {};
  for (const name of ['commanders', 'mainboard']) {
    const cards = boards[name]?.cards || {};
    for (const k in cards) {
      const c = cards[k].card || {};
      out.push(deckLine(cards[k].quantity, c.name, c.set, c.cn));
    }
  }
  return out.filter((l) => l.length > 1).join('\n');
}

async function tappedoutList(slug) {
  const r = await fetchViaProxy(`https://tappedout.net/mtg-decks/${slug}/?fmt=txt`);
  const txt = await r.text();
  // fmt=txt è già "1 Nome" per riga; tieni solo le righe che iniziano con la quantità.
  return txt.replace(/\r/g, '').split('\n').filter((l) => /^\d+\s/.test(l.trim())).join('\n');
}

/**
 * Risolve un link deck in una lista testuale "qty Nome" (poi → parseCardList).
 * @param {string} url link Moxfield / Archidekt / Tappedout
 * @returns {Promise<string>}
 */
export async function fetchDeckList(url) {
  const u = (url || '').trim();
  let m;
  if ((m = u.match(/moxfield\.com\/decks\/([\w-]+)/i))) return moxfieldList(m[1]);
  if ((m = u.match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/i))) return archidektList(m[1]);
  if ((m = u.match(/tappedout\.net\/mtg-decks\/([\w-]+)/i))) return tappedoutList(m[1]);
  throw new Error('Unrecognized link. Supported: Moxfield, Archidekt, Tappedout.');
}
