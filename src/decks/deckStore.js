/**
 * Mazzi su Firestore: un documento per mazzo in users/{uid}/decks/{deckId}. Le scritture non
 * vanno attese per aggiornare la UI: offline restano in coda nella cache locale.
 */
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc, getDocs, writeBatch, runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';

const decksCol = (uid) => collection(db, 'users', uid, 'decks');
// serverTimestamps 'estimate': un mazzo appena scritto ha già una data (stimata) per l'ordinamento.
const fromDoc = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
const ms = (t) => t?.toMillis?.() ?? 0;
const payload = (d) => ({
  v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cover: d.cover ?? null, cards: d.cards,
  updatedAt: serverTimestamp(),
});

// ponytail: ordinamento lato client (niente indice); legge i documenti interi, va bene per
// decine di mazzi. Se la lista rallenta: una collezione di riepiloghi.
export function listenDecks(uid, onChange, onError) {
  return onSnapshot(decksCol(uid), (qs) => onChange(qs.docs.map(fromDoc).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))), onError);
}

export function listenDeck(uid, id, onChange, onError) {
  return onSnapshot(doc(decksCol(uid), id), { includeMetadataChanges: true },
    (s) => onChange(s.exists() ? fromDoc(s) : null, s.metadata.hasPendingWrites), onError);
}

export function createDeck(uid, deck) {
  const ref = doc(decksCol(uid));
  return { id: ref.id, done: setDoc(ref, { ...payload(deck), createdAt: serverTimestamp() }) };
}

// merge: createdAt resta; gli array (cards, sections) vengono sostituiti interi.
export const saveDeck = (uid, deck) => setDoc(doc(decksCol(uid), deck.id), payload(deck), { merge: true });

export const deleteDeck = (uid, id) => deleteDoc(doc(decksCol(uid), id));

// Profilo in users/{uid}: photo e banner (data URL), nickname (come scritto; il nome mostrato resta il
// displayName di Firebase Auth). followers / following arriveranno con i profili pubblici.
const profileDoc = (uid) => doc(db, 'users', uid);
export const listenProfile = (uid, onChange, onError) =>
  onSnapshot(profileDoc(uid), (s) => onChange(s.exists() ? s.data() : null), onError);
// fields: { photo } o { banner }; null = rimuovi.
export const saveProfile = (uid, fields) =>
  setDoc(profileDoc(uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });

// Nickname unici: usernames/{nome in minuscolo} = { uid }. In una transazione: se il nome è di un
// altro errore 'taken', altrimenti lo prende, libera il vecchio e lo scrive nel profilo (le regole
// controllano che i due documenti corrispondano). name vuoto = nessun nickname.
export const nicknameKey = (name) => name.toLowerCase();
export const NICKNAME_RE = /^[a-z0-9._-]{3,24}$/i;
export async function claimNickname(uid, name, old) {
  const key = name && nicknameKey(name);
  const oldKey = old && nicknameKey(old);
  await runTransaction(db, async (tx) => {
    const ref = key && doc(db, 'usernames', key);
    if (ref) {
      const s = await tx.get(ref);
      if (s.exists() && s.data().uid !== uid) throw Object.assign(new Error('This nickname is taken.'), { code: 'taken' });
      if (!s.exists()) tx.set(ref, { uid });
    }
    if (oldKey && oldKey !== key) tx.delete(doc(db, 'usernames', oldKey));
    tx.set(profileDoc(uid), { nickname: name || null, updatedAt: serverTimestamp() }, { merge: true });
  });
}

// Elimina account: tutti i mazzi, il nickname, poi il profilo.
export async function deleteUserData(uid) {
  const snap = await getDocs(decksCol(uid));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  const nick = (await getDoc(profileDoc(uid))).data()?.nickname;
  if (nick) await deleteDoc(doc(db, 'usernames', nicknameKey(nick)));
  await deleteDoc(profileDoc(uid));
}
