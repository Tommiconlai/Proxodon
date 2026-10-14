import { useEffect, useId, useState } from 'react';
import { autocomplete, namedCard } from './scryfallSearch';
import { lookupCards } from '../utils/scryfall';
import { snapshotFromCard, copiesToAdd, illegalIn, legalityLabel } from './deckModel';
import AdvancedSearch from './AdvancedSearch';
import { IconSearch } from '../components/icons';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };
const front = (name) => name.split(' // ')[0];

// Ricerca per nome: solo il menu a tendina dei suggerimenti; le frecce scelgono, Invio aggiunge
// (Shift = 4, Alt = sideboard). Le carte bandite o non legali nel formato non compaiono.
// "Advanced search" apre i filtri con le immagini.
export default function CardSearch({ format, onAdd, autoFocus }) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [emptyFor, setEmptyFor] = useState(null); // testo per cui nessuna carta giocabile corrisponde
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [hideFor, setHideFor] = useState(null); // dopo Esc la tendina resta chiusa per quel testo
  const listId = useId();
  const text = q.trim();
  const open = text.length >= 2 && hideFor !== text;
  const visible = open ? sugg : [];
  const noMatch = open && emptyFor === text;

  // Autocompletamento: 250 ms dopo l'ultima battuta, la richiesta precedente viene annullata. Fuori
  // da Casual i nomi passano da una richiesta /cards/collection per togliere bandite e non legali;
  // se fallisce restano tutti (il controllo in add li ferma comunque).
  useEffect(() => {
    if (text.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      autocomplete(text, ctrl.signal)
        .then(async (names) => {
          let shown = names;
          if (format !== 'casual' && names.length) {
            try {
              const find = await lookupCards(names.map((n) => ({ name: front(n) })));
              shown = names.filter((n) => {
                const c = find({ name: front(n) });
                return !c || !illegalIn(format, { legal: c.legalities });
              });
            } catch { /* senza dati: nessun filtro */ }
          }
          if (!ctrl.signal.aborted) { setSugg(shown); setActive(0); setEmptyFor(shown.length ? null : text); }
        })
        .catch((e) => { if (e.name !== 'AbortError') setSugg([]); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text, format]);

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
  const addSuggestion = (name, e) => { setQ(''); setSugg([]); add(() => namedCard(name), e); };

  const onKeyDown = (e) => {
    const n = visible.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); setActive((i) => (i + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); setActive((i) => (i - 1 + n) % n); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (n) addSuggestion(visible[Math.min(active, n - 1)], e);
    } else if (e.key === 'Escape' && (n || noMatch)) { e.stopPropagation(); setHideFor(text); }
  };

  return (
    <div className={`card-search${advanced ? ' adv-open' : ''}`}>
      <div className="search-wrap">
        <div className="search-box">
          <IconSearch size={16} />
          <input role="combobox" aria-label="Search cards" aria-expanded={visible.length > 0} aria-controls={listId}
            aria-autocomplete="list" aria-activedescendant={visible.length ? `${listId}-${active}` : undefined}
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search a card name" autoFocus={autoFocus} spellCheck={false} autoComplete="off" />
        </div>
        {visible.length > 0 && (
          <ul id={listId} role="listbox" className="search-suggest">
            {visible.map((n, i) => (
              <li key={n} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined}
                onMouseDown={(e) => { e.preventDefault(); addSuggestion(n, e); }} onMouseEnter={() => setActive(i)}>{n}</li>
            ))}
          </ul>
        )}
        {noMatch && <p className="search-suggest search-none" role="status">No playable card with this name.</p>}
      </div>
      <p className="search-hint">Enter adds 1 · Shift+Enter 4 · Alt+Enter to {format === 'commander' ? 'maybeboard' : 'sideboard'} · ↑↓ to choose</p>
      <button type="button" className="search-adv-toggle" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
        {advanced ? 'Hide advanced search' : 'Advanced search'}
      </button>
      <p className="search-status" role="status">{status}</p>
      {error && <div className="info-box info-box-error"><span>{error}</span></div>}

      {advanced && <AdvancedSearch format={format} onPick={add} />}

    </div>
  );
}
