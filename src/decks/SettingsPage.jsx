import { useEffect, useRef, useState } from 'react';
import { listenDecks, createDeck } from './deckStore';
import { toBackup, fromBackup } from './deckModel';
import { downloadText } from '../utils/download';
import { IconDownload, IconUpload } from '../components/icons';

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

// Impostazioni (menu dell'avatar → Settings, #/settings): backup e ripristino dei mazzi, spostati qui
// dalla lista mazzi. Il ripristino aggiunge i mazzi del file accanto a quelli che ci sono già.
export default function SettingsPage({ uid, notify }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const fileRef = useRef(null);
  useEffect(() => listenDecks(uid, setDecks, (e) => notify(`Could not load your decks: ${e.message}`, 'error')), [uid, notify]);

  const backup = () => {
    downloadText(`proxoteca-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks), null, 2), 'application/json');
    notify(`Backup of ${plural(decks.length, 'deck')} downloaded`);
  };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const restored = fromBackup(JSON.parse(await file.text()));
      restored.forEach((d) => createDeck(uid, d).done.catch((err) => notify(`Sync error: ${err.message}`, 'error')));
      notify(`Restored ${plural(restored.length, 'deck')}`);
    } catch (err) {
      notify(err instanceof SyntaxError ? 'This file is not valid JSON.' : err.message, 'error');
    }
  };

  return (
    <div className="decks-root profile-page">
      <header className="decks-head">
        <h2 className="decks-title">Settings</h2>
      </header>
      <div className="profile-grid">
        <section className="profile-card" aria-labelledby="settings-backup">
          <h3 id="settings-backup" className="profile-h">Backup</h3>
          <p className="profile-note">
            Download all your decks{decks ? ` (${decks.length})` : ''} as one JSON file, to keep a copy or move them to another account.
          </p>
          <button type="button" className="btn-secondary settings-btn" onClick={backup} disabled={!decks?.length}>
            <IconDownload size={15} /> Download backup
          </button>
        </section>
        <section className="profile-card" aria-labelledby="settings-restore">
          <h3 id="settings-restore" className="profile-h">Restore</h3>
          <p className="profile-note">Add the decks of a backup file. The decks you already have stay as they are.</p>
          <button type="button" className="btn-secondary settings-btn" onClick={() => fileRef.current.click()}>
            <IconUpload size={15} /> Restore from file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </section>
      </div>
    </div>
  );
}
