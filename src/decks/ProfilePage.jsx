import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  listenDecks, saveProfile, claimNickname, countAnswered, listenDilemmas, deleteDilemma,
  getPublicProfile, listenUserDecks, setFollowing, listenFollowing, countFollowers, countFollowing, listenAnswered, ensureSince,
} from './deckStore';
import { updateNickname, authMessage } from './firebase';
import { deckCover } from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import { useCount } from './useCount';
import { Avatar } from './AccountMenu';
import { DeckTile, GhostTile } from './DeckList';
import { DilemmaTile } from './Dilemmas';
import PhotoDialog from './PhotoDialog';
import { CutFrame } from './CutFrame';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconImage, IconPencil, IconArrowRight, IconTrash, IconUserPlus, IconUserCheck } from '../components/icons';

const day = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const LABEL = { photo: 'photo', banner: 'background' };
// Quanti se ne vedono nel profilo, i più recenti; See all in fondo è il riquadro che completa la fila sul desktop
// (mazzi: una fila da 5, See all = My decks; dilemmi: due file da 3, See all li mostra tutti qui).
const SHOWN_DECKS = 4;
const SHOWN_DILEMMAS = 5;
const at = (d) => d.createdAt?.toMillis?.() ?? 0;

// Un ascolto per mazzo pubblico (dilemmi): id -> lista; errore = lista vuota.
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

// Testata del profilo (il mio e quello pubblico): un pannello con le tasche (CutFrame) grande quanto la sezione,
// misurata, così gli angoli restano tondi a ogni larghezza. Largo: foto nella tasca in basso a sinistra, stretto (< 600):
// in alto. avatar = foto (pulsante nel mio), action = il tondo in alto a destra (cambia sfondo nel mio, Segui nel pubblico).
function ProfileHero({ banner, avatar, action, since, stats, children }) {
  const heroRef = useRef(null);
  const [hero, setHero] = useState([1240, 280]);
  useLayoutEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setHero([el.offsetWidth, el.offsetHeight]));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const small = hero[0] < 600;
  const cuts = small ? { tl: [96, 96], tr: [44, 44] } : { bl: [136, 136], tr: [44, 44] };
  return (
    <section className={`profile-hero${small ? ' small' : ''}`} aria-label="Profile" ref={heroRef}>
      <CutFrame w={hero[0]} h={hero[1]} cuts={cuts}>
        <span className={`profile-banner${banner ? ' art' : ''}`} style={banner ? { backgroundImage: `url("${banner}")` } : undefined} />
      </CutFrame>
      {avatar}
      {action}
      {since && <p className="profile-callout">Member since {since}<span className="deck-tile-dot" aria-hidden="true" /></p>}
      <div className="profile-hero-body">
        {children}
        <dl className="profile-stats">
          {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}

// Profilo: testata (sfondo personalizzato o l'arte del mazzo modificato per ultimo; foto e sfondo si
// cambiano cliccandoli), nickname, iscrizione, ultimo accesso, mazzi, follower e seguiti (conteggi sul server);
// sotto, i mazzi e i dilemmi dei mazzi pubblici, ognuno con il suo See all. Email, accesso e password: Settings.
export default function ProfilePage({ user, profile, notify, onChange }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'photo' | 'banner'
  const [confirmAll, setConfirmAll] = useState(false);
  const mobile = useIsMobile(); // telefono e tablet: il titolo della pagina (non c'è testata)
  const [loadError, setLoadError] = useState(null); // listener dei mazzi fallito: messaggio invece degli spinner
  useEffect(() => listenDecks(user.uid, (d) => { setDecks(d); setLoadError(null); }, setLoadError), [user.uid]);
  const pub = (decks || []).filter((d) => d.public);
  const ids = pub.map((d) => d.id);
  const dilemmas = usePerDeck(ids, listenDilemmas);
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
  const followers = useCount(countFollowers, user.uid);
  const following = useCount(countFollowing, user.uid);
  // "Member since" per la pagina pubblica: la data dell'account nel profilo, se manca (una volta per sessione).
  useEffect(() => { ensureSince(user.uid, user.metadata.creationTime); }, [user.uid, user.metadata.creationTime]);
  const photo = profile?.photo || null;
  const custom = { photo, banner: profile?.banner || null };
  const banner = custom.banner || decks?.map(deckCover).find(Boolean);
  const stats = [
    ['Last sign-in', day(user.metadata.lastSignInTime)],
    ['Decks', decks ? decks.length : '…'],
    ['Dilemmas answered', answered ?? '…'],
    ['Followers', followers],
    ['Following', following],
  ];
  // Delete all: ogni dilemma con i suoi voti (deleteDilemma); gli ascolti per mazzo svuotano la lista da soli.
  const deleteAll = () => {
    setConfirmAll(false);
    Promise.allSettled(myDilemmas.map((x) => deleteDilemma(x.deck.id, x.id))).then((r) => {
      const failed = r.filter((x) => x.status === 'rejected');
      if (failed.length) notify(`Could not delete ${failed.length} of ${r.length} dilemmas: ${failed[0].reason?.message}`, 'error');
      else notify(r.length === 1 ? 'Dilemma deleted' : `${r.length} dilemmas deleted`);
    });
  };
  const save = (kind, data) => {
    setDialog(null);
    saveProfile(user.uid, { [kind]: data })
      .then(() => notify(`${LABEL[kind][0].toUpperCase()}${LABEL[kind].slice(1)} ${data ? 'updated' : 'removed'}`))
      .catch((e) => notify(`Could not save the ${LABEL[kind]}: ${e.message}`, 'error'));
  };

  return (
    <div className="decks-root profile-page">
      {mobile && <header className="decks-head"><h1 className="decks-title">Profile</h1></header>}
      <ProfileHero banner={banner} since={day(user.metadata.creationTime)} stats={stats}
        avatar={(
          <button type="button" className="profile-avatar" onClick={() => setDialog('photo')} aria-label="Change photo" title="Change photo">
            <Avatar user={user} photo={photo} />
            <span className="profile-avatar-hover" aria-hidden="true"><IconImage size={22} /></span>
          </button>
        )}
        action={(
          <button type="button" className="profile-bg-btn" onClick={() => setDialog('banner')} aria-label="Change background" title="Change background">
            <IconImage size={16} />
          </button>
        )}>
        <Nickname user={user} nick={profile?.nickname || ''} notify={notify} onChange={onChange} />
      </ProfileHero>

      <header className="decks-head">
        <h2 className="decks-title">Decks</h2>
      </header>
      {decks === null && (loadError ? (
        <div className="decks-empty" role="alert">
          <p className="decks-empty-title">Could not load your decks</p>
          <p className="field-hint">{loadError.message}</p>
        </div>
      ) : <span className="import-spinner" aria-label="Loading" />)}
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
              <DeckTile deck={d} onClick={() => navigate(`/decks/${d.id}`)} />
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
        {dilemmasReady && myDilemmas.length > 0 && (
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setConfirmAll(true)}
            aria-label="Delete all dilemmas" title="Delete all dilemmas"><IconTrash size={18} /></button>
        )}
      </header>
      {!dilemmasReady && !loadError && <span className="import-spinner" aria-label="Loading" />}
      {dilemmasReady && myDilemmas.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">No dilemmas yet</p>
          <p className="field-hint">Ask one from the Dilemmas tab of a public deck.</p>
        </div>
      )}
      {dilemmasReady && myDilemmas.length > 0 && (
        <DilemmaGrid list={myDilemmas} uid={user.uid} more={moreDilemmas} onAll={() => setAllDilemmas(true)} listRef={dilemmaList} />
      )}

      <ConfirmDialog open={confirmAll} confirmLabel="Delete all"
        message={`Delete all ${myDilemmas.length} of your dilemmas and their votes? This can’t be undone.`}
        onCancel={() => setConfirmAll(false)} onConfirm={deleteAll} />
      {dialog && (
        <PhotoDialog kind={dialog} onClose={() => setDialog(null)} onSave={(data) => save(dialog, data)}
          onRemove={custom[dialog] ? () => save(dialog, null) : undefined} />
      )}
    </div>
  );
}

