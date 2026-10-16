import { useCallback, useEffect, useState } from 'react';
import { listHands, listPublicDecks, createHand, listenMyHands, voteHand, countHandVotes, publicDeckOnce } from './deckStore';
import { openingHand, scryfallImg, formatLabel, shuffle } from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { CardView } from './DeckSections';
import { IconArrowLeft, IconArrowRight, IconCheck, IconShuffle } from '../components/icons';

const img = (c) => scryfallImg(c.img);
// Le mani le scrive chiunque: allo zoom solo immagini Scryfall (come le miniature).
const safe = (c) => ({ ...c, img: scryfallImg(c.img), back: scryfallImg(c.back) });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Id delle mani già votate (users/{uid}/hands); null finché non arrivano, senza permesso: nessuna.
function useMyHands(uid) {
  const [ids, setIds] = useState(null);
  useEffect(() => listenMyHands(uid, setIds, () => setIds(new Set())), [uid]);
  return ids;
}

// Mazzi pubblici da cui pescare, letti una volta per sessione (ponytail: gli ultimi 60; con tanti mazzi,
// una query a caso). Mai i propri.
let pool;
async function drawHand(uid) {
  pool ||= listPublicDecks();
  for (const d of shuffle((await pool).filter((x) => x.uid !== uid))) {
    const cards = openingHand(d);
    if (cards) return createHand(d, cards, Math.random() < 0.5);
  }
  throw new Error('There are no public decks from other players to draw from yet.');
}

// Sezione Keep or mull della scheda Dilemmas (#/dilemmas/hands): cos'è e quante mani hai votato; Play sta
// nella barra delle sezioni (DeckList).
export function HandsIntro({ uid }) {
  const mine = useMyHands(uid);
  return (
    <div className="decks-empty hands-intro">
      <p className="decks-empty-title">Keep or mull</p>
      <p className="field-hint">Opening hands from other players' public decks, one after another, on the play or on the draw: keep or take a mulligan, then see how the others voted.</p>
      {mine && <p className="field-hint">You voted on {mine.size} {mine.size === 1 ? 'hand' : 'hands'}.</p>}
    </div>
  );
}

// Gioco (#/dilemmas/hands/play): le mani non ancora votate (le ultime 60, non dei propri mazzi) in ordine
// casuale; finite quelle ne pesca una nuova da un mazzo pubblico degli altri e la salva, così la votano anche
// gli altri. Le mani di mazzi tornati privati si saltano.
export function HandsPlay({ uid, notify }) {
  const mine = useMyHands(uid);
  const [queue, setQueue] = useState(null);
  const [pos, setPos] = useState(0);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!mine || queue) return;
    listHands().then((l) => setQueue(shuffle(l.filter((h) => h.deckUid !== uid && !mine.has(h.id))))).catch(setError);
  }, [mine, queue, uid]);
  const hand = queue?.[pos];
  const drawing = !!queue && !hand && !error;
  useEffect(() => {
    if (!drawing) return undefined;
    let on = true;
    drawHand(uid).then((h) => { if (on) setQueue((q) => [...q, h]); }, (e) => { if (on) setError(e); });
    return () => { on = false; };
  }, [drawing, uid]);
  const next = useCallback(() => setPos((p) => p + 1), []);
  const exit = () => navigate('/dilemmas/hands');
  if (error) {
    return (
      <div className="decks-empty">
        <p className="decks-empty-title">No hands right now</p>
        <p className="field-hint">{error.message}</p>
        <button type="button" className="btn-secondary deck-icon-btn" onClick={exit} aria-label="Back to Keep or mull" title="Back"><IconArrowLeft size={18} /></button>
      </div>
    );
  }
  if (!hand) return <span className="import-spinner" aria-label={drawing ? 'Drawing a hand' : 'Loading'} />;
  return <HandView key={hand.id} hand={hand} uid={uid} notify={notify} onNext={next} onExit={exit} n={pos + 1} />;
}

