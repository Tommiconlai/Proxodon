import { useEffect, useState } from 'react';
import { cachedOracle, fetchOracle } from './scryfallSearch';

// Dati Oracle delle righe (maybeboard esclusa): subito quelli in cache; gli id delle stampe che mancano in una chiave,
// scaricati una volta (settled = la chiave finita, con l'errore se c'è stato). Carte che Scryfall non trova: un secondo
// giro e poi restano fuori dall'analisi.
export function useOracle(cards) {
  const [settled, setSettled] = useState({ key: '', error: null });
  const rows = cards.filter((r) => r.board !== 'maybe');
  const oracle = cachedOracle(rows);
  const missing = [...new Set(rows.filter((r) => !oracle.has(r.card.oid)).map((r) => r.card.sid))].sort().join(',');
  useEffect(() => {
    if (!missing) return undefined;
    let live = true;
    fetchOracle(missing.split(',').map((sid) => ({ card: { sid } })))
      .then(() => live && setSettled({ key: missing, error: null }), (e) => live && setSettled({ key: missing, error: e.message }));
    return () => { live = false; };
  }, [missing]);
  return { oracle, loading: !!missing && settled.key !== missing, error: settled.key === missing ? settled.error : null };
}
