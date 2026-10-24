import { useEffect } from 'react';
import { C, myDecks, communityDecks, dilemmas, demoUser } from './demo';
import { DeckTile, GhostTile } from '../decks/DeckList';
import { DilemmaTile } from '../decks/Dilemmas';
import { Avatar } from '../decks/AccountMenu';
import { ProfileHero } from '../decks/ProfilePage';
import { IconPencil, IconArrowRight, IconImage, IconDownload, IconUpload, IconTrash } from '../components/icons';

// Pagine demo del tutorial per Profilo e Settings (copie con dati inventati, niente letture dal server), e Shell, il
// contenitore delle pagine mazzi su telefono (.mobile-body.mobile-decks), usato anche da DeckTour.
const noop = () => {};
const OWNERS = Object.fromEntries(communityDecks().map((d) => [d.id, d]));
export const Shell = ({ mobile, children }) => (mobile ? <main className="mobile-body mobile-decks">{children}</main> : children);

// ── Profilo ──
export function ProfileStage({ mobile }) {
  const decks = myDecks();
  const stats = [['Last sign-in', 'Today'], ['Decks', decks.length], ['Dilemmas answered', 9], ['Followers', 3], ['Following', 5]];
  return (
    <Shell mobile={mobile}>
      <div className="decks-root profile-page">
        {mobile && <header className="decks-head"><h1 className="decks-title">Profile</h1></header>}
        <ProfileHero banner={C.tatyova.art} since="14 Mar 2026" stats={stats}
          avatar={(
            <button type="button" className="profile-avatar" aria-label="Change photo" title="Change photo">
              <Avatar user={demoUser} photo={null} />
              <span className="profile-avatar-hover" aria-hidden="true"><IconImage size={22} /></span>
            </button>
          )}
          action={<button type="button" className="profile-bg-btn" aria-label="Change background" title="Change background"><IconImage size={16} /></button>}>
          <div className="profile-who profile-name-row">
            <h2 className="profile-name">{demoUser.displayName}</h2>
            <button type="button" className="profile-icon-btn" aria-label="Edit nickname" title="Edit nickname"><IconPencil size={15} /></button>
          </div>
        </ProfileHero>
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
export function SettingsStage({ mobile, step }) {
  // La pagina è più alta dello schermo: il riquadro del passo a metà (da telefono in cima, la scheda del passo sta in
  // basso), prima che la scheda si fermi.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector(`.tut-stage ${step.target}`)?.scrollIntoView({ block: mobile ? 'start' : 'center' }), 150);
    return () => clearTimeout(t);
  }, [step, mobile]);
  return (
    <Shell mobile={mobile}>
      <div className="decks-root profile-page settings-page">
        <header className="decks-head"><h2 className="decks-title">Settings</h2></header>
        <p className="settings-note">Settings are saved in your account and follow you on every device.</p>
        <div className="profile-grid">
          <Card id="tut-set-account" title="Account">
            <dl className="profile-data">
              <dt>Email</dt><dd>{demoUser.email}<span className="profile-badge ok">verified</span></dd>
              <dt>Sign-in</dt><dd>Email and password</dd>
            </dl>
            <div className="settings-block">
              <h4 className="settings-sub">Password</h4>
              <div className="profile-form">
                <input type="password" className="import-link-input" placeholder="Current password" aria-label="Current password" readOnly />
                <input type="password" className="import-link-input" placeholder="New password, at least 6 characters" aria-label="New password" readOnly />
                <button type="button" className="btn-secondary signin-submit">Change password</button>
              </div>
            </div>
          </Card>
          <Card id="tut-set-decks" title="New decks">
            <Field label="Format" value="Commander" />
            <Field label="Group by" value="Type" />
            <Field label="Visibility" value="Private" hint="You can still change it when you create the deck." />
          </Card>
          <Card id="tut-set-display" title="Display">
            <Field label="View" value="Stacks" />
            <Field label="Sort by" value="Name" hint="The default of every deck. A deck keeps the view and sort you pick in it." />
            <Field label="List view" value="Comfortable" />
            <Field label="Card preview on hover" value="Medium" />
            <Field label="Commander brackets" value="Show" hint="Off hides them in your decks, in Community and on profiles." />
            <Check label="Reduce motion" on={false} />
          </Card>
          <Card id="tut-set-cards" title="Cards">
            <Field label="Card images" value="English" hint="Printings in this language when Scryfall has them (same set and number), English otherwise. Card names and search stay in English." />
            <Field label="Deck price" value="EUR, Cardmarket" />
          </Card>
          <Card id="tut-set-import" title="Import and print">
            <Field label="Printing not found" value="Use the default printing" />
            <Field label="Same printing on more lines" value="Merge into one row" />
            <Field label="Print deck" value="Replace the print queue" />
            <Check label="Include the sideboard" on={false} />
          </Card>
          <Card id="tut-set-backup" title="Backup">
            <p className="profile-note">Download all your decks as one JSON file, to keep a copy or move them to another account.</p>
            <button type="button" className="btn-secondary settings-btn"><IconDownload size={15} /> Download backup</button>
            <p className="profile-note">Restore adds the decks of a backup file. The decks you already have stay as they are.</p>
            <button type="button" className="btn-secondary settings-btn"><IconUpload size={15} /> Restore from file</button>
          </Card>
        </div>
        <section className="profile-card settings-wide" id="tut-set-printing" aria-labelledby="tut-set-printing-h">
          <h3 id="tut-set-printing-h" className="profile-h">Preferred printing</h3>
          <p className="profile-note">For the cards you add from the search. The printing you chose for a card comes first, then the first of your sets that has the card, then the rule.</p>
          <div className="settings-cols">
            <div className="settings-col">
              <Field label="Rule" value="Newest printing" />
              <ol className="settings-list" aria-label="Preferred sets, in order">
                <li><span className="settings-list-name">Commander Masters <span className="settings-list-code">CMM</span></span></li>
                <li><span className="settings-list-name">Dominaria United <span className="settings-list-code">DMU</span></span></li>
              </ol>
            </div>
            <div className="settings-col">
              <ul className="settings-list" aria-label="Printing of a card">
                <li><img className="settings-list-img" src={C.solRing.img} alt="" /><span className="settings-list-name">Sol Ring <span className="settings-list-code">C21 #263</span></span></li>
              </ul>
            </div>
          </div>
        </section>
        <section className="profile-card settings-danger" id="tut-set-delete" aria-labelledby="tut-set-delete-h">
          <h3 id="tut-set-delete-h" className="profile-h">Delete account</h3>
          <p className="profile-note">Delete your account, your decks with their Community copies, dilemmas and help requests, your settings, and your votes, replies and likes. This can’t be undone.</p>
          <button type="button" className="btn-secondary settings-btn settings-delete"><IconTrash size={15} /> Delete account and data</button>
        </section>
      </div>
    </Shell>
  );
}
