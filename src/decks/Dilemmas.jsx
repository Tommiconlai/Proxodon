import { useEffect, useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import ConfirmDialog from '../components/ConfirmDialog';
import { CardFrame, CardFrameDefs } from '../components/CardFrame';
import CardSearch from './CardSearch';
import { ManaCost } from './Mana';
import {
  listenDilemmas, createDilemma, deleteDilemma, listenVotes, voteDilemma, explainVote,
  listenDilemmaFeed, listenDilemma, getPublicDeck, listenPublicDeck, listenAnswered, countVotes,
} from './deckStore';
import { navigate } from '../hooks/useHashRoute';
import { groupMain, commanderRows, boardRows, scryfallImg } from './deckModel';
import { IconPlus, IconArrowLeft, IconTrash, IconCheck, IconX, IconLock, IconLockOpen } from '../components/icons';

const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const img = (c) => scryfallImg(c.img); // solo immagini Scryfall (i dilemmi li scrive chi possiede il mazzo)
// Arte della carta (art_crop): stessa immagine Scryfall, altra versione nel percorso.
const art = (c) => scryfallImg((c.img || '').replace(/\/(small|normal|large|png|border_crop)\//, '/art_crop/').replace(/\.png(?=\?|$)/, '.jpg'));

// Scheda Dilemmas della vista mazzo (editor e Community). Solo mazzi pubblici. Elenco dei dilemmi del
// mazzo, il proprietario ne crea di nuovi (+); click = il dilemma aperto (DilemmaView).
export function DeckDilemmas({ deck, uid, mine, notify }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const answered = useAnswered(uid);
  const live = !!deck.public;
  useEffect(() => (live ? listenDilemmas(deck.id, (l) => { setList(l); setError(null); }, setError) : undefined), [deck.id, live]);

  if (!live) {
    return (
      <div className="deck-sections">
        <h3 className="deck-analysis-head">Dilemmas</h3>
        <p className="field-hint">Share this deck in Community (Public) to ask the community a dilemma.</p>
      </div>
    );
  }
  const open = list?.find((d) => d.id === openId);
  if (open) return <DilemmaView deck={deck} dilemma={open} uid={uid} mine={mine} notify={notify} onBack={() => setOpenId(null)} />;
  return (
    <div className="deck-sections">
      <div className="dilemma-head">
        <h3 className="deck-analysis-head">Dilemmas</h3>
        {mine && (
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setCreating(true)} aria-label="New dilemma" title="New dilemma">
            <IconPlus size={18} />
          </button>
        )}
      </div>
      {error && <p className="field-hint">Dilemmas are not available: {error.message}</p>}
      {!error && !list && <span className="import-spinner" aria-label="Loading" />}
      {list?.length === 0 && (
        <p className="field-hint">{mine ? 'No dilemmas yet. Ask the community which of two cards fits this deck better.' : 'No dilemmas for this deck yet.'}</p>
      )}
      {list?.length > 0 && (
        <ul className="dilemma-list">
          {list.map((d) => (
            <DilemmaTile key={d.id} deckId={deck.id} d={d} uid={uid} solved={answered.has(`${deck.id}_${d.id}`)} onClick={() => setOpenId(d.id)} />
          ))}
        </ul>
      )}
      {creating && (
        <NewDilemmaDialog deck={deck} notify={notify} onClose={() => setCreating(false)}
          onSubmit={(question, cards) => {
            setCreating(false);
            createDilemma(uid, deck.id, question, cards)
              .then(() => notify('Dilemma created'))
              .catch((e) => notify(`Could not create the dilemma: ${e.message}`, 'error'));
          }} />
      )}
    </div>
  );
}

// Id {deck}_{dilemma} dei dilemmi a cui l'account ha risposto (senza permesso o offline: nessuno).
function useAnswered(uid) {
  const [answered, setAnswered] = useState(() => new Set());
  useEffect(() => listenAnswered(uid, setAnswered, () => {}), [uid]);
  return answered;
}

// Risposte di un dilemma: conteggio dal server, una lettura; prima della risposta o senza permesso: 0.
function useVoteCount(deckId, dId) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    countVotes(deckId, dId).then((c) => { if (alive) setN(c); }).catch(() => {});
    return () => { alive = false; };
  }, [deckId, dId]);
  return n;
}

