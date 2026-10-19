import { useSyncExternalStore } from 'react';
import {
  IconNavCommunity, IconNavDilemmas, IconNavHelp, IconNavDecks, IconNavPrint, IconNavDeck, IconNavStats, IconNavAdd, IconNavSettings, IconNavExport,
} from './icons';

// Voci del menu della X (MobileNav): [chiave, etichetta, href (null = scheda del mazzo), Icon].
const COMMUNITY = ['community', 'Community', '#/community', IconNavCommunity];
const MINE = ['mine', 'My decks', '#/decks', IconNavDecks];
const LIST = [COMMUNITY, ['dilemmas', 'Dilemmas', '#/dilemmas', IconNavDilemmas], ['help', 'Help', '#/help', IconNavHelp], MINE];
const PRINT = ['print', 'Print', '#/print', IconNavPrint];
// Pagina Print: le sue azioni (pulsanti, onAction di MobileNav) e My decks; niente schede dei mazzi.
const PRINT_PAGE = [['add', 'Add cards', null, IconNavAdd], ['settings', 'Settings', null, IconNavSettings], ['export', 'Export', null, IconNavExport], MINE];
const DECK = [['deck', 'Deck', null, IconNavDeck], ['stats', 'Stats', null, IconNavStats], ['dilemmas', 'Dilemmas', null, IconNavDilemmas],
  ['help', 'Help', null, IconNavHelp]];

// Pagine della lista, profilo e impostazioni: le quattro schede e Print, accesa quella della rotta. Print: Add cards,
// Settings, Export e My decks. In un mazzo (deck = { tab, back }): prima il ritorno alla lista (My decks, o Community per
// un mazzo altrui), poi Deck / Stats / Dilemmas / Help, poi Print.
export function navItems(deck, route = '') {
  if (deck) return { items: [deck.back === 'community' ? COMMUNITY : MINE, ...DECK, PRINT], current: deck.tab };
  if (route === '/print') return { items: PRINT_PAGE, current: null };
  return { items: [...LIST, PRINT], current: { community: 'community', dilemmas: 'dilemmas', help: 'help', decks: 'mine' }[route.split('/')[1]] ?? null };
}

// Schede del mazzo aperto da telefono e tablet (DeckEditor, CommunityDeck): { tab, onTab, back: 'mine' | 'community' }
// o null; il menu le legge da qui al posto delle voci della lista.
let open = null;
const subs = new Set();
export function setDeckNav(v) {
  open = v;
  subs.forEach((f) => f());
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useDeckNav = () => useSyncExternalStore(subscribe, () => open, () => null);
