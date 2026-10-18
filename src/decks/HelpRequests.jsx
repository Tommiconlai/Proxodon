import { useEffect, useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import ConfirmDialog from '../components/ConfirmDialog';
import CardSearch from './CardSearch';
import {
  listenHelps, listenHelpFeed, listenHelp, createHelp, setHelpStatus, seeHelp, setApplied, deleteHelp, listenReplies,
  countReplies, countRepliesSince, replyHelp, deleteReply, listenReplied, listenPublicDeck, deckOnce,
} from './deckStore';
import { cardsByIds } from './scryfallSearch';
import { navigate } from '../hooks/useHashRoute';
import { useBackClose } from '../hooks/useBackClose';
import { useCount } from './useCount';
import { DeckListText } from './Dilemmas';
import {
  HELP_KINDS, MAX_HELP_CARDS, helpKindLabel, applySuggestion, snapshotFromCard, scryfallImg, artCrop, deckCover,
} from './deckModel';
import { timeAgo } from '../utils/timeAgo';
import { IconPlus, IconArrowLeft, IconTrash, IconCheck, IconX, IconLifebuoy, IconMerge } from '../components/icons';

const ms = (t) => t?.toMillis?.() ?? 0;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Carte del main (una per oracle id, per nome); noCmdr = senza il comandante (le carte da tagliare).
const deckCards = (deck, noCmdr) => [...new Map(deck.cards.filter((r) => r.board === 'main' && !(noCmdr && r.commander))
  .map((r) => [r.card.oid, r.card])).values()].sort((a, b) => a.name.localeCompare(b.name));
const PLACEHOLDER = {
  cuts: 'I need to cut 5 cards. Which ones pull the least weight?',
  upgrades: 'What would you upgrade first, and with what?',
  budget: 'Cheaper cards that do the same job?',
  mana: 'Is the mana base right for these colors and this curve?',
  synergy: 'Which cards do not fit the plan, and what would?',
  other: 'What do you need help with?',
};

// Scheda Help della vista mazzo (editor: mine e update; Community). Solo mazzi pubblici. Le richieste del mazzo
// (una aperta alla volta, le risolte restano), click = la richiesta aperta (HelpView); il proprietario ne
// chiede una nuova (+) se non ce n'è una aperta. ask = carte dal menu delle carte (Ask for help): all'apertura
// c'è già la nuova richiesta con quelle; con una richiesta già aperta resta un avviso finché non la risolve.
export function DeckHelps({ deck, uid, mine, notify, update, ask, onAsked }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(ask ?? null); // carte della nuova richiesta, null = chiusa
  useBackClose(!!openId, () => setOpenId(null)); // back del sistema = torna all'elenco, non lascia il mazzo
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
  const stopCreating = () => { setCreating(null); onAsked?.(); };
  const blocked = list?.some((h) => h.status === 'open');
  const open = list?.find((h) => h.id === openId);
  if (open) return <HelpView deck={deck} help={open} uid={uid} mine={mine} notify={notify} update={update} onBack={() => setOpenId(null)} />;
  return (
    <div className="deck-sections">
      <div className="dilemma-head">
        <h3 className="deck-analysis-head">Help requests</h3>
      </div>
      {error && <p className="field-hint">Help requests are not available: {error.message}</p>}
      {!error && !list && <span className="import-spinner" aria-label="Loading" />}
      {list?.length === 0 && (
        <p className="field-hint help-intro">{mine ? 'Stuck on cuts, upgrades, budget or the mana base? Ask the community: players suggest cards to add and to cut, you apply them with one click.' : 'No help requests for this deck.'}</p>
      )}
      {mine && creating && blocked && (
        <p className="info-box help-blocked" role="status">
          <span>This deck already has an open request. Mark it solved to ask a new one.</span>
          <button type="button" className="modal-close" onClick={stopCreating} aria-label="Dismiss" title="Dismiss"><IconX size={16} /></button>
        </p>
      )}
      {list && (mine || list.length > 0) && (
        <ul className="help-list">
          {list.map((h) => <HelpItem key={h.id} deckId={deck.id} deck={deck} h={h} mine={mine} onClick={() => setOpenId(h.id)} />)}
          {/* Nuova richiesta: ultimo riquadro, solo senza una richiesta aperta. */}
          {mine && !blocked && (
            <li>
              <button type="button" className="help-card help-add" onClick={() => setCreating([])} aria-label="New help request" title="New help request">
                <IconPlus size={40} />
              </button>
            </li>
          )}
        </ul>
      )}
      {creating && list && !blocked && (
        <NewHelpDialog deck={deck} initial={creating} onClose={stopCreating}
          onSubmit={(kind, text, cards) => {
            stopCreating();
            createHelp(uid, deck.id, kind, text, cards)
              .then(() => notify('Help request posted'))
              .catch((e) => notify(`Could not post the request: ${e.message}`, 'error'));
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

// Riquadro di una richiesta: in alto l'arte (prima carta in focus, o la copertina del mazzo) con il tipo, le
// risposte e i segnali (Yours, Replied, N new, Solved); sotto la domanda, le carte in focus e meta (mazzo, autore,
// quando). Link (href) nel feed, pulsante (onClick) nella scheda del mazzo.
function HelpItem({ deckId, deck, h, mine, flags = [], meta, href, onClick }) {
  const replies = useCount(countReplies, deckId, h.id);
  const fresh = useFresh(deckId, h, mine);
  const pic = (h.cards[0] && artCrop(h.cards[0])) || (deck && scryfallImg(deckCover(deck)));
  const solved = h.status === 'solved';
  const Tag = href ? 'a' : 'button';
  const status = [...flags, fresh && `${fresh} new`, solved && 'solved'].filter(Boolean).join(', ');
  return (
    <li>
      <Tag className={`help-card${solved ? ' solved' : ''}`} {...(href ? { href } : { type: 'button', onClick })}
        aria-label={`${helpKindLabel(h.kind)}: ${h.text} ${plural(replies, 'suggestion', 'suggestions')}${status ? `, ${status}` : ''}.`}>
        <span className="help-card-art" aria-hidden="true">
          {pic && <span className="help-card-img" style={{ backgroundImage: `url("${pic}")` }} />}
          <span className="help-kind">{helpKindLabel(h.kind)}</span>
          <span className="dilemma-flags">
            {flags.map((f) => <span key={f} className="dilemma-flag">{f}</span>)}
            {fresh > 0 && <span className="dilemma-flag voted">{fresh} new</span>}
            {solved && <span className="dilemma-flag solved">Solved</span>}
          </span>
          <span className="help-count"><IconLifebuoy size={12} /> {replies}</span>
        </span>
        <span className="help-card-text">{h.text}</span>
        {h.cards.length > 0 && <span className="help-card-cards">{h.cards.map((c) => c.name).join(' · ')}</span>}
        <span className="dilemma-tile-meta">{meta}{meta && ', '}{timeAgo(ms(h.createdAt))}</span>
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
// autore) e formato (terms e format da DeckList). open = la richiesta aperta dal feed (#/help/:mazzo/:richiesta).
export function HelpFeed({ uid, notify, open, terms = [], format = '' }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [decks, setDecks] = useState({}); // deckId -> mazzo pubblico | null; manca = in arrivo
  const replied = useReplied(uid);
  useEffect(() => listenHelpFeed((l) => { setList(l); setError(null); }, setError), []);
  useEffect(() => {
    let on = true;
    new Set((list || []).map((h) => h.deckId)).forEach((id) => deckOnce(id).then((x) => {
      if (on && x !== undefined) setDecks((m) => (m[id] === x ? m : { ...m, [id]: x }));
    }));
    return () => { on = false; };
  }, [list]);
  if (open) return <FeedHelp key={`${open.deckId}/${open.id}`} {...open} uid={uid} notify={notify} />;
  if (error) return <p className="field-hint">Help requests are not available: {error.message}</p>;
  if (!list) return <span className="import-spinner" aria-label="Loading" />;
  const live = list.filter((h) => h.status === 'open' && decks[h.deckId] !== null); // mazzo tornato privato: non si vede
  const shown = live.filter((h) => {
    const deck = decks[h.deckId];
    if (format && deck?.format !== format) return false;
    const text = [h.text, helpKindLabel(h.kind), ...h.cards.map((c) => c.name), deck?.name, deck?.owner].join(' ').toLowerCase();
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
        const deck = decks[h.deckId];
        const own = h.uid === uid;
        return (
          <HelpItem key={`${h.deckId}/${h.id}`} deckId={h.deckId} deck={deck} h={h} mine={own}
            flags={own ? ['Yours'] : replied.has(`${h.deckId}_${h.id}`) ? ['Replied'] : []}
            href={own ? `#/decks/${h.deckId}/help` : `#/help/${h.deckId}/${h.id}`}
            meta={deck ? <><b>{deck.name}</b> by {deck.owner || 'anonymous'}</> : '…'} />
        );
      })}
    </ul>
  );
}

// Richiesta aperta dal feed: richiesta e mazzo pubblico in ascolto; il nome del mazzo porta al mazzo.
function FeedHelp({ deckId, id, uid, notify }) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = non c'è più
  const [help, setHelp] = useState(undefined);
  useEffect(() => listenPublicDeck(deckId, setDeck, () => setDeck(null)), [deckId]);
  useEffect(() => listenHelp(deckId, id, setHelp, () => setHelp(null)), [deckId, id]);
  const back = () => navigate('/help');
  if (deck === undefined || help === undefined) return <span className="import-spinner" aria-label="Loading" />;
  if (!deck || !help) {
    return (
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={back} aria-label="All help requests" title="All help requests"><IconArrowLeft size={18} /></button>
        <p className="field-hint">This help request is no longer available.</p>
      </div>
    );
  }
  const mine = help.uid === uid;
  return <HelpView deck={deck} help={help} uid={uid} mine={mine} notify={notify} onBack={back}
    deckHref={mine ? `#/decks/${deckId}/help` : `#/community/${deckId}`} />;
}

// Richiesta aperta: tipo, mazzo (nel feed con autore e link), domanda, carte in focus, poi le risposte. Chi non è
// il proprietario scrive (o cambia) la sua finché la richiesta è aperta e legge le altre. Il proprietario: aprirla
// azzera le "new"; per ogni risposta Apply (update, solo nell'editor: le aggiunte rilette da Scryfall, con Undo
// nel toast) e Delete; Solved la chiude (e la riapre), Delete la cancella con le risposte. deckHref = dal feed,
// sotto c'è anche la lista del mazzo.
function HelpView({ deck, help, uid, mine, notify, update, onBack, deckHref }) {
  const [replies, setReplies] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'help' | uid della risposta da cancellare
  const [busy, setBusy] = useState(null); // uid della risposta in Apply
  // Il modulo della propria risposta riparte vuoto solo dopo averla cancellata: una risposta rifiutata (richiesta
  // appena risolta) sparisce dal listener ma la bozza resta.
  const [formKey, setFormKey] = useState(0);
  const [seen] = useState(() => ms(help.seenAt)); // le "new" restano evidenziate finché la richiesta è aperta qui
  useEffect(() => listenReplies(deck.id, help.id, setReplies, () => setReplies([])), [deck.id, help.id]);
  useEffect(() => { if (mine) seeHelp(deck.id, help.id).catch(() => {}); }, [mine, deck.id, help.id]);
  const solved = help.status === 'solved';
  const writeError = (e) => notify(`Sync error: ${e.message}`, 'error');
  const own = replies?.find((r) => r.id === uid);
  const shown = (replies || []).filter((r) => mine || r.id !== uid);

  const apply = async (r) => {
    setBusy(r.id);
    try {
      // Carte delle aggiunte rilette da Scryfall: le risposte le scrive chiunque, nel mazzo entrano dati veri.
      const found = r.add.length ? await cardsByIds(r.add.map((c) => c.sid)) : new Map();
      const add = r.add.map((c) => found.get(c.sid)).filter(Boolean).map(snapshotFromCard);
      const cut = r.cut.map((c) => c.oid);
      // ponytail: Undo rimette le carte di prima per intero (una modifica fatta nei secondi del toast si perde);
      // se serve, annullare solo questi tagli e aggiunte.
      const before = deck.cards;
      const res = applySuggestion(deck, add, cut);
      update((d) => applySuggestion(d, add, cut).deck);
      setApplied(deck.id, help.id, r.id, true).catch(writeError);
      const skipped = r.add.length + r.cut.length - res.added - res.cut;
      notify(`Applied: ${res.added} in, ${res.cut} out${skipped ? `, ${skipped} skipped` : ''}`, 'success', {
        label: 'Undo',
        onClick: () => { update((d) => ({ ...d, cards: before })); setApplied(deck.id, help.id, r.id, false).catch(writeError); },
      });
    } catch (e) {
      notify(`Could not apply the suggestion: ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };
  const remove = () => {
    const what = confirm;
    setConfirm(null);
    if (what === 'help') {
      onBack();
      deleteHelp(deck.id, help.id).then(() => notify('Help request deleted')).catch((e) => notify(`Could not delete the request: ${e.message}`, 'error'));
    } else {
      if (what === uid) setFormKey((k) => k + 1);
      deleteReply(uid, deck.id, help.id, what).then(() => notify('Suggestion deleted')).catch((e) => notify(`Could not delete the suggestion: ${e.message}`, 'error'));
    }
  };
  return (
    <div className="deck-sections help-view">
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={onBack} aria-label="All help requests" title="All help requests"><IconArrowLeft size={18} /></button>
        <h3 className="deck-analysis-head">Help request</h3>
        {mine && (
          <button type="button" className={`${solved ? 'btn-secondary' : 'btn-add'} deck-icon-btn`} aria-pressed={solved}
            onClick={() => setHelpStatus(deck.id, help.id, solved ? 'open' : 'solved').then(() => notify(solved ? 'Request reopened' : 'Marked as solved')).catch(writeError)}
            aria-label="Solved" title={solved ? 'Solved. Click to reopen it' : 'Mark as solved: no new suggestions'}><IconCheck size={18} /></button>
        )}
        {mine && <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setConfirm('help')} aria-label="Delete request" title="Delete request"><IconTrash size={18} /></button>}
      </div>
      <div className="help-question">
        <p className="help-question-kind">
          <span className="help-kind">{helpKindLabel(help.kind)}</span>
          {solved && <span className="dilemma-flag solved">Solved</span>}
          <span className="help-when">{timeAgo(ms(help.createdAt))}</span>
        </p>
        {deckHref && <p className="dilemma-deck"><a href={deckHref}>{deck.name}</a> <span className="help-by">by {deck.owner || 'anonymous'}</span></p>}
        <p className="help-text">{help.text}</p>
        {help.cards.length > 0 && <CardChips cards={help.cards} label="Cards in focus" className="focus" />}
      </div>
      {!mine && !solved && replies && (
        <ReplyForm key={formKey} deck={deck} help={help} uid={uid} reply={own} notify={notify} onDelete={() => setConfirm(uid)} />
      )}
      <section className="help-replies" aria-label="Suggestions">
        <h4>{mine ? 'Suggestions' : 'Other suggestions'} <span className="n">{shown.length}</span></h4>
        {!replies && <span className="import-spinner" aria-label="Loading" />}
        {replies && !shown.length && (
          <p className="field-hint">{mine ? 'No suggestions yet. They show up here as players reply.' : solved ? 'This request is solved.' : 'None yet: be the first.'}</p>
        )}
        {shown.length > 0 && (
          <ul>
            {shown.map((r) => (
              <ReplyCard key={r.id} r={r} mine={r.id === uid} fresh={mine && !solved && ms(r.at) > seen} applied={help.applied.includes(r.id)}
                busy={busy === r.id} onApply={mine && update ? () => apply(r) : null} onDelete={mine || r.id === uid ? () => setConfirm(r.id) : null} />
            ))}
          </ul>
        )}
        {mine && !update && shown.length > 0 && <p className="field-hint">Open <a href={`#/decks/${deck.id}/help`}>your deck</a> to apply suggestions.</p>}
      </section>
      {deckHref && (
        <section className="dilemma-decklist" aria-label="Decklist">
          <h4>Decklist</h4>
          <DeckListText deck={deck} />
        </section>
      )}
      <ConfirmDialog open={!!confirm} confirmLabel={confirm === 'help' ? 'Delete request' : 'Delete suggestion'}
        message={confirm === 'help' ? 'Delete this help request and its suggestions? This can’t be undone.' : confirm === uid ? 'Delete your suggestion?' : 'Delete this suggestion?'}
        onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}

// Carte di una richiesta o di una risposta: miniatura dell'arte (solo Scryfall) e nome; sign = + / − davanti;
// onRemove(i) = × per toglierla (nei moduli).
function CardChips({ cards, label, sign, className = '', onRemove }) {
  return (
    <ul className={`help-chips ${className}`} aria-label={label}>
      {cards.map((c, i) => (
        <li key={c.oid || i} className="help-chip" title={c.name}>
          {sign && <span className="help-sign" aria-hidden="true">{sign}</span>}
          {artCrop(c) ? <img src={artCrop(c)} alt="" loading="lazy" /> : <span className="help-chip-ph" aria-hidden="true" />}
          <span className="help-chip-name">{c.name}</span>
          {onRemove && <button type="button" className="help-chip-rm" onClick={() => onRemove(i)} aria-label={`Remove ${c.name}`} title="Remove"><IconX size={12} /></button>}
        </li>
      ))}
    </ul>
  );
}

// Carte da aggiungere (In, ciano) e da togliere (Out, magenta) di una risposta.
function CardChanges({ add, cut, onRemove }) {
  return (add.length > 0 || cut.length > 0) && (
    <div className="help-changes">
      {add.length > 0 && <CardChips cards={add} label="Cards to add" sign="+" className="add" onRemove={onRemove && ((i) => onRemove('add', i))} />}
      {cut.length > 0 && <CardChips cards={cut} label="Cards to cut" sign="−" className="cut" onRemove={onRemove && ((i) => onRemove('cut', i))} />}
    </div>
  );
}

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
      <CardChanges add={r.add} cut={r.cut} />
    </li>
  );
}

// La risposta di chi guarda (una per account, si cambia finché la richiesta è aperta): consiglio facoltativo se ci
// sono carte, fino a MAX_HELP_CARDS da aggiungere (ricerca Scryfall, legali nel formato) e da togliere (dal main,
// senza il comandante). reply = quella salvata (il modulo parte da lì), onDelete la cancella.
function ReplyForm({ deck, help, uid, reply, notify, onDelete }) {
  const [text, setText] = useState(reply?.text || '');
  const [add, setAdd] = useState(reply?.add || []);
  const [cut, setCut] = useState(reply?.cut || []);
  const own = deckCards(deck, true);
  const sig = (t, a, c) => JSON.stringify([t, a.map((x) => x.oid), c.map((x) => x.oid)]);
  const empty = !text.trim() && !add.length && !cut.length;
  const changed = sig(text.trim(), add, cut) !== sig(reply?.text || '', reply?.add || [], reply?.cut || []);
  const put = (list, set) => (card) => {
    if (card && list.length < MAX_HELP_CARDS && !list.some((c) => c.oid === card.oid)) set([...list, card]);
  };
  // Successi della ricerca muti: la carta non entra nel mazzo, va solo nella risposta.
  const quiet = (msg, kind) => { if (kind === 'error') notify(msg, kind); };
  const submit = (e) => {
    e.preventDefault();
    if (empty || !changed) return;
    replyHelp(uid, deck.id, help.id, { text: text.trim(), add, cut })
      .then(() => notify(reply ? 'Suggestion updated' : 'Suggestion sent'))
      .catch((err) => notify(`Could not send the suggestion: ${err.message}`, 'error'));
  };
  return (
    <form className="help-form" onSubmit={submit}>
      <h4>{reply ? 'Your suggestion' : 'Suggest changes'}</h4>
      <label className="field-label" htmlFor="help-reply-text">Advice <span className="field-hint">Optional if you pick cards</span></label>
      <textarea id="help-reply-text" className="import-link-input" value={text} maxLength={1000} rows={3}
        onChange={(e) => setText(e.target.value)} placeholder="What would you change, and why?" />
      <div className="help-form-cols">
        <div>
          <span className="field-label">Add <span className="field-hint">{add.length} of {MAX_HELP_CARDS}</span></span>
          <CardSearch format={deck.format} onAdd={put(add, setAdd)} notify={quiet} />
        </div>
        <div>
          <label className="field-label" htmlFor="help-cut">Cut <span className="field-hint">{cut.length} of {MAX_HELP_CARDS}</span></label>
          <select id="help-cut" value="" disabled={cut.length >= MAX_HELP_CARDS} onChange={(e) => put(cut, setCut)(own.find((c) => c.oid === e.target.value))}>
            <option value="">Pick a card from the deck…</option>
            {own.filter((c) => !cut.some((x) => x.oid === c.oid)).map((c) => <option key={c.oid} value={c.oid}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <CardChanges add={add} cut={cut} onRemove={(k, i) => (k === 'add' ? setAdd : setCut)((l) => l.filter((_, j) => j !== i))} />
      <div className="help-form-actions">
        {reply && <button type="button" className="btn-secondary deck-icon-btn" onClick={onDelete} aria-label="Delete your suggestion" title="Delete your suggestion"><IconTrash size={18} /></button>}
        <button type="submit" className="btn-generate deck-icon-btn" disabled={empty || !changed}
          aria-label={reply ? 'Save suggestion' : 'Send suggestion'} title={empty ? 'Write some advice or pick cards first' : reply ? 'Save suggestion' : 'Send suggestion'}><IconCheck size={18} /></button>
      </div>
    </form>
  );
}

// Nuova richiesta: il tipo, la domanda (1-500 caratteri) e fino a MAX_HELP_CARDS carte del mazzo in focus (initial =
// quelle scelte nel menu delle carte).
function NewHelpDialog({ deck, initial, onSubmit, onClose }) {
  const [kind, setKind] = useState('cuts');
  const [text, setText] = useState('');
  const [cards, setCards] = useState(() => [...new Map(initial.map((c) => [c.oid, c])).values()].slice(0, MAX_HELP_CARDS));
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const own = deckCards(deck).filter((c) => !cards.some((x) => x.oid === c.oid));
  const pick = (oid) => { const c = own.find((x) => x.oid === oid); if (c && cards.length < MAX_HELP_CARDS) setCards([...cards, c]); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal dilemma-new help-new" ref={ref} role="dialog" aria-modal="true" aria-label="Ask for help"
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(kind, text.trim(), cards); }}>
        <div className="modal-header">
          <h2>Ask for help</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
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
        <label className="field-label" htmlFor="help-cards">Cards in focus <span className="field-hint">Optional, up to {MAX_HELP_CARDS}</span></label>
        <select id="help-cards" value="" disabled={cards.length >= MAX_HELP_CARDS} onChange={(e) => pick(e.target.value)}>
          <option value="">Pick a card from the deck…</option>
          {own.map((c) => <option key={c.oid} value={c.oid}>{c.name}</option>)}
        </select>
        {cards.length > 0 && <CardChips cards={cards} label="Cards in focus" className="focus" onRemove={(i) => setCards(cards.filter((_, j) => j !== i))} />}
        <div className="modal-actions">
          <button type="submit" className="btn-generate deck-icon-btn" disabled={!text.trim()} aria-label="Post help request" title="Post help request"><IconCheck size={18} /></button>
        </div>
      </form>
    </div>
  );
}
