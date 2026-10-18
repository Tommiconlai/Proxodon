import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import ConfirmDialog from '../components/ConfirmDialog';
import CardSearch from './CardSearch';
import DeckSections from './DeckSections';
import {
  listenHelps, listenHelpFeed, createHelp, setHelpStatus, seeHelp, setApplied, deleteHelp, listenReplies,
  countReplies, countRepliesSince, replyHelp, deleteReply, listenReplied, deckOnce,
} from './deckStore';
import { cardsByIds } from './scryfallSearch';
import { useBackClose } from '../hooks/useBackClose';
import { useCount } from './useCount';
import {
  HELP_KINDS, MAX_HELP_CARDS, DRAG_ROWS, helpKindLabel, applySuggestion, revertSuggestion, snapshotFromCard, scryfallImg, artCrop, deckCover,
} from './deckModel';
import { timeAgo } from '../utils/timeAgo';
import { IconPlus, IconArrowLeft, IconTrash, IconCheck, IconX, IconLifebuoy, IconMerge } from '../components/icons';
import { navigate } from '../hooks/useHashRoute';

const ms = (t) => t?.toMillis?.() ?? 0;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const noop = () => {};
// Risposta applicata: uid di chi ha risposto @ ora della risposta. Se la risposta cambia (o è nuova, della stessa
// persona) il segno Applied sparisce: quello applicato era un'altra versione. ponytail: le chiavi delle versioni
// vecchie restano in applied (le regole ne tengono 200 per richiesta); se mai servisse, toglierle all'Apply.
const appliedKey = (r) => `${r.id}@${ms(r.at)}`;
const Spinner = () => <span className="import-spinner" role="status" aria-label="Loading" />;
// Carte del main, una per oracle id, per nome (le carte in focus della nuova richiesta).
const deckCards = (deck) => [...new Map(deck.cards.filter((r) => r.board === 'main').map((r) => [r.card.oid, r.card])).values()]
  .sort((a, b) => a.name.localeCompare(b.name));
// Mazzo di una richiesta per riquadri e feed: quello copiato sulla richiesta (deck: nome, firma, formato, copertina),
// o per le richieste di prima il mazzo pubblico letto (full, con le carte).
const coverOf = (info) => scryfallImg(info?.cards ? deckCover(info) : info?.cover || '');
const PLACEHOLDER = {
  cuts: 'I need to cut 5 cards. Which ones pull the least weight?',
  upgrades: 'What would you upgrade first, and with what?',
  budget: 'Cheaper cards that do the same job?',
  mana: 'Is the mana base right for these colors and this curve?',
  synergy: 'Which cards do not fit the plan, and what would?',
  other: 'What do you need help with?',
};

// Scheda Help della vista mazzo (editor: mine e update; Community). Solo mazzi pubblici. Le richieste del mazzo
// (una aperta alla volta, le risolte restano). Click: il proprietario la apre qui (HelpView, con Apply
// nell'editor), gli altri vanno alla sua pagina (#/help/:mazzo/:richiesta, HelpReply). Il proprietario ne chiede
// una nuova (+) se non ce n'è una aperta. ask = carte dal menu delle carte (Ask for help), consumate subito
// (onAsked): la nuova richiesta parte con quelle; con una richiesta già aperta resta un avviso. creating = la bozza
// ({ cards, kind, text }), che torna aperta se l'invio viene rifiutato.
export function DeckHelps({ deck, uid, mine, notify, update, ask, onAsked }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(() => (ask ? { cards: ask } : null));
  useBackClose(!!openId, () => setOpenId(null)); // back del sistema = torna all'elenco, non lascia il mazzo
  useEffect(() => { if (ask) onAsked?.(); }, [ask, onAsked]); // tornando sulla scheda non riparte
  const live = !!deck.public;
  useEffect(() => (live ? listenHelps(deck.id, (l) => { setList(l); setError(null); }, setError) : undefined), [deck.id, live]);

  if (!live) {
    return (
      <div className="deck-sections">
        <h3 className="deck-analysis-head">Help</h3>
        <p className="field-hint">Share this deck in Community (Public) to ask the community for help.</p>
      </div>
    );
  }
  const blocked = list?.some((h) => h.status === 'open');
  const open = mine && list?.find((h) => h.id === openId);
  if (open) {
    return <HelpView deck={deck} help={open} uid={uid} notify={notify} update={update} onBack={() => setOpenId(null)}
      canReopen={!list.some((h) => h.status === 'open' && h.id !== open.id)} />;
  }
  return (
    <div className="deck-sections">
      <div className="dilemma-head">
        <h3 className="deck-analysis-head">Help requests</h3>
      </div>
      {error && <p className="field-hint">Help requests are not available: {error.message}</p>}
      {!error && !list && <Spinner />}
      {list?.length === 0 && (
        <p className="field-hint help-intro">{mine ? 'Stuck on cuts, upgrades, budget or the mana base? Ask the community: players suggest cards to add and to cut, you apply them with one click.' : 'No help requests for this deck.'}</p>
      )}
      {mine && creating && blocked && (
        <p className="info-box help-blocked" role="status">
          <span>This deck already has an open request. Mark it solved to ask a new one.</span>
          <button type="button" className="modal-close" onClick={() => setCreating(null)} aria-label="Dismiss" title="Dismiss"><IconX size={16} /></button>
        </p>
      )}
      {list && (mine || list.length > 0) && (
        <ul className="help-list">
          {list.map((h) => (
            <HelpItem key={h.id} deckId={deck.id} info={deck} h={h} mine={mine}
              {...(mine ? { onClick: () => { setCreating(null); setOpenId(h.id); } } : { href: `#/help/${deck.id}/${h.id}` })} />
          ))}
          {/* Nuova richiesta: ultimo riquadro, solo senza una richiesta aperta. */}
          {mine && !blocked && (
            <li>
              <button type="button" className="help-card help-add" onClick={() => setCreating({ cards: [] })} aria-label="New help request" title="New help request">
                <IconPlus size={40} />
              </button>
            </li>
          )}
        </ul>
      )}
      {creating && list && !blocked && (
        <NewHelpDialog deck={deck} initial={creating} onClose={() => setCreating(null)}
          onSubmit={(draft) => {
            setCreating(null);
            createHelp(uid, deck, draft.kind, draft.text, draft.cards)
              .then(() => notify('Help request posted'))
              .catch((e) => { notify(`Could not post the request: ${e.message}`, 'error'); setCreating(draft); });
          }} />
      )}
    </div>
  );
}

