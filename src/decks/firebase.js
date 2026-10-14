/**
 * Firebase dell'area mazzi: login Google e Firestore con cache offline persistente (anche con
 * più schede aperte). Caricato solo dentro il chunk lazy di DecksView.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged,
  signOut as fbSignOut, deleteUser, reauthenticateWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
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

// Email + password (provider "Email/Password" da attivare nella console Firebase).
export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUpEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
// Con la protezione anti-enumerazione Firebase non dice se l'email esiste: nessun errore in quel caso.
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-login-credentials': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'This email address is not valid.',
  'auth/missing-password': 'Type your password.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead, or use Google if you signed up with it.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled for this site yet.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
};
export const authMessage = (e) => AUTH_MESSAGES[e?.code] || e?.message || 'Sign-in failed.';

export const signOut = () => fbSignOut(auth);
export const watchUser = (cb) => onAuthStateChanged(auth, cb);

// Prima i dati (servono ancora i permessi), poi l'account. Firebase può chiedere un login recente:
// con Google si rifà col popup, con email + password serve un nuovo accesso (i mazzi sono già via).
export async function deleteAccount(deleteData) {
  const user = auth.currentUser;
  if (!user) return;
  await deleteData(user.uid);
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw e;
    if (!user.providerData.some((p) => p.providerId === 'google.com')) {
      throw new Error('Your decks were deleted. To delete the account too, sign out, sign in again and repeat.');
    }
    await reauthenticateWithPopup(user, provider);
    await deleteUser(user);
  }
}
