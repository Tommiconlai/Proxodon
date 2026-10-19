/**
 * Import da MPCFill (MakePlayingCards autofill), file XML <order>.
 *
 * Ogni <card> ha <id> (file Google Drive), <slots> (posizioni; più slot = più
 * copie), <query> (nome carta) e <name> (filename con l'art). Le immagini sono
 * servite da lh3.googleusercontent.com/d/<id> che, a differenza di drive.google.com,
 * manda gli header CORS → fetch leggibile → blob non "tainted" → export PDF ok.
 * Le immagini MPC sono già al vivo (~3mm di abbondanza) → bleedMode 'full'.
 */
import { timeoutSignal } from './scryfall';

// w<N> = larghezza richiesta; lh3 non fa upscale, quindi 2000 = nativo o meno.
// lh3 manda gli header CORS (drive.google.com no) → niente proxy: questo modulo
// non contatta MAI i server di MPCFill, solo le immagini Drive (lh3) citate nell'XML.
const driveImg = (id, w = 2000) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;

const stripExt = (s) => (s || '').replace(/\.[a-z0-9]+$/i, '').trim();

// Parse del testo XML → { cards: [{id, name, count}] }. fronts poi backs.
export function parseMpcXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML file.');

  const read = (section) =>
    Array.from(doc.querySelectorAll(`${section} > card`)).map((c) => {
      const id = c.querySelector('id')?.textContent?.trim();
      const slots = c.querySelector('slots')?.textContent?.trim() || '';
      // slot multipli ("0,1,2") = copie della stessa carta, al massimo 99
      const count = slots ? slots.split(',', 100).filter((s) => s.trim() !== '').length : 1;
      // il nome carta è <query>; fallback al filename senza estensione
      const name = (c.querySelector('query')?.textContent?.trim())
        || stripExt(c.querySelector('name')?.textContent) || 'card';
      return { id, name: name.slice(0, 200), count: Math.min(99, Math.max(1, count)) };
    }).filter((c) => /^[\w-]{10,100}$/.test(c.id ?? '')); // id di un file Drive

  const cards = [...read('fronts'), ...read('backs')];
  if (!cards.length) throw new Error('No cards found in the file.');
  // Copie, non righe: 1000 righe da 99 copie sarebbero 99.000 file in coda.
  if (cards.reduce((n, c) => n + c.count, 0) > 1000) throw new Error('This file has more than 1000 cards: split it.');
  return { cards };
}

// Esegue fn su items con al più `limit` richieste in parallelo (no flood su lh3).
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
 * Scarica le immagini delle carte (1 fetch per carta, poi duplicata per le copie).
 * @returns {Promise<{files: {file:File, bleedMode:'full', name:string}[], notFound:string[]}>}
 */
export async function fetchMpcImages(cards, onProgress) {
  let done = 0;
  const total = cards.length;
  const fetched = await mapLimit(cards, 6, async (c) => {
    try {
      const res = await fetch(driveImg(c.id), { signal: timeoutSignal() });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('not an image');
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `${c.name}.${ext}`, { type: blob.type });
      return { ok: true, file, count: c.count };
    } catch {
      return { ok: false, name: c.name };
    } finally {
      onProgress?.(++done, total);
    }
  });

  const files = [];
  const notFound = [];
  for (const r of fetched) {
    if (!r.ok) { notFound.push(r.name); continue; }
    // stesso File per ogni copia: addItems crea un object URL distinto per item.
    // Niente `name`: l'art MPC è custom (no identità Scryfall) → esclusa da "Save list"
    // come gli upload manuali, invece di salvare un nome che al reload prende l'art sbagliata.
    for (let i = 0; i < r.count; i++) files.push({ file: r.file, bleedMode: 'full' });
  }
  return { files, notFound };
}
