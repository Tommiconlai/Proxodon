import { useId, useMemo, useState } from 'react';
import { advancedQuery, withLegal, searchCards } from './scryfallSearch';
import { ManaCost } from './Mana';
import { useAddCard } from './useAddCard';
import { snapshotFromCard } from './deckModel';
import { CardView } from './DeckSections';
import { CardFrame, CardFrameDefs } from '../components/CardFrame';
import { IconSearch, IconPlus } from '../components/icons';

const EMPTY = {
  name: '', oracle: '', type: '', manaCost: '', mvOp: '=', mv: '', colors: [], colorless: false, colorMode: '>=',
  idColors: [], idColorless: false, idMode: '<=', rarity: '', set: '', powOp: '=', pow: '', touOp: '=', tou: '', keyword: '', artist: '', isCommander: false, extra: '',
};
const COLORS = ['W', 'U', 'B', 'R', 'G'];
const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
const OPS = ['=', '<', '<=', '>', '>='];
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle', 'Legendary', 'Equipment', 'Aura', 'Vehicle'];
const ORDERS = [{ id: 'name', label: 'Name' }, { id: 'cmc', label: 'Mana value' }, { id: 'edhrec', label: 'Popularity' }, { id: 'released', label: 'Newest' }];
const thumb = (c) => c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
const oidOf = (c) => c.oracle_id || c.card_faces?.[0]?.oracle_id || c.id; // come snapshotFromCard

