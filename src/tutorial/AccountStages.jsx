import { C, myDecks, communityDecks, dilemmas, demoUser } from './demo';
import { DeckTile, GhostTile } from '../decks/DeckList';
import { DilemmaTile } from '../decks/Dilemmas';
import { Avatar } from '../decks/AccountMenu';
import { IconPencil, IconArrowRight, IconImage, IconDownload, IconUpload } from '../components/icons';

// Pagine demo del tutorial per Profilo e Settings (copie con dati inventati, niente letture dal server), e Shell, il
// contenitore delle pagine mazzi su telefono (.mobile-body.mobile-decks), usato anche da DeckTour.
const noop = () => {};
const OWNERS = Object.fromEntries(communityDecks().map((d) => [d.id, d]));
export const Shell = ({ mobile, children }) => (mobile ? <main className="mobile-body mobile-decks">{children}</main> : children);

// ── Profilo ──
export function ProfileStage({ mobile }) {
  const decks = myDecks();
  const stats = [['Member since', '14 Mar 2026'], ['Last sign-in', 'Today'], ['Decks', decks.length], ['Dilemmas answered', 9], ['Followers', 0], ['Following', 0]];
  return (
    <Shell mobile={mobile}>
      <div className="decks-root profile-page">
        <section className="profile-hero" aria-label="Profile">
          <button type="button" className="profile-banner art" style={{ backgroundImage: `url("${C.tatyova.art}")` }} aria-label="Change background">
            <span className="profile-banner-hint" aria-hidden="true"><IconImage size={14} /> Change background</span>
          </button>
          <div className="profile-hero-body">
            <button type="button" className="profile-avatar" aria-label="Change photo" title="Change photo">
              <Avatar user={demoUser} photo={null} />
              <span className="profile-avatar-hover" aria-hidden="true"><IconImage size={22} /></span>
            </button>
            <div className="profile-who profile-name-row">
              <h2 className="profile-name">{demoUser.displayName}</h2>
              <button type="button" className="profile-icon-btn" aria-label="Edit nickname" title="Edit nickname"><IconPencil size={15} /></button>
            </div>
            <dl className="profile-stats">{stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
        </section>
        <header className="decks-head"><h2 className="decks-title">Decks</h2></header>
        <ul className="deck-grid tut-profile-decks">
          {decks.slice(0, 4).map((d) => <li key={d.id} className="deck-tile-wrap"><DeckTile deck={d} stats={{ likes: d.public ? 12 : 0, help: d.id === 'tut-deck' }} /></li>)}
          <GhostTile label={`See all ${decks.length} decks`} onClick={noop}>
            <span className="deck-all" aria-hidden="true"><IconArrowRight size={34} />See all<span className="deck-all-n">{decks.length} decks</span></span>
          </GhostTile>
        </ul>
        <header className="decks-head profile-next"><h2 className="decks-title">Dilemmas</h2></header>
        <ul className="dilemma-list">
          {dilemmas().map((d) => <DilemmaTile key={d.id} deckId={d.deckId} d={d} uid="tutorial" solved={false} votes={d.votes} onClick={noop} meta={<b>{OWNERS[d.deckId].name}</b>} />)}
        </ul>
      </div>
    </Shell>
  );
}

// ── Impostazioni (copia di SettingsPage con i valori di default) ──
const Field = ({ label, value, hint }) => (
  <div className="settings-field">
    <label>{label}</label>
    <select value={value} onChange={noop} aria-label={label}><option value={value}>{value}</option></select>
    {hint && <p className="settings-hint">{hint}</p>}
  </div>
);
const Check = ({ label, on }) => (
  <label className="checkbox-row">
    <input type="checkbox" checked={on} readOnly />
    <span className="anim-check" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
        <polyline points="1 9 7 14 15 4" />
      </svg>
    </span>
    {label}
  </label>
);
const Card = ({ id, title, children }) => (
  <section className="profile-card" id={id} aria-labelledby={`${id}-h`}><h3 id={`${id}-h`} className="profile-h">{title}</h3>{children}</section>
);
export function SettingsStage({ mobile }) {
  return (
    <Shell mobile={mobile}>
      <div className="decks-root profile-page">
        <header className="decks-head"><h2 className="decks-title">Settings</h2></header>
        <p className="settings-note">Preferences are saved on this device.</p>
        <div className="profile-grid">
          <Card id="tut-set-account" title="Account">
            <dl className="profile-data">
              <dt>Email</dt><dd>{demoUser.email}<span className="profile-badge ok">verified</span></dd>
              <dt>Sign-in</dt><dd>Email and password</dd>
            </dl>
          </Card>
          <Card id="tut-set-decks" title="Decks">
            <Field label="Format of new decks" value="Commander" />
            <Field label="Group new decks by" value="Type" />
            <Field label="View" value="Stacks" />
            <Field label="Sort by" value="Name" hint="View and sort apply to every deck, and change when you pick them in a deck." />
          </Card>
          <Card id="tut-set-print" title="Print deck">
            <Field label="Print queue" value="Replace the cards in it" />
            <Check label="Include the sideboard" on={false} />
          </Card>
          <Card id="tut-set-lang" title="Card language">
            <Field label="Card images" value="English" hint="Printings in this language when Scryfall has them (same set and number), English otherwise. Card names and search stay in English." />
          </Card>
          <Card id="tut-set-look" title="Appearance">
            <Field label="Card preview on hover" value="Medium" />
            <Field label="List view" value="Comfortable" />
            <Check label="Reduce motion" on={false} />
          </Card>
          <Card id="tut-set-backup" title="Backup">
            <p className="profile-note">Download all your decks as one JSON file, to keep a copy or move them to another account.</p>
            <button type="button" className="btn-secondary settings-btn"><IconDownload size={15} /> Download backup</button>
          </Card>
          <Card id="tut-set-restore" title="Restore">
            <p className="profile-note">Add the decks of a backup file. The decks you already have stay as they are.</p>
            <button type="button" className="btn-secondary settings-btn"><IconUpload size={15} /> Restore from file</button>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
