import { useEffect, useState } from 'react';
import { watchUser, signIn, signInEmail, signUpEmail, resetPassword, authMessage } from './firebase';
import AccountMenu from './AccountMenu';
import DeckList from './DeckList';
import DeckEditor from './DeckEditor';
import { deleteAllDecks } from './deckStore';

// Radice dell'area mazzi (lazy): attende lo stato di login, poi lista o editor.
export default function DecksView({ route, notify, printQueueCount, onPrintDeck }) {
  const [user, setUser] = useState(undefined); // undefined = in verifica, null = non loggato
  useEffect(() => watchUser(setUser), []);
  if (user === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  if (!user) return <SignInPanel />;
  const id = route.split('/')[2];
  if (id) return <DeckEditor key={id} uid={user.uid} id={id} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />;
  return <DeckList uid={user.uid} notify={notify} account={<AccountMenu user={user} notify={notify} onDeleteData={deleteAllDecks} />} />;
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
