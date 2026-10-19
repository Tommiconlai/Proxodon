/**
 * Mazzi su Firestore: un documento per mazzo in users/{uid}/decks/{deckId}; quelli pubblici hanno anche
 * una copia in publicDecks/{deckId} (Community). Le scritture non vanno attese per aggiornare la UI:
 * offline restano in coda nella cache locale.
 */
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc, getDocs, writeBatch, runTransaction,
  query, where, orderBy, limit, startAfter, getCountFromServer, collectionGroup, arrayUnion, arrayRemove, Timestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  searchTerms, contentSig, deckTags, deckCover, cleanCards, cleanHelp, cleanReply, cleanPublicDeck, cleanIndex, indexFields, rid,
} from './deckModel';

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
// Copia pubblica letta: la scrive chiunque abbia un account, quindi ripulita (cleanPublicDeck); null = ritirata o rotta.
const publicOf = (s) => cleanPublicDeck({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
// ponytail: nickname del profilo aperto (lo aggiorna listenProfile, attivo finché si è nell'area mazzi), di ownerUid
// (cambiando account si rilegge). undefined finché il profilo non è arrivato (o dopo una ricarica del modulo, in sviluppo).
let ownerName;
let ownerUid;
// Firma della copia: se ownerName non c'è ancora la legge dal profilo (prima la copia nasceva senza firma,
// "anonymous", per esempio pubblicando dal pannello New deck appena aperta la pagina). Profilo illeggibile
// (offline senza cache): undefined, e la copia tiene la firma che ha.
const ownerOf = async (uid) => {
  if (ownerName === undefined || ownerUid !== uid) {
    ownerUid = uid;
    ownerName = await getDoc(profileDoc(uid)).then((s) => s.data()?.nickname || null, () => undefined);
  }
  return ownerName;
};
const searchWords = (name) => [...new Set(searchTerms(name)
  .flatMap((w) => Array.from({ length: Math.min(w.length, 20) }, (_, i) => w.slice(0, i + 1))))];
// Indice leggero della Community: publicIndex/{id} (stesso id della copia) con quello che servono i riquadri e i filtri
// (nome, formato, firma, tag, words, identità, copertina, nomi delle carte), ogni campo con un tetto nelle regole.
// Il feed legge 60 voci piccole invece di 60 copie piene, le cui righe le regole non possono controllare.
const indexCol = collection(db, 'publicIndex');
const indexOf = (s) => cleanIndex({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
// Le regole dell'indice non ancora pubblicate (o mazzo appena tornato privato): permission-denied, la copia vale lo stesso.
const indexDenied = (e) => { if (e.code !== 'permission-denied') throw e; };
const writeIndex = (uid, d, owner, common) => setDoc(doc(indexCol, d.id), {
  uid, name: d.name, format: d.format, ...(owner !== undefined && { owner }), tags: deckTags(d), ...indexFields(d), ...common,
}, { merge: true }).catch(indexDenied);
const commonOf = (d, f = {}) => ({
  words: searchWords([d.name, ...deckTags(d)].join(' ')).slice(0, 200), createdAt: d.createdAt ?? serverTimestamp(),
  changedAt: f.changedAt ?? d.changedAt ?? d.updatedAt ?? serverTimestamp(),
});
// changedAt sempre scritto (il nuovo o quello del mazzo). Merge solo per la firma: senza firma nota la copia
// tiene la sua; tutto il resto si riscrive comunque (gli array vengono sostituiti interi). Poi l'indice: dopo la copia,
// perché le regole vogliono che la copia sia di chi lo scrive.
const publish = async (uid, d, f) => {
  const owner = await ownerOf(uid);
  const common = commonOf(d, f);
  await setDoc(doc(publicCol, d.id), { ...payload(d), ...f, uid, ...(owner !== undefined && { owner }), ...common }, { merge: true });
  return writeIndex(uid, d, owner, common);
};
// Mazzi pubblici di prima dell'indice: il proprietario aprendo My decks scrive la voce che manca (una lettura per mazzo
// pubblico, una volta per sessione). ponytail: i mazzi di chi non riapre l'app restano fuori dall'indice.
const indexed = new Set();
export function ensureIndexed(uid, decks) {
  decks.filter((d) => d.public && !indexed.has(d.id)).forEach((d) => {
    indexed.add(d.id);
    getDoc(doc(indexCol, d.id))
      .then(async (s) => { if (!s.exists()) await writeIndex(uid, d, await ownerOf(uid), commonOf(d)); })
      .catch(() => {}); // offline o regole vecchie: si riprova alla prossima sessione (non a ogni aggiornamento)
  });
}
// Fuori dalla Community: la copia diventa un segnaposto { uid } invece di sparire, così l'id resta di chi l'ha
// pubblicato (nessun altro può prenderlo, far vedere altro sotto il vecchio link o bloccare la cancellazione
// dell'account); via la voce dell'indice, dilemmi e help request (con voti e risposte) e like. Un errore nella pulizia
// arriva al chiamante (toast); il segnaposto è scritto comunque.
export const unpublishDeck = (uid, id) => Promise.all([
  setDoc(doc(publicCol, id), { uid }), deleteDoc(doc(indexCol, id)).catch(indexDenied),
  deleteDilemmasOf(id), deleteHelpsOf(id), deleteLikesOf(id),
]);

// ponytail: ordinamento lato client (niente indice); legge i documenti interi, va bene per
// decine di mazzi. Se la lista rallenta: una collezione di riepiloghi.
export function listenDecks(uid, onChange, onError) {
  return onSnapshot(decksCol(uid), (qs) => onChange(qs.docs.map(fromDoc).sort((a, b) => changedMs(b) - changedMs(a))), onError);
}

// fromCache: lo snapshot viene dalla cache locale e non è ancora confermato dal server (può essere vecchio).
export function listenDeck(uid, id, onChange, onError) {
  return onSnapshot(doc(decksCol(uid), id), { includeMetadataChanges: true },
    (s) => onChange(s.exists() ? fromDoc(s) : null, s.metadata.hasPendingWrites, s.metadata.fromCache), onError);
}

// Nuovo mazzo; public (dal pannello New deck) scrive subito anche la copia in Community. folder = la
// cartella in cui nasce (aperta in My decks), fuori dal payload perché la copia pubblica non la porta.
export function createDeck(uid, deck) {
  const ref = doc(decksCol(uid));
  const f = changes(deck);
  const done = setDoc(ref, { ...payload(deck), ...f, rev: 1, folder: deck.folder ?? null, createdAt: serverTimestamp() });
  return { id: ref.id, done: deck.public ? Promise.all([done, publish(uid, { ...deck, id: ref.id }, f)]) : done };
}
// Cartelle di My decks: folder = { id, name } sul mazzo (solo quello privato), null = fuori. Una cartella
// esiste finché ha un mazzo; spostare o rinominare = riscrivere folder su quei mazzi, in un solo batch.
export function setDeckFolder(uid, ids, folder) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(decksCol(uid), id), { folder, rev: increment(1) })); // la cartella non è un conflitto
  return batch.commit();
}

// merge: createdAt resta; gli array (cards, sections) vengono sostituiti interi. rev = revisione del mazzo letto + 1,
// ver = versione nuova (una per salvataggio), base = la ver del mazzo letto: le regole accettano solo la revisione
// successiva e base == ver salvata, così una copia vecchia (altro dispositivo, cache non aggiornata) non sovrascrive
// quella nuova: la scrittura è rifiutata e la cache torna alla versione del server. Con più salvataggi in coda
// (offline) cadono tutti: il secondo parte dalla ver del primo, che il server non ha mai avuto. Senza ver (app di
// prima, cartelle) conta solo rev. Pubblico: la copia si riscrive dopo, solo se il mazzo è stato accettato; un suo
// errore ha publish = true (non è un conflitto del mazzo).
export const saveDeck = (uid, deck, ver = rid()) => {
  const f = changes(deck);
  const done = setDoc(doc(decksCol(uid), deck.id),
    { ...payload(deck), ...f, rev: (deck.rev || 0) + 1, ver, base: deck.ver ?? null }, { merge: true });
  return deck.public ? done.then(() => publish(uid, deck, f).catch((e) => { e.publish = true; throw e; })) : done;
};
export const setDeckPublic = (uid, deck, on) => Promise.all([
  saveDeck(uid, { ...deck, public: on }), !on && unpublishDeck(uid, deck.id),
]);

// Pulizia anche per un mazzo già privato: dilemmi o richieste rimasti da prima (unpublishDeck non fallisce per una copia che non c'è).
export const deleteDeck = (uid, deck) => Promise.all([deleteDoc(doc(decksCol(uid), deck.id)), unpublishDeck(uid, deck.id)]);

// Gli ultimi creati, o quelli con una parola che inizia per word; i più recenti prima. Dall'indice; finché è vuoto o le
// sue regole non sono pubblicate (deciso una volta per sessione), dalle copie piene come prima.
// ponytail: niente indici composti, quindi filtri e altre parole li applica la lista su questi 60.
// Se la community cresce: indici su format / words + createdAt e filtri nella query.
let fromIndex;
export function listenCommunity(word, onChange, onError) {
  fromIndex ??= getDocs(query(indexCol, limit(1))).then((qs) => !qs.empty, () => false);
  let stop = false;
  let un = () => {};
  fromIndex.then((idx) => {
    if (stop) return;
    const col = idx ? indexCol : publicCol;
    const q = word ? query(col, where('words', 'array-contains', word), limit(60)) : query(col, orderBy('createdAt', 'desc'), limit(60));
    un = onSnapshot(q, (qs) => onChange(qs.docs.map(idx ? indexOf : publicOf).filter(Boolean)
      .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))), onError);
  });
  return () => { stop = true; un(); };
}
export const listenPublicDeck = (id, onChange, onError) =>
  onSnapshot(doc(publicCol, id), (s) => onChange(s.exists() ? publicOf(s) : null), onError);