// Dilemmi del profilo (mio e pubblico): i primi SHOWN_DILEMMAS e See all, che li mostra tutti qui. solved = già risposto.
function DilemmaGrid({ list, uid, more, onAll, listRef, solved }) {
  return (
    <ul className="dilemma-list" ref={listRef}>
      {(more ? list.slice(0, SHOWN_DILEMMAS) : list).map((x) => (
        <DilemmaTile key={`${x.deck.id}/${x.id}`} deckId={x.deck.id} d={x} uid={uid} solved={!!solved?.has(`${x.deck.id}_${x.id}`)}
          href={`#/dilemmas/${x.deck.id}/${x.id}`} meta={<b>{x.deck.name}</b>} />
      ))}
      {more && (
        <li>
          <button type="button" className="dilemma-tile dilemma-add" onClick={onAll}
            aria-label={`See all ${list.length} dilemmas`} title={`See all ${list.length} dilemmas`}>
            <span className="dilemma-split" aria-hidden="true">
              <span className="deck-all"><IconArrowRight size={34} />See all<span className="deck-all-n">{list.length} dilemmas</span></span>
            </span>
          </button>
        </li>
      )}
    </ul>
  );
}

// Pagina pubblica di un altro utente (#/profile/:uid, dal nome dell'autore nella vista di un mazzo): come il proprio
// profilo, ma foto e sfondo non si cambiano e il tondo in alto a destra è Segui / Seguito. Numeri: iscrizione (se il
// profilo la porta), mazzi pubblici, follower, seguiti; niente ultimo accesso né dilemmi risposti (dati privati).
// Sotto, i suoi mazzi pubblici (le voci dell'indice) e i dilemmi su quei mazzi.
export function PublicProfilePage({ uid, viewer, notify }) {
  const [profile, setProfile] = useState(undefined); // undefined = caricamento
  const [decks, setDecks] = useState(null);
  const [followed, setFollowed] = useState(undefined); // undefined = non ancora noto
  const [busy, setBusy] = useState(false);
  const [allDilemmas, setAllDilemmas] = useState(false);
  const mobile = useIsMobile();
  const dilemmaList = useRef(null);
  useEffect(() => {
    let alive = true;
    getPublicProfile(uid).then((p) => alive && setProfile(p), () => alive && setProfile(null));
    return () => { alive = false; };
  }, [uid]);
  useEffect(() => listenUserDecks(uid, setDecks, () => setDecks([])), [uid]);
  useEffect(() => listenFollowing(viewer, uid, setFollowed, () => setFollowed(false)), [viewer, uid]);
  // saved cresce quando il server ha confermato Segui / Smetti di seguire: rilegge i follower (followed cambia prima,
  // sulla scrittura locale, e il conteggio sul server non la vedrebbe ancora).
  const [saved, setSaved] = useState(0);
  const followers = useCount(countFollowers, uid, saved);
  const following = useCount(countFollowing, uid);
  const ids = (decks || []).map((d) => d.id);
  const dilemmas = usePerDeck(ids, listenDilemmas);
  const [answered, setAnswered] = useState(null); // dilemmi a cui chi guarda ha già risposto (Voted sui riquadri)
  useEffect(() => listenAnswered(viewer, setAnswered, () => setAnswered(new Set())), [viewer]);
  const list = (decks || []).flatMap((d) => (dilemmas[d.id] || []).map((x) => ({ ...x, deck: d }))).sort((a, b) => at(b) - at(a));
  const dilemmasReady = decks && ids.every((id) => dilemmas[id]);
  const moreDilemmas = !allDilemmas && list.length > SHOWN_DILEMMAS;
  useEffect(() => { if (allDilemmas) dilemmaList.current?.children[SHOWN_DILEMMAS]?.querySelector('a')?.focus(); }, [allDilemmas]);
  if (profile === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  // Senza profilo leggibile (niente documento, o regole vecchie) il nickname firmato sui suoi mazzi pubblici.
  const name = profile?.nickname || decks?.find((d) => d.owner)?.owner || 'a player';
  const banner = profile?.banner || decks?.map((d) => d.art).find(Boolean);
  const toggle = () => {
    const on = !followed;
    setBusy(true);
    setFollowing(viewer, uid, on)
      .then(() => { setSaved((n) => n + 1); notify(on ? `You follow ${name}` : `You no longer follow ${name}`); })
      .catch((e) => notify(`Could not ${on ? 'follow' : 'unfollow'}: ${e.message}`, 'error'))
      .finally(() => setBusy(false));
  };
  const stats = [
    ['Decks', decks ? decks.length : '…'],
    ['Followers', followers],
    ['Following', following],
  ];
  const label = followed ? `Unfollow ${name}` : `Follow ${name}`;
  return (
    <div className="decks-root profile-page">
      {mobile && <header className="decks-head"><h1 className="decks-title">Profile</h1></header>}
      <ProfileHero banner={banner} since={profile?.since ? day(profile.since.toMillis()) : ''} stats={stats}
        avatar={<span className="profile-avatar"><Avatar user={{ displayName: name }} photo={profile?.photo} /></span>}
        action={followed !== undefined && (
          <button type="button" className={`profile-bg-btn profile-follow${followed ? ' on' : ''}`} onClick={toggle} disabled={busy}
            aria-pressed={followed} aria-label={label} title={label}>
            {followed ? <IconUserCheck size={16} /> : <IconUserPlus size={16} />}
          </button>
        )}>
        <div className="profile-who profile-name-row"><h2 className="profile-name">{name}</h2></div>
      </ProfileHero>

      <header className="decks-head">
        <h2 className="decks-title">Decks</h2>
      </header>
      {decks === null && <span className="import-spinner" aria-label="Loading" />}
      {decks?.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">No public decks</p>
          <p className="field-hint">{name === 'a player' ? 'This player has' : `${name} has`} not shared a deck in Community yet.</p>
        </div>
      )}
      {decks?.length > 0 && (
        <ul className="deck-grid">
          {decks.map((d) => (
            <li key={d.id} className="deck-tile-wrap">
              <DeckTile deck={d} onClick={() => navigate(`/community/${d.id}`)} />
            </li>
          ))}
        </ul>
      )}

      <header className="decks-head profile-next">
        <h2 className="decks-title">Dilemmas</h2>
      </header>
      {!dilemmasReady && <span className="import-spinner" aria-label="Loading" />}
      {dilemmasReady && list.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">No dilemmas yet</p>
        </div>
      )}
      {dilemmasReady && list.length > 0 && (
        <DilemmaGrid list={list} uid={viewer} more={moreDilemmas} onAll={() => setAllDilemmas(true)} listRef={dilemmaList} solved={answered} />
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
