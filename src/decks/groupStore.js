/**
 * Liste di gruppo (My decks): groupLists/{id} = { owner, name, members, invite, joinKey?, deleted?, createdAt, updatedAt },
 * le carte in groupLists/{id}/cards/{rowId} = { uid, owner (nickname o null), card (le 7 chiavi di dilemmaCard), qty, at }.
 * Le leggono solo i membri; ognuno aggiunge carte e cambia o toglie solo le proprie; il creatore (owner) gestisce
 * nome, membri, link d'invito ed eliminazione (regole).
 */
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc, getDocs, writeBatch, query, where,
  orderBy, getCountFromServer, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import { ownerOf, nicknameKey, dilemmaCard } from './deckStore';
import { cleanCards } from './deckModel';

export const MAX_MEMBERS = 20;
export const MAX_GROUP_QTY = 99;
const listsCol = collection(db, 'groupLists');
const listDoc = (id) => doc(listsCol, id);
const cardsCol = (id) => collection(listDoc(id), 'cards');
const now = () => ({ updatedAt: serverTimestamp() });

// Letti dal server ma scritti da altri membri: ripuliti (nome corto, carte solo con immagini Scryfall).
const fromList = (s) => {
  const d = s.data({ serverTimestamps: 'estimate' });
  return {
    id: s.id, owner: String(d.owner || ''), name: String(d.name || '').slice(0, 80) || 'Group list',
    members: Array.isArray(d.members) ? d.members.filter((m) => typeof m === 'string') : [],
    invite: typeof d.invite === 'string' ? d.invite : null, deleted: d.deleted === true,
  };
};
const fromRow = (s) => {
  const d = s.data();
  const [card] = cleanCards([d.card], 1);
  return card ? {
    id: s.id, uid: String(d.uid || ''), owner: typeof d.owner === 'string' ? d.owner.slice(0, 24) : null,
    qty: Math.min(MAX_GROUP_QTY, Math.max(1, Math.trunc(d.qty) || 1)), card,
  } : null;
};

// Le liste di cui si è membri, per nome; quelle in eliminazione (deleted) non si vedono più.
export const listenGroupLists = (uid, onChange, onError) => onSnapshot(query(listsCol, where('members', 'array-contains', uid)),
  (qs) => onChange(qs.docs.map(fromList).filter((l) => !l.deleted).sort((a, b) => a.name.localeCompare(b.name))), onError);
// null = non c'è più (eliminata) o non se ne fa più parte.
export const listenGroupList = (id, onChange, onError) => onSnapshot(listDoc(id),
  (s) => { const l = s.exists() ? fromList(s) : null; onChange(l && !l.deleted ? l : null); }, onError);
export const listenGroupCards = (id, onChange, onError) => onSnapshot(query(cardsCol(id), orderBy('at')),
  (qs) => onChange(qs.docs.map(fromRow).filter(Boolean)), onError);
export const countGroupCards = (id) => getCountFromServer(cardsCol(id)).then((s) => s.data().count);

// L'id subito (la scrittura offline resta in coda); la pagina si apre a scrittura confermata (done).
export function createGroupList(uid, name) {
  const ref = doc(listsCol);
  return { id: ref.id, done: setDoc(ref, { owner: uid, name, members: [uid], invite: null, createdAt: serverTimestamp(), ...now() }) };
}
export const renameGroupList = (id, name) => updateDoc(listDoc(id), { name, ...now() });

// Invito per nickname: il nickname porta all'account (usernames/), che entra subito tra i membri.
export async function inviteToGroupList(list, nickname) {
  const s = await getDoc(doc(db, 'usernames', nicknameKey(nickname)));
  const uid = s.data()?.uid;
  if (!uid) throw new Error(`No player is called ${nickname}.`);
  if (list.members.includes(uid)) throw new Error(`${nickname} is already in this list.`);
  if (list.members.length >= MAX_MEMBERS) throw new Error(`A group list has at most ${MAX_MEMBERS} members.`);
  await updateDoc(listDoc(list.id), { members: arrayUnion(uid), ...now() });
}
export const removeFromGroupList = (id, uid) => updateDoc(listDoc(id), { members: arrayRemove(uid), ...now() });
// Link d'invito: un codice nuovo lo attiva (e ritira il vecchio), null lo spegne.
const code = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 32);
export const setGroupInvite = (id, on) => updateDoc(listDoc(id), { invite: on ? code() : null, ...now() });
export const inviteLink = (list) => `${location.origin}${location.pathname}#/decks/join/${list.id}/${list.invite}`;
// Col link: chi lo apre aggiunge solo sé stesso, con il codice (joinKey) che le regole confrontano con invite.
export const joinGroupList = (id, uid, key) => updateDoc(listDoc(id), { members: arrayUnion(uid), joinKey: key, ...now() });

