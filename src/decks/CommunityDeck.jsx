import { useCallback, useEffect, useRef, useState } from 'react';
import { listenPublicDeck, createDeck, countLikes, hasLiked, setLiked } from './deckStore';
import { duplicateDeck, coverRow, formatLabel, priceLabel, refreshSnapshots, withScryfallImgs } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { useSettings } from '../utils/settings';
import { useIsMobile } from '../hooks/useIsMobile';
import { navigate } from '../hooks/useHashRoute';
import DeckSections from './DeckSections';
import { DeckTabs, DeckCount } from './DeckTabs';
import { DeckDilemmas } from './Dilemmas';
import { ExportDeckDialog } from './dialogs';
import { IconCopy, IconExport, IconHeart } from '../components/icons';

const STUCK_AT = 64; // px: la barra delle schede (padding + 40 px), come STUCK_AT nell'editor

// Mazzo della Community in sola lettura (#/community/:id): testata come l'editor (arte, nome con il cuore
// dei like, formato, prezzo, autore), Copy to my decks ed Export; schede Deck / Stats / Dilemmas (DeckTabs,
// Dilemmas vuota per ora) in alto al centro come nell'editor (telefono: sotto la testata); sotto le sezioni
// senza comandi di modifica. Vista e raggruppamento cambiano solo la copia sullo schermo.
export default function CommunityDeck({ uid, id, notify }) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = non più pubblico o errore
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState('deck');
  const heroRef = useRef(null);
  const [stuck, setStuck] = useState(false); // la testata è uscita: la barra delle schede ha lo sfondo
  const mobile = useIsMobile();
  const { currency } = useSettings();
  // Immagini solo da Scryfall: vale per testata, carte, anteprima e per la copia in Copy to my decks.
  useEffect(() => listenPublicDeck(id, (d) => setDeck(d && withScryfallImgs(d)), (e) => { setDeck(null); notify(`Could not load this deck: ${e.message}`, 'error'); }), [id, notify]);
  const update = useCallback((fn) => setDeck((d) => d && fn(d)), []);
  // Like: il mio (cuore pieno) e il totale; il click li aggiorna subito, li riporta indietro se fallisce.
  const [liked, setLikedNow] = useState(false);
  const [likes, setLikes] = useState(0);
  useEffect(() => {
    hasLiked(id, uid).then(setLikedNow).catch(() => {});
    countLikes(id).then(setLikes).catch(() => {});
  }, [id, uid]);
  const toggleLike = () => {
    const on = !liked;
    setLikedNow(on);
    setLikes((n) => n + (on ? 1 : -1));
    setLiked(id, uid, on).catch((e) => {
      setLikedNow(!on);
      setLikes((n) => n - (on ? 1 : -1));
      notify(`Could not save the like: ${e.message}`, 'error');
    });
  };
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
      <div className="deck-scroll" onScroll={mobile ? undefined : (e) => setStuck(e.currentTarget.scrollTop > (heroRef.current?.offsetHeight || 0) - STUCK_AT)}>
        {!mobile && (
          <div className="deck-sticky">
            <div className={`deck-sticky-bar has-tabs${stuck ? ' stuck' : ''}`}>
              <span />
              <DeckTabs tab={tab} onTab={setTab} bar />
              <span />
            </div>
          </div>
        )}
        <header className={`deck-hero${mobile ? ' has-tabs' : ''}`} ref={heroRef}>
          <span className="deck-hero-art" aria-hidden="true">
            {cover?.card.art && (
              <>
                <span className="deck-hero-blur"><span style={{ backgroundImage: `url("${cover.card.art}")` }} /></span>
                <span className="deck-hero-img" style={{ backgroundImage: `url("${cover.card.art}")` }} />
              </>
            )}
          </span>
          <div className="deck-hero-content">
            <div className="deck-hero-title">
              <h2 className="deck-name deck-name-static">{deck.name}</h2>
              <button type="button" className={`deck-like${liked ? ' on' : ''}`} aria-pressed={liked} onClick={toggleLike}
                aria-label={`Like, ${likes} ${likes === 1 ? 'like' : 'likes'}`} title={liked ? 'Unlike' : 'Like'}>
                <IconHeart size={20} fill={liked ? 'currentColor' : 'none'} /> <span>{likes}</span>
              </button>
            </div>
            <div className="deck-hero-meta">
              <span className="deck-price">{formatLabel(deck.format)}</span>
              <button type="button" className="btn-secondary deck-icon-btn" onClick={copy}
                aria-label="Copy to my decks" title="Copy to my decks"><IconCopy size={17} /></button>
              <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}
                aria-label="Export" title="Export"><IconExport size={17} /></button>
              {price && <span className="deck-price">{price}</span>}
              <span className="deck-sync">by {deck.owner || 'anonymous'}</span>
            </div>
          </div>
        </header>
        {mobile && <DeckTabs tab={tab} onTab={setTab} />}
        <div className="deck-body">
          <section className="deck-main">
            {tab === 'dilemmas' ? <DeckDilemmas deck={deck} uid={uid} mine={false} notify={notify} />
              : <DeckSections deck={deck} update={update} touch={mobile} readOnly tab={tab} onTab={setTab} />}
          </section>
        </div>
      </div>
      {tab === 'deck' && <DeckCount deck={deck} />}
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
