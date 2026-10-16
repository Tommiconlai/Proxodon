import { useEffect, useState } from 'react';
import { countLikes } from './deckStore';

// Like ricevuti da un mazzo: conteggio dal server per i mazzi pubblici (0 per i privati, che non
// possono averne). Prima della risposta, offline o senza permesso: 0.
export function useLikeCount(id, isPublic) {
  const [n, setN] = useState(null);
  useEffect(() => {
    if (!isPublic) return undefined;
    let alive = true;
    countLikes(id).then((c) => { if (alive) setN(c); }).catch(() => {});
    return () => { alive = false; };
  }, [id, isPublic]);
  return isPublic ? n ?? 0 : 0;
}
