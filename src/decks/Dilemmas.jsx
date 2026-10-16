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
import { useBackClose } from '../hooks/useBackClose';
import { useCount } from './useCount';
import { groupMain, commanderRows, boardRows, scryfallImg, shuffle, splitSlices, MAX_DILEMMA_CARDS } from './deckModel';
import {
  IconPlus, IconArrowLeft, IconArrowRight, IconTrash, IconCheck, IconX,
} from '../components/icons';

const sum = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const img = (c) => scryfallImg(c.img); // solo immagini Scryfall (i dilemmi li scrive chi possiede il mazzo)
// Arte della carta (art_crop): stessa immagine Scryfall, altra versione nel percorso.
const art = (c) => scryfallImg((c.img || '').replace(/\/(small|normal|large|png|border_crop)\//, '/art_crop/').replace(/\.png(?=\?|$)/, '.jpg'));

// Scheda Dilemmas della vista mazzo (editor e Community). Solo mazzi pubblici. Elenco dei dilemmi del
// mazzo, il proprietario ne crea di nuovi (+); click = il dilemma aperto (DilemmaView). ask = 2 carte (Dilemma
// nel menu delle carte): all'apertura c'è già il nuovo dilemma con quelle; onAsked quando si chiude.
export function DeckDilemmas({ deck, uid, mine, notify, ask, onAsked }) {
  const [list, setList] = useState(null); // null = caricamento
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(ask ?? null); // carte iniziali del nuovo dilemma, null = chiuso
  const answered = useAnswered(uid);
  useBackClose(!!openId, () => setOpenId(null)); // back del sistema = torna all'elenco, non lascia il mazzo
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
  const stopCreating = () => { setCreating(null); onAsked?.(); };
  const open = list?.find((d) => d.id === openId);
  if (open) return <DilemmaView deck={deck} dilemma={open} uid={uid} mine={mine} notify={notify} onBack={() => setOpenId(null)} />;
  return (
    <div className="deck-sections">
      <div className="dilemma-head">
        <h3 className="deck-analysis-head">Dilemmas</h3>
      </div>
      {error && <p className="field-hint">Dilemmas are not available: {error.message}</p>}
      {!error && !list && <span className="import-spinner" aria-label="Loading" />}
      {list?.length === 0 && (
        <p className="field-hint">{mine ? 'No dilemmas yet. Ask the community which of two cards fits this deck better.' : 'No dilemmas for this deck yet.'}</p>
      )}
      {list && (mine || list.length > 0) && (
        <ul className="dilemma-list">
          {list.map((d) => (
            <DilemmaTile key={d.id} deckId={deck.id} d={d} uid={uid} solved={!!answered?.has(`${deck.id}_${d.id}`)} onClick={() => setOpenId(d.id)} />
          ))}
          {/* Nuovo dilemma: ultimo riquadro della griglia, grande quanto l'arte di un dilemma. */}
          {mine && (
            <li>
              <button type="button" className="dilemma-tile dilemma-add" onClick={() => setCreating([null, null])} aria-label="New dilemma" title="New dilemma">
                <span className="dilemma-split"><IconPlus size={44} /></span>
              </button>
            </li>
          )}
        </ul>
      )}
      {creating && (
        <NewDilemmaDialog deck={deck} notify={notify} initial={creating} onClose={stopCreating}
          onSubmit={(question, cards) => {
            stopCreating();
            createDilemma(uid, deck.id, question, cards)
              .then(() => notify('Dilemma created'))
              .catch((e) => notify(`Could not create the dilemma: ${e.message}`, 'error'));
          }} />
      )}
    </div>
  );
}

// Id {deck}_{dilemma} dei dilemmi a cui l'account ha risposto; null finché non arrivano (senza permesso
// o offline: nessuno).
function useAnswered(uid) {
  const [answered, setAnswered] = useState(null);
  useEffect(() => listenAnswered(uid, setAnswered, () => setAnswered(new Set())), [uid]);
  return answered;
}

// Riquadro di un dilemma (disegno dell'utente): le arti delle carte (2-4) divise in diagonale (splitSlices), in alto a
// sinistra le risposte, in alto a destra New (creato nelle ultime 12 ore) e Voted (hai già risposto; mai sui
// propri, a cui non si risponde). Sotto, fuori dal bordo, la domanda e nel feed mazzo e autore (meta). Link
// (href) nel feed, pulsante (onClick) nella scheda del mazzo.
const NEW_MS = 12 * 3600 * 1000;
function DilemmaTile({ deckId, d, uid, solved, meta, href, onClick }) {
  const votes = useCount(countVotes, deckId, d.id);
  const voted = solved && d.uid !== uid;
  const [now] = useState(() => Date.now()); // all'apertura della lista: basta per una soglia di 12 ore
  const fresh = now - (d.createdAt?.toMillis?.() ?? 0) < NEW_MS;
  const Tag = href ? 'a' : 'button';
  const status = [fresh && 'new', voted && 'voted'].filter(Boolean).join(', ');
  const split = splitSlices(d.cards.length); // una fetta per carta, divise in diagonale
  return (
    <li>
      <Tag className="dilemma-tile" {...(href ? { href } : { type: 'button', onClick })}
        aria-label={`${d.question} ${d.cards.map((c) => c.name).join(' or ')}. ${votes} ${votes === 1 ? 'vote' : 'votes'}${status ? `, ${status}` : ''}.`}>
        <span className="dilemma-split" aria-hidden="true">
          {d.cards.map((c, i) => {
            const s = split.slices[i];
            const style = { left: `${s.left}%`, width: `${s.width}%`, clipPath: s.clip };
            return art(c)
              ? <img key={i} className="slice" style={style} src={art(c)} alt="" loading="lazy" title={c.name} />
              : <span key={i} className="slice dilemma-split-ph" style={style} title={c.name}>{c.name}</span>;
          })}
          <svg className="dilemma-split-line" viewBox="0 0 100 100" preserveAspectRatio="none">
            {split.lines.map(([a, b]) => <line key={a} x1={a} y1="0" x2={b} y2="100" />)}
          </svg>
          <span className="dilemma-votes">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
          {(fresh || voted) && (
            <span className="dilemma-flags">
              {fresh && <span className="dilemma-flag">New</span>}
              {voted && <span className="dilemma-flag voted">Voted</span>}
            </span>
          )}
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

// Scheda Dilemmas della lista mazzi (#/dilemmas): gli ultimi dilemmi degli altri giocatori, filtrati dalla
// ricerca (domanda, carte, mazzo, autore) e dal formato del mazzo (terms e format da DeckList).
// Click = #/dilemmas/:mazzo/:dilemma, il dilemma aperto (open) qui; play = il gioco (DilemmaPlay).
export function DilemmaFeed({ uid, notify, open, play, terms = [], format = '' }) {
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
  if (!list || (play && !answered)) return <span className="import-spinner" aria-label="Loading" />;
  if (play) return <DilemmaPlay list={list} decks={decks} answered={answered} uid={uid} notify={notify} />;
  // Solo quelli degli altri: i propri stanno nella scheda Dilemmas dei loro mazzi.
  const others = list.filter((d) => d.uid !== uid);
  if (!others.length) {
    return (
      <div className="decks-empty">
        <p className="decks-empty-title">No dilemmas from other players yet</p>
        <p className="field-hint">Yours are in the Dilemmas tab of your public decks.</p>
      </div>
    );
  }
  // Mazzo tornato privato (null): i suoi dilemmi restano su Firestore ma qui non si vedono.
  const shown = others.filter((d) => {
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
          <DilemmaTile key={`${d.deckId}/${d.id}`} deckId={d.deckId} d={d} uid={uid} solved={!!answered?.has(`${d.deckId}_${d.id}`)}
            href={`#/dilemmas/${d.deckId}/${d.id}`} meta={deck ? <><b>{deck.name}</b> by {deck.owner || 'anonymous'}</> : '…'} />
        );
      })}
    </ul>
  );
}

// Play (#/dilemmas/play), un "Tinder" dei dilemmi: quelli altrui a cui non hai ancora risposto, uno alla
// volta in ordine casuale (fissato all'avvio: il voto appena dato non fa saltare via il risultato). Scegli
// una carta (o ← →), vedi come hanno scelto gli altri, spieghi se vuoi, poi Next (→ o Enter); prima del voto
// lo stesso pulsante salta. ponytail: pesca tra gli ultimi 40 del feed; con più dilemmi, una query a caso.
function DilemmaPlay({ list, decks, answered, uid, notify }) {
  const [queue] = useState(() => shuffle(list.filter((d) => d.uid !== uid && !answered.has(`${d.deckId}_${d.id}`))));
  const [pos, setPos] = useState(0);
  const exit = () => navigate('/dilemmas');
  const at = queue.findIndex((d, i) => i >= pos && decks[d.deckId] !== null); // salta i mazzi tornati privati
  const d = queue[at];
  if (!d) {
    return (
      <div className="decks-empty">
        <p className="decks-empty-title">{queue.length ? 'That was the last one' : 'All caught up'}</p>
        <p className="field-hint">
          {queue.length ? 'No more dilemmas in this round. The ones you skipped come back the next time you press Play.'
            : 'Nothing left to answer: you voted on every dilemma from other players. New ones show up as the community asks them.'}
        </p>
        <button type="button" className="btn-secondary deck-icon-btn" onClick={exit} aria-label="All dilemmas" title="All dilemmas"><IconArrowLeft size={18} /></button>
      </div>
    );
  }
  const deck = decks[d.deckId];
  if (!deck) return <span className="import-spinner" aria-label="Loading" />;
  return (
    <div className="dilemma-play" key={`${d.deckId}/${d.id}`}>
      <DilemmaView deck={deck} dilemma={d} uid={uid} mine={false} notify={notify} onBack={exit} deckHref={`#/community/${d.deckId}`}
        onNext={() => setPos(at + 1)} progress={`${at + 1} / ${queue.length}`} />
    </div>
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

// Dilemma aperto (dal disegno dell'utente): le carte, da 2 a 4 (hover = quella si ingrandisce, le altre si
// scuriscono), il nome del mazzo, la domanda, la lista del mazzo. Chi non è il proprietario sceglie una
// carta (click = scelta, si cambia o si toglie; il voto si salva solo confermando, così un click partito per
// sbaglio non conta), insieme al perché facoltativo: poi vede le percentuali (sulle carte e quanti hanno
// scelto come lui), può cambiare la spiegazione e legge quelle degli altri. Conferma: nel gioco (onNext,
// progress) Next o Enter salvano e passano al prossimo (un toast dice la percentuale), senza scelta saltano;
// fuori dal gioco il pulsante di conferma nella testata. Il proprietario vede percentuali e spiegazioni, e
// può cancellarlo.
function DilemmaView({ deck, dilemma, uid, mine, notify, onBack, deckHref, onNext, progress }) {
  const [votes, setVotes] = useState(null);
  const [sending, setSending] = useState(false); // un voto alla volta (doppio click, tasti ripetuti)
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => listenVotes(deck.id, dilemma.id, setVotes, () => setVotes([])), [deck.id, dilemma.id]);
  const my = votes?.find((v) => v.id === uid);
  const n = dilemma.cards.length;
  const counts = dilemma.cards.map((_, i) => (votes || []).filter((v) => v.pick === i).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const results = mine || !!my;
  const [pick, setPick] = useState(null); // carta scelta, non ancora confermata
  const [why, setWhy] = useState('');
  // Click = scegli o togli; tastiera (only) = scegli soltanto.
  const choose = (i, only) => { if (!results && !sending) setPick((p) => (p === i && !only ? null : i)); };
  // Salva il voto senza aspettarlo (offline resta in coda); il listener dei voti porta subito ai risultati. Nel
  // gioco ci sono solo dilemmi senza il tuo voto, quindi non serve aspettare i voti; fuori il pulsante sì.
  const confirm = () => {
    if (pick === null || results || sending) return false;
    setSending(true);
    voteDilemma(uid, deck.id, dilemma.id, pick, why.trim()).catch((e) => {
      setSending(false);
      notify(`Could not save your choice: ${e.message}`, 'error');
    });
    return true;
  };
  const next = () => {
    if (pick !== null && confirm()) notify(`${pct(counts[pick] + 1, total + 1)}% chose ${dilemma.cards[pick].name} like you`);
    onNext();
  };
  // Gioco: 1-4 (con due carte anche ← →) scelgono la carta, Enter (o →, quando non sceglie) conferma e passa al
  // prossimo. Non mentre si scrive; Enter su un pulsante o un link resta suo. Senza dipendenze: si riaggancia a ogni render.
  useEffect(() => {
    if (!onNext) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select')) return;
      const enter = e.key === 'Enter' && !e.target.closest?.('button, a');
      const k = /^[1-9]$/.test(e.key) && +e.key <= n ? +e.key - 1 : (n === 2 ? ['ArrowLeft', 'ArrowRight'] : []).indexOf(e.key);
      if (!results && k >= 0) {
        e.preventDefault();
        choose(k, true);
      } else if (enter || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const reasons = (votes || []).filter((v) => v.why);
  const nextLabel = results ? 'Next dilemma' : pick !== null ? 'Confirm and next' : 'Skip this dilemma';
  return (
    <div className="deck-sections dilemma-view">
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={onBack} aria-label="All dilemmas" title="All dilemmas"><IconArrowLeft size={18} /></button>
        <h3 className="deck-analysis-head">Dilemma</h3>
        {progress && <span className="dilemma-progress">{progress}</span>}
        {onNext && (
          <button type="button" className={`${results || pick !== null ? 'btn-add' : 'btn-secondary'} deck-icon-btn`} onClick={next}
            aria-label={nextLabel} title={`${nextLabel} (Enter)`}><IconArrowRight size={18} /></button>
        )}
        {!onNext && !results && (
          <button type="button" className="btn-add deck-icon-btn" onClick={confirm} disabled={pick === null || sending || !votes}
            aria-label="Confirm vote" title={pick === null ? 'Choose a card first' : 'Confirm vote'}><IconCheck size={18} /></button>
        )}
        {mine && (
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setConfirmDel(true)} aria-label="Delete dilemma" title="Delete dilemma"><IconTrash size={18} /></button>
        )}
      </div>
      <CardFrameDefs />
      <div className={`dilemma-cards n${n}${results ? ' voted' : pick !== null ? ' picked' : ''}`} role="group" aria-label="Choose a card">
        {dilemma.cards.map((c, i) => (
          // A ventaglio: da -4° a +4°, la rotazione in --r (l'hover la toglie).
          <button key={i} type="button" className={`dilemma-card${(my ? my.pick : pick) === i ? ' selected' : ''}`} aria-disabled={results}
            style={{ '--r': `${(i - (n - 1) / 2) * (8 / (n - 1))}deg` }}
            aria-pressed={mine ? undefined : (my ? my.pick : pick) === i} onClick={() => choose(i)}
            aria-label={results ? `${c.name}: ${pct(counts[i], total)}% of ${total} votes` : `Choose ${c.name}`}>
            {img(c) ? <img src={img(c)} alt="" /> : <span className="deck-card-ph">{c.name}</span>}
            <CardFrame />
            {results && <span className="dilemma-pct" aria-hidden="true">{pct(counts[i], total)}%</span>}
          </button>
        ))}
      </div>
      <p className="dilemma-deck">{deckHref ? <a href={deckHref}>{deck.name}</a> : deck.name}</p>
      <p className="dilemma-question">{dilemma.question}</p>
      {!results && (
        <p className="field-hint dilemma-hint">
          {pick === null ? `Choose the card you would play${onNext ? (n === 2 ? ' (← or →)' : ` (1 to ${n})`) : ''}.`
            : `${dilemma.cards[pick].name}: change it if you like, then ${onNext ? 'Next (Enter) saves your vote' : 'confirm your vote'}.`}
        </p>
      )}
      {!results && pick !== null && (
        <div className="dilemma-why">
          <label htmlFor="dilemma-why">Why? <span className="field-hint">Optional, saved with your vote</span></label>
          <textarea id="dilemma-why" className="import-link-input" value={why} maxLength={500} rows={3}
            onChange={(e) => setWhy(e.target.value)} placeholder="What makes it the better card for this deck?" />
        </div>
      )}
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

// Nuovo dilemma: da 2 a MAX_DILEMMA_CARDS carte diverse (dal mazzo o con la ricerca Scryfall, riempiono la
// casella scelta, poi si passa alla prima vuota) e la domanda. + aggiunge una casella, × la toglie (oltre 2).
// initial = le caselle all'apertura (dal menu delle carte: piene, il cursore va sulla domanda).
function NewDilemmaDialog({ deck, notify, initial, onSubmit, onClose }) {
  const [cards, setCards] = useState(initial);
  const [slot, setSlot] = useState(() => Math.max(0, initial.indexOf(null)));
  const [question, setQuestion] = useState('');
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const own = [...new Map(deck.cards.map((r) => [r.card.oid, r.card])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const put = (card) => {
    if (!card) return;
    const next = cards.map((c, i) => (i === slot ? card : c));
    setCards(next);
    setSlot(next.includes(null) ? next.indexOf(null) : (slot + 1) % next.length);
  };
  const drop = (i) => { setCards((cs) => cs.filter((_, j) => j !== i)); setSlot(0); };
  const filled = cards.filter(Boolean);
  const same = new Set(filled.map((c) => c.oid)).size < filled.length;
  const ok = filled.length === cards.length && !same && question.trim();
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
            <div key={i} className="dilemma-slot-wrap">
              <button type="button" className={`dilemma-slot${slot === i ? ' active' : ''}`} onClick={() => setSlot(i)}
                aria-pressed={slot === i} aria-label={`Card ${i + 1}: ${c ? c.name : 'empty'}. Fill it`}>
                {c && img(c) ? <img src={img(c)} alt="" /> : <span className="deck-card-ph">{c ? c.name : `Card ${i + 1}`}</span>}
              </button>
              {cards.length > 2 && (
                <button type="button" className="dilemma-slot-rm" onClick={() => drop(i)} aria-label={`Remove card ${i + 1}`} title="Remove"><IconX size={14} /></button>
              )}
            </div>
          ))}
          {cards.length < MAX_DILEMMA_CARDS && (
            <button type="button" className="dilemma-slot-add" onClick={() => { setCards([...cards, null]); setSlot(cards.length); }}
              aria-label="Add a card" title={`Add a card (up to ${MAX_DILEMMA_CARDS})`}><IconPlus size={24} /></button>
          )}
        </div>
        <label className="field-label" htmlFor="dilemma-own">From this deck</label>
        <select id="dilemma-own" value="" onChange={(e) => put(own.find((c) => c.oid === e.target.value))}>
          <option value="">Pick a card for card {slot + 1}…</option>
          {own.map((c) => <option key={c.oid} value={c.oid}>{c.name}</option>)}
        </select>
        <span className="field-label">Or search Scryfall</span>
        <CardSearch format={deck.format} onAdd={put} notify={quiet} />
        <label className="field-label" htmlFor="dilemma-q">Question</label>
        <textarea id="dilemma-q" className="import-link-input" value={question} maxLength={280} rows={3} autoFocus={!initial.includes(null)}
          onChange={(e) => setQuestion(e.target.value)} placeholder="Which one fits better in this deck?" />
        {same && <p className="field-hint">Pick different cards.</p>}
        <div className="modal-actions">
          <button type="submit" className="btn-generate deck-icon-btn" disabled={!ok} aria-label="Create dilemma" title="Create dilemma"><IconCheck size={18} /></button>
        </div>
      </form>
    </div>
  );
}
