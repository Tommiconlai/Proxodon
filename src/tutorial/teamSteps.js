import { pointAt } from './control';

// Passi del tutorial di Team Trios (TeamStage in TeamTour): la squadra, i tre posti, il posto libero, il limite di
// squadra, Stats. La demo non salva niente: i gesti indicano i pulsanti che scrivono (Add player, New deck, Delete)
// senza premerli.
const slot = (i) => `.team-deck[aria-labelledby="team-deck-${i}"]`;
const select = (el) => el.click();
const pickOption = (v) => (el) => { el.value = String(v); el.dispatchEvent(new Event('change', { bubbles: true })); }; // React sente il change

export function teamSteps(mobile) {
  const tap = mobile ? 'Tap' : 'Click';
  const chart = 'A bar of the charts selects its cards in that deck.';
  return [{
    target: '.team-bar', title: 'Your team',
    text: `A demo team: three decks for three players, for a team tournament. Nothing here changes your teams. The leader ${mobile ? 'taps' : 'clicks'} the name to rename the team and deletes it for everyone; a player leaves it instead, and their deck stays in the team.`,
    play: (g) => pointAt(g, [['.team-bar .folder-name', 'Rename'], ['.team-bar [aria-label="Delete the team"]', 'Delete']]),
  }, {
    target: `${slot(0)} .team-deck-head`, title: 'Three slots',
    text: 'One deck per slot, each with its own format. The crown marks the leader, here you: the leader edits all three decks and removes a player with the X, the deck stays. A player edits only their own deck and sees the other two read only.',
    play: async (g) => {
      await pointAt(g, [[`${slot(0)} .group-member`, 'Leader'], [`${slot(0)} .deck-format`, 'Format']]);
      // Il secondo posto è più in basso: da telefono a metà schermo, sopra la scheda del passo; da desktop in fondo, con
      // ricerca e controlli sotto (la scheda sta in alto).
      const head = `${slot(1)} .team-deck-head`;
      g.el(mobile ? head : `${slot(1)} .deck-toolbar`).scrollIntoView({ block: mobile ? 'center' : 'nearest' });
      g.spot(head);
      await pointAt(g, [[`${slot(1)} .group-member`, 'Player'], [`${slot(1)} .group-member-x`, 'Remove']]);
    },
  }, {
    target: slot(2), empty: 2, scroll: true, title: 'An open slot',
    text: 'The leader gives an open slot to a player by nickname. A slot without a deck gets a new one, from scratch or a pasted list, or a copy of one of your decks: an independent copy, yours stays as it is.',
    play: (g) => pointAt(g, [[`${slot(2)} .team-invite input`, 'Player nickname'], [`${slot(2)} [title="New deck"]`, 'New deck'], [`${slot(2)} [title="Copy one of your decks"]`, 'Copy one of your decks']]),
  }, {
    target: `${slot(0)} .deck-issue`, side: 'above', title: 'Team limit',
    text: `At most 4 copies of a card across the three decks, sideboards included; basic lands and cards that allow any number are exempt. Here Explore is at 6 of 4: an amber chip in each deck that has it names the card. ${tap} it to select those cards. Nothing is blocked.`,
    play: async (g) => {
      await g.click(`${slot(0)} .deck-issue`, tap, select);
      await g.wait(400); // la carta scelta scorre a metà schermo
      g.spot(`${slot(0)} .deck-row.selected`);
      await g.move(g.at(`${slot(0)} .deck-row.selected .deck-row-main`, 0.5, 0.05)); // il nome, visibile anche dentro la pila
      g.say('Explore 6/4');
      await g.wait(1400);
    },
  }, mobile ? {
    // Da telefono niente schede: le statistiche stanno sotto i tre mazzi.
    target: '.team-pick', scroll: true, title: 'Stats',
    text: `Under the three decks, the stats of one deck at a time: pick it in Deck. ${chart}`,
    play: async (g) => {
      g.spot('.team-part');
      await g.click('.team-pick select', tap, pickOption(1));
      await g.wait(1400);
    },
  } : {
    target: '.deck-tabs', title: 'Stats',
    text: `Stats shows one deck at a time: pick it in Deck. ${chart}`,
    play: async (g) => {
      await g.click('.deck-tabs .decks-tab:nth-child(2)', tap, select);
      g.spot('.team-stats');
      await g.click('.team-pick select', tap, pickOption(1));
      await g.wait(1400);
    },
  }];
}
