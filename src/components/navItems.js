import { IconNavCommunity, IconNavDilemmas, IconNavHelp, IconNavDecks, IconNavPrint } from './icons';

// Voci del menu della X (MobileNav), le stesse in ogni pagina: [chiave, etichetta, href, Icon].
const ITEMS = [
  ['community', 'Community', '#/community', IconNavCommunity],
  ['dilemmas', 'Dilemmas', '#/dilemmas', IconNavDilemmas],
  ['help', 'Help', '#/help', IconNavHelp],
  ['mine', 'My decks', '#/decks', IconNavDecks],
  ['print', 'Print', '#/print', IconNavPrint],
];
const AREA = { print: 'print', community: 'community', dilemmas: 'dilemmas', help: 'help', decks: 'mine' };

// Accesa la voce dell'area della rotta: un mazzo sta in My decks, uno della Community in Community; profilo e
// impostazioni nessuna.
export const navItems = (route = '') => ({ items: ITEMS, current: AREA[route.split('/')[1]] ?? null });
