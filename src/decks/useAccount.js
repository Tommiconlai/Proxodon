import { useEffect, useReducer, useState } from 'react';
import { watchUser, needsVerification } from './firebase';
import { listenProfile } from './deckStore';

// Utente (undefined = in verifica, null = non loggato), foto profilo personalizzata (data URL) e rerender,
// che dopo reload() aggiorna l'utente sul posto.
export function useAccount() {
  const [user, setUser] = useState(undefined);
  const [, rerender] = useReducer((n) => n + 1, 0);
  const [photo, setPhoto] = useState(null);
  const ready = !!user && !needsVerification(user);
  const uid = user?.uid;
  useEffect(() => watchUser(setUser), []);
  // Solo da verificato: prima le regole rifiutano la lettura.
  useEffect(() => (ready ? listenProfile(uid, (p) => setPhoto(p?.photo || null), () => setPhoto(null)) : undefined), [uid, ready]);
  return { user, photo, ready, rerender };
}
