import { snapshotFromCard, copiesToAdd, illegalIn, legalityLabel } from './deckModel';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };

// Aggiunta di una carta dalla ricerca (barra o avanzata): snapshot, controllo di legalità, copie
// secondo i modificatori, onAdd(snapshot, { board, qty }); esito ed errori nel toast (notify).
export function useAddCard(format, onAdd, notify) {
  const add = async (getCard, e) => {
    const { board, four } = target(e, format); // letti prima dell'await
    try {
      const snap = snapshotFromCard(await getCard());
      const ban = illegalIn(format, snap);
      if (ban) { notify(`${snap.name}: ${legalityLabel(ban, format)}.`, 'error'); return; }
      const qty = copiesToAdd(format, snap, four);
      onAdd(snap, { board, qty });
      notify(`Added ${qty} ${snap.name}${WHERE[board]}`);
    } catch (err) {
      if (err.name !== 'AbortError') notify(err.status === 404 ? 'Card not found.' : err.message || 'Could not add the card.', 'error');
    }
  };
  return { add };
}