// Riquadro di un dilemma (disegno dell'utente): le arti delle due carte divise in diagonale, in alto a
// sinistra le risposte, in alto a destra il lucchetto (chiuso = hai risposto, aperto = ancora da
// risolvere; niente sui propri, a cui non si risponde). Sotto, fuori dal bordo, la domanda e nel feed
// mazzo e autore (meta). Link (href) nel feed, pulsante (onClick) nella scheda del mazzo.
function DilemmaTile({ deckId, d, uid, solved, meta, href, onClick }) {
  const votes = useVoteCount(deckId, d.id);
  const mine = d.uid === uid;
  const Tag = href ? 'a' : 'button';
  const status = mine ? 'your dilemma' : solved ? 'answered' : 'not answered yet';
  return (
    <li>
      <Tag className="dilemma-tile" {...(href ? { href } : { type: 'button', onClick })}
        aria-label={`${d.question} ${d.cards.map((c) => c.name).join(' or ')}. ${votes} ${votes === 1 ? 'vote' : 'votes'}, ${status}.`}>
        <span className="dilemma-split" aria-hidden="true">
          {d.cards.map((c, i) => (art(c)
            ? <img key={i} className={`s${i}`} src={art(c)} alt="" loading="lazy" title={c.name} />
            : <span key={i} className={`s${i} dilemma-split-ph`} title={c.name}>{c.name}</span>))}
          <svg className="dilemma-split-line" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="60" y1="0" x2="40" y2="100" /></svg>
          <span className="dilemma-votes">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
          {!mine && <span className={`dilemma-lock${solved ? ' solved' : ''}`}>{solved ? <IconLock size={14} /> : <IconLockOpen size={14} />}</span>}
        </span>
        <span className="dilemma-tile-q">{d.question}</span>
        {meta && <span className="dilemma-tile-meta">{meta}</span>}
      </Tag>
    </li>
  );
}

// Nome, formato e autore dal mazzo pubblico, letto una volta per mazzo. ponytail: cache per la sessione,
// un nome cambiato si vede ricaricando. null = mazzo non più pubblico; errore = undefined, resta "…".
const publicDecks = new Map();
const deckOnce = (id) => {
  if (!publicDecks.has(id)) publicDecks.set(id, getPublicDeck(id).catch(() => undefined));
  return publicDecks.get(id);
};