// Le proprie carte di una lista (una lettura): per unirle a quelle che arrivano e per uscire.
const ownRows = (id, uid) => getDocs(query(cardsCol(id), where('uid', '==', uid))).then((qs) => qs.docs);
// Uscire: prima via le proprie carte (dopo non si potrebbero più leggere), poi sé stessi dai membri.
export async function leaveGroupList(id, uid) {
  const own = await ownRows(id, uid);
  await Promise.all(own.map((d) => deleteDoc(d.ref)));
  await removeFromGroupList(id, uid);
}
// Eliminare (solo il creatore): deleted, così i membri non la vedono più, poi tutte le carte, poi la lista.
export async function deleteGroupList(id) {
  await updateDoc(listDoc(id), { deleted: true, ...now() });
  const all = (await getDocs(cardsCol(id))).docs;
  for (let i = 0; i < all.length; i += 400) {
    const batch = writeBatch(db);
    all.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(listDoc(id));
}

// Carte aggiunte (dalla ricerca della lista o da To group list nei mazzi): items = [{ card: snapshot, qty }]. La stessa
// stampa già messa da chi aggiunge somma le copie sulla sua riga (al massimo MAX_GROUP_QTY), le altre fanno righe nuove
// firmate col nickname. Le righe degli altri non si toccano.
export async function addGroupCards(id, uid, items) {
  const [own, owner] = await Promise.all([ownRows(id, uid), ownerOf(uid)]);
  const bySid = new Map(own.map((d) => [d.data().card?.sid, d]));
  await Promise.all(items.map(({ card, qty }) => {
    const mine = bySid.get(card.sid);
    if (mine) return updateDoc(mine.ref, { qty: Math.min(MAX_GROUP_QTY, (Math.trunc(mine.data().qty) || 0) + qty) });
    return addDoc(cardsCol(id), { uid, owner: owner ?? null, card: dilemmaCard(card), qty: Math.min(MAX_GROUP_QTY, qty), at: serverTimestamp() });
  }));
}
export const setGroupQty = (id, rowId, qty) => updateDoc(doc(cardsCol(id), rowId), { qty });
// Cambio di edizione di una propria riga (stessa carta: le regole tengono l'oracle id). Se un'altra propria riga ha già
// quella stampa, le copie vanno lì (al massimo MAX_GROUP_QTY) e questa riga si toglie.
export async function setGroupEdition(id, row, card, rows) {
  const twin = rows.find((r) => r.id !== row.id && r.uid === row.uid && r.card.sid === card.sid);
  if (!twin) return updateDoc(doc(cardsCol(id), row.id), { card: dilemmaCard(card) });
  await updateDoc(doc(cardsCol(id), twin.id), { qty: Math.min(MAX_GROUP_QTY, twin.qty + row.qty) });
  return deleteDoc(doc(cardsCol(id), row.id));
}
export const removeGroupCard = (id, rowId) => deleteDoc(doc(cardsCol(id), rowId));

// Delete account: le liste create si eliminano, da quelle degli altri si esce (con le proprie carte).
// Regole di prima delle liste (lettura negata): non ce ne possono essere, non è un errore.
export async function deleteGroupData(uid) {
  const found = await getDocs(query(listsCol, where('members', 'array-contains', uid))).catch((e) => {
    if (e.code === 'permission-denied') return { docs: [] };
    throw e;
  });
  const lists = found.docs.map(fromList);
  await Promise.all(lists.map((l) => (l.owner === uid ? deleteGroupList(l.id) : leaveGroupList(l.id, uid))));
}
