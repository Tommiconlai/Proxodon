import { useEffect, useId, useState } from 'react';
import { autocomplete, namedCard, searchCards } from './scryfallSearch';
import { snapshotFromCard, copiesToAdd } from './deckModel';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconSearch, IconPlus, IconX } from '../components/icons';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const thumb = (c) => c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };

export default function CardSearch({ format, onAdd, autoFocus }) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState(null); // { cards, next, total }
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null); // carta Scryfall ingrandita
  const listId = useId();
  const text = q.trim();
  const visible = text.length >= 2 ? sugg : [];

  // Autocompletamento: 250 ms dopo l'ultima battuta, la richiesta precedente viene annullata.
  useEffect(() => {
    if (text.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      autocomplete(text, ctrl.signal)
        .then((names) => { setSugg(names); setActive(0); })
        .catch((e) => { if (e.name !== 'AbortError') setSugg([]); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);

  const add = async (getCard, e) => {
    const { board, four } = target(e, format); // letti prima dell'await
    setError(null);
    try {
      const snap = snapshotFromCard(await getCard());
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
    setSugg([]);
    try {
      const r = await searchCards(text, undefined, pageUrl);
      setResults((prev) => (pageUrl && prev ? { ...r, cards: [...prev.cards, ...r.cards] } : r));
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && visible.length) { e.preventDefault(); setActive((i) => (i + 1) % visible.length); }
    else if (e.key === 'ArrowUp' && visible.length) { e.preventDefault(); setActive((i) => (i - 1 + visible.length) % visible.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (visible.length) addSuggestion(visible[Math.min(active, visible.length - 1)], e);
      else runSearch();
    } else if (e.key === 'Escape' && visible.length) { e.stopPropagation(); setSugg([]); }
  };
  // Enter (con i modificatori) su un risultato o sul suo + aggiunge; il click sull'immagine ingrandisce.
  const enterAdds = (c) => (e) => { if (e.key === 'Enter') { e.preventDefault(); add(async () => c, e); } };

  return (
    <div className="card-search">
      <div className="search-wrap">
        <div className="search-box">
          <IconSearch size={16} />
          <input role="combobox" aria-label="Search cards" aria-expanded={visible.length > 0} aria-controls={listId}
            aria-autocomplete="list" aria-activedescendant={visible.length ? `${listId}-${active}` : undefined}
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
      <p className="search-hint">Enter adds 1 · Shift+Enter 4 · Alt+Enter to {format === 'commander' ? 'maybeboard' : 'sideboard'}</p>
      <p className="search-status" role="status">{status}</p>
      {error && <div className="info-box info-box-error"><span>{error}</span></div>}

      {results && (
        results.cards.length === 0
          ? <p className="deck-empty">No cards found.</p>
          : (
            <>
              <p className="search-count">{results.total} result{results.total !== 1 ? 's' : ''}</p>
              <ul className="search-results">
                {results.cards.map((c) => (
                  <li key={c.id} className="search-card">
                    <button type="button" className="search-card-img" onClick={() => setZoom(c)} onKeyDown={enterAdds(c)}
                      aria-label={`${c.name}. Enter to add, Space to enlarge`}>
                      <img src={thumb(c)} alt="" loading="lazy" />
                    </button>
                    <button type="button" className="search-card-add" aria-label={`Add ${c.name}`}
                      onClick={(e) => add(async () => c, e)} onKeyDown={enterAdds(c)}>
                      <IconPlus size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              {results.next && <button type="button" className="btn-secondary search-more" onClick={() => runSearch(results.next)} disabled={busy}>Load more</button>}
            </>
          )
      )}
      {zoom && <CardZoom card={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function CardZoom({ card, onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card-zoom-wrap" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={card.name}>
        <img className="card-zoom" src={card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large || thumb(card)} alt={card.name} />
        <button type="button" className="modal-close card-zoom-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
      </div>
    </div>
  );
}