// Like: publicDecks/{id}/likes/{uid} = { at }. Niente contatore nel mazzo (lo riscriverebbe ogni
// salvataggio dell'autore): il numero è un conteggio sul server, una lettura per mazzo. Ogni like ha la sua traccia
// users/{uid}/liked/{deck} = { at } (stesso batch), per toglierlo con l'account; il proprietario del mazzo li toglie
// quando lo ritira (deleteLikesOf).
const likeDoc = (id, uid) => doc(publicCol, id, 'likes', uid);
const likedCol = (uid) => collection(db, 'users', uid, 'liked');
async function deleteLikesOf(deckId) {
  const list = (await getDocs(collection(publicCol, deckId, 'likes'))).docs;
  for (let i = 0; i < list.length; i += 400) {
    const batch = writeBatch(db);
    list.slice(i, i + 400).forEach((l) => batch.delete(l.ref));
    await batch.commit();
  }
}
export const countLikes = (id) => getCountFromServer(collection(publicCol, id, 'likes')).then((s) => s.data().count);
export const hasLiked = (id, uid) => getDoc(likeDoc(id, uid)).then((s) => s.exists());
export function setLiked(id, uid, on) {
  const batch = writeBatch(db);
  if (on) {
    batch.set(likeDoc(id, uid), { at: serverTimestamp() });
    batch.set(doc(likedCol(uid), id), { at: serverTimestamp() });
  } else {
    batch.delete(likeDoc(id, uid));
    batch.delete(doc(likedCol(uid), id));
  }
  return batch.commit();
}

