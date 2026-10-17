/**
 * Firebase dell'area mazzi: login Google e Firestore con cache offline persistente (anche con
 * più schede aperte). Caricato solo dentro il chunk lazy di DecksView.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged,
  signOut as fbSignOut, deleteUser, reauthenticateWithPopup, signInWithCredential,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
  updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { firebaseConfig, googleWebClientId } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true, // rete di sicurezza: un campo undefined non fa fallire il salvataggio
});

const provider = new GoogleAuthProvider();

// App Android: popup e redirect non funzionano nella WebView. Login Google nativo (Credential Manager,
// plugin caricato solo nell'app) e il suo idToken passa all'SDK web: Firestore e watchUser restano uguali.
const isApp = Capacitor.isNativePlatform();
let socialLogin = null;
const getSocialLogin = () => (socialLogin ??= import('@capgo/capacitor-social-login')
  .then(async ({ SocialLogin }) => {
    await SocialLogin.initialize({ google: { webClientId: googleWebClientId } });
    return SocialLogin;
  })
  .catch((e) => { socialLogin = null; throw e; })); // un errore non resta in cache: il tentativo dopo riprova
async function googleCredential() {
  const { result } = await (await getSocialLogin()).login({ provider: 'google', options: {} });
  return GoogleAuthProvider.credential(result.idToken);
}

// Popup; se il browser lo blocca, login a pagina intera (redirect). Popup chiuso = nessun errore.
export async function signIn() {
  if (isApp) {
    let credential;
    try {
      credential = await googleCredential();
    } catch (e) {
      if (e.code === 'USER_CANCELLED') return; // foglio Google chiuso = nessun errore, come il popup
      // il dettaglio tecnico (pacchetto, SHA-1, client id) è nel logcat, tag GoogleProvider
      throw new Error('Google sign-in failed. Try again, or sign in with email.');
    }
    await signInWithCredential(auth, credential);
    return;
  }
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
export async function signUpEmail(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  // Un invio fallito non blocca: il pannello di verifica ha "Send the link again".
  await sendEmailVerification(user).catch(() => {});
}
export const sendVerification = () => sendEmailVerification(auth.currentUser);
// Gli account email + password devono confermare l'indirizzo; Google è già verificato.
// Stessa condizione delle regole Firestore (email_verified o login Google).
export const needsVerification = (u) => !u.emailVerified && !u.providerData.some((p) => p.providerId === 'google.com');
// Dopo il click sul link: rilegge l'utente e rinnova il token, così le regole vedono email_verified.
export async function checkVerified() {
  const u = auth.currentUser;
  if (!u) return false;
  await u.reload();
  if (u.emailVerified) await u.getIdToken(true);
  return u.emailVerified;
}
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

// Nickname = displayName di Firebase Auth; vuoto = nessuno (si vede l'email).
export const updateNickname = (name) => updateProfile(auth.currentUser, { displayName: name || null });
// Cambio password: Firebase vuole un accesso recente, quindi prima la password attuale.
export async function changePassword(current, next) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  await updatePassword(u, next);
}

// Nell'app si azzera anche la scelta dell'account Google, così il prossimo accesso può cambiarlo.
export async function signOut() {
  await fbSignOut(auth);
  if (isApp) await getSocialLogin().then((s) => s.logout({ provider: 'google' })).catch(() => {});
}
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
    if (isApp) await reauthenticateWithCredential(user, await googleCredential());
    else await reauthenticateWithPopup(user, provider);
    await deleteUser(user);
  }
}