// Ricerca avanzata: filtri → query Scryfall (sempre giocabile nel formato del mazzo), risultati con
// immagine. Click sull'immagine = ingrandisci; + (o Invio sulla carta) aggiunge, con gli stessi
// modificatori della ricerca per nome (useAddCard, che controlla anche la legalità). identity = colori del
// comandante (searchIdentity): fuori le carte che non ci stanno. deckCards = le righe del mazzo: i risultati già
// presenti (in qualsiasi board) hanno la cornice della carta selezionata (.marked).
export default function AdvancedSearch({ format, identity, onAdd, notify, deckCards }) {
  const { add: onPick } = useAddCard(format, onAdd, notify);
  const [f, setF] = useState(EMPTY);
  const [order, setOrder] = useState('name');
  const [results, setResults] = useState(null); // { cards, next, total }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const id = useId();
  const inDeck = useMemo(() => new Set((deckCards || []).map((r) => r.card.oid)), [deckCards]);
  const field = (k) => ({ id: `${id}-${k}`, value: f[k], onChange: (e) => setF((x) => ({ ...x, [k]: e.target.value })) });
  const check = (k) => ({ checked: f[k], onChange: (e) => setF((x) => ({ ...x, [k]: e.target.checked })) });
  // Pips e confronto di una riga: colori della carta (colors, colorless, colorMode) o identità (idColors, ...).
  // Incolore esclude i colori e viceversa.
  const colorSet = (legend, cs, cl, mk) => {
    const toggle = (c) => setF((x) => (c === 'C'
      ? { ...x, [cl]: !x[cl], [cs]: [] }
      : { ...x, [cl]: false, [cs]: x[cs].includes(c) ? x[cs].filter((y) => y !== c) : [...x[cs], c] }));
    return (
      <fieldset className="adv-field adv-colors">
        <legend>{legend}</legend>
        <div className="adv-pips">
          {[...COLORS, 'C'].map((c) => {
            const on = c === 'C' ? f[cl] : f[cs].includes(c);
            return (
              <label key={c} className={`adv-pip${on ? ' on' : ''}`} title={COLOR_NAME[c]}>
                <input type="checkbox" checked={on} onChange={() => toggle(c)} aria-label={COLOR_NAME[c]} />
                <ManaCost cost={`{${c}}`} />
              </label>
            );
          })}
        </div>
        <select aria-label={`${legend} match`} value={f[mk]} disabled={f[cl]} onChange={(e) => setF((x) => ({ ...x, [mk]: e.target.value }))}>
          <option value=">=">Including these</option>
          <option value="=">Exactly these</option>
          <option value="<=">At most these</option>
        </select>
      </fieldset>
    );
  };

  const run = async (pageUrl) => {
    const q = advancedQuery(f);
    if (!q && !pageUrl) { setError('Set at least one filter.'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await searchCards(withLegal(q, format, identity), undefined, pageUrl, order);
      setResults((prev) => (pageUrl && prev ? { ...r, cards: [...prev.cards, ...r.cards] } : r));
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setBusy(false);
    }
  };
  const enterAdds = (c) => (e) => { if (e.key === 'Enter') { e.preventDefault(); onPick(async () => c, e); } };
  const opSelect = (k, label) => (
    <select className="adv-op" aria-label={`${label} comparison`} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}>
      {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <section className="adv-search" aria-label="Advanced search">
      <form className="adv-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label className="adv-field" htmlFor={`${id}-name`}><span>Card name</span>
          <input className="import-link-input" {...field('name')} placeholder="Bolt" spellCheck={false} />
        </label>
        <label className="adv-field" htmlFor={`${id}-oracle`}><span>Oracle text</span>
          <input className="import-link-input" {...field('oracle')} placeholder="draw a card" spellCheck={false} />
        </label>
        <label className="adv-field" htmlFor={`${id}-type`}><span>Type</span>
          <input className="import-link-input" {...field('type')} list={`${id}-types`} placeholder="Creature Goblin" spellCheck={false} />
          <datalist id={`${id}-types`}>{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className="adv-field" htmlFor={`${id}-manaCost`}><span>Mana cost</span>
          <input className="import-link-input" {...field('manaCost')} placeholder="{2}{R}" spellCheck={false} />
        </label>
        <div className="adv-field"><span>Mana value</span>
          <div className="adv-row">{opSelect('mvOp', 'Mana value')}<input className="import-link-input" type="number" min="0" aria-label="Mana value" {...field('mv')} placeholder="3" /></div>
        </div>
        <label className="adv-field" htmlFor={`${id}-rarity`}><span>Rarity</span>
          <select {...field('rarity')}>
            <option value="">Any</option>
            <option value="common">Common</option>
            <option value="uncommon">Uncommon</option>
            <option value="rare">Rare</option>
            <option value="mythic">Mythic</option>
          </select>
        </label>

        {colorSet('Colors', 'colors', 'colorless', 'colorMode')}
        {colorSet('Color identity', 'idColors', 'idColorless', 'idMode')}

        <div className="adv-field"><span>Power</span>
          <div className="adv-row">{opSelect('powOp', 'Power')}<input className="import-link-input" type="number" min="0" aria-label="Power" {...field('pow')} /></div>
        </div>
        <div className="adv-field"><span>Toughness</span>
          <div className="adv-row">{opSelect('touOp', 'Toughness')}<input className="import-link-input" type="number" min="0" aria-label="Toughness" {...field('tou')} /></div>
        </div>
        <label className="adv-field" htmlFor={`${id}-keyword`}><span>Keyword</span>
          <input className="import-link-input" {...field('keyword')} placeholder="Flying" spellCheck={false} />
        </label>
        <label className="adv-field" htmlFor={`${id}-set`}><span>Set code</span>
          <input className="import-link-input" {...field('set')} placeholder="MH3" spellCheck={false} />
        </label>
        <label className="adv-field" htmlFor={`${id}-artist`}><span>Artist</span>
          <input className="import-link-input" {...field('artist')} placeholder="Rebecca Guay" spellCheck={false} />
        </label>
        <label className="adv-field" htmlFor={`${id}-extra`}><span>Scryfall syntax</span>
          <input className="import-link-input" {...field('extra')} placeholder="is:fetchland" spellCheck={false} />
        </label>
        {format === 'commander' && (
          <label className="adv-check adv-wide"><input type="checkbox" {...check('isCommander')} /> Can be your commander</label>
        )}

        <div className="adv-actions">
          <label className="deck-tool"><span>Sort by</span>
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              {ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={() => { setF(EMPTY); setResults(null); setError(null); }}>Reset</button>
          <button type="submit" className="btn-secondary adv-go" disabled={busy}>
            {busy ? <span className="import-spinner" /> : <IconSearch size={15} />} Search
          </button>
        </div>
      </form>

      {error && <div className="info-box info-box-error"><span>{error}</span></div>}
      {results && (
        results.cards.length === 0
          ? <p className="deck-empty">No cards found.</p>
          : (
            <>
              <p className="search-count">{results.total} result{results.total !== 1 ? 's' : ''}</p>
              <CardFrameDefs />
              <ul className="search-results">
                {results.cards.map((c) => {
                  const here = inDeck.has(oidOf(c));
                  return (
                  <li key={c.id} className={`search-card${here ? ' marked' : ''}`}>
                    <button type="button" className="search-card-img" onClick={() => setZoom(c)} onKeyDown={enterAdds(c)}
                      aria-label={`${c.name}${here ? ', already in the deck' : ''}. Enter to add, Space to enlarge`}>
                      <img src={thumb(c)} alt="" loading="lazy" />
                    </button>
                    {here && <CardFrame />}
                    <button type="button" className="search-card-add" aria-label={`Add ${c.name}`} title={`Add ${c.name}`}
                      onClick={(e) => onPick(async () => c, e)} onKeyDown={enterAdds(c)}>
                      <IconPlus size={16} />
                    </button>
                  </li>
                  );
                })}
              </ul>
              {results.next && <button type="button" className="btn-secondary search-more" onClick={() => run(results.next)} disabled={busy}>Load more</button>}
            </>
          )
      )}
      {zoom && <CardView card={snapshotFromCard(zoom)} onClose={() => setZoom(null)} />}
    </section>
  );
}