// Dilemmi (solo mazzi pubblici): publicDecks/{deck}/dilemmas/{id} = { uid, question, cards: [2-4 carte], createdAt };
// voti in .../votes/{uid} = { pick: indice della carta (0-3), why, owner (nickname di chi vota), at }, uno per account, mai del
// proprietario. Ogni voto ha anche users/{uid}/answered/{deck}_{id} = { deck, dilemma, at }: il contatore
// del profilo e la cancellazione dei propri voti con l'account.
const plainDoc = (s) => ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) });
const dilemmasCol = (deckId) => collection(publicCol, deckId, 'dilemmas');
const votesCol = (deckId, dId) => collection(dilemmasCol(deckId), dId, 'votes');
const answeredCol = (uid) => collection(db, 'users', uid, 'answered');
const dilemmaCard = (c) => ({ name: c.name, img: c.img || '', back: c.back || '', sid: c.sid, oid: c.oid, set: c.set || '', cn: c.cn || '' });
// Carte dei dilemmi ripulite come quelle delle help request (cleanCards); un dilemma con meno di 2 carte valide non si vede.
const cleanDilemma = (d) => ({ ...d, question: typeof d.question === 'string' ? d.question.slice(0, 280) : '', cards: cleanCards(d.cards, 4) });
const okDilemma = (d) => d.cards.length >= 2;
export const listenDilemmas = (deckId, onChange, onError) =>
  onSnapshot(query(dilemmasCol(deckId), orderBy('createdAt', 'desc')), (qs) => onChange(qs.docs.map((s) => cleanDilemma(plainDoc(s))).filter(okDilemma)), onError);
