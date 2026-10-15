import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { PrivacyPanel } from './dialogs';
import { signOut, deleteAccount } from './firebase';
import { navigate } from '../hooks/useHashRoute';
import { IconInfo, IconLogOut, IconTrash, IconUser, IconSettings } from '../components/icons';

// Foto personalizzata, poi quella di Google, poi l'iniziale (nickname o email).
export function Avatar({ user, photo }) {
  const src = photo || user.photoURL;
  const label = user.displayName || user.email || 'Account';
  return src
    ? <img src={src} alt="" referrerPolicy="no-referrer" />
    : <span aria-hidden="true">{label[0].toUpperCase()}</span>;
}

// Avatar → menu: profilo, impostazioni, privacy, esci, elimina account e dati (con conferma). Sta nell'header, il cui
// backdrop-filter farebbe da riferimento ai position: fixed: i dialoghi vanno nel body.
export default function AccountMenu({ user, photo, notify, onDeleteData }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const [privacy, setPrivacy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const closeMenu = useCallback(() => setMenu(null), []);
  const label = user.displayName || user.email || 'Account';
  const items = [
    { key: 'profile', Icon: IconUser, label: 'Profile', run: () => navigate('/profile') },
    { key: 'settings', Icon: IconSettings, label: 'Settings', run: () => navigate('/settings') },
    { key: 'privacy', Icon: IconInfo, label: 'Privacy', run: () => setPrivacy(true) },
    { key: 'out', Icon: IconLogOut, label: 'Sign out', run: () => signOut().catch((e) => notify(e.message, 'error')) },
    { key: 'del', Icon: IconTrash, label: 'Delete account and data', danger: true, run: () => setConfirmDel(true) },
  ];
  return (
    <>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-label={`Account: ${label}`}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 6 }); }}>
        <Avatar user={user} photo={photo} />
      </button>
      {menu && <CardMenu x={menu.x} y={menu.y} title={user.email || label} items={items} onClose={closeMenu} />}
      {createPortal(<>
      {privacy && <PrivacyPanel onClose={() => setPrivacy(false)} />}
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
