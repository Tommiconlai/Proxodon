import { useEffect, useId, useState } from 'react';
import { autocomplete, namedCard } from './scryfallSearch';
import { lookupCards } from '../utils/scryfall';
import { blockedIn } from './deckModel';
import { useAddCard } from './useAddCard';
import AdvancedSearch from './AdvancedSearch';
import { IconDeckSearch } from '../components/icons';

const front = (name) => name.split(' // ')[0];

// Ricerca per nome: solo il menu a tendina dei suggerimenti; le frecce scelgono, Invio aggiunge
// (Shift = 4, Alt = sideboard). Le carte bandite o non legali nel formato non compaiono, né (identity, da
// searchIdentity) quelle fuori dai colori del comandante.
// "Advanced search": se il genitore passa onAdvanced (desktop, ricerca nella testata) apre il suo
// pannello fuori da qui; altrimenti i filtri si aprono qui sotto. noAdvanced = solo il nome (editor da telefono,
// dove il tasto filtri sta in DeckTopBar; zona Suggestions delle help request, dove il pannello non ci sta).
export default function CardSearch({ format, identity, onAdd, notify, autoFocus, advanced: advancedProp, onAdvanced, noAdvanced }) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [emptyFor, setEmptyFor] = useState(null); // testo per cui nessuna carta giocabile corrisponde
  const [active, setActive] = useState(0);
  const [ownAdvanced, setOwnAdvanced] = useState(false);
  const [hideFor, setHideFor] = useState(null); // dopo Esc la tendina resta chiusa per quel testo
  const { add } = useAddCard(format, onAdd, notify);
  const listId = useId();
  const controlled = typeof onAdvanced === 'function';
  const advanced = controlled ? !!advancedProp : ownAdvanced;
  const text = q.trim();
  const open = text.length >= 2 && hideFor !== text;
  const visible = open ? sugg : [];
  const noMatch = open && emptyFor === text;
  const idKey = identity ? identity.join('') : null; // stringa: l'array cambia a ogni render del genitore

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
                return !c || (!blockedIn(format, { legal: c.legalities, type: c.type_line || '', rarity: c.rarity }) && (idKey === null || (c.color_identity || []).every((x) => idKey.includes(x))));
              });
            } catch { /* senza dati: nessun filtro */ }
          }
          if (!ctrl.signal.aborted) { setSugg(shown); setActive(0); setEmptyFor(shown.length ? null : text); }
        })
        .catch((e) => { if (e.name !== 'AbortError') setSugg([]); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text, format, idKey]);

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
    <div className="card-search">
      <div className="search-wrap">
        <div className="search-box">
          <IconDeckSearch />
          <input role="combobox" aria-label="Search cards" aria-expanded={visible.length > 0} aria-controls={listId}
            aria-autocomplete="list" aria-activedescendant={visible.length ? `${listId}-${active}` : undefined}
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search a card name" autoFocus={autoFocus} data-autofocus={autoFocus || undefined} spellCheck={false} autoComplete="off" />
        </div>
        {visible.length > 0 && (
          <ul id={listId} role="listbox" className="search-suggest">
            {visible.map((n, i) => (
              <li key={n} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined}
                onMouseDown={(e) => { e.preventDefault(); addSuggestion(n, e); }} onMouseEnter={() => setActive(i)}>{n}</li>
            ))}
          </ul>
        )}
        {noMatch && <p className="search-suggest search-none" role="status">{idKey === null ? 'No playable card with this name.' : 'No playable card with this name in the commander\'s colors.'}</p>}
      </div>
      {!noAdvanced && (
        <div className="search-foot">
          <button type="button" className="search-adv-toggle" aria-expanded={advanced}
            onClick={() => (controlled ? onAdvanced(!advanced) : setOwnAdvanced((v) => !v))}>
            {advanced ? 'Hide advanced search' : 'Advanced search'}
          </button>
        </div>
      )}
      {advanced && !controlled && !noAdvanced && <AdvancedSearch format={format} identity={identity} onAdd={onAdd} notify={notify} />}
    </div>
  );
}
