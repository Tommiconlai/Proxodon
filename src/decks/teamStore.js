/**
 * Team Trios (My decks, con le liste di gruppo): teams/{id} = { owner (il team leader), name, members (al massimo 3),
 * slots: i tre posti mazzo, ognuno l'uid di un membro o null (il posto 0 è del leader), deleted?, createdAt, updatedAt }.
 * I mazzi in teams/{id}/decks/{0|1|2}: documenti come i mazzi personali (deckStore, useDeck, rev e ver), mai pubblici.
 * Li leggono i membri; il leader cambia squadra e mazzi, un giocatore solo il mazzo del suo posto (regole).
 */
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc, getDocs, query, where, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import { createDeck, nicknameKey } from './deckStore';
import { teamCopy } from './deckModel';

export const SLOTS = ['0', '1', '2'];
const teamsCol = collection(db, 'teams');
const teamDoc = (id) => doc(teamsCol, id);
const now = () => ({ updatedAt: serverTimestamp() });
// Mazzi di una squadra: sempre la stessa collezione per id (useDeck la tiene tra le dipendenze del suo effetto).
const decksOf = new Map();
export const teamDecks = (id) => decksOf.get(id) || decksOf.set(id, collection(teamDoc(id), 'decks')).get(id);

// Scritta anche da altri: ripulita (nome corto, posti uid o null).
const fromTeam = (s) => {
  const d = s.data({ serverTimestamps: 'estimate' });
  return {
    id: s.id, owner: String(d.owner || ''), name: String(d.name || '').slice(0, 80) || 'Team',
    members: Array.isArray(d.members) ? d.members.filter((m) => typeof m === 'string') : [],
    slots: SLOTS.map((_, i) => (typeof d.slots?.[i] === 'string' ? d.slots[i] : null)), deleted: d.deleted === true,
  };
};

// Le squadre di cui si è membri, per nome; quelle in eliminazione (deleted) non si vedono più.
export const listenTeams = (uid, onChange, onError) => onSnapshot(query(teamsCol, where('members', 'array-contains', uid)),
  (qs) => onChange(qs.docs.map(fromTeam).filter((t) => !t.deleted).sort((a, b) => a.name.localeCompare(b.name))), onError);
// null = non c'è più (eliminata). Chi non ne fa più parte riceve un errore di permessi.
export const listenTeam = (id, onChange, onError) => onSnapshot(teamDoc(id),
  (s) => { const t = s.exists() ? fromTeam(s) : null; onChange(t && !t.deleted ? t : null); }, onError);

// L'id subito (la scrittura offline resta in coda), col leader nel posto 0; la pagina si apre a scrittura confermata (done).
export function createTeam(uid, name) {
  const ref = doc(teamsCol);
  return { id: ref.id, done: setDoc(ref, { owner: uid, name, members: [uid], slots: [uid, null, null], createdAt: serverTimestamp(), ...now() }) };
}
export const renameTeam = (id, name) => updateDoc(teamDoc(id), { name, ...now() });

// Il leader dà il posto libero i a un giocatore, per nickname: entra tra i membri e nel posto insieme.
export async function assignPlayer(team, i, nickname) {
  const s = await getDoc(doc(db, 'usernames', nicknameKey(nickname)));
  const uid = s.data()?.uid;
  if (!uid) throw new Error(`No player is called ${nickname}.`);
  if (team.members.includes(uid)) throw new Error(`${nickname} is already in this team.`);
  await updateDoc(teamDoc(team.id), { members: arrayUnion(uid), slots: team.slots.map((u, j) => (j === i ? uid : u)), ...now() });
}
// Fuori dalla squadra (tolto dal leader o uscito da sé): via dai membri e dal posto; il mazzo resta, lo controlla il leader.
export const removePlayer = (team, uid) => updateDoc(teamDoc(team.id), {
  members: arrayRemove(uid), slots: team.slots.map((u) => (u === uid ? null : u)), ...now(),
});
// Eliminare (solo il leader): deleted, così i membri non la vedono più, poi i mazzi, poi la squadra.
export async function deleteTeam(id) {
  await updateDoc(teamDoc(id), { deleted: true, ...now() });
  await Promise.all(SLOTS.map((s) => deleteDoc(doc(teamDecks(id), s))));
  await deleteDoc(teamDoc(id));
}

// Mazzo di un posto (teamCopy: nuovo o copia di uno dei propri).
export const createSlotDeck = (teamId, slot, deck) => createDeck(teamDecks(teamId), teamCopy(deck), slot);
export const deleteSlotDeck = (teamId, slot) => deleteDoc(doc(teamDecks(teamId), slot));

// Delete account: le squadre guidate si eliminano (con i mazzi), da quelle degli altri si esce (il mazzo resta).
// Regole di prima delle squadre (lettura negata): non ce ne possono essere, non è un errore.
export async function deleteTeamData(uid) {
  const found = await getDocs(query(teamsCol, where('members', 'array-contains', uid))).catch((e) => {
    if (e.code === 'permission-denied') return { docs: [] };
    throw e;
  });
  await Promise.all(found.docs.map(fromTeam).map((t) => (t.owner === uid ? deleteTeam(t.id) : removePlayer(t, uid))));
}
