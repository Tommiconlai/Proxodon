/**
 * Mazzi su Firestore: un documento per mazzo in users/{uid}/decks/{deckId}. Le scritture non
 * vanno attese per aggiornare la UI: offline restano in coda nella cache locale.
 */
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const decksCol = (uid) => collection(db, 'users', uid, 'decks');
// serverTimestamps 'estimate': un mazzo appena scritto ha già una data (stimata) per l'ordinamento.
const fromDoc = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
const ms = (t) => t?.toMillis?.() ?? 0;
const payload = (d) => ({
  v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cards: d.cards,
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

export async function deleteAllDecks(uid) {
  const snap = await getDocs(decksCol(uid));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
