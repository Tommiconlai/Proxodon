import { useState } from 'react';
import { boardCounts, toPrintEntries } from './deckModel';
import { deckTokens } from './scryfallSearch';
import { useSettings } from '../utils/settings';
import { PrintDeckDialog } from './dialogs';

// Print deck (editor e Team Trios): i token delle carte che vanno in stampa (main, e sideboard se inclusa), di solito
// già in cache dalla sezione Tokens; Scryfall giù = nessun token, si stampa il mazzo. Nessuna domanda se la coda è
// vuota e non c'è né sideboard né token. → [start(deck), dialog]: dialog (la domanda, o niente) va messo nella pagina.
export function usePrintDeck(printQueueCount, onPrintDeck) {
  const settings = useSettings(); // aggiungi o sostituisci, sideboard
  const [open, setOpen] = useState(null); // { deck, side, main, all }: i token senza e con la sideboard
  const tokensOf = (deck, side) => deckTokens(deck.cards.filter((r) => r.board === 'main' || (side && r.board === 'side')))
    .then((l) => l.map((t) => t.card), () => []);
  const start = async (deck) => {
    const side = boardCounts(deck).side;
    const all = await tokensOf(deck, true);
    const main = side ? await tokensOf(deck, false) : all; // dopo all: le carte sono già in cache
    if (!side && !main.length && (!printQueueCount || settings.printAdd)) onPrintDeck(toPrintEntries(deck), settings.printAdd);
    else setOpen({ deck, side, main, all });
  };
  const dialog = open && (
    <PrintDeckDialog queueCount={printQueueCount} sideCount={open.side} tokens={open} add={settings.printAdd} defaultSide={settings.printSide}
      onClose={() => setOpen(null)}
      onConfirm={(side, tokens) => { setOpen(null); onPrintDeck(toPrintEntries(open.deck, { includeSide: side, tokens }), settings.printAdd); }} />
  );
  return [start, dialog];
}