// Feed della scheda Dilemmas: gli ultimi 40 di tutti i mazzi pubblici (collection group, serve l'indice
// collection group su createdAt). deckId = il mazzo pubblico genitore.
export const listenDilemmaFeed = (onChange, onError) =>
  onSnapshot(query(collectionGroup(db, 'dilemmas'), orderBy('createdAt', 'desc'), limit(40)),
    (qs) => onChange(qs.docs.map((s) => ({ ...cleanDilemma(plainDoc(s)), deckId: s.ref.parent.parent.id })).filter(okDilemma)), onError);
export const listenDilemma = (deckId, dId, onChange, onError) => onSnapshot(doc(dilemmasCol(deckId), dId), (s) => {
  const d = s.exists() && cleanDilemma(plainDoc(s));
  onChange(d && okDilemma(d) ? d : null);
}, onError);
export const getPublicDeck = (id) => getDoc(doc(publicCol, id)).then((s) => (s.exists() ? publicOf(s) : null));
// Nome, formato e autore del mazzo pubblico per i feed (dilemmi, help request), letto una volta per mazzo. ponytail: cache
// per la sessione, un nome cambiato si vede ricaricando. null = mazzo non più pubblico; errore = undefined, resta "…"
// e non resta in cache (la chiamata dopo riprova).
const publicDecks = new Map();
export const deckOnce = (id) => {
  if (!publicDecks.has(id)) publicDecks.set(id, getPublicDeck(id).catch(() => { publicDecks.delete(id); return undefined; }));
  return publicDecks.get(id);
};
// Id {deck}_{dilemma} dei dilemmi a cui l'account ha risposto.
export const listenAnswered = (uid, onChange, onError) =>
  onSnapshot(answeredCol(uid), (qs) => onChange(new Set(qs.docs.map((d) => d.id))), onError);
export const createDilemma = (uid, deckId, question, cards) =>
  addDoc(dilemmasCol(deckId), { uid, question, cards: cards.map(dilemmaCard), createdAt: serverTimestamp() });
// Il proprietario cancella prima i voti (a gruppi: un batch arriva a 500 scritture), poi il dilemma (le regole glielo
// permettono). Un errore a metà lascia il dilemma con i voti rimasti: si riprova.
export async function deleteDilemma(deckId, dId) {
  const votes = (await getDocs(votesCol(deckId, dId))).docs;
  for (let i = 0; i < votes.length; i += 400) {
    const batch = writeBatch(db);
    votes.slice(i, i + 400).forEach((v) => batch.delete(v.ref));
    await batch.commit();
  }
  await deleteDoc(doc(dilemmasCol(deckId), dId));
}
async function deleteDilemmasOf(deckId) {
  const list = await getDocs(dilemmasCol(deckId));
  await Promise.all(list.docs.map((d) => deleteDilemma(deckId, d.id)));
}
export const listenVotes = (deckId, dId, onChange, onError) => onSnapshot(votesCol(deckId, dId), (qs) => onChange(qs.docs.map(plainDoc)), onError);
export const countVotes = (deckId, dId) => getCountFromServer(votesCol(deckId, dId)).then((s) => s.data().count);
export function voteDilemma(uid, deckId, dId, pick, why = '') {
  const batch = writeBatch(db);
  batch.set(doc(votesCol(deckId, dId), uid), { pick, why, ...(ownerName ? { owner: ownerName } : {}), at: serverTimestamp() });
  batch.set(doc(answeredCol(uid), `${deckId}_${dId}`), { deck: deckId, dilemma: dId, at: serverTimestamp() });
  return batch.commit();
}
export const explainVote = (uid, deckId, dId, why) => updateDoc(doc(votesCol(deckId, dId), uid), { why });
export const countAnswered = (uid) => getCountFromServer(answeredCol(uid)).then((s) => s.data().count);

