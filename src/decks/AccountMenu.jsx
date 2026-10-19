import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { PrivacyPanel, CreditsPanel } from './dialogs';
import { signOut, deleteAccount, writesSynced } from './firebase';
import { deleteUserData } from './deckStore';
import { useAccount } from './useAccount';
import { navigate } from '../hooks/useHashRoute';
import { IconInfo, IconLogOut, IconTrash, IconUser, IconSettings, IconSparkles } from '../components/icons';

// Header della stampa: avatar e menu da loggato, altrimenti l'icona porta all'accesso (area mazzi).
// In verifica resta il posto vuoto, così il ? non si sposta.
export function HeaderAccount({ notify }) {
  const { user, photo, ready } = useAccount();
  if (user === undefined) return <span className="account-btn account-placeholder" aria-hidden="true" />;
  return ready
    ? <AccountMenu user={user} photo={photo} notify={notify} onDeleteData={deleteUserData} />
    : <a href="#/decks" className="account-btn account-signin" aria-label="Sign in" title="Sign in"><IconUser size={16} /></a>;
}

// Foto personalizzata, poi quella di Google, poi l'iniziale (nickname o email).
export function Avatar({ user, photo }) {
  const src = photo || user.photoURL;
  const label = user.displayName || user.email || 'Account';
  return src
    ? <img src={src} alt="" referrerPolicy="no-referrer" />
    : <span aria-hidden="true">{label[0].toUpperCase()}</span>;
}

// Avatar → menu col nickname in testa: profilo, impostazioni, privacy, crediti, esci, elimina account e dati
// (con conferma). Sta nell'header, il cui backdrop-filter farebbe da riferimento ai position: fixed: i
// dialoghi vanno nel body.
export default function AccountMenu({ user, photo, notify, onDeleteData }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const [privacy, setPrivacy] = useState(false);
  const [credits, setCredits] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false); // modifiche non ancora sul server: uscire le perde
  const closeMenu = useCallback(() => setMenu(null), []);
  const out = () => signOut().catch((e) => notify(e.message, 'error'));
  const label = user.displayName || user.email || 'Account';
  const items = [
    { key: 'profile', Icon: IconUser, label: 'Profile', run: () => navigate('/profile') },
    { key: 'settings', Icon: IconSettings, label: 'Settings', run: () => navigate('/settings') },
    { key: 'privacy', Icon: IconInfo, label: 'Privacy', run: () => setPrivacy(true) },
    { key: 'credits', Icon: IconSparkles, label: 'Credits', run: () => setCredits(true) },
    { key: 'out', Icon: IconLogOut, label: 'Sign out', run: () => writesSynced().then((ok) => (ok ? out() : setConfirmOut(true))) },
    { key: 'del', Icon: IconTrash, label: 'Delete account and data', danger: true, run: () => setConfirmDel(true) },
  ];
  return (
    <>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-label={`Account: ${label}`}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 6 }); }}>
        <Avatar user={user} photo={photo} />
      </button>
      {menu && <CardMenu x={menu.x} y={menu.y} title={label} items={items} onClose={closeMenu} />}
      {createPortal(<>
      {privacy && <PrivacyPanel onClose={() => setPrivacy(false)} />}
      {credits && <CreditsPanel onClose={() => setCredits(false)} />}
      <ConfirmDialog open={confirmOut} confirmLabel="Sign out"
        message="Some changes are not synced yet (no connection?). Signing out now loses them. Sign out anyway?"
        onCancel={() => setConfirmOut(false)} onConfirm={() => { setConfirmOut(false); out(); }} />
      <ConfirmDialog open={confirmDel} message="Delete your account and all your decks? This can’t be undone."
        confirmLabel="Delete everything" onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false);
          deleteAccount(onDeleteData)
            .then(() => notify('Account and decks deleted'))
            .catch((e) => notify(e.message || 'Could not delete the account.', 'error'));
        }} />
      </>, document.body)}
    </>
  );
}
