import { useCallback, useEffect, useRef, useState } from 'react';
import { listenPublicDeck, listenHelp, createDeck, countLikes, hasLiked, setLiked, listenFollowing } from './deckStore';
import { duplicateDeck, coverRow, deckTab, formatLabel, refreshSnapshots, boardCounts } from './deckModel';
import { cardsByIds } from './scryfallSearch';
import { usePrintDeck } from './usePrintDeck';
import ShareLink from './ShareLink';
import { useIsMobile } from '../hooks/useIsMobile';
import { navigate } from '../hooks/useHashRoute';
import DeckSections from './DeckSections';
import { DeckBand, DeckTitle, DeckCount, DeckTopBar, DeckTagList, DeckBracket, ByLink } from './DeckTabs';
import { DeckDilemmas } from './Dilemmas';
import { DeckHelps, HelpQuestion, HelpReply } from './HelpRequests';
import { ExportDeckDialog } from './dialogs';
import { ToGroupListDialog } from './GroupLists';
import { IconCopy, IconDeckExport, IconDeckHeart, IconDeckPrint, IconUser } from '../components/icons';

const STUCK_AT = 64; // px: la barra delle schede (padding + 40 px), come STUCK_AT nell'editor

// Mazzo della Community in sola lettura (#/community/:id): testata come l'editor (arte, nome con il cuore
// dei like, autore, formato), Copy to my decks, Print, Export e Copy link; da desktop nome e cuore nella barra in
// alto, formato e schede nella fascia (DeckBand) come nell'editor (telefono: tutto nella testata, schede sotto); sotto
// le sezioni senza comandi di modifica. Vista e raggruppamento cambiano solo la copia sullo schermo.
// helpId = pagina di una help request (#/help/:mazzo/:richiesta): la domanda nella testata, niente schede, sotto la
// risposta di chi aiuta (zone Cuts e Suggestions) e la lista del mazzo da cui si trascinano i tagli (HelpReply).
// Senza account (uid assente, link condiviso): carte, Stats, Print, Export e Copy link; like, Copy to my decks, To group
// list, Dilemmas e Help chiedono l'accesso (onSignIn, sopra la pagina).
export default function CommunityDeck({ uid, id, notify, helpId, printQueueCount, onPrintDeck, onSignIn }) {
  const [deck, setDeck] = useState(undefined); // undefined = caricamento, null = non più pubblico o errore
  const [help, setHelp] = useState(undefined); // la richiesta (helpId): undefined = caricamento, null = non c'è più
  useEffect(() => (helpId ? listenHelp(id, helpId, setHelp, () => setHelp(null)) : undefined), [id, helpId]);
  const [exportOpen, setExportOpen] = useState(false);
  const [groupRows, setGroupRows] = useState(null); // To group list dal menu delle carte
  const [startPrint, printDialog] = usePrintDeck(printQueueCount, onPrintDeck);
  const [tabPick, setTab] = useState('deck');
  const heroRef = useRef(null);
  const scrollRef = useRef(null); // .deck-scroll: Back to top della barra in cima (DeckTopBar, telefono)
  const [stuck, setStuck] = useState(false); // la testata è uscita: la barra delle schede ha lo sfondo
  const mobile = useIsMobile();
  // Immagini solo da Scryfall: vale per testata, carte, anteprima e per la copia in Copy to my decks.
  useEffect(() => listenPublicDeck(id, setDeck, (e) => { setDeck(null); notify(`Could not load this deck: ${e.message}`, 'error'); }), [id, notify]);
  const update = useCallback((fn) => setDeck((d) => d && fn(d)), []);
  // Like: il mio (cuore pieno) e il totale; il click li aggiorna subito, li riporta indietro se fallisce. Senza account
  // niente (le regole li fanno leggere solo a chi è entrato).
  const [liked, setLikedNow] = useState(false);
  const [likes, setLikes] = useState(0);
  useEffect(() => {
    if (!uid) return;
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
  // Segui già l'autore: il suo nickname prende il gradiente della selezione (ByLink).
  const owner = deck?.uid;
  const [followedNow, setFollowed] = useState(false);
  useEffect(() => (uid && owner && owner !== uid ? listenFollowing(uid, owner, setFollowed, () => setFollowed(false)) : undefined), [uid, owner]);
  const followed = followedNow && owner !== uid; // il proprio mazzo: mai, anche se prima la vista era su un altro
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
  const tab = deckTab(tabPick, deck);
  const cover = coverRow(deck);
  const copy = () => {
    const { id: nid, done } = createDeck(uid, { ...duplicateDeck(deck), name: deck.name });
    done.catch((e) => notify(`Sync error: ${e.message}`, 'error'));
    notify('Copied to your decks');
    navigate(`/decks/${nid}`);
  };
  const by = deck.owner || 'a player';
  // Nome dell'autore = link alla sua pagina pubblica (Segui, i suoi mazzi pubblici); uid della copia, stabile anche se
  // cambia il nickname.
  const byHref = deck.uid ? `#/profile/${encodeURIComponent(deck.uid)}` : undefined;
  const byLink = <ByLink by={by} href={byHref} followed={followed} />;
  const like = uid ? (
    <button type="button" className={`deck-like${liked ? ' on' : ''}`} aria-pressed={liked} onClick={toggleLike}
      aria-label={`Like, ${likes} ${likes === 1 ? 'like' : 'likes'}`} title={liked ? 'Unlike' : 'Like'}>
      <IconDeckHeart filled={liked} /> <span>{likes}</span>
    </button>
  ) : <button type="button" className="deck-like" onClick={onSignIn} aria-label="Sign in to like" title="Sign in to like"><IconDeckHeart /></button>;
  const copyLabel = uid ? 'Copy to my decks' : 'Sign in to copy it to your decks';
  // Dilemmas e Help senza account: l'invito a entrare al posto delle schede.
  const signInFor = (what) => (
    <div className="decks-empty">
      <p className="field-hint">Sign in to see {what} and join in.</p>
      <button type="button" className="btn-secondary deck-icon-btn" onClick={onSignIn} aria-label="Sign in" title="Sign in"><IconUser size={16} /></button>
    </div>
  );
  // La pagina di una richiesta non ha barra né fascia: nome e formato restano nella testata anche da desktop.
  const inHero = mobile || helpId;
  // Da desktop una scheda alla volta, da telefono tutto in fila (carte, Stats, Power, Dilemmas, Help).
  const cards = (t) => <DeckSections deck={deck} update={update} touch={mobile} readOnly tab={t} onTab={mobile ? undefined : setTab} onGroup={uid ? setGroupRows : undefined} />;
  const dilemmas = uid ? <DeckDilemmas deck={deck} uid={uid} mine={false} notify={notify} /> : signInFor('the dilemmas of this deck');
  const helps = uid ? <DeckHelps deck={deck} uid={uid} mine={deck.uid === uid} notify={notify} /> : signInFor('the help requests of this deck');
  return (
    <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll" ref={scrollRef} onScroll={mobile ? undefined : (e) => setStuck(e.currentTarget.scrollTop > (heroRef.current?.offsetHeight || 0) - STUCK_AT)}>
        {/* Pagina della richiesta: niente barra delle schede, in alto restano ferme le zone Cuts / Suggestions. */}
        {!mobile && !helpId && (
          <div className="deck-sticky">
            <div className={`deck-sticky-bar${stuck ? ' stuck' : ''}`}>
              <DeckTitle by={by} byHref={byHref} followed={followed}><h2 className="deck-name deck-name-static">{deck.name}</h2><DeckBracket deck={deck} />{like}</DeckTitle>
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
                <DeckBracket deck={deck} />
                {like}
              </div>
            )}
            {help && <HelpQuestion help={help} />}
            <DeckTagList deck={deck} />
            <div className="deck-hero-meta">
              {inHero && <span className="deck-price">{formatLabel(deck.format)}</span>}
              <span className="deck-hero-actions">
                <button type="button" className="btn-secondary deck-icon-btn" onClick={uid ? copy : onSignIn}
                  aria-label={copyLabel} title={copyLabel}><IconCopy size={17} /></button>
                <button type="button" className="btn-secondary deck-icon-btn" onClick={() => startPrint(deck)} disabled={!boardCounts(deck).main}
                  aria-label="Print deck" title="Print deck"><IconDeckPrint /></button>
                <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setExportOpen(true)} disabled={!deck.cards.length}
                  aria-label="Export" title="Export"><IconDeckExport /></button>
                <ShareLink path={`/community/${id}`} title={deck.name} notify={notify} />
              </span>
              {inHero && <span className="deck-sync deck-hero-by">by {byLink}</span>}
            </div>
          </div>
          {cover?.card.art && cover.card.artist && <span className="deck-hero-credit">Art by {cover.card.artist} · © Wizards of the Coast</span>}
        </header>
        {!helpId && (mobile ? <DeckTopBar deck={deck} scrollRef={scrollRef} />
          : <DeckBand tab={tab} onTab={setTab} format={<span className="deck-format-static">{formatLabel(deck.format)}</span>} power={deck.format === 'commander'} />)}
        <div className="deck-body">
          <section className="deck-main">
            {helpId ? (
              help === undefined ? <div className="help-page"><span className="import-spinner" role="status" aria-label="Loading" /></div>
                : help === null ? <div className="help-page"><p className="field-hint">This help request is no longer available. <a href="#/help">All help requests</a></p></div>
                  : <HelpReply deck={deck} help={help} uid={uid} notify={notify} update={update} touch={mobile} />
            ) : mobile ? <>{cards('all')}{uid ? <><div className="deck-part">{dilemmas}</div><div className="deck-part">{helps}</div></>
              : <div className="deck-part">{signInFor('the dilemmas and help requests of this deck')}</div>}</>
              : tab === 'dilemmas' ? dilemmas : tab === 'help' ? helps : cards(tab)}
          </section>
        </div>
      </div>
      {!mobile && tab === 'deck' && <DeckCount deck={deck} />}
      {printDialog}
      {exportOpen && <ExportDeckDialog deck={deck} onClose={() => setExportOpen(false)} />}
      {groupRows && <ToGroupListDialog uid={uid} rows={groupRows} notify={notify} onClose={() => setGroupRows(null)} />}
    </div>
  );
}