// Scheda Dilemmas della lista mazzi (#/dilemmas): gli ultimi dilemmi della Community, filtrati dalla
// ricerca (domanda, carte, mazzo, autore) e dal formato del mazzo (terms e format da DeckList).
// Click = #/dilemmas/:mazzo/:dilemma, il dilemma aperto (open) qui.
export function DilemmaFeed({ uid, notify, open, terms = [], format = '' }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [decks, setDecks] = useState({}); // deckId -> mazzo pubblico | null; manca = in arrivo
  const answered = useAnswered(uid);
  useEffect(() => listenDilemmaFeed((l) => { setList(l); setError(null); }, setError), []);
  useEffect(() => {
    let on = true;
    new Set((list || []).map((d) => d.deckId)).forEach((id) => deckOnce(id).then((x) => {
      if (on && x !== undefined) setDecks((m) => (m[id] === x ? m : { ...m, [id]: x }));
    }));
    return () => { on = false; };
  }, [list]);
  if (open) return <FeedDilemma key={`${open.deckId}/${open.id}`} {...open} uid={uid} notify={notify} />;
  if (error) return <p className="field-hint">Dilemmas are not available: {error.message}</p>;
  if (!list) return <span className="import-spinner" aria-label="Loading" />;
  if (!list.length) {
    return (
      <div className="decks-empty">
        <p className="decks-empty-title">No dilemmas yet</p>
        <p className="field-hint">Ask the community from the Dilemmas tab of one of your public decks.</p>
      </div>
    );
  }
  // Mazzo tornato privato (null): i suoi dilemmi restano su Firestore ma qui non si vedono.
  const shown = list.filter((d) => {
    const deck = decks[d.deckId];
    if (deck === null || (format && deck?.format !== format)) return false;
    const text = [d.question, ...d.cards.map((c) => c.name), deck?.name, deck?.owner].join(' ').toLowerCase();
    return terms.every((w) => text.includes(w));
  });
  if (!shown.length) {
    return (
      <div className="decks-empty">
        <p className="decks-empty-title">No dilemmas match</p>
        <p className="field-hint">Try another search or format.</p>
      </div>
    );
  }
  return (
    <ul className="dilemma-list">
      {shown.map((d) => {
        const deck = decks[d.deckId];
        return (
          <DilemmaTile key={`${d.deckId}/${d.id}`} deckId={d.deckId} d={d} uid={uid} solved={answered.has(`${d.deckId}_${d.id}`)}
            href={`#/dilemmas/${d.deckId}/${d.id}`} meta={deck ? <><b>{deck.name}</b> by {deck.owner || 'anonymous'}</> : '…'} />
        );
      })}
    </ul>
  );
}

// Dilemma aperto dal feed: dilemma e mazzo pubblico in ascolto; il nome del mazzo porta al mazzo.
function FeedDilemma({ deckId, id, uid, notify }) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = non c'è più
  const [dilemma, setDilemma] = useState(undefined);
  useEffect(() => listenPublicDeck(deckId, setDeck, () => setDeck(null)), [deckId]);
  useEffect(() => listenDilemma(deckId, id, setDilemma, () => setDilemma(null)), [deckId, id]);
  const back = () => navigate('/dilemmas');
  if (deck === undefined || dilemma === undefined) return <span className="import-spinner" aria-label="Loading" />;
  if (!deck || !dilemma) {
    return (
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={back} aria-label="All dilemmas" title="All dilemmas"><IconArrowLeft size={18} /></button>
        <p className="field-hint">This dilemma is no longer available.</p>
      </div>
    );
  }
  const mine = dilemma.uid === uid;
  return <DilemmaView deck={deck} dilemma={dilemma} uid={uid} mine={mine} notify={notify} onBack={back}
    deckHref={mine ? `#/decks/${deckId}` : `#/community/${deckId}`} />;
}

