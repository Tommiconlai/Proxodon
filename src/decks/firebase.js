/**
 * Firebase dell'area mazzi: login Google e Firestore con cache offline persistente (anche con
 * più schede aperte). Caricato solo dentro il chunk lazy di DecksView.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged,
  signOut as fbSignOut, deleteUser, reauthenticateWithPopup,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true, // rete di sicurezza: un campo undefined non fa fallire il salvataggio
});

const provider = new GoogleAuthProvider();

// Popup; se il browser lo blocca, login a pagina intera (redirect). Popup chiuso = nessun errore.
export async function signIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export const signOut = () => fbSignOut(auth);
export const watchUser = (cb) => onAuthStateChanged(auth, cb);

// Prima i dati (servono ancora i permessi), poi l'account. Google può chiedere un login recente.
export async function deleteAccount(deleteData) {
  const user = auth.currentUser;
  if (!user) return;
  await deleteData(user.uid);
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw e;
    await reauthenticateWithPopup(user, provider);
    await deleteUser(user);
  }
}
