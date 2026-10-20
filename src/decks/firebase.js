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
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, clearIndexedDbPersistence, waitForPendingWrites } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseConfig, googleWebClientId, appCheckSiteKey } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
// App Check: ogni richiesta a Firestore porta un token reCAPTCHA che dice "viene da questo sito", non da uno
// script che usa la config pubblica (quota consumata da account finti). Senza chiave resta spento; renderlo
// obbligatorio è un interruttore della console (App Check > Firestore > Enforce), dopo averlo visto in Monitor.
if (appCheckSiteKey) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true, // rete di sicurezza: un campo undefined non fa fallire il salvataggio
});

// Uscendo (o cancellando l'account) la cache locale dei mazzi si svuota al prossimo avvio, prima di ogni lettura:
// Firestore la cancella solo da chiuso, e chiuderlo subito vorrebbe dire ricaricare la pagina (e perdere
// un'impaginazione in corso). Con altre schede aperte non si può: ci riprova all'avvio dopo.
const CLEAR = 'ip:clearCache';
const clearLater = () => { try { localStorage.setItem(CLEAR, '1'); } catch { /* niente storage: niente pulizia */ } };
try {
  if (localStorage.getItem(CLEAR)) { await clearIndexedDbPersistence(db); localStorage.removeItem(CLEAR); }
} catch { /* altre schede aperte */ }

const provider = new GoogleAuthProvider();
// Sempre la scelta dell'account: su un computer condiviso, dopo l'uscita di A, B non entra come A senza volerlo.
provider.setCustomParameters({ prompt: 'select_account' });

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
// Account email mai confermato (VerifyEmailPanel): niente dati da cancellare, le regole non gli fanno leggere né scrivere
// nulla (verified()), quindi solo l'account. Prima rilegge l'utente: confermato intanto da un'altra scheda potrebbe avere
// mazzi, e allora si cancella da Settings, con i dati. Firebase vuole un accesso recente (5 minuti), se no lo dice.
export async function deleteUnverifiedAccount() {
  const u = auth.currentUser;
  if (!u) return;
  await u.reload();
  if (!needsVerification(u)) throw new Error('This account is verified now. Reload the page and delete it from Settings.');
  await deleteUser(u);
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
  'auth/popup-closed-by-user': 'The Google window was closed.',
  'auth/cancelled-popup-request': 'The Google window was closed.',
  'auth/user-disabled': 'Wrong email or password.', // come gli altri: non dice se l'account esiste
  'auth/user-mismatch': 'That is a different Google account. Use the one you are signed in with.',
  'auth/requires-recent-login': 'For safety, sign out, sign in again and repeat within 5 minutes.',
};
// Codici sconosciuti dell'SDK: un messaggio generico col codice (utile per un aiuto), mai il suo testo grezzo; gli errori
// dell'app (senza codice) tengono il loro testo.
export const authMessage = (e) => AUTH_MESSAGES[e?.code]
  || (e?.code ? `Something went wrong (${e.code}). Try again.` : e?.message) || 'Sign-in failed.';

// Nickname = displayName di Firebase Auth; vuoto = nessuno (si vede l'email).
export const updateNickname = (name) => updateProfile(auth.currentUser, { displayName: name || null });
// Cambio password: Firebase vuole un accesso recente, quindi prima la password attuale.
export async function changePassword(current, next) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  await updatePassword(u, next);
}

// Modifiche ancora in coda (offline): uscendo si perdono (la cache si svuota, e senza account il server le rifiuta).
// true = arrivate tutte al server entro ms; chi esce chiede conferma se no.
export const writesSynced = (ms = 4000) =>
  Promise.race([waitForPendingWrites(db).then(() => true, () => false), new Promise((r) => { setTimeout(r, ms, false); })]);

// Nell'app si azzera anche la scelta dell'account Google, così il prossimo accesso può cambiarlo.
export async function signOut() {
  clearLater();
  await fbSignOut(auth);
  if (isApp) await getSocialLogin().then((s) => s.logout({ provider: 'google' })).catch(() => {});
}
export const watchUser = (cb) => onAuthStateChanged(auth, cb);

// Prima un accesso recente (meno di 5 minuti, quello che Firebase chiede per cancellare l'account), poi i dati (servono
// ancora i permessi), poi l'account: chi trova la sessione aperta su un dispositivo non cancella tutto con due click.
// Con Google si rifà l'accesso (popup o nativo), con email + password si esce e si rientra; i dati restano finché non va.
const RECENT_LOGIN = 5 * 60 * 1000;
export async function deleteAccount(deleteData) {
  const user = auth.currentUser;
  if (!user) return;
  // Ultimo accesso letto subito (niente await prima del popup: i browser lo bloccano se non segue il click). Dopo un
  // riaccesso l'ora può restare quella vecchia: al massimo si chiede di nuovo.
  if (!(Date.now() - Date.parse(user.metadata.lastSignInTime) < RECENT_LOGIN)) {
    if (!user.providerData.some((p) => p.providerId === 'google.com')) {
      throw new Error('For safety, sign out, sign in again and repeat Delete account within 5 minutes. Nothing was deleted.');
    }
    try {
      if (isApp) await reauthenticateWithCredential(user, await googleCredential());
      else await reauthenticateWithPopup(user, provider);
    } catch (e) {
      throw new Error(`${authMessage(e)} Nothing was deleted.`);
    }
  }
  await deleteData(user.uid);
  clearLater();
  // Da qui i dati non ci sono più: un errore lo dice, invece del messaggio grezzo (es. finestra di Google chiusa).
  const dataGone = (e) => new Error(`Your decks were deleted, but the account was not: ${authMessage(e)} Try Delete account again.`);
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw dataGone(e);
    if (!user.providerData.some((p) => p.providerId === 'google.com')) {
      throw new Error('Your decks were deleted. To delete the account too, sign out, sign in again and repeat.');
    }
    try {
      if (isApp) await reauthenticateWithCredential(user, await googleCredential());
      else await reauthenticateWithPopup(user, provider);
      await deleteUser(user);
    } catch (e2) {
      throw dataGone(e2);
    }
  }
}
