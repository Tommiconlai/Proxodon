import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { IconX, IconInfo } from './icons';

// Chi gestisce Proxodon e dove scrivere per le richieste privacy (GDPR art. 13): da compilare. Vuoti = riga nascosta.
const CONTROLLER = '';
const CONTACT = ''; // email

const Ext = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer"><b>{children}</b></a>;

// Cosa resta sul dispositivo, chi altro vede le richieste, cosa salva l'account e come cancellarlo. Fuori dal chunk dei
// mazzi: lo aprono anche il banner e il pannello di accesso. Un host nuovo (vite.config.js, CSP) va detto anche qui.
export default function PrivacyPanel({ onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-credits" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Privacy" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Privacy</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Proxodon has no ads, no analytics and no tracking cookies. This is what it keeps, where, and who else sees your requests.</p>
        {CONTROLLER && (
          <p className="modal-hint">Proxodon is run by {CONTROLLER}.{CONTACT && <> Privacy requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</>}</p>
        )}
        <section className="credits-group" aria-label="On this device">
          <h3 className="profile-h">On this device</h3>
          <ul className="privacy-list">
            <li><b>Settings:</b> the print layout (sheet, card size, bleed, crop marks, colors), the choices on the Settings page and the last list pasted in Import from Scryfall, in the browser’s local storage.</li>
            <li><b>Caches:</b> card rules text from Scryfall, the addresses of card images in other languages, and how fast the AI upscale runs on this device. Plus a time stamp, for this tab only, that stops a reload loop after an update.</li>
            <li><b>Signed in:</b> your sign-in session and an offline copy of your decks, kept by Firebase in the browser (IndexedDB and local storage). After you sign out, the copy is emptied the next time the app starts.</li>
            <li><b>Your images:</b> the files you add to the print area, the AI upscale and the PDF stay in this page and are never uploaded. They are gone when you close it.</li>
            <li>Proxodon sets no cookies. All of this is needed for the features you use, so no consent is asked. To remove it, clear this site’s data in your browser.</li>
          </ul>
        </section>
        <section className="credits-group" aria-label="Who else sees your requests">
          <h3 className="profile-h">Who else sees your requests</h3>
          <ul className="privacy-list">
            <li><Ext href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub</Ext> hosts the site (GitHub Pages), so it receives your IP address and browser details when the page loads.</li>
            <li><Ext href="https://scryfall.com/docs/privacy">Scryfall</Ext>: card search, card data, images and mana symbols load straight from Scryfall, which receives your IP address and the cards you look up.</li>
            <li><Ext href="https://firebase.google.com/support/privacy">Google Firebase</Ext>: in Decks, sign-in and the deck database receive your IP address with every request. Firebase Authentication runs in the US and keeps sign-in IP addresses for a few weeks, against abuse.</li>
            <li><Ext href="https://policies.google.com/privacy">Google</Ext>: Sign in with Google opens Google’s own window, with Google’s cookies. Google profile photos and the Google Drive images of MPCFill imports load from Google’s servers.</li>
            <li>These companies may process data outside the EU, including in the United States.</li>
          </ul>
        </section>
        <section className="credits-group" aria-label="Your account">
          <h3 className="profile-h">Your account</h3>
          <p className="modal-hint">Signing in (with Google, or with email and password) lets Proxodon keep your decks and your settings on Firebase (Google Cloud), so they sync between your devices.</p>
          <ul className="privacy-list">
            <li><b>Stored:</b> your account id and email, plus name and photo with Google, and the nickname, profile photo and profile background if you set them (kept by Firebase Authentication; passwords are stored hashed by Firebase, never by Proxodon), your decks, your group lists, your Team Trios teams and your settings (the choices on the Settings page).</li>
            <li><b>Why:</b> only to run the features you use: keep and sync your decks and settings, and show what you share. Nothing is used for ads or profiling.</li>
            <li><b>Where:</b> Firebase, with the deck database in the EU and Firebase Authentication in the US. The emails that verify your address or reset your password are sent by Firebase.</li>
            <li><b>Who can read it:</b> only you, except what is public. Access rules block every other account. Public to every signed-in account: your profile page (nickname, profile photo, profile background, the date you joined, your public decks and the follower counts; never your email or last sign-in), and who you follow and who follows you (stored with the account ids; the profile page shows only the counts). Also: your nickname is reserved in a list that other signed-in accounts can check to see whether a name is free (only the name and your account id), and the decks you share in Community can be read by every signed-in account, with your nickname and account id. Decks are private until you share them. A like you give is stored on that deck with your account id; others only see the count. On dilemmas (questions on public decks), your choice and optional explanation are stored with your account id and nickname, and other signed-in accounts who answered see the explanations; the count of dilemmas you answered stays in your account. On help requests (on public decks), your suggestion (text and cards) is stored with your account id and nickname and every signed-in account can read it. A group list can be read only by its members: its name, the members’ account ids, and every card with the account id and nickname of who added it. A Team Trios team can be read only by its players: its name, the players’ account ids and its three decks (never public).</li>
            <li><b>How long:</b> until you delete it, or delete the account.</li>
            <li><b>Your copy:</b> Settings, Backup downloads all your decks as one JSON file. Profile and Settings show the rest.</li>
            <li><b>How to delete it:</b> Settings, Delete account and data at the bottom. It removes your decks, their Community copies (with the likes they received), the group lists you created, the cards you added to other group lists (you leave them), the teams you lead with their decks (you leave the other teams; your deck there stays with the team leader), your settings and your account; the likes you gave are removed too, so those counts go down; your follows are removed in both directions; your dilemma answers, your help suggestions, and the dilemmas and help requests on your decks are deleted. Make private removes a deck from Community, together with its dilemmas and help requests and their answers.</li>
          </ul>
        </section>
        <section className="credits-group" aria-label="Your rights">
          <h3 className="profile-h">Your rights</h3>
          <ul className="privacy-list">
            <li>Under the GDPR you can ask to see, correct, export or delete your data, and to restrict or object to its use. Most of it you can do yourself, from Profile and Settings.</li>
            <li>You can also complain to a data protection authority: in Italy, the <Ext href="https://www.garanteprivacy.it">Garante per la protezione dei dati personali</Ext>.</li>
          </ul>
        </section>
        <p className="modal-hint">The print area works without an account and keeps nothing on a server.</p>
      </div>
    </div>
  );
}

// Tasto ⓘ che apre il pannello (banner, accesso). Il pannello va nel body: fuori da contenitori animati o col backdrop-filter.
export function PrivacyButton({ className = 'btn-secondary deck-icon-btn' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-label="Privacy" title="Privacy" onClick={() => setOpen(true)}><IconInfo size={16} /></button>
      {open && createPortal(<PrivacyPanel onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
