import { useEffect, useReducer, useState } from 'react';
import { watchUser, needsVerification } from './firebase';
import { listenProfile } from './deckStore';

// Utente (undefined = in verifica, null = non loggato), documento profilo (foto e sfondo come data URL,
// nickname) e rerender, che dopo reload() aggiorna l'utente sul posto.
export function useAccount() {
  const [user, setUser] = useState(undefined);
  const [, rerender] = useReducer((n) => n + 1, 0);
  const [profile, setProfile] = useState(null);
  const ready = !!user && !needsVerification(user);
  const uid = user?.uid;
  useEffect(() => watchUser(setUser), []);
  // Solo da verificato: prima le regole rifiutano la lettura.
  useEffect(() => (ready ? listenProfile(uid, setProfile, () => setProfile(null)) : undefined), [uid, ready]);
  return { user, profile, photo: profile?.photo || null, ready, rerender };
}
