import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  signIn, signInEmail, signUpEmail, resetPassword, authMessage, signOut,
  sendVerification, checkVerified, deleteUnverifiedAccount,
} from './firebase';
import ConfirmDialog from '../components/ConfirmDialog';
import { PrivacyButton } from '../components/PrivacyPanel';
import { CreditsButton } from '../components/CreditsPanel';
import { IconTrash, IconUser, IconX } from '../components/icons';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import AccountMenu from './AccountMenu';
import { useAccount } from './useAccount';
import DeckList from './DeckList';
import DeckEditor from './DeckEditor';
import CommunityDeck from './CommunityDeck';
import DeckHelp from './DeckHelp';
import ProfilePage, { PublicProfilePage } from './ProfilePage';
import SettingsPage from './SettingsPage';
import { GroupListsSection, GroupListPage, JoinGroupList } from './GroupLists';
import TeamPage from './TeamPage';
import { listenFollowingIds, listenAnswered, listenReplied, listenDilemmaFeed, listenHelpFeed } from './deckStore';
import { countUnanswered } from './deckModel';
import { setBadges } from '../hooks/useBadges';

// Notifiche delle schede Dilemmas e Help (useBadges): dilemmi e richieste aperte dei giocatori seguiti a cui
// l'account non ha ancora risposto, contati sui feed delle due schede (stesse query: Firestore le ascolta una volta).
// I feed hanno gli ultimi 40 dilemmi e le ultime 60 richieste della Community, quindi quelle più vecchie non contano;
// per contarle tutte servirebbe una query per autore (where uid in, con il suo indice collection group). Senza
// nessuno seguito i feed non si ascoltano. Nessuna interfaccia; uscendo dall'area mazzi i numeri spariscono.
function Badges({ uid }) {
  const [following, setFollowing] = useState(null);
  const [answered, setAnswered] = useState(null);
  const [replied, setReplied] = useState(null);
  const [dilemmas, setDilemmas] = useState(null);
  const [helps, setHelps] = useState(null);
  const none = () => new Set();
  useEffect(() => listenFollowingIds(uid, setFollowing, () => setFollowing(none())), [uid]);
  useEffect(() => listenAnswered(uid, setAnswered, () => setAnswered(none())), [uid]);
  useEffect(() => listenReplied(uid, setReplied, () => setReplied(none())), [uid]);
  const any = following?.size > 0;
  useEffect(() => (any ? listenDilemmaFeed(setDilemmas, () => setDilemmas([])) : undefined), [any]);
  useEffect(() => (any ? listenHelpFeed(setHelps, () => setHelps([])) : undefined), [any]);
  useEffect(() => {
    const ok = any && answered && replied;
    setBadges({
      dilemmas: ok && dilemmas ? countUnanswered(dilemmas, following, answered) : 0,
      help: ok && helps ? countUnanswered(helps.filter((h) => h.status === 'open'), following, replied) : 0,
    });
  }, [any, following, answered, replied, dilemmas, helps]);
  useEffect(() => () => setBadges({}), []);
  return null;
}

