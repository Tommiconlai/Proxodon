import { useEffect, useId, useRef, useState } from 'react';
import { listenDecks, createDeck } from './deckStore';
import { toBackup, fromBackup, FORMATS, GROUP_MODES, SORT_MODES, VIEWS } from './deckModel';
import { downloadText } from '../utils/download';
import { useSettings, setSetting } from '../utils/settings';
import { IconDownload, IconUpload } from '../components/icons';

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;
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

function Card({ id, title, children }) {
  return (
    <section className="profile-card" aria-labelledby={id}>
      <h3 id={id} className="profile-h">{title}</h3>
      {children}
    </section>
  );
}

// Impostazioni (menu dell'avatar → Settings, #/settings), salvate su questo dispositivo
// (utils/settings): mazzi nuovi, stampa, lingua delle carte, import, aspetto, prezzi, poi backup e
// ripristino dei mazzi (il ripristino aggiunge i mazzi del file accanto a quelli che ci sono).
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
      <p className="settings-note">Saved on this device.</p>
      <div className="profile-grid settings-grid">
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
            hint="Prices from Scryfall, main deck and sideboard. A deck gets them the next time you open it." />
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
    </div>
  );
}
