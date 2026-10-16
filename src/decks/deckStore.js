/**
 * Mazzi su Firestore: un documento per mazzo in users/{uid}/decks/{deckId}; quelli pubblici hanno anche
 * una copia in publicDecks/{deckId} (Community). Le scritture non vanno attese per aggiornare la UI:
 * offline restano in coda nella cache locale.
 */
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc, getDocs, writeBatch, runTransaction,
  query, where, orderBy, limit, getCountFromServer, collectionGroup,
} from 'firebase/firestore';
import { db } from './firebase';
import { searchTerms, contentSig, deckTags } from './deckModel';

const decksCol = (uid) => collection(db, 'users', uid, 'decks');
// serverTimestamps 'estimate': un mazzo appena scritto ha già una data (stimata) per l'ordinamento.
// sig mancante (mazzi di prima di changedAt): la firma delle carte appena lette fa da base, così il primo
// cambio vero si riconosce.
const fromDoc = (s) => {
  const d = { id: s.id, ...s.data({ serverTimestamps: 'estimate' }) };
  return d.sig || !Array.isArray(d.cards) ? d : { ...d, sig: contentSig(d.cards) };
};
const ms = (t) => t?.toMillis?.() ?? 0;
const payload = (d) => ({
  v: 1, name: d.name, format: d.format, groupBy: d.groupBy, sections: d.sections, cover: d.cover ?? null, cards: d.cards,
  tags: deckTags(d), public: !!d.public, updatedAt: serverTimestamp(),
});
// "Updated" (riquadri dei mazzi) = changedAt, che si sposta solo quando cambia contentSig (carte aggiunte, tolte, quantità,
// zone, sezioni, comandante). Nome, formato, raggruppamento, copertina, Public, cambi di edizione e
// riallineamenti da Scryfall toccano solo updatedAt (l'ultima scrittura). Senza cambi la chiave manca e col
// merge resta quella salvata; un mazzo di prima, senza changedAt, prende il suo updatedAt di allora.
const changes = (d) => {
  const sig = contentSig(d.cards);
  if (sig !== d.sig) return { sig, changedAt: serverTimestamp() };
  return d.changedAt || !d.updatedAt ? { sig } : { sig, changedAt: d.updatedAt };
};
export const changedMs = (d) => ms(d.changedAt ?? d.updatedAt);

// Community. La copia pubblica porta uid, la firma (owner: nickname del profilo, o null) e words: i
// prefissi delle parole del nome e dei tag (max 200, come le regole), fino a 20 lettere, per cercare con un array-contains senza indici.
const publicCol = collection(db, 'publicDecks');
// ponytail: nickname del profilo aperto (lo aggiorna listenProfile, attivo finché si è nell'area mazzi).
// undefined finché il profilo non è arrivato (o dopo una ricarica del modulo, in sviluppo).
let ownerName;
// Firma della copia: se ownerName non c'è ancora la legge dal profilo (prima la copia nasceva senza firma,
// "anonymous", per esempio pubblicando dal pannello New deck appena aperta la pagina). Profilo illeggibile
// (offline senza cache): undefined, e la copia tiene la firma che ha.
const ownerOf = async (uid) => {
  if (ownerName === undefined) ownerName = await getDoc(profileDoc(uid)).then((s) => s.data()?.nickname || null, () => undefined);
  return ownerName;
};
const searchWords = (name) => [...new Set(searchTerms(name)
  .flatMap((w) => Array.from({ length: Math.min(w.length, 20) }, (_, i) => w.slice(0, i + 1))))];
// changedAt sempre scritto (il nuovo o quello del mazzo). Merge solo per la firma: senza firma nota la copia
// tiene la sua; tutto il resto si riscrive comunque (gli array vengono sostituiti interi).
const publish = async (uid, d, f) => {
  const owner = await ownerOf(uid);
  return setDoc(doc(publicCol, d.id), {
    ...payload(d), ...f, changedAt: f.changedAt ?? d.changedAt ?? d.updatedAt ?? serverTimestamp(),
    uid, ...(owner !== undefined && { owner }), words: searchWords([d.name, ...deckTags(d)].join(' ')).slice(0, 200), createdAt: d.createdAt ?? serverTimestamp(),
  }, { merge: true });
};
export const unpublishDeck = (id) => deleteDoc(doc(publicCol, id));