// Radice dell'area mazzi (lazy): attende lo stato di login, poi lista (#/decks, #/community, #/dilemmas con
// #/dilemmas/:mazzo/:dilemma per quello aperto e #/dilemmas/play per il gioco, #/help con #/help/:mazzo/:richiesta),
// editor (#/decks/:id, #/decks/:id/help sulla scheda Help), mazzo della Community
// (#/community/:id), liste di gruppo (#/decks/list/:id, invito #/decks/join/:id/:codice; in My decks la sezione sotto i
// mazzi), Team Trios (#/decks/team/:id, nella stessa sezione), profilo (#/profile, o #/profile/:uid per la pagina pubblica di un altro) o impostazioni. Avatar e ? (con il tutorial della pagina; nell'editor anche tasti e gesti)
// vanno nell'header dell'app, in headerSlot.
// Senza account (o con l'email ancora da confermare) si aprono solo i link condivisi: Community (elenco e ricerca), i
// suoi mazzi e le squadre pubbliche, in sola lettura; al posto dell'avatar Sign in apre l'accesso sopra la pagina.
// Il resto chiede di entrare.
export default function DecksView({ route, notify, printQueueCount, onPrintDeck, headerSlot }) {
  const { user, profile, photo, ready, rerender } = useAccount();
  const [signInOpen, setSignInOpen] = useState(false);
  if (ready && signInOpen) setSignInOpen(false); // entrato: l'accesso sopra la pagina si chiude da sé
  if (user === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  const [, area, id, sub, extra] = route.split('/');
  const group = area === 'decks' && (id === 'list' || id === 'join'); // liste di gruppo: #/decks/list/:id, #/decks/join/:id/:codice
  const community = area === 'community';
  const teamId = area === 'decks' && id === 'team' && sub;
  if (!ready) {
    const verify = (onClose) => <VerifyEmailPanel email={user.email} onVerified={rerender} notify={notify} onClose={onClose} />;
    if (!community && !teamId) return user ? verify() : <SignInPanel />;
    const signIn = () => setSignInOpen(true);
    const close = () => setSignInOpen(false);
    return (
      <>
        {headerSlot && createPortal(
          <><DeckHelp editor={!!teamId} team={!!teamId} /><button type="button" className="account-btn" onClick={signIn} aria-label="Sign in" title="Sign in"><IconUser size={16} /></button></>,
          headerSlot,
        )}
        {teamId ? <TeamPage key={teamId} id={teamId} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} onSignIn={signIn} />
          : id ? <CommunityDeck key={id} id={id} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} onSignIn={signIn} />
            : <DeckList notify={notify} tab="community" />}
        {signInOpen && (user ? verify(close) : <SignInPanel onClose={close} />)}
      </>
    );
  }
  return (
    <>
      <Badges uid={user.uid} />
      {headerSlot && createPortal(
        <><DeckHelp editor={area === 'decks' && !!id && id !== 'folder' && !group} team={area === 'decks' && id === 'team'} /><AccountMenu user={user} photo={photo} notify={notify} /></>,
        headerSlot,
      )}
      {route === '/profile' || (area === 'profile' && id === user.uid) ? <ProfilePage user={user} profile={profile} notify={notify} onChange={rerender} />
        : area === 'profile' && id ? <PublicProfilePage key={id} uid={id} viewer={user.uid} notify={notify} />
        : route === '/settings' ? <SettingsPage user={user} notify={notify} />
        : area === 'dilemmas' ? <DeckList uid={user.uid} notify={notify} tab="dilemmas" open={id && sub ? { deckId: id, id: sub } : null} play={id === 'play'} />
        : area === 'help' && id && sub ? <CommunityDeck key={`${id}/${sub}`} uid={user.uid} id={id} helpId={sub} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />
        : area === 'help' ? <DeckList uid={user.uid} notify={notify} tab="help" />
        : group && id === 'list' && sub ? <GroupListPage key={sub} uid={user.uid} id={sub} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />
        : group && sub && extra ? <JoinGroupList key={sub} uid={user.uid} id={sub} code={extra} />
        : teamId ? <TeamPage key={sub} uid={user.uid} id={sub} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />
        : area === 'decks' && id === 'folder' ? <DeckList uid={user.uid} notify={notify} tab="mine" folder={sub} />
        : community && id ? <CommunityDeck key={id} uid={user.uid} id={id} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />
        : id ? <DeckEditor key={id} uid={user.uid} id={id} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} initialTab={sub} owner={profile?.nickname} />
          : <DeckList uid={user.uid} notify={notify} tab={community ? 'community' : 'mine'} after={community ? null : <GroupListsSection uid={user.uid} notify={notify} />} />}
    </>
  );
}