// Una mano: chi inizia (on the play / on the draw), il mazzo, le 7 carte (tocco = a tutto schermo). Mulligan
// (←) o Keep (→); poi la percentuale di chi ha votato come te e Next (→ o Enter). Prima del voto Next salta.
function HandView({ hand, uid, notify, onNext, onExit, n }) {
  const [vote, setVote] = useState(null); // il mio voto: true = keep
  const [res, setRes] = useState(null); // { keep, total } dopo il voto
  const [zoom, setZoom] = useState(null);
  useEffect(() => {
    let on = true;
    publicDeckOnce(hand.deckId).then((d) => { if (on && d === null) onNext(); }); // mazzo tornato privato
    return () => { on = false; };
  }, [hand.deckId, onNext]);
  const choose = (keep) => {
    if (vote !== null) return;
    setVote(keep);
    voteHand(uid, hand.id, keep).then(() => countHandVotes(hand.id)).then(setRes).catch((e) => {
      setVote(null);
      notify(`Could not save your vote: ${e.message}`, 'error');
    });
  };
  // ← mulligan, → keep; dopo il voto → o Enter = la prossima. Non mentre una carta è a tutto schermo.
  useEffect(() => {
    const onKey = (e) => {
      if (zoom || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select')) return;
      const enter = e.key === 'Enter' && !e.target.closest?.('button, a');
      if (vote === null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); choose(e.key === 'ArrowRight'); }
      else if (vote !== null && (e.key === 'ArrowRight' || enter)) { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const same = res && (vote ? res.keep : res.total - res.keep);
  return (
    <div className="dilemma-play hand-play">
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={onExit} aria-label="Back to Keep or mull" title="Back"><IconArrowLeft size={18} /></button>
        <h3 className="deck-analysis-head">Keep or mull</h3>
        <span className="dilemma-progress">Hand {n}</span>
        <button type="button" className={`${vote !== null ? 'btn-add' : 'btn-secondary'} deck-icon-btn`} onClick={onNext}
          aria-label={vote !== null ? 'Next hand' : 'Skip this hand'} title={vote !== null ? 'Next hand (→)' : 'Skip'}><IconArrowRight size={18} /></button>
      </div>
      <p className={`hand-turn ${hand.onPlay ? 'play' : 'draw'}`}>{hand.onPlay ? 'On the play' : 'On the draw'}</p>
      <p className="hand-deck">
        <a href={`#/community/${hand.deckId}`}>{hand.deckName}</a> <span>{formatLabel(hand.format)}</span>
        {hand.commander?.map((c) => (
          <button key={c.oid} type="button" className="hand-cmdr" onClick={() => setZoom(c)} title="View card">{c.name}</button>
        ))}
      </p>
      <ul className="hand-cards">
        {hand.cards.map((c, i) => (
          <li key={i}>
            <button type="button" className="hand-card" onClick={() => setZoom(c)} aria-label={`View ${c.name}`} title={c.name}>
              {img(c) ? <img src={img(c)} alt="" /> : <span className="deck-card-ph">{c.name}</span>}
            </button>
          </li>
        ))}
      </ul>
      {vote === null ? (
        <>
          <div className="hand-vote" role="group" aria-label="Keep or mulligan">
            <button type="button" className="btn-secondary deck-icon-btn hand-mull" onClick={() => choose(false)} aria-label="Mulligan" title="Mulligan (←)"><IconShuffle size={26} /></button>
            <button type="button" className="btn-add deck-icon-btn hand-keep" onClick={() => choose(true)} aria-label="Keep" title="Keep (→)"><IconCheck size={26} /></button>
          </div>
          <p className="field-hint hand-hint">← Mulligan · Keep →</p>
        </>
      ) : (
        <div className="hand-result" aria-live="polite">
          {res ? (
            <>
              <p><b>{pct(same, res.total)}%</b> {vote ? 'kept' : 'took a mulligan'} like you ({res.total} {res.total === 1 ? 'vote' : 'votes'}).</p>
              <div className="hand-bar" aria-hidden="true"><span style={{ width: `${pct(res.keep, res.total)}%` }} /></div>
              <p className="hand-bar-legend"><span>Keep {pct(res.keep, res.total)}%</span><span>Mulligan {100 - pct(res.keep, res.total)}%</span></p>
            </>
          ) : <span className="import-spinner" aria-label="Loading" />}
        </div>
      )}
      {zoom && <CardView card={safe(zoom)} onClose={() => setZoom(null)} />}
    </div>
  );
}
