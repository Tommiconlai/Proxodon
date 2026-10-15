// "10 minutes ago", "yesterday", "just now": tempo trascorso da un istante in ms (Intl, inglese).
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

export function timeAgo(ms) {
  const sec = (Date.now() - ms) / 1000;
  const u = UNITS.find(([, n]) => sec >= n);
  return u ? rtf.format(-Math.floor(sec / u[1]), u[0]) : 'just now';
}