// ponytail: ordinamento lato client (niente indice); legge i documenti interi, va bene per
// decine di mazzi. Se la lista rallenta: una collezione di riepiloghi.
export function listenDecks(uid, onChange, onError) {
  return onSnapshot(decksCol(uid), (qs) => onChange(qs.docs.map(fromDoc).sort((a, b) => changedMs(b) - changedMs(a))), onError);
}

export function listenDeck(uid, id, onChange, onError) {
  return onSnapshot(doc(decksCol(uid), id), { includeMetadataChanges: true },
    (s) => onChange(s.exists() ? fromDoc(s) : null, s.metadata.hasPendingWrites), onError);
}

// Nuovo mazzo; public (dal pannello New deck) scrive subito anche la copia in Community. folder = la
// cartella in cui nasce (aperta in My decks), fuori dal payload perché la copia pubblica non la porta.
export function createDeck(uid, deck) {
  const ref = doc(decksCol(uid));
  const f = changes(deck);
  const done = setDoc(ref, { ...payload(deck), ...f, folder: deck.folder ?? null, createdAt: serverTimestamp() });
  return { id: ref.id, done: deck.public ? Promise.all([done, publish(uid, { ...deck, id: ref.id }, f)]) : done };
}
// Cartelle di My decks: folder = { id, name } sul mazzo (solo quello privato), null = fuori. Una cartella
// esiste finché ha un mazzo; spostare o rinominare = riscrivere folder su quei mazzi, in un solo batch.
export function setDeckFolder(uid, ids, folder) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(decksCol(uid), id), { folder }));
  return batch.commit();
}

// merge: createdAt resta; gli array (cards, sections) vengono sostituiti interi. Pubblico: riscrive anche
// la copia, con una scrittura a parte (se le regole la rifiutano il mazzo resta salvato).
export const saveDeck = (uid, deck) => {
  const f = changes(deck);
  const done = setDoc(doc(decksCol(uid), deck.id), { ...payload(deck), ...f }, { merge: true });
  return deck.public ? Promise.all([done, publish(uid, deck, f)]) : done;
};
export const setDeckPublic = (uid, deck, on) => Promise.all([
  saveDeck(uid, { ...deck, public: on }), !on && unpublishDeck(deck.id),
]);