// Help request (solo mazzi pubblici): publicDecks/{deck}/helps/{id} = { uid, kind, text, cards: [0-10 carte], status:
// 'open' | 'solved', applied: [uid delle risposte applicate], seenAt (ultima apertura del proprietario), createdAt };
// risposte in .../replies/{uid} = { text, add: [carte], cut: [carte], owner (nickname), at }, una per account, mai del
// proprietario. Ogni risposta ha users/{uid}/replied/{deck}_{id} = { deck, help, at }, per cancellarla con l'account.
const helpsCol = (deckId) => collection(publicCol, deckId, 'helps');
const repliesCol = (deckId, hId) => collection(helpsCol(deckId), hId, 'replies');
const repliedCol = (uid) => collection(db, 'users', uid, 'replied');
const helpOf = (s) => cleanHelp(plainDoc(s)); // dati ripuliti (cleanHelp, cleanReply): li scrive chiunque abbia un account
export const listenHelps = (deckId, onChange, onError) =>
  onSnapshot(query(helpsCol(deckId), orderBy('createdAt', 'desc')), (qs) => onChange(qs.docs.map(helpOf)), onError);
// Feed della scheda Help: le ultime 60 di tutti i mazzi pubblici (serve l'indice collection group su
// helps.createdAt, come per i dilemmi). ponytail: aperte / risolte le separa la lista.
export const listenHelpFeed = (onChange, onError) =>
  onSnapshot(query(collectionGroup(db, 'helps'), orderBy('createdAt', 'desc'), limit(60)),
    (qs) => onChange(qs.docs.map((s) => ({ ...helpOf(s), deckId: s.ref.parent.parent.id }))), onError);
// Richieste aperte del mazzo (chiave inglese sui riquadri dei mazzi), un conteggio sul server per riquadro come i like.
export const countOpenHelps = (deckId) =>
  getCountFromServer(query(helpsCol(deckId), where('status', '==', 'open'))).then((s) => s.data().count);
export const listenHelp = (deckId, id, onChange, onError) =>
  onSnapshot(doc(helpsCol(deckId), id), (s) => onChange(s.exists() ? helpOf(s) : null), onError);
// deck = il mazzo com'è adesso: nome, firma, formato e copertina restano sulla richiesta per il feed (ponytail: un
// nome cambiato dopo non si aggiorna lì; la pagina della richiesta legge il mazzo vero).
export async function createHelp(uid, deck, kind, text, cards) {
  const owner = await ownerOf(uid);
  return addDoc(helpsCol(deck.id), {
    uid, kind, text, cards: cards.map(dilemmaCard), status: 'open', applied: [], seenAt: serverTimestamp(), createdAt: serverTimestamp(),
    deck: { name: deck.name.slice(0, 80), owner: owner || null, format: deck.format, cover: deckCover(deck) },
  });
}
// Solo il proprietario: aperta / risolta, l'ha appena aperta (le risposte "new" ripartono da qui), una risposta
// applicata al mazzo o no (Undo); key = uid@ora della risposta (appliedKey in HelpRequests), così vale per quella versione.
const helpDoc = (deckId, id) => doc(helpsCol(deckId), id);
export const setHelpStatus = (deckId, id, status) => updateDoc(helpDoc(deckId, id), { status });
export const seeHelp = (deckId, id) => updateDoc(helpDoc(deckId, id), { seenAt: serverTimestamp() });
export const setApplied = (deckId, id, key, on) => updateDoc(helpDoc(deckId, id), { applied: on ? arrayUnion(key) : arrayRemove(key) });
// Id {deck}_{help} delle richieste a cui l'account ha risposto.
export const listenReplied = (uid, onChange, onError) =>
  onSnapshot(repliedCol(uid), (qs) => onChange(new Set(qs.docs.map((d) => d.id))), onError);
