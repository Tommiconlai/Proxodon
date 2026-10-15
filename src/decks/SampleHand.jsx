import { useMemo, useState } from 'react';
import { libraryCards, shuffle, mulliganBottom, primaryType } from './deckModel';

const HAND = 7;
const deal = (lib, mulls) => ({ order: shuffle(lib), drawn: HAND, mulls, bottom: [] });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Mano di prova (come Moxfield): 7 carte dal grimorio mescolato (main senza comandanti).
// Mulligan = mulligan London: nuove 7 carte, poi si cliccano quelle da mettere in fondo
// (in Commander il primo è gratis). Draw pesca la successiva, New hand ricomincia da zero.
// ponytail: le carte messe in fondo contano nel grimorio ma non si ripescano (si pesca dall'alto).
export default function SampleHand({ deck }) {
  const lib = useMemo(() => libraryCards(deck), [deck]);
  const [h, setH] = useState(() => deal(lib, 0));
  if (!lib.length) return <p className="deck-empty">Add cards to the main deck to draw a sample hand.</p>;
  const hand = h.order.slice(0, h.drawn).filter((e) => !h.bottom.includes(e.key));
  const toBottom = mulliganBottom(deck.format, h.mulls) - h.bottom.length;
  const lands = lib.filter((e) => primaryType(e.card.type) === 'Land').length;
  return (
    <div className="sample-hand">
      <div className="sample-hand-bar">
        <button type="button" className="btn-secondary" onClick={() => setH(deal(lib, 0))}>New hand</button>
        <button type="button" className="btn-secondary" onClick={() => setH(deal(lib, h.mulls + 1))} disabled={h.mulls >= HAND}>Mulligan</button>
        <button type="button" className="btn-secondary" onClick={() => setH({ ...h, drawn: h.drawn + 1 })}
          disabled={toBottom > 0 || h.drawn >= h.order.length}>Draw</button>
        <span className={`sample-hand-status${toBottom > 0 ? ' pick' : ''}`} role="status">
          {toBottom > 0
            ? `Mulligan to ${HAND - mulliganBottom(deck.format, h.mulls)}: click ${plural(toBottom, 'card')} to put on the bottom`
            : `${hand.length} in hand · ${h.order.length - h.drawn + h.bottom.length} in library${h.mulls ? ` · ${plural(h.mulls, 'mulligan')}` : ''}`}
        </span>
      </div>
      <ul className={`sample-hand-cards${toBottom > 0 ? ' pick' : ''}`}>
        {hand.map((e) => {
          const face = e.card.img ? <img src={e.card.img} alt="" loading="lazy" draggable={false} /> : <span className="deck-card-ph">{e.card.name}</span>;
          return (
            <li key={e.key}>
              {toBottom > 0
                ? <button type="button" className="sample-card" aria-label={`Put ${e.card.name} on the bottom`}
                  onClick={() => setH({ ...h, bottom: [...h.bottom, e.key] })}>{face}</button>
                : <span className="sample-card" title={e.card.name}>{face}<span className="sr-only">{e.card.name}</span></span>}
            </li>
          );
        })}
      </ul>
      <p className="sample-hand-note">Average lands in an opening hand: {((HAND * lands) / lib.length).toFixed(2)}</p>
    </div>
  );
}
