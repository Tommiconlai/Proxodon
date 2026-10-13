import { useCallback, useState } from 'react';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { PrivacyPanel } from './dialogs';
import { signOut, deleteAccount } from './firebase';
import { IconInfo, IconLogOut, IconTrash } from '../components/icons';

// Avatar → menu: privacy, esci, elimina account e dati (con conferma).
export default function AccountMenu({ user, notify, onDeleteData }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const [privacy, setPrivacy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const closeMenu = useCallback(() => setMenu(null), []);
  const label = user.displayName || user.email || 'Account';
  const items = [
    { key: 'privacy', Icon: IconInfo, label: 'Privacy', run: () => setPrivacy(true) },
    { key: 'out', Icon: IconLogOut, label: 'Sign out', run: () => signOut().catch((e) => notify(e.message, 'error')) },
    { key: 'del', Icon: IconTrash, label: 'Delete account and data', danger: true, run: () => setConfirmDel(true) },
  ];
  return (
    <>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-label={`Account: ${label}`}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 6 }); }}>
        {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{label[0].toUpperCase()}</span>}
      </button>
      {menu && <CardMenu x={menu.x} y={menu.y} title={user.email || label} items={items} onClose={closeMenu} />}
      {privacy && <PrivacyPanel onClose={() => setPrivacy(false)} />}
      <ConfirmDialog open={confirmDel} message="Delete your account and all your decks? This can’t be undone."
        confirmLabel="Delete everything" onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false);
          deleteAccount(onDeleteData)
            .then(() => notify('Account and decks deleted'))
            .catch((e) => notify(e.message || 'Could not delete the account.', 'error'));
        }} />
    </>
  );
}