// Prima le risposte (a gruppi: un batch arriva a 500 scritture), poi la richiesta.
export async function deleteHelp(deckId, id) {
  const replies = (await getDocs(repliesCol(deckId, id))).docs;
  for (let i = 0; i < replies.length; i += 400) {
    const batch = writeBatch(db);
    replies.slice(i, i + 400).forEach((r) => batch.delete(r.ref));
    await batch.commit();
  }
  await deleteDoc(doc(helpsCol(deckId), id));
}
async function deleteHelpsOf(deckId) {
  const list = await getDocs(helpsCol(deckId));
  await Promise.all(list.docs.map((h) => deleteHelp(deckId, h.id)));
}
export const listenReplies = (deckId, hId, onChange, onError) =>
  onSnapshot(query(repliesCol(deckId, hId), orderBy('at', 'desc')), (qs) => onChange(qs.docs.map((s) => cleanReply(plainDoc(s)))), onError);
export const countReplies = (deckId, hId) => getCountFromServer(repliesCol(deckId, hId)).then((s) => s.data().count);
// Risposte arrivate dopo since (ms): le "new" del proprietario.
export const countRepliesSince = (deckId, hId, since) =>
  getCountFromServer(query(repliesCol(deckId, hId), where('at', '>', Timestamp.fromMillis(since)))).then((s) => s.data().count);
// Scrive (o riscrive) la risposta dell'account, con la firma attuale.
export async function replyHelp(uid, deckId, hId, { text, add, cut }) {
  const owner = await ownerOf(uid);
  const batch = writeBatch(db);
  batch.set(doc(repliesCol(deckId, hId), uid), {
    text, add: add.map(dilemmaCard), cut: cut.map(dilemmaCard), ...(owner && { owner }), at: serverTimestamp(),
  });
  batch.set(doc(repliedCol(uid), `${deckId}_${hId}`), { deck: deckId, help: hId, at: serverTimestamp() });
  return batch.commit();
}
// La propria (con la traccia) o, per il proprietario della richiesta, quella di un altro.
export function deleteReply(uid, deckId, hId, rUid) {
  const batch = writeBatch(db);
  batch.delete(doc(repliesCol(deckId, hId), rUid));
  if (rUid === uid) batch.delete(doc(repliedCol(uid), `${deckId}_${hId}`));
  return batch.commit();
}

// Profilo in users/{uid}: photo e banner (data URL), nickname (come scritto; il nome mostrato resta il
// displayName di Firebase Auth). followers / following arriveranno con i profili pubblici.
const profileDoc = (uid) => doc(db, 'users', uid);
export const listenProfile = (uid, onChange, onError) => onSnapshot(profileDoc(uid), (s) => {
  const p = s.exists() ? s.data() : null;
  ownerName = p?.nickname || null;
  ownerUid = uid;
  onChange(p);
}, onError);
// fields: { photo } o { banner }; null = rimuovi.
export const saveProfile = (uid, fields) =>
  setDoc(profileDoc(uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });

// Nickname unici: usernames/{nome in minuscolo} = { uid }. In una transazione: se il nome è di un
// altro errore 'taken', altrimenti lo prende, libera il vecchio e lo scrive nel profilo (le regole
// controllano che i due documenti corrispondano). name vuoto = nessun nickname.
export const nicknameKey = (name) => name.toLowerCase();
// Riservati anche dalle regole (usernames/): qui solo per dire "taken" invece di un errore di permessi.
const RESERVED = ['admin', 'administrator', 'proxodon', 'proxoteca', 'moderator', 'support', 'staff', 'official', 'system'];
export async function claimNickname(uid, name, old) {
  const key = name && nicknameKey(name);
  const oldKey = old && nicknameKey(old);
  if (RESERVED.includes(key)) throw Object.assign(new Error('This nickname is taken.'), { code: 'taken' });
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
  ownerUid = uid;
  getDocs(query(publicCol, where('uid', '==', uid)))
    .then((mine) => Promise.all(mine.docs.filter((d) => Array.isArray(d.data().cards)).map((d) => updateDoc(d.ref, { owner: ownerName }))))
    .catch(() => {});
  getDocs(query(indexCol, where('uid', '==', uid))) // e le voci dell'indice
    .then((mine) => Promise.all(mine.docs.map((d) => updateDoc(d.ref, { owner: ownerName }))))
    .catch(() => {});
}

