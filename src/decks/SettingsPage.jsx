import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listenDecks, createDeck, deleteUserData } from './deckStore';
import { changePassword, authMessage, deleteAccount } from './firebase';
import { toBackup, fromBackup, FORMATS, GROUP_MODES, SORT_MODES, VIEWS } from './deckModel';
import { downloadText } from '../utils/download';
import { useSettings, setSetting } from '../utils/settings';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconDownload, IconUpload, IconTrash } from '../components/icons';

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;
const WRONG_PASSWORD = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'];
const PROVIDERS = { 'google.com': 'Google', password: 'Email and password' };
const opts = (list) => list.map(({ id, label }) => <option key={String(id)} value={String(id)}>{label}</option>);
const LANGS = [
  ['en', 'English'], ['it', 'Italiano'], ['fr', 'Français'], ['de', 'Deutsch'], ['es', 'Español'], ['pt', 'Português'],
  ['ja', '日本語'], ['ko', '한국어'], ['ru', 'Русский'], ['zhs', '简体中文'], ['zht', '繁體中文'],
].map(([id, label]) => ({ id, label }));

// Riga "etichetta + select" legata a una chiave delle impostazioni. Opzioni con id true / false:
// il select dà stringhe, si salva il booleano ("false" sarebbe vero).
function Choice({ k, label, options, hint }) {
  const s = useSettings();
  const id = useId();
  const bool = typeof options[0].id === 'boolean';
  return (
    <div className="settings-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={String(s[k])} onChange={(e) => setSetting(k, bool ? e.target.value === 'true' : e.target.value)}>{opts(options)}</select>
      {hint && <p className="settings-hint">{hint}</p>}
    </div>
  );
}

// Casella sì / no legata a una chiave delle impostazioni (stesso disegno della stampa).
function Toggle({ k, label }) {
  const s = useSettings();
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={!!s[k]} onChange={(e) => setSetting(k, e.target.checked)} />
      <span className="anim-check" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
          <polyline points="1 9 7 14 15 4" />
        </svg>
      </span>
      {label}
    </label>
  );
}

function Card({ id, title, className = '', children }) {
  return (
    <section className={`profile-card ${className}`.trim()} aria-labelledby={id}>
      <h3 id={id} className="profile-h">{title}</h3>
      {children}
    </section>
  );
}