// Risposte arrivate dopo l'ultima apertura del proprietario (seenAt), solo per lui e solo sulle aperte.
function useFresh(deckId, h, on) {
  const [n, setN] = useState(0);
  const since = ms(h.seenAt);
  const live = on && h.status === 'open';
  useEffect(() => {
    if (!live) return undefined;
    let alive = true;
    countRepliesSince(deckId, h.id, since).then((c) => { if (alive) setN(c); }).catch(() => {});
    return () => { alive = false; };
  }, [live, deckId, h.id, since]);
  return live ? n : 0;
}

// Riquadro di una richiesta: in alto l'arte (prima carta in focus, o la copertina del mazzo, caricata solo quando
// serve) con il tipo, le risposte e i segnali (Yours, Replied, N new, Solved); sotto la domanda, le carte in focus e
// meta (nel feed mazzo e autore, quando). L'etichetta letta dice anche mazzo, autore e carte. Link (href) o pulsante (onClick).
function HelpItem({ deckId, info, h, mine, flags = [], inFeed, href, onClick }) {
  const replies = useCount(countReplies, deckId, h.id);
  const fresh = useFresh(deckId, h, mine);
  const pic = (h.cards[0] && artCrop(h.cards[0])) || coverOf(info);
  const solved = h.status === 'solved';
  const Tag = href ? 'a' : 'button';
  const status = [...flags, fresh && `${fresh} new`, solved && 'solved'].filter(Boolean).join(', ');
  const by = inFeed && info ? `${info.name} by ${info.owner || 'anonymous'}` : ''; // solo nel feed: nella scheda del mazzo è ovvio
  const cards = h.cards.map((c) => c.name).join(', ');
  const stop = /[.?!]$/.test(h.text) ? '' : '.'; // niente "?." dopo una domanda
  return (
    <li>
      <Tag className={`help-card${solved ? ' solved' : ''}`} {...(href ? { href } : { type: 'button', onClick })}
        aria-label={`${helpKindLabel(h.kind)}: ${h.text}${stop}${by ? ` ${by}.` : ''}${cards ? ` Cards: ${cards}.` : ''} ${plural(replies, 'suggestion', 'suggestions')}${status ? `, ${status}` : ''}.`}>
        <span className="help-card-art" aria-hidden="true">
          {pic && <img className="help-card-img" src={pic} alt="" loading="lazy" decoding="async" />}
          <span className="help-kind">{helpKindLabel(h.kind)}</span>
          <span className="dilemma-flags">
            {flags.map((f) => <span key={f} className="dilemma-flag">{f}</span>)}
            {fresh > 0 && <span className="dilemma-flag voted">{fresh} new</span>}
            {solved && <span className="dilemma-flag solved">Solved</span>}
          </span>
          <span className="help-count"><IconLifebuoy size={12} /> {replies}</span>
        </span>
        <span className="help-card-text">{h.text}</span>
        {cards && <span className="help-card-cards">{h.cards.map((c) => c.name).join(' · ')}</span>}
        <span className="dilemma-tile-meta">{by && info && <><b>{info.name}</b> by {info.owner || 'anonymous'}, </>}{timeAgo(ms(h.createdAt))}</span>
      </Tag>
    </li>
  );
}

