import { useCallback, useEffect, useRef, useState } from 'react';
import { listenPublicDeck, createDeck } from './deckStore';
import { duplicateDeck, coverRow, formatLabel, priceLabel, refreshSnapshots } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { useSettings } from '../utils/settings';
import { useIsMobile } from '../hooks/useIsMobile';
import { navigate } from '../hooks/useHashRoute';
import DeckSections from './DeckSections';
import { ExportDeckDialog } from './dialogs';
import { IconCopy, IconExport } from '../components/icons';

// Mazzo della Community in sola lettura (#/community/:id): testata come l'editor (arte, nome, formato,
// prezzo, autore), Copy to my decks ed Export; sotto le sezioni senza comandi di modifica. Vista e
// raggruppamento cambiano solo la copia sullo schermo, non si salva niente.
export default function CommunityDeck({ uid, id, notify }) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = non più pubblico o errore
  const [exportOpen, setExportOpen] = useState(false);
  const mobile = useIsMobile();
  const { currency } = useSettings();
  useEffect(() => listenPublicDeck(id, setDeck, (e) => { setDeck(null); notify(`Could not load this deck: ${e.message}`, 'error'); }), [id, notify]);
  const update = useCallback((fn) => setDeck((d) => d && fn(d)), []);
  // Snapshot aggiornati da Scryfall solo sullo schermo (es. il retro delle carte a due facce nelle copie
  // pubblicate prima che esistesse), come fa l'editor all'apertura.
  const refreshed = useRef(false);
  useEffect(() => {
    if (!deck || refreshed.current) return;
    refreshed.current = true;
    const ids = deck.cards.map((r) => r.card.sid);
    if (ids.length) cardsByIds(ids).then((map) => update((d) => refreshSnapshots(d, map).deck)).catch(() => {});
  }, [deck, update]);

  if (deck === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  if (deck === null) {
    return (
      <div className="decks-root decks-center">
        <div className="decks-empty">
          <p className="decks-empty-title">This deck is not available</p>
          <p className="field-hint">Its owner may have made it private or deleted it. <a href="#/community">Back to Community</a></p>
        </div>
      </div>
    );
  }
  const cover = coverRow(deck);
  const price = priceLabel(deck, currency);
  const copy = () => {
    const { id: nid, done } = createDeck(uid, { ...duplicateDeck(deck), name: deck.name });
    done.catch((e) => notify(`Sync error: ${e.message}`, 'error'));
    notify('Copied to your decks');
    navigate(`/decks/${nid}`);
  };
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll">
        <header className="deck-hero">
          <span className="deck-hero-art" aria-hidden="true">
            {cover?.card.art && (
              <>
                <span className="deck-hero-blur"><span style={{ backgroundImage: `url("${cover.card.art}")` }} /></span>
                <span className="deck-hero-img" style={{ backgroundImage: `url("${cover.card.art}")` }} />
              </>
            )}
          </span>
          <div className="deck-hero-content">
            <div className="deck-hero-title"><h2 className="deck-name deck-name-static">{deck.name}</h2></div>
            <div className="deck-hero-meta">
              <span className="deck-price">{formatLabel(deck.format)}</span>
              <button type="button" className="btn-secondary deck-print" onClick={copy}><IconCopy size={15} /> Copy to my decks</button>
              <button type="button" className="btn-secondary deck-print" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}><IconExport size={15} /> Export</button>
              {price && <span className="deck-price">{price}</span>}
              <span className="deck-sync">by {deck.owner || 'anonymous'}</span>
            </div>
          </div>
        </header>
        <div className="deck-body">
          <section className="deck-main">
            <DeckSections deck={deck} update={update} touch={mobile} readOnly />
          </section>
        </div>
      </div>
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
