import { useEffect, useId, useRef, useState } from 'react';
import { listenDecks, saveProfile, claimNickname, countAnswered, listenDilemmas, listenHelps } from './deckStore';
import { updateNickname, authMessage } from './firebase';
import { deckCover } from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { Avatar } from './AccountMenu';
import { DeckTile, GhostTile } from './DeckList';
import { DilemmaTile } from './Dilemmas';
import PhotoDialog from './PhotoDialog';
import { IconImage, IconPencil, IconArrowRight } from '../components/icons';

const day = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const LABEL = { photo: 'photo', banner: 'background' };
// Quanti se ne vedono nel profilo, i più recenti; See all in fondo è il riquadro che completa la fila sul desktop
// (mazzi: una fila da 5, See all = My decks; dilemmi: due file da 3, See all li mostra tutti qui).
const SHOWN_DECKS = 4;
const SHOWN_DILEMMAS = 5;
const at = (d) => d.createdAt?.toMillis?.() ?? 0;

// Un ascolto per mazzo pubblico (dilemmi, help request): id -> lista; errore = lista vuota.
// ponytail: un ascolto per mazzo; con molti mazzi pubblici, una query collection group per uid (con il suo indice).
function usePerDeck(ids, listen) {
  const [map, setMap] = useState({});
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return undefined;
    const offs = key.split(',').map((id) => listen(id, (l) => setMap((m) => ({ ...m, [id]: l })), () => setMap((m) => ({ ...m, [id]: [] }))));
    return () => offs.forEach((off) => off());
  }, [key, listen]);
  return map;
}

// Foto profilo e sfondo: JPEG da PhotoDialog salvati come data URL nel documento users/{uid}.
// ponytail: niente Firebase Storage (sui progetti nuovi richiede il piano a pagamento); se servono
// immagini più grandi, Storage + URL.

