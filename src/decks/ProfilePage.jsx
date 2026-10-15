import { useEffect, useId, useState } from 'react';
import { listenDecks, saveProfilePhoto } from './deckStore';
import { updateNickname, authMessage } from './firebase';
import { deckCover } from './deckModel';
import { useSettings } from '../utils/settings';
import { navigate } from '../hooks/useHashRoute';
import { Avatar } from './AccountMenu';
import { DeckTile } from './DeckList';
import PhotoDialog from './PhotoDialog';
import { IconImage, IconPencil } from '../components/icons';

const day = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Foto profilo: JPEG 256 px (circa 20 KB) da PhotoDialog, salvato come data URL nel documento
// users/{uid}. ponytail: niente Firebase Storage (sui progetti nuovi richiede il piano a pagamento);
// se servono foto più grandi, Storage + URL.

// Profilo: testata con l'arte del mazzo modificato per ultimo come sfondo, foto, nickname, iscrizione,
// ultimo accesso, mazzi e carte; sotto, i mazzi. Email, metodo di accesso e password stanno in Settings.
export default function ProfilePage({ user, photo, notify, onChange }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const { currency } = useSettings();
  useEffect(() => listenDecks(user.uid, setDecks, () => setDecks(null)), [user.uid]);
  const cards = decks?.reduce((n, d) => n + d.cards.reduce((m, r) => m + r.qty, 0), 0);
  const banner = decks?.map(deckCover).find(Boolean);
  const stats = [
    ['Member since', day(user.metadata.creationTime)],
    ['Last sign-in', day(user.metadata.lastSignInTime)],
    ['Decks', decks ? decks.length : '…'],
    ['Cards', decks ? cards : '…'],
  ];

  return (
    <div className="decks-root profile-page">
      <section className="profile-hero" aria-label="Profile">
        <div className={`profile-banner${banner ? ' art' : ''}`} style={banner ? { backgroundImage: `url("${banner}")` } : undefined} aria-hidden="true" />
        <div className="profile-hero-body">
          <Identity user={user} photo={photo} notify={notify} onChange={onChange} />
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
          {decks.map((d) => (
            <li key={d.id} className="deck-tile-wrap">
              <DeckTile deck={d} currency={currency} onClick={() => navigate(`/decks/${d.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Foto (il tasto sul cerchio apre PhotoDialog: nuova o rimuovi) e nickname (matita → campo in linea, Esc annulla).
function Identity({ user, photo, notify, onChange }) {
  const current = user.displayName || '';
  const [name, setName] = useState(current);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); // salvataggio nickname
  const [photoOpen, setPhotoOpen] = useState(false);
  const nameId = useId();
  const savePhoto = (data, done) => saveProfilePhoto(user.uid, data)
    .then(() => notify(done))
    .catch((e) => notify(`Could not save the photo: ${e.message}`, 'error'));
  const cancel = () => { setName(current); setEditing(false); };

  const saveName = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateNickname(name.trim());
      setName(name.trim());
      setEditing(false);
      onChange();
      notify('Nickname saved');
    } catch (err) {
      notify(authMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="profile-avatar-wrap">
        <div className="profile-avatar"><Avatar user={user} photo={photo} /></div>
        <button type="button" className="profile-avatar-edit" onClick={() => setPhotoOpen(true)} aria-label="Change photo" title="Change photo">
          <IconImage size={16} />
        </button>
      </div>
      <div className="profile-who">
        {editing ? (
          <form className="profile-row profile-name-form" onSubmit={saveName} onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}>
            <label className="sr-only" htmlFor={nameId}>Nickname</label>
            <input id={nameId} className="import-link-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              maxLength={40} placeholder={user.email?.split('@')[0]} autoComplete="nickname" spellCheck={false} disabled={busy} />
            <button type="submit" className="btn-secondary" disabled={busy || name.trim() === current}>
              {busy && <span className="import-spinner" />} Save
            </button>
            <button type="button" className="btn-secondary" onClick={cancel} disabled={busy}>Cancel</button>
          </form>
        ) : (
          <div className="profile-name-row">
            <h2 className="profile-name">{current || user.email?.split('@')[0]}</h2>
            <button type="button" className="profile-icon-btn" onClick={() => setEditing(true)} aria-label="Edit nickname" title="Edit nickname">
              <IconPencil size={15} />
            </button>
          </div>
        )}
      </div>
      {photoOpen && (
        <PhotoDialog onClose={() => setPhotoOpen(false)}
          onSave={(data) => { setPhotoOpen(false); savePhoto(data, 'Photo updated'); }}
          onRemove={photo ? () => { setPhotoOpen(false); savePhoto(null, 'Photo removed'); } : undefined} />
      )}
    </>
  );
}
