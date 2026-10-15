/**
 * Mazzi su Firestore: un documento per mazzo in users/{uid}/decks/{deckId}; quelli pubblici hanno anche
 * una copia in publicDecks/{deckId} (Community). Le scritture non vanno attese per aggiornare la UI:
 * offline restano in coda nella cache locale.
 */
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc, getDocs, writeBatch, runTransaction,
  query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { searchTerms } from './deckModel';

const decksCol = (uid) => collection(db, 'users', uid, 'decks');
// serverTimestamps 'estimate': un mazzo appena scritto ha già una data (stimata) per l'ordinamento.
const fromDoc = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
const ms = (t) => t?.toMillis?.() ?? 0;
const payload = (d) => ({
  v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cover: d.cover ?? null, cards: d.cards,
  public: !!d.public, updatedAt: serverTimestamp(),
});

// Community. La copia pubblica porta uid, la firma (owner: nickname del profilo, o null) e words: i
// prefissi delle parole del nome, fino a 20 lettere, per cercare con un array-contains senza indici.
const publicCol = collection(db, 'publicDecks');
// ponytail: nickname del profilo aperto (lo aggiorna listenProfile, attivo finché si è nell'area mazzi).
let ownerName = null;
const searchWords = (name) => [...new Set(searchTerms(name)
  .flatMap((w) => Array.from({ length: Math.min(w.length, 20) }, (_, i) => w.slice(0, i + 1))))];
const publish = (uid, d) => setDoc(doc(publicCol, d.id), {
  ...payload(d), uid, owner: ownerName, words: searchWords(d.name), createdAt: d.createdAt ?? serverTimestamp(),
});
export const unpublishDeck = (id) => deleteDoc(doc(publicCol, id));

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

// merge: createdAt resta; gli array (cards, sections) vengono sostituiti interi. Pubblico: riscrive anche
// la copia, con una scrittura a parte (se le regole la rifiutano il mazzo resta salvato).
export const saveDeck = (uid, deck) => {
  const done = setDoc(doc(decksCol(uid), deck.id), payload(deck), { merge: true });
  return deck.public ? Promise.all([done, publish(uid, deck)]) : done;
};
export const setDeckPublic = (uid, deck, on) => Promise.all([
  saveDeck(uid, { ...deck, public: on }), !on && unpublishDeck(deck.id),
]);

export const deleteDeck = (uid, deck) => Promise.all([
  deleteDoc(doc(decksCol(uid), deck.id)), deck.public && unpublishDeck(deck.id),
]);

// Gli ultimi creati, o quelli con una parola che inizia per word; i più recenti prima.
// ponytail: niente indici composti, quindi filtri e altre parole li applica la lista su questi 60.
// Se la community cresce: indici su format / words + createdAt e filtri nella query.
export function listenCommunity(word, onChange, onError) {
  const q = word ? query(publicCol, where('words', 'array-contains', word), limit(60))
    : query(publicCol, orderBy('createdAt', 'desc'), limit(60));
  return onSnapshot(q, (qs) => onChange(qs.docs.map(fromDoc).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))), onError);
}
export const listenPublicDeck = (id, onChange, onError) =>
  onSnapshot(doc(publicCol, id), (s) => onChange(s.exists() ? fromDoc(s) : null), onError);

// Profilo in users/{uid}: photo e banner (data URL), nickname (come scritto; il nome mostrato resta il
// displayName di Firebase Auth). followers / following arriveranno con i profili pubblici.
const profileDoc = (uid) => doc(db, 'users', uid);
export const listenProfile = (uid, onChange, onError) => onSnapshot(profileDoc(uid), (s) => {
  const p = s.exists() ? s.data() : null;
  ownerName = p?.nickname || null;
  onChange(p);
}, onError);
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
  // Firma nuova sui mazzi pubblici (il vecchio nome ora è libero). Non blocca il nickname: se fallisce,
  // ogni mazzo si rifirma al prossimo salvataggio.
  ownerName = name || null;
  getDocs(query(publicCol, where('uid', '==', uid)))
    .then((mine) => Promise.all(mine.docs.map((d) => updateDoc(d.ref, { owner: ownerName }))))
    .catch(() => {});
}

// Elimina account: tutti i mazzi con le copie pubbliche, il nickname, poi il profilo.
export async function deleteUserData(uid) {
  const snap = await getDocs(decksCol(uid));
  for (let i = 0; i < snap.docs.length; i += 200) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 200).forEach((d) => {
      batch.delete(d.ref);
      if (d.data().public) batch.delete(doc(publicCol, d.id));
    });
    await batch.commit();
  }
  const nick = (await getDoc(profileDoc(uid))).data()?.nickname;
  if (nick) await deleteDoc(doc(db, 'usernames', nicknameKey(nick)));
  await deleteDoc(profileDoc(uid));
}
