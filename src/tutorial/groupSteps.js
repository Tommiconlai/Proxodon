import { pointAt } from './control';
import { IconPlus, IconMinus, IconTrash, IconImage } from '../components/icons';

// Passi del tutorial della lista di gruppo (GroupStage in GroupTour): testata, membri, ricerca, chi ha messo cosa, menu
// delle proprie carte, stampa.
export function groupSteps(mobile) {
  // Sol Ring, la terza carta: il menu si apre a destra della scheda del passo (ogni passo riparte con 2 copie).
  const menuSpec = { title: 'Sol Ring', items: [[IconPlus, 'Add 1'], [IconMinus, 'Remove 1'], [IconTrash, 'Remove all (2)', true], [IconImage, 'Change edition']] };
  return [{
    target: '.group-head', title: 'A group list',
    text: 'A card list you share with other players, to print together. This is a demo copy: nothing you do here changes your lists.',
  }, {
    target: '.group-members', title: 'Members',
    text: 'Who is in the list; the crown is who created it. The creator invites by nickname, or turns on an invite link and copies it. The others can leave the list.',
    play: (g) => pointAt(g, [
      ['.group-invite input', 'Invite by nickname'],
      ['.group-invite [aria-label="Turn off the invite link"]', 'Invite link'],
      ['.group-invite [aria-label="Copy the invite link"]', 'Copy'],
    ]),
  }, {
    target: '.group-search', title: 'Add cards',
    text: 'Search a card and press Enter, as in a deck (Shift+Enter adds 4): the same printing you already added gets one more copy. From a deck: right-click or long-press a card, To group list.',
    play: async (g) => {
      await g.type('.group-search input', 'Sol', g.api.query);
      await g.wait(500);
      g.say('Enter');
      await g.wait(600);
      g.api.query('');
      g.api.rows((l) => l.map((r) => (r.id === 'g1' ? { ...r, qty: r.qty + 1 } : r)));
      g.spot('.group-cards');
      await g.move('[data-row="g1"]');
      g.say('+1');
      await g.wait(1200);
    },
  }, {
    target: '.group-cards', title: 'Who added what',
    text: 'Every card shows the nickname of who added it. You change or remove only your own cards; the others belong to whoever added them.',
    play: (g) => pointAt(g, [['[data-row="g2"] .group-card-by', 'by mira'], ['[data-row="g1"] .group-card-by', 'Yours']]),
  }, {
    target: '.group-cards', title: 'Card options',
    text: mobile ? 'Long-press one of your cards: Add 1, Remove 1, Remove all, Change edition.'
      : 'Click or right-click one of your cards: Add 1, Remove 1, Remove all, Change edition (the printings grid, as in a deck).',
    play: (g) => g.menu('[data-row="g1"] .group-card-btn', menuSpec, mobile ? { text: 'Long press', hold: true } : {}),
  }, {
    target: '.group-actions', title: 'Print it',
    text: 'Print sends every copy of every member to the print sheet, like Print deck. The creator deletes the list for everyone; the others leave it, and their cards go with them.',
    play: (g) => pointAt(g, [['.group-actions [aria-label="Print the list"]', 'Print'], ['.group-actions [aria-label="Delete the list"]', 'Delete']]),
  }];
}
