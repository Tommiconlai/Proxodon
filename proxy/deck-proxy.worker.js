/**
 * Proxy CORS minimo per l'import dei mazzi da link (Cloudflare Worker, piano gratuito).
 * Moxfield e Archidekt non mandano header CORS, quindi il browser non può leggerli direttamente,
 * e i proxy CORS pubblici sono morti o a pagamento (verificato il 2026-10-14).
 * Limiti voluti: solo GET, solo verso questi due host (niente proxy aperto), risposta leggibile
 * dal browser solo per le origini dell'app. Uso: GET <url del worker>/?url=<url del sito>.
 * Deploy: HANDOFF.md, voce "Deck-link import".
 */
const HOSTS = new Set(['archidekt.com', 'api2.moxfield.com']);
const APP_ORIGIN = 'https://tommiconlai.github.io';
const isLocal = (o) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
// Moxfield risponde 403 se la richiesta non sembra quella del suo sito (User-Agent da browser,
// lingua, Origin e Referer di moxfield.com); ad Archidekt vanno bene gli stessi header.
const UPSTREAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};
const SITE_HEADERS = { 'api2.moxfield.com': { Origin: 'https://moxfield.com', Referer: 'https://moxfield.com/' } };

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin === APP_ORIGIN || isLocal(origin) ? origin : APP_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    const reply = (status, text) => new Response(text, { status, headers: { ...cors, 'Content-Type': 'text/plain' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return reply(405, 'Method not allowed');

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url'));
    } catch {
      return reply(400, 'Missing or bad url');
    }
    if (target.protocol !== 'https:' || !HOSTS.has(target.hostname)) return reply(403, 'Host not allowed');

    try {
      const upstream = await fetch(target, { headers: { ...UPSTREAM_HEADERS, ...SITE_HEADERS[target.hostname] } });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    } catch {
      return reply(502, 'Deck site unreachable');
    }
  },
};
