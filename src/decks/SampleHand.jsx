import { useMemo, useState } from 'react';
import { libraryCards, shuffle, mulliganBottom, isLand } from './deckModel';

const HAND = 7;
const deal = (lib, mulls) => ({ order: shuffle(lib), drawn: HAND, mulls, bottom: [], played: [], leaving: [], lands: 0 });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Mano di prova (come Moxfield): 7 carte dal grimorio mescolato (main senza comandanti), una di
// fianco all'altra. Mulligan = mulligan London: nuove 7 carte, poi si cliccano quelle da mettere in
// fondo (in Commander il primo è gratis). Fuori dalla scelta del mulligan il click gioca la carta:
// scende e sparisce (animazione card-play, poi esce dalla mano) e, se è una terra, conta in "Lands
// on battlefield". Le non terra con costo di mana più alto delle terre in campo sono sbiadite.
// Draw pesca la successiva, New hand ricomincia da zero.
// ponytail: giocabile = costo di mana <= terre in campo, senza guardare i colori né le terre già
// usate nel turno. Le carte messe in fondo contano nel grimorio ma non si ripescano.
export default function SampleHand({ deck }) {
  const lib = useMemo(() => libraryCards(deck), [deck]);
  const [h, setH] = useState(() => deal(lib, 0));
  if (!lib.length) return <p className="deck-empty">Add cards to the main deck to draw a sample hand.</p>;
  const gone = new Set([...h.bottom, ...h.played]);
  const hand = h.order.slice(0, h.drawn).filter((e) => !gone.has(e.key));
  const toBottom = mulliganBottom(deck.format, h.mulls) - h.bottom.length;
  const play = (e) => setH((s) => ({ ...s, leaving: [...s.leaving, e.key] }));
  // Fine dell'animazione: la carta esce dalla mano, una terra va in campo.
  const played = (e) => setH((s) => (s.played.includes(e.key) ? s : {
    ...s, played: [...s.played, e.key], leaving: s.leaving.filter((k) => k !== e.key), lands: s.lands + (isLand(e.card) ? 1 : 0),
  }));
  return (
    <div className="sample-hand">
      <div className="sample-hand-bar">
        <button type="button" className="btn-secondary" onClick={() => setH(deal(lib, 0))}>New hand</button>
        <button type="button" className="btn-secondary" onClick={() => setH(deal(lib, h.mulls + 1))} disabled={h.mulls >= HAND}>Mulligan</button>
        <button type="button" className="btn-secondary" onClick={() => setH({ ...h, drawn: h.drawn + 1 })}
          disabled={toBottom > 0 || h.drawn >= h.order.length}>Draw</button>
        <span className="sample-lands" aria-live="polite"><b>{h.lands}</b> Lands on battlefield</span>
        <span className={`sample-hand-status${toBottom > 0 ? ' pick' : ''}`} role="status">
          {toBottom > 0
            ? `Mulligan to ${HAND - mulliganBottom(deck.format, h.mulls)}: click ${plural(toBottom, 'card')} to put on the bottom`
            : `${hand.length} in hand · ${h.order.length - h.drawn + h.bottom.length} in library${h.mulls ? ` · ${plural(h.mulls, 'mulligan')}` : ''}`}
        </span>
      </div>
      <ul className={`sample-hand-cards${toBottom > 0 ? ' pick' : ''}`}>
        {hand.map((e) => {
          const leaving = h.leaving.includes(e.key);
          const castable = isLand(e.card) || e.card.mv <= h.lands;
          return (
            <li key={e.key} className={`${castable || toBottom > 0 ? '' : 'uncastable'}${leaving ? ' leaving' : ''}`}
              onAnimationEnd={(ev) => { if (ev.animationName === 'card-play') played(e); }}>
              <button type="button" className="sample-card" disabled={leaving}
                aria-label={toBottom > 0 ? `Put ${e.card.name} on the bottom` : `Play ${e.card.name}${castable ? '' : ', not enough lands'}`}
                onClick={() => (toBottom > 0 ? setH({ ...h, bottom: [...h.bottom, e.key] }) : play(e))}>
                {e.card.img ? <img src={e.card.img} alt="" loading="lazy" draggable={false} /> : <span className="deck-card-ph">{e.card.name}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