// Id {deck}_{help} delle richieste a cui l'account ha risposto; senza permesso o offline: nessuna.
function useReplied(uid) {
  const [replied, setReplied] = useState(() => new Set());
  useEffect(() => listenReplied(uid, setReplied, () => setReplied(new Set())), [uid]);
  return replied;
}

// Scheda Help della lista mazzi (#/help): le richieste aperte di tutti i mazzi pubblici, le proprie prima (Yours,
// portano al proprio mazzo, dove si applicano le risposte), filtrate da ricerca (domanda, tipo, carte, mazzo,
// autore) e formato (terms e format da DeckList). Le altre portano alla loro pagina (#/help/:mazzo/:richiesta).
// Mazzo: quello copiato sulla richiesta; solo per le richieste di prima si legge il mazzo pubblico (deckOnce, tutti
// insieme: un solo aggiornamento della lista), che se non c'è più (privato) le nasconde.
export function HelpFeed({ uid, terms = [], format = '' }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [decks, setDecks] = useState({}); // deckId -> mazzo pubblico | null, solo per le richieste senza deck
  const replied = useReplied(uid);
  useEffect(() => listenHelpFeed((l) => { setList(l); setError(null); }, setError), []);
  useEffect(() => {
    const ids = [...new Set((list || []).filter((h) => !h.deck).map((h) => h.deckId))];
    if (!ids.length) return undefined;
    let on = true;
    Promise.all(ids.map((id) => deckOnce(id))).then((xs) => {
      if (on) setDecks((m) => ({ ...m, ...Object.fromEntries(ids.map((id, i) => [id, xs[i]]).filter(([, x]) => x !== undefined)) }));
    });
    return () => { on = false; };
  }, [list]);
  if (error) return <p className="field-hint">Help requests are not available: {error.message}</p>;
  if (!list) return <Spinner />;
  const infoOf = (h) => h.deck || decks[h.deckId];
  const live = list.filter((h) => h.status === 'open' && infoOf(h) !== null);
  const shown = live.filter((h) => {
    const info = infoOf(h);
    if (format && info?.format !== format) return false;
    const text = [h.text, helpKindLabel(h.kind), ...h.cards.map((c) => c.name), info?.name, info?.owner].join(' ').toLowerCase();
    return terms.every((w) => text.includes(w));
  }).sort((a, b) => (b.uid === uid) - (a.uid === uid));
  if (!shown.length) {
    return (
      <div className="decks-empty">
        <p className="decks-empty-title">{live.length ? 'No help requests match' : 'No open help requests'}</p>
        <p className="field-hint">{live.length ? 'Try another search or format.' : 'Ask for help from the Help tab of a public deck, or from the menu of its cards.'}</p>
      </div>
    );
  }
  return (
    <ul className="help-list">
      {shown.map((h) => {
        const own = h.uid === uid;
        return (
          <HelpItem key={`${h.deckId}/${h.id}`} deckId={h.deckId} info={infoOf(h)} h={h} mine={own} inFeed
            flags={own ? ['Yours'] : replied.has(`${h.deckId}_${h.id}`) ? ['Replied'] : []}
            href={own ? `#/decks/${h.deckId}/help` : `#/help/${h.deckId}/${h.id}`} />
        );
      })}
    </ul>
  );
}

// La domanda nella testata del mazzo (pagina della richiesta, CommunityDeck): tipo, quando, testo, carte in focus.
export function HelpQuestion({ help }) {
  return (
    <div className="deck-hero-question">
      <p className="help-question-kind">
        <span className="help-kind">{helpKindLabel(help.kind)}</span>
        {help.status === 'solved' && <span className="dilemma-flag solved">Solved</span>}
        <span className="help-when">{timeAgo(ms(help.createdAt))}</span>
      </p>
      <p className="help-text">{help.text}</p>
      {help.cards.length > 0 && <CardChips cards={help.cards} label="Cards in focus" className="focus" />}
    </div>
  );
}

