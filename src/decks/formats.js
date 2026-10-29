/**
 * Formati dei mazzi e regole di costruzione. Solo formati da carta: niente formati di Arena (Alchemy, Historic,
 * Timeless, Explorer, Brawl, Gladiator). id = chiave delle legalità di Scryfall (`legal:<id>` nella ricerca).
 * size = carte del mazzo, comandanti compresi (exact: esattamente, sennò almeno); copies = copie per nome (terre
 * base e "any number" a parte); side = sideboard massima (0 = nessuna); cmd = chi guida il mazzo dalla zona di
 * comando (legend = creatura leggendaria, uncommon = creatura non comune, walker = planeswalker + signature spell),
 * max = righe nella zona; multi = multigiocatore (primo mulligan gratis, regola 103.5c). Casual: nessuna regola.
 * Fuori: Old School (dati Scryfall vuoti) e Canadian Highlander (lista a punti).
 */
const SIXTY = { size: 60, copies: 4, side: 15 };
const HUNDRED = { size: 100, exact: true, copies: 1, side: 0, cmd: 'legend', max: 2 };

export const FORMATS = [
  { id: 'commander', label: 'Commander', ...HUNDRED, multi: true },
  { id: 'duel', label: 'Duel Commander', ...HUNDRED },
  { id: 'paupercommander', label: 'Pauper Commander', ...HUNDRED, cmd: 'uncommon', multi: true },
  { id: 'predh', label: 'PreDH', ...HUNDRED, multi: true },
  { id: 'oathbreaker', label: 'Oathbreaker', size: 60, exact: true, copies: 1, side: 0, cmd: 'walker', max: 4, multi: true },
  { id: 'tlr', label: 'Tiny Leaders', size: 50, exact: true, copies: 1, side: 10, cmd: 'legend', max: 2 },
  { id: 'standard', label: 'Standard', ...SIXTY },
  { id: 'pioneer', label: 'Pioneer', ...SIXTY },
  { id: 'modern', label: 'Modern', ...SIXTY },
  { id: 'premodern', label: 'Premodern', ...SIXTY },
  { id: 'legacy', label: 'Legacy', ...SIXTY },
  { id: 'vintage', label: 'Vintage', ...SIXTY },
  { id: 'pauper', label: 'Pauper', ...SIXTY },
  { id: 'penny', label: 'Penny Dreadful', ...SIXTY },
  { id: 'casual', label: 'Casual', copies: Infinity, side: Infinity },
];
export const LEGAL_FORMATS = FORMATS.filter((f) => f.id !== 'casual').map((f) => f.id);
// Team Trios: mazzi da 60 e Casual, niente zona di comando.
export const TEAM_FORMATS = FORMATS.filter((f) => !f.cmd);
// Formato ignoto (mazzi di versioni future, file): come Casual, nessun controllo.
export const formatRules = (id) => FORMATS.find((f) => f.id === id) || FORMATS[FORMATS.length - 1];
export const formatLabel = (id) => FORMATS.find((f) => f.id === id)?.label || id;

// Chi guida il mazzo: nella ricerca (query Scryfall) e nel nome della zona di comando.
const LEADER_QUERY = { legend: 'is:commander', uncommon: 'r:uncommon (t:creature or t:background)', walker: 't:planeswalker' };
export const leaderQuery = (id) => LEADER_QUERY[formatRules(id).cmd] || 'is:commander';
export const leaderNoun = (id) => (formatRules(id).cmd === 'walker' ? 'oathbreaker' : 'commander');
