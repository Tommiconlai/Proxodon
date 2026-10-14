import { useState } from 'react';
import { snapshotFromCard, copiesToAdd, illegalIn, legalityLabel } from './deckModel';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };

// Aggiunta di una carta dalla ricerca (barra o avanzata): snapshot, controllo di legalità, copie
// secondo i modificatori, onAdd(snapshot, { board, qty }) e il messaggio da mostrare.
export function useAddCard(format, onAdd) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const add = async (getCard, e) => {
    const { board, four } = target(e, format); // letti prima dell'await
    setError(null);
    try {
      const snap = snapshotFromCard(await getCard());
      const ban = illegalIn(format, snap);
      if (ban) { setError(`${snap.name}: ${legalityLabel(ban, format)}.`); return; }
      const qty = copiesToAdd(format, snap, four);
      onAdd(snap, { board, qty });
      setStatus(`Added ${qty} ${snap.name}${WHERE[board]}`);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.status === 404 ? 'Card not found.' : err.message || 'Could not add the card.');
    }
  };
  return { add, status, error };
}