// Pagina della richiesta per chi aiuta (#/help/:mazzo/:richiesta, dentro CommunityDeck sotto la testata con la
// domanda): la propria risposta (ReplyDraft) con la lista del mazzo. Il proprietario qui trova solo il rimando al
// suo mazzo, dove legge e applica le risposte (niente ascolto delle risposte). Risposte illeggibili: un errore, non un
// modulo vuoto che sovrascriverebbe la propria risposta.
export function HelpReply({ deck, help, uid, notify, update, touch }) {
  const [replies, setReplies] = useState(null);
  const [error, setError] = useState(null);
  const own = help.uid === uid;
  useEffect(() => (own ? undefined : listenReplies(deck.id, help.id, (l) => { setReplies(l); setError(null); }, setError)), [deck.id, help.id, own]);
  if (own) {
    return (
      <>
        <div className="help-page">
          <p className="field-hint">This is your request. <a href={`#/decks/${deck.id}/help`}>Open it in your deck</a> to read the suggestions and apply them.</p>
        </div>
        <DeckSections deck={deck} update={update} touch={touch} readOnly tab="deck" onTab={noop} notify={notify} />
      </>
    );
  }
  if (error) return <div className="help-page"><p className="field-hint">Suggestions are not available: {error.message}</p></div>;
  if (!replies) return <div className="help-page"><Spinner /></div>;
  return (
    <ReplyDraft deck={deck} help={help} uid={uid} notify={notify} update={update} touch={touch}
      reply={replies.find((r) => r.id === uid)} others={replies.filter((r) => r.id !== uid)} />
  );
}

// Aggiunge carte (diverse, fino a MAX_HELP_CARDS) a una delle zone: → { next, added, dup, full }.
function addTo(list, cards) {
  const next = [...list];
  let dup = 0;
  let full = 0;
  for (const c of cards) {
    if (next.some((x) => x.oid === c.oid)) dup += 1;
    else if (next.length >= MAX_HELP_CARDS) full += 1;
    else next.push(c);
  }
  return { next, added: next.slice(list.length), dup, full };
}

// Esito di un'aggiunta a una zona: errori sempre, il successo solo se richiesto (dal menu; trascinando si vede la carta).
function report(notify, r, zone, sayOk) {
  if (r.full) notify(`${zone} is full: ${MAX_HELP_CARDS} cards at most`, 'error');
  else if (r.dup && !r.added.length) notify(r.dup === 1 ? `Already in ${zone}` : `Already in ${zone}: ${r.dup} cards`);
  else if (sayOk && r.added.length) notify(r.added.length === 1 ? `${r.added[0].name} added to ${zone}` : `${r.added.length} cards added to ${zone}`);
}