// Dilemma aperto (dal disegno dell'utente): le due carte (hover = quella si ingrandisce, l'altra si
// scurisce), il nome del mazzo, la domanda, la lista del mazzo. Chi non è il proprietario sceglie una
// carta: poi vede le percentuali (sulle carte e quanti hanno scelto come lui), può spiegare la scelta e
// legge le spiegazioni degli altri. Il proprietario vede percentuali e spiegazioni, e può cancellarlo.
function DilemmaView({ deck, dilemma, uid, mine, notify, onBack, deckHref }) {
  const [votes, setVotes] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => listenVotes(deck.id, dilemma.id, setVotes, () => setVotes([])), [deck.id, dilemma.id]);
  const my = votes?.find((v) => v.id === uid);
  const counts = [0, 1].map((i) => (votes || []).filter((v) => v.pick === i).length);
  const total = counts[0] + counts[1];
  const results = mine || !!my;
  const choose = (i) => {
    if (results || !votes) return;
    voteDilemma(uid, deck.id, dilemma.id, i).catch((e) => notify(`Could not save your choice: ${e.message}`, 'error'));
  };
  const reasons = (votes || []).filter((v) => v.why);
  return (
    <div className="deck-sections dilemma-view">
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={onBack} aria-label="All dilemmas" title="All dilemmas"><IconArrowLeft size={18} /></button>
        <h3 className="deck-analysis-head">Dilemma</h3>
        {mine && (
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setConfirmDel(true)} aria-label="Delete dilemma" title="Delete dilemma"><IconTrash size={18} /></button>
        )}
      </div>
      <CardFrameDefs />
      <div className={`dilemma-cards${results ? ' voted' : ''}`} role="group" aria-label="Choose a card">
        {dilemma.cards.map((c, i) => (
          <button key={i} type="button" className={`dilemma-card c${i}${my?.pick === i ? ' selected' : ''}`} aria-disabled={results}
            aria-pressed={my ? my.pick === i : undefined} onClick={() => choose(i)}
            aria-label={results ? `${c.name}: ${pct(counts[i], total)}% of ${total} votes` : `Choose ${c.name}`}>
            {img(c) ? <img src={img(c)} alt="" /> : <span className="deck-card-ph">{c.name}</span>}
            <CardFrame />
            {results && <span className="dilemma-pct" aria-hidden="true">{pct(counts[i], total)}%</span>}
          </button>
        ))}
      </div>
      <p className="dilemma-deck">{deckHref ? <a href={deckHref}>{deck.name}</a> : deck.name}</p>
      <p className="dilemma-question">{dilemma.question}</p>
      {!results && <p className="field-hint dilemma-hint">Choose the card you would play.</p>}
      {my && (
        <p className="dilemma-same">
          <b>{pct(counts[my.pick], total)}%</b> chose {dilemma.cards[my.pick].name} like you ({total} {total === 1 ? 'vote' : 'votes'}).
        </p>
      )}
      {mine && <p className="dilemma-same">{total} {total === 1 ? 'vote' : 'votes'} so far.</p>}
      {my && <WhyBox key={dilemma.id} initial={my.why} onSave={(why) => explainVote(uid, deck.id, dilemma.id, why)
        .then(() => notify(why ? 'Explanation saved' : 'Explanation removed'))
        .catch((e) => notify(`Could not save the explanation: ${e.message}`, 'error'))} />}
      {results && reasons.length > 0 && (
        <section className="dilemma-reasons" aria-label="Explanations">
          <h4>Why they chose</h4>
          <ul>
            {reasons.map((v) => (
              <li key={v.id}>
                <span className="dilemma-reason-who">{v.owner || 'anonymous'}</span> chose <b>{dilemma.cards[v.pick]?.name}</b>
                <p>{v.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="dilemma-decklist" aria-label="Decklist">
        <h4>Decklist</h4>
        <DeckListText deck={deck} />
      </section>
      <ConfirmDialog open={confirmDel} message="Delete this dilemma and its votes? This can’t be undone." confirmLabel="Delete dilemma"
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false);
          onBack();
          deleteDilemma(deck.id, dilemma.id).then(() => notify('Dilemma deleted')).catch((e) => notify(`Could not delete the dilemma: ${e.message}`, 'error'));
        }} />
    </div>
  );
}

// Spiegazione facoltativa dopo il voto (max 500 caratteri): Save la salva, anche vuota (= tolta).
function WhyBox({ initial, onSave }) {
  const [why, setWhy] = useState(initial || '');
  return (
    <form className="dilemma-why" onSubmit={(e) => { e.preventDefault(); onSave(why.trim()); }}>
      <label htmlFor="dilemma-why">Why? <span className="field-hint">Optional</span></label>
      <div className="dilemma-why-row">
        <textarea id="dilemma-why" className="import-link-input" value={why} maxLength={500} rows={3}
          onChange={(e) => setWhy(e.target.value)} placeholder="What makes it the better card for this deck?" />
        <button type="submit" className="btn-secondary deck-icon-btn" aria-label="Save explanation" title="Save explanation"
          disabled={why.trim() === (initial || '')}><IconCheck size={18} /></button>
      </div>
    </form>
  );
}

// Lista del mazzo in sola lettura, per ora fissa: vista lista, per nome, raggruppata per tipo.
function DeckListText({ deck }) {
  const blocks = [
    ['Commander', commanderRows(deck)],
    ...groupMain({ ...deck, groupBy: 'type' }, 'name').map((g) => [g.label, g.rows]),
    ...(deck.format === 'commander' ? [] : [['Sideboard', boardRows(deck, 'side', 'name')]]),
  ].filter(([, rows]) => rows.length);
  return (
    <div className="dilemma-list-cols">
      {blocks.map(([label, rows]) => (
        <section key={label} className="dilemma-list-group" aria-label={label}>
          <h5>{label} <span className="n">{sum(rows)}</span></h5>
          <ul>
            {rows.map((r) => (
              <li key={r.id}><span className="deck-qty">{r.qty}</span> <span className="dilemma-list-name">{r.card.name}</span> <ManaCost cost={r.card.mana} /></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Nuovo dilemma: due carte (dal mazzo o con la ricerca Scryfall, riempiono la casella scelta) e la domanda.
function NewDilemmaDialog({ deck, notify, onSubmit, onClose }) {
  const [cards, setCards] = useState([null, null]);
  const [slot, setSlot] = useState(0);
  const [question, setQuestion] = useState('');
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const own = [...new Map(deck.cards.map((r) => [r.card.oid, r.card])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const put = (card) => {
    if (!card) return;
    setCards((cs) => cs.map((c, i) => (i === slot ? card : c)));
    setSlot((s) => (s === 0 ? 1 : 0));
  };
  const same = cards[0] && cards[1] && cards[0].oid === cards[1].oid;
  const ok = cards[0] && cards[1] && !same && question.trim();
  // Successi della ricerca muti: qui la carta non entra nel mazzo, va solo nella casella.
  const quiet = (msg, kind) => { if (kind === 'error') notify(msg, kind); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal dilemma-new" ref={ref} role="dialog" aria-modal="true" aria-label="New dilemma"
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(question.trim(), cards); }}>
        <div className="modal-header">
          <h2>New dilemma</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <div className="dilemma-slots" role="group" aria-label="Cards">
          {cards.map((c, i) => (
            <button key={i} type="button" className={`dilemma-slot${slot === i ? ' active' : ''}`} onClick={() => setSlot(i)}
              aria-pressed={slot === i} aria-label={`${i ? 'Second' : 'First'} card: ${c ? c.name : 'empty'}. Fill it`}>
              {c && img(c) ? <img src={img(c)} alt="" /> : <span className="deck-card-ph">{c ? c.name : `Card ${i + 1}`}</span>}
            </button>
          ))}
        </div>
        <label className="field-label" htmlFor="dilemma-own">From this deck</label>
        <select id="dilemma-own" value="" onChange={(e) => put(own.find((c) => c.oid === e.target.value))}>
          <option value="">Pick a card for card {slot + 1}…</option>
          {own.map((c) => <option key={c.oid} value={c.oid}>{c.name}</option>)}
        </select>
        <span className="field-label">Or search Scryfall</span>
        <CardSearch format={deck.format} onAdd={put} notify={quiet} />
        <label className="field-label" htmlFor="dilemma-q">Question</label>
        <textarea id="dilemma-q" className="import-link-input" value={question} maxLength={280} rows={3}
          onChange={(e) => setQuestion(e.target.value)} placeholder="Which one fits better in this deck?" />
        {same && <p className="field-hint">Pick two different cards.</p>}
        <div className="modal-actions">
          <button type="submit" className="btn-generate deck-icon-btn" disabled={!ok} aria-label="Create dilemma" title="Create dilemma"><IconCheck size={18} /></button>
        </div>
      </form>
    </div>
  );
}
