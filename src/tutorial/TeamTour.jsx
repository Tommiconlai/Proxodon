import { useEffect, useState } from 'react';
import { Shell } from './AccountStages';
import { trioDecks } from './demo';
import { TeamBody } from '../decks/TeamPage';

// Tutorial di Team Trios (#/decks/team/:id): la pagina vera (TeamBody) su una squadra e tre mazzi demo, nickname
// inventati, solo in memoria: niente Firestore (i passi sono in DeckTour, teamSteps). La demo è il leader: modifica i
// tre mazzi, dà il posto libero, toglie i giocatori. step.empty = il posto senza mazzo.
const TEAM = { id: 'tut-team', name: 'Friday Trios', owner: 'demoplayer', members: ['demoplayer', 'mira'], slots: ['demoplayer', 'mira', null] };
const nick = (u) => u;
const noop = () => {};

export function TeamStage({ step, mobile }) {
  const [decks, setDecks] = useState(() => trioDecks().map((d, i) => (i === step.empty ? null : d)));
  // Come DeckStage: il riquadro del passo (step.scroll) a metà schermo prima che la scheda del passo si fermi.
  useEffect(() => {
    if (!step.scroll) return undefined;
    const t = setTimeout(() => document.querySelector(`.tut-stage ${step.target}`)?.scrollIntoView({ block: 'center' }), 150);
    return () => clearTimeout(t);
  }, [step]);
  const slots = decks.map((deck, i) => ({ deck, canEdit: true, update: (fn) => setDecks((l) => l.map((d, j) => (j === i ? fn(d) : d))) }));
  return (
    <Shell mobile={mobile}>
      <TeamBody team={TEAM} uid="demoplayer" slots={slots} nameOf={nick} notify={noop} printQueueCount={0} onPrintDeck={noop} />
    </Shell>
  );
}
