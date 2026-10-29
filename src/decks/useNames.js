import { useEffect, useState } from 'react';
import { getPublicProfile } from './deckStore';

// Liste di gruppo e Team Trios. Errore di una scrittura in parole: permessi negati = regole non ancora pubblicate.
export const errorText = (e) => (e?.code === 'permission-denied' ? 'Not allowed. The new Firestore rules may not be published yet.' : e?.message || 'Something went wrong.');

// Nickname dei membri (profili pubblici, una lettura per membro, tenuti per la sessione): "a player" senza nickname.
const names = new Map();
export function useNames(uids) {
  const [, bump] = useState(0);
  const key = uids.join(',');
  useEffect(() => {
    let on = true;
    key.split(',').filter((u) => u && !names.has(u)).forEach((u) => {
      names.set(u, null);
      getPublicProfile(u).then((p) => { names.set(u, p.nickname); if (on) bump((n) => n + 1); }, () => names.delete(u));
    });
    return () => { on = false; };
  }, [key]);
  return (u) => names.get(u) || 'a player';
}
