import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  signIn, signInEmail, signUpEmail, resetPassword, authMessage, signOut,
  needsVerification, sendVerification, checkVerified,
} from './firebase';
import AccountMenu from './AccountMenu';
import { useAccount } from './useAccount';
import DeckList from './DeckList';
import DeckEditor from './DeckEditor';
import CommunityDeck from './CommunityDeck';
import DeckHelp from './DeckHelp';
import ProfilePage from './ProfilePage';
import SettingsPage from './SettingsPage';
import { deleteUserData } from './deckStore';

// Radice dell'area mazzi (lazy): attende lo stato di login, poi lista (#/decks, #/community, #/dilemmas con
// #/dilemmas/:mazzo/:dilemma per quello aperto e #/dilemmas/play per il gioco, #/help con #/help/:mazzo/:richiesta),
// editor (#/decks/:id, #/decks/:id/help sulla scheda Help), mazzo della Community
// (#/community/:id), profilo o impostazioni. Avatar (e il ?
// nell'editor) vanno nell'header dell'app, in headerSlot.
export default function DecksView({ route, notify, printQueueCount, onPrintDeck, headerSlot }) {
  const { user, profile, photo, rerender } = useAccount();
  if (user === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  if (!user) return <SignInPanel />;
  if (needsVerification(user)) return <VerifyEmailPanel email={user.email} onVerified={rerender} />;
  const [, area, id, sub] = route.split('/');
  const community = area === 'community';
  return (
    <>
      {headerSlot && createPortal(
        <>{id && area === 'decks' && <DeckHelp />}<AccountMenu user={user} photo={photo} notify={notify} onDeleteData={deleteUserData} /></>,
        headerSlot,
      )}
      {route === '/profile' ? <ProfilePage user={user} profile={profile} notify={notify} onChange={rerender} />
        : route === '/settings' ? <SettingsPage user={user} notify={notify} />
        : area === 'dilemmas' ? <DeckList uid={user.uid} notify={notify} tab="dilemmas" open={id && sub ? { deckId: id, id: sub } : null} play={id === 'play'} />
        : area === 'help' && id && sub ? <CommunityDeck key={`${id}/${sub}`} uid={user.uid} id={id} helpId={sub} notify={notify} />
        : area === 'help' ? <DeckList uid={user.uid} notify={notify} tab="help" />
        : area === 'decks' && id === 'folder' ? <DeckList uid={user.uid} notify={notify} tab="mine" folder={sub} />
        : community && id ? <CommunityDeck key={id} uid={user.uid} id={id} notify={notify} />
        : id ? <DeckEditor key={id} uid={user.uid} id={id} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} initialTab={sub} />
          : <DeckList uid={user.uid} notify={notify} tab={community ? 'community' : 'mine'} />}
    </>
  );
}

// Login: Google oppure email + password (accedi / crea account / reimposta password).
function SignInPanel() {
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
    <div className="decks-root decks-center">
      <div className="signin-panel">
        <h2 className="decks-title">Your decks</h2>
        <p>Sign in to keep your deck lists and sync them between your computer and your phone.</p>
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
        <p className="field-hint">The print area works without an account.</p>
      </div>
    </div>
  );
}

// Account email appena creato: niente mazzi finché l'indirizzo non è confermato dal link.
function VerifyEmailPanel({ email, onVerified }) {
  const [busy, setBusy] = useState(null); // 'check' | 'send'
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

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
    <div className="decks-root decks-center">
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
        </div>
      </div>
    </div>
  );
}
