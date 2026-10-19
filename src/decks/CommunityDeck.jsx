import { useCallback, useEffect, useRef, useState } from 'react';
import { listenPublicDeck, listenHelp, createDeck, countLikes, hasLiked, setLiked } from './deckStore';
import { duplicateDeck, coverRow, formatLabel, refreshSnapshots } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { useIsMobile } from '../hooks/useIsMobile';
import { navigate } from '../hooks/useHashRoute';
import DeckSections from './DeckSections';
import { DeckBand, DeckTitle, DeckCount, DeckTopBar, DeckTagList } from './DeckTabs';
import { DeckDilemmas } from './Dilemmas';
import { DeckHelps, HelpQuestion, HelpReply } from './HelpRequests';
import { ExportDeckDialog } from './dialogs';
import { IconCopy, IconDeckExport, IconDeckHeart } from '../components/icons';

const STUCK_AT = 64; // px: la barra delle schede (padding + 40 px), come STUCK_AT nell'editor

// Mazzo della Community in sola lettura (#/community/:id): testata come l'editor (arte, nome con il cuore
// dei like, autore, formato), Copy to my decks ed Export; da desktop nome e cuore nella barra in alto, formato e
// schede nella fascia (DeckBand) come nell'editor (telefono: tutto nella testata, schede sotto); sotto le sezioni
// senza comandi di modifica. Vista e raggruppamento cambiano solo la copia sullo schermo.
// helpId = pagina di una help request (#/help/:mazzo/:richiesta): la domanda nella testata, niente schede, sotto la
// risposta di chi aiuta (zone Cuts e Suggestions) e la lista del mazzo da cui si trascinano i tagli (HelpReply).
export default function CommunityDeck({ uid, id, notify, helpId }) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = non più pubblico o errore
  const [help, setHelp] = useState(undefined); // la richiesta (helpId): undefined = caricamento, null = non c'è più
  useEffect(() => (helpId ? listenHelp(id, helpId, setHelp, () => setHelp(null)) : undefined), [id, helpId]);
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState('deck');
  const heroRef = useRef(null);
  const scrollRef = useRef(null); // .deck-scroll: Back to top della barra in cima (DeckTopBar, telefono)
  const [stuck, setStuck] = useState(false); // la testata è uscita: la barra delle schede ha lo sfondo
  const mobile = useIsMobile();
  // Immagini solo da Scryfall: vale per testata, carte, anteprima e per la copia in Copy to my decks.
  useEffect(() => listenPublicDeck(id, setDeck, (e) => { setDeck(null); notify(`Could not load this deck: ${e.message}`, 'error'); }), [id, notify]);
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
  const copy = () => {
    const { id: nid, done } = createDeck(uid, { ...duplicateDeck(deck), name: deck.name });
    done.catch((e) => notify(`Sync error: ${e.message}`, 'error'));
    notify('Copied to your decks');
    navigate(`/decks/${nid}`);
  };
  const by = deck.owner || 'a player';
  const like = (
    <button type="button" className={`deck-like${liked ? ' on' : ''}`} aria-pressed={liked} onClick={toggleLike}
      aria-label={`Like, ${likes} ${likes === 1 ? 'like' : 'likes'}`} title={liked ? 'Unlike' : 'Like'}>
      <IconDeckHeart filled={liked} /> <span>{likes}</span>
    </button>
  );
  // La pagina di una richiesta non ha barra né fascia: nome e formato restano nella testata anche da desktop.
  const inHero = mobile || helpId;
  // Da desktop una scheda alla volta, da telefono tutto in fila (carte, Stats, Dilemmas, Help).
  const cards = (t) => <DeckSections deck={deck} update={update} touch={mobile} readOnly tab={t} onTab={mobile ? undefined : setTab} />;
  const dilemmas = <DeckDilemmas deck={deck} uid={uid} mine={false} notify={notify} />;
  const helps = <DeckHelps deck={deck} uid={uid} mine={deck.uid === uid} notify={notify} />;
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll" ref={scrollRef} onScroll={mobile ? undefined : (e) => setStuck(e.currentTarget.scrollTop > (heroRef.current?.offsetHeight || 0) - STUCK_AT)}>
        {/* Pagina della richiesta: niente barra delle schede, in alto restano ferme le zone Cuts / Suggestions. */}
        {!mobile && !helpId && (
          <div className="deck-sticky">
            <div className={`deck-sticky-bar${stuck ? ' stuck' : ''}`}>
              <DeckTitle by={by}><h2 className="deck-name deck-name-static">{deck.name}</h2>{like}</DeckTitle>
            </div>
          </div>
        )}
        <header className="deck-hero" ref={heroRef}>
          <span className="deck-hero-art" aria-hidden="true">
            {cover?.card.art && (
              <>
                <span className="deck-hero-blur"><span style={{ backgroundImage: `url("${cover.card.art}")` }} /></span>
                <span className="deck-hero-img" style={{ backgroundImage: `url("${cover.card.art}")` }} />
              </>
            )}
          </span>
          <div className="deck-hero-content">
            {inHero && (
              <div className="deck-hero-title">
                <h2 className="deck-name deck-name-static">{deck.name}</h2>
                {like}
              </div>
            )}
            {help && <HelpQuestion help={help} />}
            <DeckTagList deck={deck} />
            <div className="deck-hero-meta">
              {inHero && <span className="deck-price">{formatLabel(deck.format)}</span>}
              <span className="deck-hero-actions">
                <button type="button" className="btn-secondary deck-icon-btn" onClick={copy}
                  aria-label="Copy to my decks" title="Copy to my decks"><IconCopy size={17} /></button>
                <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}
                  aria-label="Export" title="Export"><IconDeckExport /></button>
              </span>
              {inHero && <span className="deck-sync">by {by}</span>}
            </div>
          </div>
        </header>
        {!helpId && (mobile ? <DeckTopBar deck={deck} scrollRef={scrollRef} />
          : <DeckBand tab={tab} onTab={setTab} format={<span className="deck-format-static">{formatLabel(deck.format)}</span>} />)}
        <div className="deck-body">
          <section className="deck-main">
            {helpId ? (
              help === undefined ? <div className="help-page"><span className="import-spinner" role="status" aria-label="Loading" /></div>
                : help === null ? <div className="help-page"><p className="field-hint">This help request is no longer available. <a href="#/help">All help requests</a></p></div>
                  : <HelpReply deck={deck} help={help} uid={uid} notify={notify} update={update} touch={mobile} />
            ) : mobile ? <>{cards('all')}<div className="deck-part">{dilemmas}</div><div className="deck-part">{helps}</div></>
              : tab === 'dilemmas' ? dilemmas : tab === 'help' ? helps : cards(tab)}
          </section>
        </div>
      </div>
      {!mobile && tab === 'deck' && <DeckCount deck={deck} />}
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