// Due zone affiancate, ferme in alto mentre si scorre la lista del mazzo (desktop): Cuts (carte trascinate dalla
// lista, o Suggest cut dal menu della carta, anche da tastiera e su telefono; solo main, mai il comandante) e
// Suggestions (ricerca Scryfall per nome, carte legali nel formato), fino a MAX_HELP_CARDS ciascuna; sotto la
// spiegazione facoltativa e l'invio, le altre risposte (chiuse in un details) e la lista del mazzo. Ogni aggiunta
// dal menu è annunciata in un toast; doppioni e zona piena sempre. Richiesta risolta: niente zone, le risposte restano.
function ReplyDraft({ deck, help, uid, reply, others, notify, update, touch }) {
  const open = help.status === 'open';
  const [text, setText] = useState(reply?.text || '');
  const [add, setAdd] = useState(reply?.add || []);
  const [cut, setCut] = useState(reply?.cut || []);
  const [over, setOver] = useState(false); // una carta trascinata sopra la zona Cuts
  const depth = useRef(0); // dragenter / dragleave annidati sui figli della zona (Safari non dà relatedTarget)
  const whyRef = useRef(null);
  const [confirm, setConfirm] = useState(false);
  const sig = (t, a, c) => JSON.stringify([t, a.map((x) => x.oid), c.map((x) => x.oid)]);
  const empty = !text.trim() && !add.length && !cut.length;
  const changed = sig(text.trim(), add, cut) !== sig(reply?.text || '', reply?.add || [], reply?.cut || []);
  const cutRows = useCallback((rows, sayOk) => {
    const ok = rows.filter((r) => r.board === 'main' && !r.commander);
    if (ok.length < rows.length) notify('Only cards of the main deck can be cut, not the commander', 'error');
    if (!ok.length) return;
    const r = addTo(cut, ok.map((x) => x.card));
    if (r.added.length) setCut(r.next);
    report(notify, r, 'Cuts', sayOk);
  }, [cut, notify]);
  const onCut = useCallback((rows) => cutRows(rows, true), [cutRows]);
  // Successi della ricerca muti (la carta non entra nel mazzo, va solo nella risposta), gli errori no.
  const quiet = useCallback((msg, kind) => { if (kind === 'error') notify(msg, kind); }, [notify]);
  const suggest = (card) => {
    const r = addTo(add, [card]);
    if (r.added.length) setAdd(r.next);
    report(notify, r, 'Suggestions', false);
  };
  const has = (e) => e.dataTransfer.types.includes(DRAG_ROWS);
  const drop = touch ? {} : {
    onDragEnter: (e) => { if (has(e)) { depth.current += 1; setOver(true); } },
    onDragOver: (e) => { if (has(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } },
    onDragLeave: (e) => { if (has(e) && --depth.current <= 0) { depth.current = 0; setOver(false); } },
    onDrop: (e) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      let ids = [];
      try { ids = JSON.parse(e.dataTransfer.getData(DRAG_ROWS) || '[]'); } catch { /* trascinamento estraneo */ }
      if (Array.isArray(ids)) cutRows(deck.cards.filter((r) => ids.includes(r.id)), false);
    },
  };
  const submit = () => {
    if (empty || !changed) return;
    if (!navigator.onLine) notify('Saved on this device: it will be sent when you are back online');
    replyHelp(uid, deck.id, help.id, { text: text.trim(), add, cut })
      .then(() => notify(reply ? 'Suggestion updated' : 'Suggestion sent'))
      .catch((err) => notify(`Could not send the suggestion: ${err.message}`, 'error'));
  };
  const drop1 = (set) => (i) => set((l) => l.filter((_, j) => j !== i));
  const shown = open ? others : [...(reply ? [reply] : []), ...others];
  // La lista del mazzo non si ridisegna a ogni tasto nella spiegazione (solo quando cambiano mazzo o tagli).
  const list = useMemo(() => (
    <DeckSections deck={deck} update={update} touch={touch} readOnly tab="deck" onTab={noop} notify={notify} onCut={open ? onCut : undefined} />
  ), [deck, update, touch, notify, open, onCut]);
  return (
    <>
      {/* Contenitore di zone e lista: le zone (sticky, desktop) restano in alto finché si scorre la lista del mazzo. */}
      <div className="help-reply-body">
        <div className="help-page">
          <div className="dilemma-head">
            <button type="button" className="btn-secondary deck-icon-btn" onClick={() => navigate('/help')} aria-label="All help requests" title="All help requests"><IconArrowLeft size={18} /></button>
            <h3 className="deck-analysis-head">{!open ? 'Solved' : reply ? 'Your suggestion' : 'Suggest changes'}</h3>
          </div>
          {!open && <p className="field-hint">This request is solved: no new suggestions.</p>}
        </div>
        {open && (
          <div className="help-zones-bar">
            <div className="help-zones">
              <section className={`help-zone cut${over ? ' over' : ''}`} aria-label="Cuts: cards to take out" tabIndex={-1} data-focus-zone {...drop}>
                <h4>Cuts <span className="n">{cut.length} of {MAX_HELP_CARDS}</span></h4>
                {cut.length > 0
                  ? <CardChips cards={cut} label="Cards to cut" sign="−" className="cut" onRemove={drop1(setCut)} />
                  : <p className="help-zone-hint">{touch ? 'Long press a card in the deck below, then Suggest cut.' : 'Drag cards here from the deck below, or open a card’s menu (right click or Shift+F10): Suggest cut.'}</p>}
              </section>
              <section className="help-zone add" aria-label="Suggestions: cards to add" tabIndex={-1} data-focus-zone>
                <h4>Suggestions <span className="n">{add.length} of {MAX_HELP_CARDS}</span></h4>
                <CardSearch format={deck.format} onAdd={suggest} notify={quiet} noAdvanced />
                {add.length > 0 && <CardChips cards={add} label="Cards to add" sign="+" className="add" onRemove={drop1(setAdd)} />}
              </section>
            </div>
          </div>
        )}
        <div className="help-page">
          {open && (
            <div className="help-why">
              <label className="field-label" htmlFor="help-why">Why? <span className="field-hint">Optional</span></label>
              <textarea id="help-why" ref={whyRef} className="import-link-input" value={text} maxLength={1000} rows={3}
                onChange={(e) => setText(e.target.value)} placeholder="What would these changes fix in the deck?" />
              <div className="help-why-actions">
                {reply && <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setConfirm(true)} aria-label="Delete your suggestion" title="Delete your suggestion"><IconTrash size={18} /></button>}
                <button type="button" className="btn-generate deck-icon-btn" onClick={submit} disabled={empty || !changed}
                  aria-label={reply ? 'Save suggestion' : 'Send suggestion'}
                  title={empty ? 'Pick cards to cut or suggest, or write why' : reply ? 'Save suggestion' : 'Send suggestion'}><IconCheck size={18} /></button>
              </div>
            </div>
          )}
          {shown.length > 0 && (
            <details className="help-others" open={!open}>
              <summary>{open ? 'Other suggestions' : 'Suggestions'} <span className="n">{shown.length}</span></summary>
              <ul>{shown.map((r) => <ReplyCard key={r.id} r={r} mine={r.id === uid} />)}</ul>
            </details>
          )}
        </div>
        {list}
      </div>
      <ConfirmDialog open={confirm} confirmLabel="Delete suggestion" message="Delete your suggestion?"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          // Il modulo riparte vuoto subito (lo snapshot senza la risposta arriva dopo) e il focus torna al testo.
          setText('');
          setAdd([]);
          setCut([]);
          requestAnimationFrame(() => whyRef.current?.focus());
          deleteReply(uid, deck.id, help.id, uid).then(() => notify('Suggestion deleted')).catch((e) => notify(`Could not delete the suggestion: ${e.message}`, 'error'));
        }} />
    </>
  );
}