// Elimina account: i propri voti ai dilemmi, le risposte alle help request e i like (con le loro tracce), le copie
// pubbliche (anche ritirate o senza più il mazzo privato: le trova la query per uid) con i loro dilemmi, richieste e
// like, i mazzi, il nickname, poi il profilo. Un passo che fallisce non ferma gli altri; alla fine il primo errore,
// così chi chiama non cancella l'account Auth e si può riprovare (i passi si ripetono senza danni).
export async function deleteUserData(uid) {
  const errors = [];
  const settle = async (list) => (await Promise.allSettled(list)).forEach((r) => r.status === 'rejected' && errors.push(r.reason));
  const docsOf = (ref) => getDocs(ref).then((qs) => qs.docs, (e) => { errors.push(e); return []; });
  const pair = (a, b) => { const batch = writeBatch(db); batch.delete(a); batch.delete(b); return batch.commit(); };
  await settle((await docsOf(answeredCol(uid))).map((a) => pair(doc(votesCol(a.data().deck, a.data().dilemma), uid), a.ref)));
  await settle((await docsOf(repliedCol(uid))).map((r) => deleteReply(uid, r.data().deck, r.data().help, uid)));
  await settle((await docsOf(likedCol(uid))).map((l) => pair(likeDoc(l.id, uid), l.ref)));
  // Like di prima delle tracce (senza users/{uid}/liked): si tolgono a tappeto da ogni copia pubblica, 60 alla volta.
  // ponytail: una scrittura per copia pubblica, va bene finché la Community è piccola.
  for (let page = await docsOf(query(publicCol, orderBy('createdAt'), limit(60))); page.length;) {
    const batch = writeBatch(db);
    page.forEach((p) => batch.delete(likeDoc(p.id, uid)));
    await settle([batch.commit()]);
    page = page.length < 60 ? [] : await docsOf(query(publicCol, orderBy('createdAt'), startAfter(page.at(-1)), limit(60)));
  }
  // Voci dell'indice della Community (regole vecchie: l'elenco è negato e non c'è niente da cancellare).
  await settle((await getDocs(query(indexCol, where('uid', '==', uid))).then((qs) => qs.docs, () => []))
    .map((i) => deleteDoc(i.ref)));
  const [mine, decks] = await Promise.all([docsOf(query(publicCol, where('uid', '==', uid))), docsOf(decksCol(uid))]);
  // Copie proprie: prima dilemmi, richieste e like, poi la copia (se la pulizia fallisce resta, e si ritrova riprovando).
  await settle(mine.map((p) => Promise.all([deleteDilemmasOf(p.id), deleteHelpsOf(p.id), deleteLikesOf(p.id)]).then(() => deleteDoc(p.ref))));
  // Mazzi privati senza copia: dilemmi o richieste rimasti da prima dei segnaposto, al meglio.
  const pub = new Set(mine.map((p) => p.id));
  await Promise.allSettled(decks.filter((d) => !pub.has(d.id)).flatMap((d) => [deleteDilemmasOf(d.id), deleteHelpsOf(d.id)]));
  const batches = [];
  for (let i = 0; i < decks.length; i += 400) {
    const batch = writeBatch(db);
    decks.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    batches.push(batch.commit());
  }
  await settle(batches);
  await settle([getDoc(profileDoc(uid)).then((s) => {
    const nick = s.data()?.nickname;
    const batch = writeBatch(db);
    if (nick) batch.delete(doc(db, 'usernames', nicknameKey(nick)));
    batch.delete(profileDoc(uid));
    return batch.commit();
  })]);
  if (errors.length) throw errors[0];
}
