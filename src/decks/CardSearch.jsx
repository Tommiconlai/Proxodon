import { useEffect, useId, useState } from 'react';
import { autocomplete, namedCard, searchCards } from './scryfallSearch';
import { lookupCards } from '../utils/scryfall';
import { snapshotFromCard, copiesToAdd, illegalIn, legalityLabel } from './deckModel';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconSearch, IconPlus, IconX, IconBan } from '../components/icons';

// Modificatori di aggiunta, uguali da tastiera e da mouse: Alt = sideboard (maybeboard in
// Commander, che non ha sideboard), Shift = 4 copie (con le regole di copiesToAdd).
const target = (e, format) => ({ board: e.altKey ? (format === 'commander' ? 'maybe' : 'side') : 'main', four: e.shiftKey });
const thumb = (c) => c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
const WHERE = { main: '', side: ' to sideboard', maybe: ' to maybeboard' };
const front = (name) => name.split(' // ')[0];

export default function CardSearch({ format, onAdd, autoFocus }) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState(null); // { cards, next, total }
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null); // carta Scryfall ingrandita
  const [legalities, setLegalities] = useState(() => new Map()); // nome suggerito → legalities Scryfall
  const listId = useId();
  const text = q.trim();
  const visible = text.length >= 2 ? sugg : [];

  // Autocompletamento: 250 ms dopo l'ultima battuta, la richiesta precedente viene annullata.
  useEffect(() => {
    if (text.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      autocomplete(text, ctrl.signal)
        .then(async (names) => {
          setSugg(names);
          setActive(0);
          // Legalità dei suggerimenti (una richiesta /cards/collection): i nomi non giocabili nel
          // formato restano in lista ma non si aggiungono. Se fallisce, ci pensa il controllo in add.
          try {
            const find = await lookupCards(names.map((n) => ({ name: front(n) })));
            if (!ctrl.signal.aborted) setLegalities(new Map(names.map((n) => [n, find({ name: front(n) })?.legalities])));
          } catch { /* senza dati: nessun nome bloccato in anticipo */ }
        })
        .catch((e) => { if (e.name !== 'AbortError') setSugg([]); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);

  // Stato di legalità di un nome suggerito (null = giocabile o non ancora noto).
  const banOf = (name) => {
    const l = legalities.get(name);
    return l ? illegalIn(format, { legal: l }) : null;
  };

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
  const addSuggestion = (name, e) => {
    const ban = banOf(name);
    if (ban) { setError(`${name}: ${legalityLabel(ban, format)}.`); return; }
    setQ('');
    setSugg([]);
    add(() => namedCard(name), e);
  };

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
            {visible.map((n, i) => {
              const ban = banOf(n);
              return (
                <li key={n} id={`${listId}-${i}`} role="option" aria-selected={i === active} aria-disabled={ban ? true : undefined}
                  className={`${i === active ? 'active' : ''}${ban ? ' banned' : ''}`} title={ban ? legalityLabel(ban, format) : undefined}
                  onMouseDown={(e) => { e.preventDefault(); if (!ban) addSuggestion(n, e); }} onMouseEnter={() => setActive(i)}>
                  <span className="search-suggest-name">{n}</span>
                  {ban && <span className="search-ban"><IconBan size={12} /> {ban === 'banned' ? 'Banned' : 'Not legal'}</span>}
                </li>
              );
            })}
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
                {results.cards.map((c) => {
                  const ban = illegalIn(format, { legal: c.legalities });
                  const why = ban && legalityLabel(ban, format);
                  return (
                    <li key={c.id} className={`search-card${ban ? ' banned' : ''}`}>
                      <button type="button" className="search-card-img" onClick={() => setZoom(c)} onKeyDown={enterAdds(c)}
                        aria-label={ban ? `${c.name}. ${why}. Space to enlarge` : `${c.name}. Enter to add, Space to enlarge`}>
                        <img src={thumb(c)} alt="" loading="lazy" />
                      </button>
                      {ban && <span className="deck-card-ban search-card-ban" title={why}><IconBan size={13} /></span>}
                      <button type="button" className="search-card-add" aria-label={ban ? `${c.name}: ${why}` : `Add ${c.name}`} title={why || undefined}
                        disabled={!!ban} onClick={(e) => add(async () => c, e)} onKeyDown={enterAdds(c)}>
                        {ban ? <IconBan size={16} /> : <IconPlus size={16} />}
                      </button>
                    </li>
                  );
                })}
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