// Profilo: testata (sfondo personalizzato o l'arte del mazzo modificato per ultimo; foto e sfondo si
// cambiano cliccandoli), nickname, iscrizione, ultimo accesso, mazzi, followers e following (per ora
// sempre 0, arriveranno con i profili pubblici); sotto, i mazzi (chiave inglese = help request aperta) e i
// dilemmi dei mazzi pubblici, ognuno con il suo See all. Email, accesso e password: Settings.
export default function ProfilePage({ user, profile, notify, onChange }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'photo' | 'banner'
  useEffect(() => listenDecks(user.uid, setDecks, () => setDecks(null)), [user.uid]);
  const pub = (decks || []).filter((d) => d.public);
  const ids = pub.map((d) => d.id);
  const dilemmas = usePerDeck(ids, listenDilemmas);
  const helps = usePerDeck(ids, listenHelps);
  // Sui propri mazzi i dilemmi li crea solo il proprietario: sono tutti suoi.
  const myDilemmas = pub.flatMap((d) => (dilemmas[d.id] || []).map((x) => ({ ...x, deck: d }))).sort((a, b) => at(b) - at(a));
  const dilemmasReady = decks && ids.every((id) => dilemmas[id]);
  const [allDilemmas, setAllDilemmas] = useState(false);
  const moreDilemmas = !allDilemmas && myDilemmas.length > SHOWN_DILEMMAS;
  const dilemmaList = useRef(null);
  // See all sparisce: il focus va sul primo dilemma comparso, non si perde.
  useEffect(() => { if (allDilemmas) dilemmaList.current?.children[SHOWN_DILEMMAS]?.querySelector('a')?.focus(); }, [allDilemmas]);
  // Dilemmi a cui ha risposto (users/{uid}/answered, conteggio sul server); senza permesso o offline: 0.
  const [answered, setAnswered] = useState(null);
  useEffect(() => { countAnswered(user.uid).then(setAnswered).catch(() => setAnswered(0)); }, [user.uid]);
  const photo = profile?.photo || null;
  const custom = { photo, banner: profile?.banner || null };
  const banner = custom.banner || decks?.map(deckCover).find(Boolean);
  const stats = [
    ['Member since', day(user.metadata.creationTime)],
    ['Last sign-in', day(user.metadata.lastSignInTime)],
    ['Decks', decks ? decks.length : '…'],
    ['Dilemmas answered', answered ?? '…'],
    ['Followers', profile?.followers ?? 0],
    ['Following', profile?.following ?? 0],
  ];
  const save = (kind, data) => {
    setDialog(null);
    saveProfile(user.uid, { [kind]: data })
      .then(() => notify(`${LABEL[kind][0].toUpperCase()}${LABEL[kind].slice(1)} ${data ? 'updated' : 'removed'}`))
      .catch((e) => notify(`Could not save the ${LABEL[kind]}: ${e.message}`, 'error'));
  };

  return (
    <div className="decks-root profile-page">
      <section className="profile-hero" aria-label="Profile">
        <button type="button" className={`profile-banner${banner ? ' art' : ''}`} onClick={() => setDialog('banner')}
          style={banner ? { backgroundImage: `url("${banner}")` } : undefined} aria-label="Change background">
          <span className="profile-banner-hint" aria-hidden="true"><IconImage size={14} /> Change background</span>
        </button>
        <div className="profile-hero-body">
          <button type="button" className="profile-avatar" onClick={() => setDialog('photo')} aria-label="Change photo" title="Change photo">
            <Avatar user={user} photo={photo} />
            <span className="profile-avatar-hover" aria-hidden="true"><IconImage size={22} /></span>
          </button>
          <Nickname user={user} nick={profile?.nickname || ''} notify={notify} onChange={onChange} />
          <dl className="profile-stats">
            {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      </section>

      <header className="decks-head">
        <h2 className="decks-title">Decks</h2>
      </header>
      {decks === null && <span className="import-spinner" aria-label="Loading" />}
      {decks?.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">No decks yet</p>
          <p className="field-hint">Create or import one in <a href="#/decks">Decks</a>.</p>
        </div>
      )}
      {decks?.length > 0 && (
        <ul className="deck-grid">
          {decks.slice(0, SHOWN_DECKS).map((d) => (
            <li key={d.id} className="deck-tile-wrap">
              <DeckTile deck={d} helping={!!helps[d.id]?.some((h) => h.status === 'open')} onClick={() => navigate(`/decks/${d.id}`)} />
            </li>
          ))}
          {decks.length > SHOWN_DECKS && (
            <GhostTile label={`See all ${decks.length} decks`} href="#/decks">
              <span className="deck-all" aria-hidden="true"><IconArrowRight size={34} />See all<span className="deck-all-n">{decks.length} decks</span></span>
            </GhostTile>
          )}
        </ul>
      )}

      <header className="decks-head profile-next">
        <h2 className="decks-title">Dilemmas</h2>
      </header>
      {!dilemmasReady && <span className="import-spinner" aria-label="Loading" />}
      {dilemmasReady && myDilemmas.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">No dilemmas yet</p>
          <p className="field-hint">Ask one from the Dilemmas tab of a public deck.</p>
        </div>
      )}
      {dilemmasReady && myDilemmas.length > 0 && (
        <ul className="dilemma-list" ref={dilemmaList}>
          {(moreDilemmas ? myDilemmas.slice(0, SHOWN_DILEMMAS) : myDilemmas).map((x) => (
            <DilemmaTile key={`${x.deck.id}/${x.id}`} deckId={x.deck.id} d={x} uid={user.uid} solved={false}
              href={`#/dilemmas/${x.deck.id}/${x.id}`} meta={<b>{x.deck.name}</b>} />
          ))}
          {moreDilemmas && (
            <li>
              <button type="button" className="dilemma-tile dilemma-add" onClick={() => setAllDilemmas(true)}
                aria-label={`See all ${myDilemmas.length} dilemmas`} title={`See all ${myDilemmas.length} dilemmas`}>
                <span className="dilemma-split" aria-hidden="true">
                  <span className="deck-all"><IconArrowRight size={34} />See all<span className="deck-all-n">{myDilemmas.length} dilemmas</span></span>
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      {dialog && (
        <PhotoDialog kind={dialog} onClose={() => setDialog(null)} onSave={(data) => save(dialog, data)}
          onRemove={custom[dialog] ? () => save(dialog, null) : undefined} />
      )}
    </div>
  );
}

// Nickname unico (claimNickname, poi il displayName di Auth): matita → campo in linea, Esc annulla.
// Senza nickname si vede il nome Google o l'inizio dell'email.
function Nickname({ user, nick, notify, onChange }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const hintId = useId();

  const save = async (e) => {
    e.preventDefault();
    const n = name.trim();
    setBusy(true);
    try {
      await claimNickname(user.uid, n, nick);
      await updateNickname(n);
      setEditing(false);
      onChange();
      notify(n ? 'Nickname saved' : 'Nickname removed');
    } catch (err) {
      notify(err.code === 'taken' ? err.message : authMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="profile-who profile-name-row">
        <h2 className="profile-name">{user.displayName || user.email?.split('@')[0]}</h2>
        <button type="button" className="profile-icon-btn" aria-label="Edit nickname" title="Edit nickname"
          onClick={() => { setName(nick || user.displayName || ''); setEditing(true); }}>
          <IconPencil size={15} />
        </button>
      </div>
    );
  }
  return (
    <form className="profile-who profile-name-form" onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}>
      <div className="profile-row">
        <label className="sr-only" htmlFor={nameId}>Nickname</label>
        <input id={nameId} className="import-link-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus
          minLength={3} maxLength={24} pattern="[A-Za-z0-9._\-]{3,24}" title="3 to 24 letters, numbers, dots, dashes or underscores"
          aria-describedby={hintId} placeholder={user.email?.split('@')[0]} autoComplete="nickname" spellCheck={false} disabled={busy} />
        <button type="submit" className="btn-secondary" disabled={busy || name.trim() === nick}>
          {busy && <span className="import-spinner" />} Save
        </button>
        <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
      </div>
      <p className="field-hint" id={hintId}>3 to 24 letters, numbers, dots, dashes or underscores. Each nickname belongs to one account.</p>
    </form>
  );
}