// Carte delle aggiunte delle risposte lette da Scryfall (sid → carta): al proprietario si mostrano nome e arte veri,
// non quelli scritti da chi risponde (che potrebbero non corrispondere alla carta che Apply aggiunge).
// null finché non arrivano; Scryfall giù = mappa vuota (le carte risultano non verificate).
function useScryfallCards(replies) {
  const key = [...new Set((replies || []).flatMap((r) => r.add.map((c) => c.sid)))].sort().join(',');
  const [got, setGot] = useState({ key: '', map: new Map() });
  useEffect(() => {
    if (!key) return undefined;
    let on = true;
    cardsByIds(key.split(',')).then((map) => { if (on) setGot({ key, map }); }, () => { if (on) setGot({ key, map: new Map() }); });
    return () => { on = false; };
  }, [key]);
  return !key ? new Map() : got.key === key ? got.map : null;
}

// Richiesta aperta dal proprietario (scheda Help del suo mazzo): tipo, domanda, carte in focus, poi le risposte.
// Aprirla azzera le "new". Per ogni risposta: le carte da togliere con il nome della riga del mazzo (oid) e quelle da
// aggiungere con nome e arte di Scryfall (sid), segnate se non tornano; Apply (update, solo nell'editor: sul mazzo
// di quel momento, con Undo nel toast che annulla solo quei tagli e quelle aggiunte) e Delete. Solved la chiude e la
// riapre (non se un'altra richiesta è aperta, canReopen); Delete la cancella con le risposte.
function HelpView({ deck, help, uid, notify, update, onBack, canReopen }) {
  const [replies, setReplies] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'help' | uid della risposta da cancellare
  const [busy, setBusy] = useState(() => new Set()); // uid delle risposte in Apply
  const [seen] = useState(() => ms(help.seenAt)); // le "new" restano evidenziate finché la richiesta è aperta qui
  useEffect(() => listenReplies(deck.id, help.id, (l) => { setReplies(l); setError(null); }, setError), [deck.id, help.id]);
  useEffect(() => { seeHelp(deck.id, help.id).catch(() => {}); }, [deck.id, help.id]);
  const found = useScryfallCards(replies);
  const solved = help.status === 'solved';
  const writeError = (e) => notify(`Sync error: ${e.message}`, 'error');
  const inDeck = (c) => {
    const row = deck.cards.find((r) => r.board === 'main' && r.card.oid === c.oid);
    return row ? { ...c, name: row.card.name, img: row.card.img } : { ...c, off: 'not in this deck' };
  };
  const fromScryfall = (c) => {
    const s = found?.get(c.sid);
    if (s) { const snap = snapshotFromCard(s); return { ...c, name: snap.name, img: snap.img }; }
    return found ? { ...c, off: 'not found on Scryfall' } : c;
  };
  const view = (r) => ({ ...r, cut: r.cut.map(inDeck), add: r.add.map(fromScryfall) });
  const mark = (id, on) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const apply = async (r) => {
    mark(r.id, true);
    try {
      // Carte delle aggiunte da Scryfall: le risposte le scrive chiunque, nel mazzo entrano dati veri.
      const map = found && r.add.every((c) => found.has(c.sid)) ? found : await cardsByIds(r.add.map((c) => c.sid));
      const add = r.add.map((c) => map.get(c.sid)).filter(Boolean).map(snapshotFromCard);
      const cut = r.cut.map((c) => c.oid);
      // Sul mazzo di adesso (update chiama subito la funzione), non su quello di prima dell'attesa.
      let res = null;
      update((d) => { res = applySuggestion(d, add, cut); return res.deck; });
      if (!res) return; // editor chiuso nel frattempo
      const names = [...res.cut.map((x) => `−${x.card.name}`), ...res.added.map((c) => `+${c.name}`)];
      if (!names.length) { notify('Nothing to apply: these cards are already in or out of the deck'); return; }
      setApplied(deck.id, help.id, appliedKey(r), true).catch(writeError);
      const skipped = r.add.length + r.cut.length - names.length;
      notify(`Applied: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} more` : ''}${skipped ? `; ${skipped} skipped` : ''}`, 'success', {
        label: 'Undo',
        onClick: () => { update((d) => revertSuggestion(d, res)); setApplied(deck.id, help.id, appliedKey(r), false).catch(writeError); },
      });
    } catch (e) {
      notify(`Could not apply the suggestion: ${e.message}`, 'error');
    } finally {
      mark(r.id, false);
    }
  };
  const toggleSolved = () => {
    if (solved && !canReopen) { notify('Another request of this deck is open: mark it solved first', 'error'); return; }
    setHelpStatus(deck.id, help.id, solved ? 'open' : 'solved').then(() => notify(solved ? 'Request reopened' : 'Marked as solved')).catch(writeError);
  };
  const remove = () => {
    const what = confirm;
    setConfirm(null);
    if (what === 'help') {
      onBack();
      deleteHelp(deck.id, help.id).then(() => notify('Help request deleted')).catch((e) => notify(`Could not delete the request: ${e.message}`, 'error'));
    } else {
      deleteReply(uid, deck.id, help.id, what).then(() => notify('Suggestion deleted')).catch((e) => notify(`Could not delete the suggestion: ${e.message}`, 'error'));
    }
  };
  return (
    <div className="deck-sections help-view">
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={onBack} aria-label="All help requests" title="All help requests"><IconArrowLeft size={18} /></button>
        <h3 className="deck-analysis-head">Help request</h3>
        <button type="button" className={`${solved ? 'btn-secondary' : 'btn-add'} deck-icon-btn`} aria-pressed={solved} onClick={toggleSolved}
          aria-label="Solved" title={solved ? (canReopen ? 'Solved. Click to reopen it' : 'Solved. Another request is open') : 'Mark as solved: no new suggestions'}><IconCheck size={18} /></button>
        <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setConfirm('help')} aria-label="Delete request" title="Delete request"><IconTrash size={18} /></button>
      </div>
      <div className="help-question">
        <p className="help-question-kind">
          <span className="help-kind">{helpKindLabel(help.kind)}</span>
          {solved && <span className="dilemma-flag solved">Solved</span>}
          <span className="help-when">{timeAgo(ms(help.createdAt))}</span>
        </p>
        <p className="help-text">{help.text}</p>
        {help.cards.length > 0 && <CardChips cards={help.cards} label="Cards in focus" className="focus" />}
      </div>
      <section className="help-replies" aria-label="Suggestions">
        <h4>Suggestions <span className="n">{replies?.length ?? 0}</span></h4>
        {error && <p className="field-hint">Suggestions are not available: {error.message}</p>}
        {!error && !replies && <Spinner />}
        {replies?.length === 0 && <p className="field-hint">No suggestions yet. They show up here as players reply.</p>}
        {replies?.length > 0 && (
          <ul>
            {replies.map((r) => (
              <ReplyCard key={r.id} r={view(r)} fresh={!solved && ms(r.at) > seen} applied={help.applied.includes(appliedKey(r))}
                busy={busy.has(r.id)} onApply={update ? () => apply(r) : null} onDelete={() => setConfirm(r.id)} />
            ))}
          </ul>
        )}
        {!update && replies?.length > 0 && <p className="field-hint">Open <a href={`#/decks/${deck.id}/help`}>your deck</a> to apply suggestions.</p>}
      </section>
      <ConfirmDialog open={!!confirm} confirmLabel={confirm === 'help' ? 'Delete request' : 'Delete suggestion'}
        message={confirm === 'help' ? 'Delete this help request and its suggestions? This can’t be undone.' : 'Delete this suggestion?'}
        onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}

// Carte di una richiesta o di una risposta: miniatura dell'arte (solo Scryfall) e nome; sign = + / − davanti;
// off = la carta non torna (non è nel mazzo, Scryfall non la trova), segnata e spiegata nel title. onRemove(i) = ×
// per toglierla (nei moduli): il focus passa al × accanto o, se non ne restano, alla zona (data-focus-zone).
function CardChips({ cards, label, sign, className = '', onRemove }) {
  const ref = useRef(null);
  const remove = (i) => {
    const zone = ref.current?.closest('[data-focus-zone]');
    onRemove(i);
    requestAnimationFrame(() => {
      const btns = ref.current?.querySelectorAll('.help-chip-rm');
      (btns?.[i] || btns?.[i - 1] || zone?.querySelector('input, select') || zone)?.focus();
    });
  };
  return (
    <ul ref={ref} className={`help-chips ${className}`} aria-label={label}>
      {cards.map((c, i) => (
        <li key={c.oid || i} className={`help-chip${c.off ? ' off' : ''}`} title={c.off ? `${c.name}: ${c.off}` : c.name}>
          {sign && <span className="help-sign" aria-hidden="true">{sign}</span>}
          {artCrop(c) ? <img src={artCrop(c)} alt="" loading="lazy" /> : <span className="help-chip-ph" aria-hidden="true" />}
          <span className="help-chip-name">{c.name}{c.off && <span className="sr-only">, {c.off}</span>}</span>
          {onRemove && <button type="button" className="help-chip-rm" onClick={() => remove(i)} aria-label={`Remove ${c.name}`} title="Remove"><IconX size={12} /></button>}
        </li>
      ))}
    </ul>
  );
}

// Una risposta: chi (You per la propria), quando, segnali (New, Applied), Apply e Delete per il proprietario, la
// spiegazione, le carte da togliere (Out, magenta) e da aggiungere (In, ciano).
function ReplyCard({ r, mine, fresh, applied, busy, onApply, onDelete }) {
  return (
    <li className={`help-reply${fresh ? ' fresh' : ''}`}>
      <div className="help-reply-head">
        <span className="dilemma-reason-who">{mine ? 'You' : r.owner || 'anonymous'}</span>
        <span className="help-when">{timeAgo(ms(r.at))}</span>
        {fresh && <span className="dilemma-flag">New</span>}
        {applied && <span className="dilemma-flag voted">Applied</span>}
        <span className="help-reply-actions">
          {onApply && (r.add.length > 0 || r.cut.length > 0) && (
            <button type="button" className={`${applied ? 'btn-secondary' : 'btn-add'} deck-icon-btn`} onClick={onApply} disabled={busy}
              aria-label="Apply to deck" title={applied ? 'Applied. Apply it again' : 'Apply to deck: add and cut these cards'}><IconMerge size={16} /></button>
          )}
          {onDelete && <button type="button" className="btn-secondary deck-icon-btn" onClick={onDelete} aria-label="Delete suggestion" title="Delete suggestion"><IconTrash size={16} /></button>}
        </span>
      </div>
      {r.text && <p className="help-reply-text">{r.text}</p>}
      {(r.cut.length > 0 || r.add.length > 0) && (
        <div className="help-changes">
          {r.cut.length > 0 && <CardChips cards={r.cut} label="Cards to cut" sign="−" className="cut" />}
          {r.add.length > 0 && <CardChips cards={r.add} label="Cards to add" sign="+" className="add" />}
        </div>
      )}
    </li>
  );
}

// Nuova richiesta: il tipo, la domanda (1-500 caratteri) e fino a MAX_HELP_CARDS carte del mazzo in focus. initial =
// la bozza ({ cards } dal menu delle carte, o tutta quella di un invio rifiutato). La tendina resta attiva anche a
// 10 carte (disattivarla toglierebbe il focus): le scelte in più non entrano.
function NewHelpDialog({ deck, initial, onSubmit, onClose }) {
  const [kind, setKind] = useState(initial.kind || 'cuts');
  const [text, setText] = useState(initial.text || '');
  const [cards, setCards] = useState(() => [...new Map(initial.cards.map((c) => [c.oid, c])).values()].slice(0, MAX_HELP_CARDS));
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const own = deckCards(deck).filter((c) => !cards.some((x) => x.oid === c.oid));
  const pick = (oid) => { const c = own.find((x) => x.oid === oid); if (c && cards.length < MAX_HELP_CARDS) setCards([...cards, c]); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal dilemma-new help-new" ref={ref} role="dialog" aria-modal="true" aria-label="Ask for help"
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit({ kind, text: text.trim(), cards }); }}>
        <div className="modal-header">
          <h2>Ask for help</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={18} /></button>
        </div>
        <fieldset className="help-kinds">
          <legend className="field-label">What do you need?</legend>
          {HELP_KINDS.map(([k, label]) => (
            <label key={k} className={`help-kind-opt${kind === k ? ' on' : ''}`}>
              <input type="radio" name="help-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />{label}
            </label>
          ))}
        </fieldset>
        <label className="field-label" htmlFor="help-text">Question</label>
        <textarea id="help-text" className="import-link-input" value={text} maxLength={500} rows={4} autoFocus
          onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER[kind]} />
        <label className="field-label" htmlFor="help-cards">Cards in focus <span className="field-hint">Optional, {cards.length} of {MAX_HELP_CARDS}</span></label>
        <div data-focus-zone>
          <select id="help-cards" value="" onChange={(e) => pick(e.target.value)}>
            <option value="">{cards.length < MAX_HELP_CARDS ? 'Pick a card from the deck…' : `Up to ${MAX_HELP_CARDS} cards: remove one to pick another`}</option>
            {cards.length < MAX_HELP_CARDS && own.map((c) => <option key={c.oid} value={c.oid}>{c.name}</option>)}
          </select>
          {cards.length > 0 && <CardChips cards={cards} label="Cards in focus" className="focus" onRemove={(i) => setCards((l) => l.filter((_, j) => j !== i))} />}
        </div>
        <div className="modal-actions">
          <button type="submit" className="btn-generate deck-icon-btn" disabled={!text.trim()} aria-label="Post help request" title="Post help request"><IconCheck size={18} /></button>
        </div>
      </form>
    </div>
  );
}
