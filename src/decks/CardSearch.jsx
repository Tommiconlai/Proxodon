import { useEffect, useId, useState } from 'react';
import { autocomplete, namedCard, searchCards, withLegal } from './scryfallSearch';
import { lookupCards } from '../utils/scryfall';
import { snapshotFromCard, copiesToAdd, illegalIn, legalityLabel } from './deckModel';
import { ManaCost } from './Mana';
import AdvancedSearch from './AdvancedSearch';
import { IconSearch } from '../components/icons';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };
const front = (name) => name.split(' // ')[0];
const manaOf = (c) => c.mana_cost ?? c.card_faces?.[0]?.mana_cost ?? '';
const typeOf = (c) => (c.type_line || c.card_faces?.[0]?.type_line || '').split(' // ')[0];

// Ricerca per nome: suggerimenti mentre scrivi, Invio (o la lente) = elenco dei risultati, senza
// immagini. Su entrambi le frecce scelgono e Invio aggiunge (Shift = 4, Alt = sideboard). Le carte
// bandite o non legali nel formato non compaiono. "Advanced search" apre i filtri con le immagini.
export default function CardSearch({ format, onAdd, autoFocus }) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState(null); // { cards, next, total, q }
  const [activeRes, setActiveRes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  // Testo per cui i suggerimenti restano chiusi: dopo una ricerca o Esc (anche se arrivano in ritardo).
  const [hideFor, setHideFor] = useState(null);
  const listId = useId();
  const resId = useId();
  const text = q.trim();
  const visible = text.length >= 2 && hideFor !== text ? sugg : [];
  // Le frecce guidano i suggerimenti se aperti, sennò i risultati della ricerca per questo testo.
  const onResults = !visible.length && results?.cards.length > 0 && results.q === text;

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
          if (!ctrl.signal.aborted) { setSugg(shown); setActive(0); }
        })
        .catch((e) => { if (e.name !== 'AbortError') setSugg([]); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text, format]);

  // La riga attiva dei risultati resta visibile mentre si scorre con le frecce.
  useEffect(() => {
    if (onResults) document.getElementById(`${resId}-${activeRes}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeRes, onResults, resId]);

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

  const runSearch = async (pageUrl) => {
    if (!text && !pageUrl) return;
    setBusy(true);
    setError(null);
    setHideFor(text);
    try {
      const r = await searchCards(withLegal(text, format), undefined, pageUrl);
      setResults((prev) => (pageUrl && prev ? { ...r, cards: [...prev.cards, ...r.cards], q: prev.q } : { ...r, q: text }));
      if (!pageUrl) setActiveRes(0);
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    const n = visible.length || (onResults ? results.cards.length : 0);
    const move = visible.length ? setActive : setActiveRes;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); move((i) => (i + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); move((i) => (i - 1 + n) % n); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (visible.length) addSuggestion(visible[Math.min(active, visible.length - 1)], e);
      else if (onResults) { const c = results.cards[Math.min(activeRes, results.cards.length - 1)]; add(async () => c, e); }
      else runSearch();
    } else if (e.key === 'Escape' && visible.length) { e.stopPropagation(); setHideFor(text); }
  };

  return (
    <div className={`card-search${advanced ? ' adv-open' : ''}`}>
      <div className="search-wrap">
        <div className="search-box">
          <IconSearch size={16} />
          <input role="combobox" aria-label="Search cards" aria-expanded={visible.length > 0 || onResults}
            aria-controls={visible.length ? listId : resId} aria-autocomplete="list"
            aria-activedescendant={visible.length ? `${listId}-${active}` : onResults ? `${resId}-${activeRes}` : undefined}
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search a card name" autoFocus={autoFocus} spellCheck={false} autoComplete="off" />
          <button type="button" className="search-go" onClick={() => runSearch()} disabled={!text || busy} aria-label="Show results">
            {busy ? <span className="import-spinner" /> : <IconSearch size={15} />}
          </button>
        </div>
        {visible.length > 0 && (
          <ul id={listId} role="listbox" className="search-suggest">
            {visible.map((n, i) => (
              <li key={n} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined}
                onMouseDown={(e) => { e.preventDefault(); addSuggestion(n, e); }} onMouseEnter={() => setActive(i)}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="search-hint">Enter adds 1 · Shift+Enter 4 · Alt+Enter to {format === 'commander' ? 'maybeboard' : 'sideboard'} · ↑↓ to choose</p>
      <button type="button" className="search-adv-toggle" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
        {advanced ? 'Hide advanced search' : 'Advanced search'}
      </button>
      <p className="search-status" role="status">{status}</p>
      {error && <div className="info-box info-box-error"><span>{error}</span></div>}

      {advanced && <AdvancedSearch format={format} onPick={add} />}

      {!advanced && results && (
        results.cards.length === 0
          ? <p className="deck-empty">No cards found.</p>
          : (
            <>
              <p className="search-count">{results.total} result{results.total !== 1 ? 's' : ''}</p>
              <ul id={resId} role="listbox" aria-label="Search results" className="search-list">
                {results.cards.map((c, i) => (
                  <li key={c.id} id={`${resId}-${i}`} role="option" aria-selected={onResults && i === activeRes}
                    className={onResults && i === activeRes ? 'active' : undefined}
                    onMouseDown={(e) => { e.preventDefault(); add(async () => c, e); }} onMouseEnter={() => setActiveRes(i)}>
                    <span className="search-list-name">{c.name}</span>
                    <ManaCost cost={manaOf(c)} />
                    <span className="search-list-type">{typeOf(c)}</span>
                  </li>
                ))}
              </ul>
              {results.next && <button type="button" className="btn-secondary search-more" onClick={() => runSearch(results.next)} disabled={busy}>Load more</button>}
            </>
          )
      )}
    </div>
  );
}