// Impostazioni (menu dell'avatar → Settings, #/settings): account (email, accesso) e password, poi le
// preferenze salvate su questo dispositivo (utils/settings): mazzi nuovi, stampa, lingua delle carte,
// import, aspetto, prezzi, poi backup e ripristino dei mazzi (il ripristino aggiunge i mazzi del file
// accanto a quelli che ci sono); in fondo, a tutta larghezza e col bordo rosso, l'eliminazione dell'account (con conferma).
export default function SettingsPage({ user, notify }) {
  const uid = user.uid;
  const providers = user.providerData.map((p) => p.providerId);
  const [decks, setDecks] = useState(null); // null = caricamento
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => listenDecks(uid, setDecks, (e) => notify(`Could not load your decks: ${e.message}`, 'error')), [uid, notify]);

  const backup = () => {
    downloadText(`proxodon-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks), null, 2), 'application/json')
      .then(() => notify(`Backup of ${plural(decks.length, 'deck')} downloaded`))
      .catch((e) => notify(`Backup failed: ${e.message}`, 'error'));
  };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const restored = fromBackup(json);
      restored.forEach((d) => createDeck(uid, d).done.catch((err) => notify(`Sync error: ${err.message}`, 'error')));
      // Righe rotte o oltre il massimo per mazzo: fromBackup le scarta, il toast le conta.
      const left = json.decks.reduce((n, d) => n + (Array.isArray(d?.cards) ? d.cards.length : 0), 0)
        - restored.reduce((n, d) => n + d.cards.length, 0);
      notify(`Restored ${plural(restored.length, 'deck')}${left > 0 ? `. ${plural(left, 'row')} could not be read and ${left === 1 ? 'was' : 'were'} left out` : ''}`,
        left > 0 ? 'error' : 'success');
    } catch (err) {
      notify(err instanceof SyntaxError ? 'This file is not valid JSON.' : err.message, 'error');
    }
  };

  return (
    <div className="decks-root profile-page">
      <header className="decks-head">
        <h2 className="decks-title">Settings</h2>
      </header>
      <p className="settings-note">Preferences are saved on this device.</p>
      <div className="profile-grid">
        <Card id="settings-account" title="Account">
          <dl className="profile-data">
            <dt>Email</dt>
            <dd>
              {user.email}
              <span className={`profile-badge${user.emailVerified ? ' ok' : ''}`}>{user.emailVerified ? 'verified' : 'not verified'}</span>
            </dd>
            <dt>Sign-in</dt><dd>{providers.map((p) => PROVIDERS[p] || p).join(', ')}</dd>
          </dl>
        </Card>
        <Card id="settings-password" title="Password">
          {providers.includes('password')
            ? <PasswordForm email={user.email} />
            : <p className="profile-note">You sign in with Google, so your password is managed by your Google account.</p>}
        </Card>
        <Card id="settings-decks" title="Decks">
          <Choice k="deckFormat" label="Format of new decks" options={FORMATS} />
          <Choice k="deckGroupBy" label="Group new decks by" options={GROUP_MODES.filter((m) => m.id !== 'custom')} />
          <Choice k="deckView" label="View" options={VIEWS} />
          <Choice k="deckSort" label="Sort by" options={SORT_MODES} hint="View and sort apply to every deck, and change when you pick them in a deck." />
        </Card>
        <Card id="settings-print" title="Print deck">
          <Choice k="printAdd" label="Print queue" options={[{ id: false, label: 'Replace the cards in it' }, { id: true, label: 'Add the deck after them' }]} />
          <Toggle k="printSide" label="Include the sideboard" />
        </Card>
        <Card id="settings-lang" title="Card language">
          <Choice k="cardLang" label="Card images" options={LANGS}
            hint="Printings in this language when Scryfall has them (same set and number), English otherwise. Card names and search stay in English." />
        </Card>
        <Card id="settings-import" title="Import">
          <Choice k="importFallback" label="Printing not found" options={[{ id: true, label: 'Use the default printing' }, { id: false, label: 'Skip the card' }]} />
          <Choice k="importMerge" label="Same printing on more lines" options={[{ id: true, label: 'Merge into one row' }, { id: false, label: 'Keep separate rows' }]} />
        </Card>
        <Card id="settings-look" title="Appearance">
          <Choice k="preview" label="Card preview on hover" options={[{ id: 'off', label: 'Off' }, { id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} />
          <Choice k="density" label="List view" options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]} />
          <Toggle k="reduceMotion" label="Reduce motion" />
        </Card>
        <Card id="settings-prices" title="Prices">
          <Choice k="currency" label="Deck price" options={[{ id: 'eur', label: 'EUR, Cardmarket' }, { id: 'usd', label: 'USD, TCGplayer' }, { id: 'off', label: 'Off' }]}
            hint="Prices from Scryfall, main deck and sideboard, shown only in the deck's Stats. A deck gets them the next time you open it." />
        </Card>
        <Card id="settings-backup" title="Backup">
          <p className="profile-note">
            Download all your decks{decks ? ` (${decks.length})` : ''} as one JSON file, to keep a copy or move them to another account.
          </p>
          <button type="button" className="btn-secondary settings-btn" onClick={backup} disabled={!decks?.length}>
            <IconDownload size={15} /> Download backup
          </button>
        </Card>
        <Card id="settings-restore" title="Restore">
          <p className="profile-note">Add the decks of a backup file. The decks you already have stay as they are.</p>
          <button type="button" className="btn-secondary settings-btn" onClick={() => fileRef.current.click()}>
            <IconUpload size={15} /> Restore from file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </Card>
      </div>
      <Card id="settings-delete" title="Delete account" className="settings-danger">
        <p className="profile-note">
          Delete your account, your decks with their Community copies, dilemmas and help requests, and your votes, replies and likes. This can’t be undone.
        </p>
        <button type="button" className="btn-secondary settings-btn settings-delete" onClick={() => setConfirmDel(true)}>
          <IconTrash size={15} /> Delete account and data
        </button>
      </Card>
      {createPortal(
        <ConfirmDialog open={confirmDel} message="Delete your account and all your decks? This can’t be undone."
          confirmLabel="Delete everything" onCancel={() => setConfirmDel(false)}
          onConfirm={() => {
            setConfirmDel(false);
            deleteAccount(deleteUserData)
              .then(() => notify('Account and decks deleted'))
              .catch((e) => notify(e.message || 'Could not delete the account.', 'error'));
          }} />,
        document.body,
      )}
    </div>
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
