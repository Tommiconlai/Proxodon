import { useEffect, useState } from 'react';

// Conteggio dal server (like di un mazzo, voti di un dilemma): una lettura per chiave. fn è una funzione
// di deckStore (countLikes, countVotes), a e b i suoi argomenti. Prima della risposta, offline, senza
// permesso o con enabled false (un mazzo privato non ha like): 0.
export function useCount(fn, a, b, enabled = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fn(a, b).then((c) => { if (alive) setN(c); }).catch(() => {});
    return () => { alive = false; };
  }, [fn, a, b, enabled]);
  return enabled ? n : 0;
}
