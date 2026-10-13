import { useEffect, useState } from 'react';
import { watchUser, signIn } from './firebase';
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

function SignInPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try { await signIn(); } catch (e) { setError(e.message || 'Sign-in failed.'); } finally { setBusy(false); }
  };
  return (
    <div className="decks-root decks-center">
      <div className="signin-panel">
        <h2 className="decks-title">Your decks</h2>
        <p>Sign in to keep your deck lists and sync them between your computer and your phone.</p>
        <button type="button" className="btn-generate" onClick={go} disabled={busy}>
          {busy && <span className="spinner" />} Sign in with Google
        </button>
        {error && <div className="info-box info-box-error"><span>{error}</span></div>}
        <p className="field-hint">The print area works without an account.</p>
      </div>
    </div>
  );
}