// Pagina al centro (l'area chiede l'accesso) o, con onClose, finestra sopra un link condiviso aperto senza account.
function SignInFrame({ label, onClose, children }) {
  const ref = useOverlayDismiss(onClose, !!onClose, { focusContainer: false });
  if (!onClose) return <div className="decks-root decks-center">{children}</div>;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="signin-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close signin-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={18} /></button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Login: Google oppure email + password (accedi / crea account / reimposta password).
function SignInPanel({ onClose }) {
  const [busy, setBusy] = useState(null); // 'google' | 'email' | 'reset'
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    setInfo(null);
    try { await fn(); } catch (e) { setError(authMessage(e)); } finally { setBusy(null); }
  };
  const submit = (e) => {
    e.preventDefault();
    run('email', () => (signUp ? signUpEmail : signInEmail)(email.trim(), password));
  };
  const reset = () => {
    if (!email.trim()) { setInfo(null); setError('Type your email first, then ask for the reset link.'); return; }
    run('reset', async () => {
      await resetPassword(email.trim());
      setInfo('If an account exists for this email, a reset link is on its way. Check the spam folder too.');
    });
  };

  return (
    <SignInFrame label="Sign in" onClose={onClose}>
      <div className="signin-panel">
        <h2 className="decks-title">{onClose ? 'Sign in' : 'Your decks'}</h2>
        <p>{onClose ? 'Sign in to copy decks to your own, like them and join dilemmas and help requests. Your deck lists sync between your computer and your phone.'
          : 'Sign in to keep your deck lists and sync them between your computer and your phone.'}</p>
        <button type="button" className="btn-generate" onClick={() => run('google', signIn)} disabled={!!busy}>
          {busy === 'google' && <span className="spinner" />} Sign in with Google
        </button>
        <div className="signin-or" aria-hidden="true">or</div>
        <form className="signin-form" onSubmit={submit}>
          <input type="email" className="import-link-input" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" aria-label="Email" autoComplete="email" required disabled={!!busy} spellCheck={false} />
          <input type="password" className="import-link-input" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={signUp ? 'Password, at least 6 characters' : 'Password'} aria-label="Password"
            autoComplete={signUp ? 'new-password' : 'current-password'} minLength={6} required disabled={!!busy} />
          <button type="submit" className="btn-secondary signin-submit" disabled={!!busy}>
            {busy === 'email' && <span className="import-spinner" />} {signUp ? 'Create account' : 'Sign in with email'}
          </button>
          <div className="signin-links">
            <button type="button" className="signin-link" disabled={!!busy}
              onClick={() => { setSignUp((v) => !v); setError(null); setInfo(null); }}>
              {signUp ? 'I already have an account' : 'Create an account'}
            </button>
            {!signUp && <button type="button" className="signin-link" onClick={reset} disabled={!!busy}>Forgot password?</button>}
          </div>
        </form>
        {error && <div className="info-box info-box-error" role="alert"><span>{error}</span></div>}
        {info && <div className="info-box" role="status"><span>{info}</span></div>}
        <div className="privacy-row">
          <span>An account keeps your email, decks and settings on Firebase (Google). The print area works without one.</span>
          <CreditsButton />
          <PrivacyButton />
        </div>
      </div>
    </SignInFrame>
  );
}

// Account email appena creato: niente mazzi finché l'indirizzo non è confermato dal link. Chi non lo vuole più (email
// sbagliata, account di prova) lo cancella da qui: Settings non la vede.
function VerifyEmailPanel({ email, onVerified, notify, onClose }) {
  const [busy, setBusy] = useState(null); // 'check' | 'send' | 'delete'
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const check = useCallback(async (quiet) => {
    try {
      if (await checkVerified()) onVerified();
      else if (!quiet) setError('Not verified yet. Open the link in the email, then try again.');
    } catch (e) {
      if (!quiet) setError(authMessage(e));
    }
  }, [onVerified]);
  // Rientro dalla scheda della mail: controlla da solo.
  useEffect(() => {
    const onFocus = () => check(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    setInfo(null);
    try { await fn(); } catch (e) { setError(authMessage(e)); } finally { setBusy(null); }
  };

  return (
    <SignInFrame label="Verify your email" onClose={onClose}>
      <div className="signin-panel">
        <h2 className="decks-title">Verify your email</h2>
        <p>We sent a link to <b>{email}</b>. Open it to confirm the address, then come back here.</p>
        <button type="button" className="btn-generate" onClick={() => run('check', () => check(false))} disabled={!!busy}>
          {busy === 'check' && <span className="spinner" />} I verified it
        </button>
        <button type="button" className="btn-secondary signin-submit" disabled={!!busy}
          onClick={() => run('send', async () => { await sendVerification(); setInfo(`New link sent to ${email}.`); })}>
          {busy === 'send' && <span className="import-spinner" />} Send the link again
        </button>
        {error && <div className="info-box info-box-error" role="alert"><span>{error}</span></div>}
        {info && <div className="info-box" role="status"><span>{info}</span></div>}
        <p className="field-hint">Nothing in the inbox? Check the spam folder.</p>
        <div className="signin-links">
          <button type="button" className="signin-link" onClick={() => signOut()} disabled={!!busy}>Use another account</button>
          <button type="button" className="btn-secondary settings-delete signin-delete" disabled={!!busy}
            aria-label="Delete this account" title="Delete this account" onClick={() => setConfirmDel(true)}>
            {busy === 'delete' ? <span className="import-spinner" /> : <IconTrash size={16} />}
          </button>
        </div>
      </div>
      {createPortal(
        <ConfirmDialog open={confirmDel} message={`Delete the account ${email}? It has no decks yet. This can’t be undone.`}
          confirmLabel="Delete account" onCancel={() => setConfirmDel(false)}
          onConfirm={() => {
            setConfirmDel(false);
            run('delete', async () => { await deleteUnverifiedAccount(); notify('Account deleted'); });
          }} />,
        document.body,
      )}
    </SignInFrame>
  );
}
