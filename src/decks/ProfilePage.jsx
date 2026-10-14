import { useEffect, useId, useState } from 'react';
import { listenDecks, saveProfilePhoto } from './deckStore';
import { updateNickname, changePassword, authMessage } from './firebase';
import { Avatar } from './AccountMenu';
import PhotoDialog from './PhotoDialog';
import { IconArrowLeft, IconUpload, IconTrash } from '../components/icons';

const WRONG_PASSWORD = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'];
const PROVIDERS = { 'google.com': 'Google', password: 'Email and password' };
const day = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

// Foto profilo: JPEG 256 px (circa 20 KB) da PhotoDialog, salvato come data URL nel documento
// users/{uid}. ponytail: niente Firebase Storage (sui progetti nuovi richiede il piano a pagamento);
// se servono foto più grandi, Storage + URL.

// Profilo: foto e nickname, riepilogo dell'account, cambio password (solo account email).
export default function ProfilePage({ user, photo, notify, onChange }) {
  const [decks, setDecks] = useState(null);
  useEffect(() => listenDecks(user.uid, setDecks, () => setDecks(null)), [user.uid]);
  const providers = user.providerData.map((p) => p.providerId);
  const cards = decks?.reduce((n, d) => n + d.cards.reduce((m, r) => m + r.qty, 0), 0);

  return (
    <div className="decks-root profile-page">
      <header className="decks-head">
        <a className="deck-back" href="#/decks" aria-label="Back to decks"><IconArrowLeft size={18} /></a>
        <h2 className="decks-title">Profile</h2>
      </header>
      <div className="profile-grid">
        <IdentityCard user={user} photo={photo} notify={notify} onChange={onChange} />
        <section className="profile-card" aria-labelledby="profile-account">
          <h3 id="profile-account" className="profile-h">Account</h3>
          <dl className="profile-data">
            <dt>Email</dt>
            <dd>
              {user.email}
              <span className={`profile-badge${user.emailVerified ? ' ok' : ''}`}>{user.emailVerified ? 'verified' : 'not verified'}</span>
            </dd>
            <dt>Sign-in</dt><dd>{providers.map((p) => PROVIDERS[p] || p).join(', ')}</dd>
            <dt>Member since</dt><dd>{day(user.metadata.creationTime)}</dd>
            <dt>Last sign-in</dt><dd>{day(user.metadata.lastSignInTime)}</dd>
            <dt>Decks</dt><dd>{decks ? `${plural(decks.length, 'deck')}, ${plural(cards, 'card')}` : '…'}</dd>
          </dl>
        </section>
        <section className="profile-card" aria-labelledby="profile-password">
          <h3 id="profile-password" className="profile-h">Password</h3>
          {providers.includes('password')
            ? <PasswordForm email={user.email} />
            : <p className="profile-note">You sign in with Google, so your password is managed by your Google account.</p>}
        </section>
      </div>
    </div>
  );
}

function IdentityCard({ user, photo, notify, onChange }) {
  const current = user.displayName || '';
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false); // salvataggio nickname
  const [photoOpen, setPhotoOpen] = useState(false);
  const nameId = useId();
  const savePhoto = (data, done) => saveProfilePhoto(user.uid, data)
    .then(() => notify(done))
    .catch((e) => notify(`Could not save the photo: ${e.message}`, 'error'));

  const saveName = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateNickname(name.trim());
      setName(name.trim());
      onChange();
      notify('Nickname saved');
    } catch (err) {
      notify(authMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="profile-card profile-id" aria-label="Photo and nickname">
      <div className="profile-avatar"><Avatar user={user} photo={photo} /></div>
      <div className="profile-photo-actions">
        <button type="button" className="btn-secondary" onClick={() => setPhotoOpen(true)}>
          <IconUpload size={15} /> Change photo
        </button>
        {photo && (
          <button type="button" className="btn-secondary" onClick={() => savePhoto(null, 'Photo removed')}>
            <IconTrash size={15} /> Remove photo
          </button>
        )}
      </div>
      {photoOpen && <PhotoDialog onClose={() => setPhotoOpen(false)} onSave={(data) => { setPhotoOpen(false); savePhoto(data, 'Photo updated'); }} />}
      <form className="profile-form" onSubmit={saveName}>
        <label className="profile-h" htmlFor={nameId}>Nickname</label>
        <div className="profile-row">
          <input id={nameId} className="import-link-input" value={name} onChange={(e) => setName(e.target.value)}
            maxLength={40} placeholder={user.email?.split('@')[0]} autoComplete="nickname" spellCheck={false} disabled={busy} />
          <button type="submit" className="btn-secondary" disabled={busy || name.trim() === current}>
            {busy && <span className="import-spinner" />} Save
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm({ email }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setInfo('Password changed.');
    } catch (err) {
      setError(WRONG_PASSWORD.includes(err.code) ? 'The current password is wrong.' : authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={submit}>
      {/* Per i password manager: a quale account appartiene la nuova password. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <input type="password" className="import-link-input" value={current} onChange={(e) => setCurrent(e.target.value)}
        placeholder="Current password" aria-label="Current password" autoComplete="current-password" required disabled={busy} />
      <input type="password" className="import-link-input" value={next} onChange={(e) => setNext(e.target.value)}
        placeholder="New password, at least 6 characters" aria-label="New password" autoComplete="new-password"
        minLength={6} required disabled={busy} />
      <button type="submit" className="btn-secondary signin-submit" disabled={busy}>
        {busy && <span className="import-spinner" />} Change password
      </button>
      {error && <div className="info-box info-box-error" role="alert"><span>{error}</span></div>}
      {info && <div className="info-box" role="status"><span>{info}</span></div>}
      <p className="field-hint">Forgot it? Sign out and use “Forgot password?” on the sign-in page.</p>
    </form>
  );
}