export const deleteDeck = (uid, deck) => Promise.all([
  deleteDoc(doc(decksCol(uid), deck.id)), deck.public && unpublishDeck(deck.id),
  deck.public && deleteDilemmasOf(deck.id).catch(() => {}), // pulizia: se fallisce il mazzo resta comunque eliminato
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

// Like: publicDecks/{id}/likes/{uid} = { at }. Niente contatore nel mazzo (lo riscriverebbe ogni
// salvataggio dell'autore): il numero è un conteggio sul server, una lettura per mazzo.
const likeDoc = (id, uid) => doc(publicCol, id, 'likes', uid);
export const countLikes = (id) => getCountFromServer(collection(publicCol, id, 'likes')).then((s) => s.data().count);
export const hasLiked = (id, uid) => getDoc(likeDoc(id, uid)).then((s) => s.exists());
export const setLiked = (id, uid, on) => (on ? setDoc(likeDoc(id, uid), { at: serverTimestamp() }) : deleteDoc(likeDoc(id, uid)));

// Dilemmi (solo mazzi pubblici): publicDecks/{deck}/dilemmas/{id} = { uid, question, cards: [2-4 carte], createdAt };
// voti in .../votes/{uid} = { pick: indice della carta (0-3), why, owner (nickname di chi vota), at }, uno per account, mai del
// proprietario. Ogni voto ha anche users/{uid}/answered/{deck}_{id} = { deck, dilemma, at }: il contatore
// del profilo e la cancellazione dei propri voti con l'account.
const plainDoc = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
const dilemmasCol = (deckId) => collection(publicCol, deckId, 'dilemmas');
const votesCol = (deckId, dId) => collection(dilemmasCol(deckId), dId, 'votes');
const answeredCol = (uid) => collection(db, 'users', uid, 'answered');
const dilemmaCard = (c) => ({ name: c.name, img: c.img || '', back: c.back || '', sid: c.sid, oid: c.oid, set: c.set || '', cn: c.cn || '' });
export const listenDilemmas = (deckId, onChange, onError) =>
  onSnapshot(query(dilemmasCol(deckId), orderBy('createdAt', 'desc')), (qs) => onChange(qs.docs.map(plainDoc)), onError);
// Feed della scheda Dilemmas: gli ultimi 40 di tutti i mazzi pubblici (collection group, serve l'indice
// collection group su createdAt). deckId = il mazzo pubblico genitore.
export const listenDilemmaFeed = (onChange, onError) =>
  onSnapshot(query(collectionGroup(db, 'dilemmas'), orderBy('createdAt', 'desc'), limit(40)),
    (qs) => onChange(qs.docs.map((s) => ({ ...plainDoc(s), deckId: s.ref.parent.parent.id }))), onError);
export const listenDilemma = (deckId, dId, onChange, onError) =>
  onSnapshot(doc(dilemmasCol(deckId), dId), (s) => onChange(s.exists() ? plainDoc(s) : null), onError);
export const getPublicDeck = (id) => getDoc(doc(publicCol, id)).then((s) => (s.exists() ? fromDoc(s) : null));
// Id {deck}_{dilemma} dei dilemmi a cui l'account ha risposto.
export const listenAnswered = (uid, onChange, onError) =>
  onSnapshot(answeredCol(uid), (qs) => onChange(new Set(qs.docs.map((d) => d.id))), onError);
export const createDilemma = (uid, deckId, question, cards) =>
  addDoc(dilemmasCol(deckId), { uid, question, cards: cards.map(dilemmaCard), createdAt: serverTimestamp() });
// Il proprietario cancella prima i voti, poi il dilemma (le regole glielo permettono).
export async function deleteDilemma(deckId, dId) {
  const votes = await getDocs(votesCol(deckId, dId));
  const batch = writeBatch(db);
  votes.docs.forEach((v) => batch.delete(v.ref));
  batch.delete(doc(dilemmasCol(deckId), dId));
  await batch.commit();
}
async function deleteDilemmasOf(deckId) {
  const list = await getDocs(dilemmasCol(deckId));
  await Promise.all(list.docs.map((d) => deleteDilemma(deckId, d.id)));
}
export const listenVotes = (deckId, dId, onChange, onError) => onSnapshot(votesCol(deckId, dId), (qs) => onChange(qs.docs.map(plainDoc)), onError);
export const countVotes = (deckId, dId) => getCountFromServer(votesCol(deckId, dId)).then((s) => s.data().count);
export function voteDilemma(uid, deckId, dId, pick) {
  const batch = writeBatch(db);
  batch.set(doc(votesCol(deckId, dId), uid), { pick, why: '', ...(ownerName ? { owner: ownerName } : {}), at: serverTimestamp() });
  batch.set(doc(answeredCol(uid), `${deckId}_${dId}`), { deck: deckId, dilemma: dId, at: serverTimestamp() });
  return batch.commit();
}
export const explainVote = (uid, deckId, dId, why) => updateDoc(doc(votesCol(deckId, dId), uid), { why });
export const countAnswered = (uid) => getCountFromServer(answeredCol(uid)).then((s) => s.data().count);

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

// Elimina account: i propri voti ai dilemmi (e le loro tracce), i dilemmi dei propri mazzi pubblici, tutti i
// mazzi con le copie pubbliche, il nickname, poi il profilo.
export async function deleteUserData(uid) {
  const answered = await getDocs(answeredCol(uid));
  await Promise.all(answered.docs.map((a) => {
    const { deck, dilemma } = a.data();
    const batch = writeBatch(db);
    batch.delete(doc(votesCol(deck, dilemma), uid));
    batch.delete(a.ref);
    return batch.commit();
  }));
  const snap = await getDocs(decksCol(uid));
  await Promise.all(snap.docs.filter((d) => d.data().public).map((d) => deleteDilemmasOf(d.id)));
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
