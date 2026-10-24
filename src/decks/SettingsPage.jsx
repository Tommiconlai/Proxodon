import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listenDecks, createDeck, deleteUserData } from './deckStore';
import { changePassword, authMessage, deleteAccount } from './firebase';
import { toBackup, fromBackup, FORMATS, GROUP_MODES, SORT_MODES, VIEWS, scryfallImg } from './deckModel';
import { autocomplete, cardsByIds, paperSets } from './scryfallSearch';
import { downloadText } from '../utils/download';
import { useSettings, getSettings, setSetting, MAX_FAV_PRINTS, MAX_PREF_SETS } from '../utils/settings';
import ConfirmDialog from '../components/ConfirmDialog';
import ArtPickerModal from '../components/ArtPickerModal';
import { IconDownload, IconUpload, IconTrash, IconPlus, IconX, IconArrowUp, IconImage, IconReplay } from '../components/icons';

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;
const WRONG_PASSWORD = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'];
const PROVIDERS = { 'google.com': 'Google', password: 'Email and password' };
const opts = (list) => list.map(({ id, label }) => <option key={String(id)} value={String(id)}>{label}</option>);
const LANGS = [
  ['en', 'English'], ['it', 'Italiano'], ['fr', 'Français'], ['de', 'Deutsch'], ['es', 'Español'], ['pt', 'Português'],
  ['ja', '日本語'], ['ko', '한국어'], ['ru', 'Русский'], ['zhs', '简体中文'], ['zht', '繁體中文'],
].map(([id, label]) => ({ id, label }));
const RULES = [
  { id: 'default', label: 'Scryfall default' },
  { id: 'newest', label: 'Newest printing' },
  { id: 'oldest', label: 'Oldest printing' },
  { id: 'cheapest', label: 'Cheapest, in the deck price currency' },
];

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

function Card({ id, title, className = '', children }) {
  return (
    <section className={`profile-card ${className}`.trim()} aria-labelledby={id}>
      <h3 id={id} className="profile-h">{title}</h3>
      {children}
    </section>
  );
}

// Impostazioni (menu dell'avatar → Settings, #/settings), salvate sull'account (settingsSync) e su questo dispositivo,
// in riquadri per tipo: account con la password, mazzi nuovi, visualizzazione, carte, import e stampa, backup e
// ripristino (il ripristino aggiunge i mazzi del file accanto a quelli che ci sono); sotto, a tutta larghezza, la stampa
// preferita e, col bordo rosso, l'eliminazione dell'account (con conferma).
export default function SettingsPage({ user, notify }) {
  const uid = user.uid;
  const providers = user.providerData.map((p) => p.providerId);
  const s = useSettings();
  const [decks, setDecks] = useState(null); // null = caricamento
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => listenDecks(uid, setDecks, (e) => notify(`Could not load your decks: ${e.message}`, 'error')), [uid, notify]);
  const ownViews = Object.keys(s.deckViews).length; // mazzi con vista o ordine propri

  const backup = () => {
    downloadText(`proxodon-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks), null, 2), 'application/json')
      .then(() => notify(`Backup of ${plural(decks.length, 'deck')} downloaded`))
      .catch((e) => notify(`Backup failed: ${e.message}`, 'error'));
  };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const restored = fromBackup(json);
      restored.forEach((d) => createDeck(uid, d).done.catch((err) => notify(`Sync error: ${err.message}`, 'error')));
      // Righe rotte o oltre il massimo per mazzo: fromBackup le scarta, il toast le conta.
      const left = json.decks.reduce((n, d) => n + (Array.isArray(d?.cards) ? d.cards.length : 0), 0)
        - restored.reduce((n, d) => n + d.cards.length, 0);
      notify(`Restored ${plural(restored.length, 'deck')}${left > 0 ? `. ${plural(left, 'row')} could not be read and ${left === 1 ? 'was' : 'were'} left out` : ''}`,
        left > 0 ? 'error' : 'success');
    } catch (err) {
      notify(err instanceof SyntaxError ? 'This file is not valid JSON.' : err.message, 'error');
    }
  };

  return (
    <div className="decks-root profile-page">
      <header className="decks-head">
        <h2 className="decks-title">Settings</h2>
      </header>
      <p className="settings-note">Settings are saved in your account and follow you on every device.</p>
      <div className="profile-grid">
        <Card id="settings-account" title="Account">
          <dl className="profile-data">
            <dt>Email</dt>
            <dd>
              {user.email}
              <span className={`profile-badge${user.emailVerified ? ' ok' : ''}`}>{user.emailVerified ? 'verified' : 'not verified'}</span>
            </dd>
            <dt>Sign-in</dt><dd>{providers.map((p) => PROVIDERS[p] || p).join(', ')}</dd>
          </dl>
          <h4 className="settings-sub">Password</h4>
          {providers.includes('password')
            ? <PasswordForm email={user.email} />
            : <p className="profile-note">You sign in with Google, so your password is managed by your Google account.</p>}
        </Card>
        <Card id="settings-decks" title="New decks">
          <Choice k="deckFormat" label="Format" options={FORMATS} />
          <Choice k="deckGroupBy" label="Group by" options={GROUP_MODES.filter((m) => m.id !== 'custom')} />
          <Choice k="deckPublic" label="Visibility" options={[{ id: false, label: 'Private' }, { id: true, label: 'Public, shared in Community' }]}
            hint="You can still change it when you create the deck." />
        </Card>
        <Card id="settings-display" title="Display">
          <Choice k="deckView" label="View" options={VIEWS} />
          <Choice k="deckSort" label="Sort by" options={SORT_MODES}
            hint="The default of every deck. A deck keeps the view and sort you pick in it." />
          {ownViews > 0 && (
            <div className="settings-inline">
              <p className="settings-hint">{plural(ownViews, 'deck')} with its own view or sort.</p>
              <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setSetting('deckViews', {})}
                aria-label="Use the default view and sort in every deck" title="Use the default view and sort in every deck"><IconReplay size={15} /></button>
            </div>
          )}
          <Choice k="density" label="List view" options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]} />
          <Choice k="preview" label="Card preview on hover" options={[{ id: 'off', label: 'Off' }, { id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} />
          <Choice k="brackets" label="Commander brackets" options={[{ id: true, label: 'Show' }, { id: false, label: 'Off' }]}
            hint="Off hides them in your decks, in Community and on profiles." />
          <Toggle k="reduceMotion" label="Reduce motion" />
        </Card>
        <Card id="settings-cards" title="Cards">
          <Choice k="cardLang" label="Card images" options={LANGS}
            hint="Printings in this language when Scryfall has them (same set and number), English otherwise. Card names and search stay in English." />
          <Choice k="currency" label="Deck price" options={[{ id: 'eur', label: 'EUR, Cardmarket' }, { id: 'usd', label: 'USD, TCGplayer' }, { id: 'off', label: 'Off' }]}
            hint="Prices from Scryfall, main deck and sideboard, shown only in the deck's Stats. A deck gets them the next time you open it." />
        </Card>
        <Card id="settings-import" title="Import and print">
          <Choice k="importFallback" label="Printing not found" options={[{ id: true, label: 'Use the default printing' }, { id: false, label: 'Skip the card' }]} />
          <Choice k="importMerge" label="Same printing on more lines" options={[{ id: true, label: 'Merge into one row' }, { id: false, label: 'Keep separate rows' }]} />
          <Choice k="printAdd" label="Print deck" options={[{ id: false, label: 'Replace the print queue' }, { id: true, label: 'Add to the print queue' }]} />
          <Toggle k="printSide" label="Include the sideboard" />
        </Card>
        <Card id="settings-backup" title="Backup">
          <p className="profile-note">
            Download all your decks{decks ? ` (${decks.length})` : ''} as one JSON file, to keep a copy or move them to another account.
          </p>
          <button type="button" className="btn-secondary settings-btn" onClick={backup} disabled={!decks?.length}>
            <IconDownload size={15} /> Download backup
          </button>
          <p className="profile-note">Restore adds the decks of a backup file. The decks you already have stay as they are.</p>
          <button type="button" className="btn-secondary settings-btn" onClick={() => fileRef.current.click()}>
            <IconUpload size={15} /> Restore from file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </Card>
      </div>
      <PreferredPrinting />
      <Card id="settings-delete" title="Delete account" className="settings-danger">
        <p className="profile-note">
          Delete your account, your decks with their Community copies, dilemmas and help requests, your settings, and your votes, replies and likes. This can’t be undone.
        </p>
        <button type="button" className="btn-secondary settings-btn settings-delete" onClick={() => setConfirmDel(true)}>
          <IconTrash size={15} /> Delete account and data
        </button>
      </Card>
      {createPortal(
        <ConfirmDialog open={confirmDel} message="Delete your account and all your decks? This can’t be undone."
          confirmLabel="Delete everything" onCancel={() => setConfirmDel(false)}
          onConfirm={() => {
            setConfirmDel(false);
            deleteAccount(deleteUserData)
              .then(() => notify('Account and decks deleted'))
              .catch((e) => notify(e.message || 'Could not delete the account.', 'error'));
          }} />,
        document.body,
      )}
    </div>
  );
}

// Stampa preferita delle carte aggiunte dalla ricerca (preferredPrint in scryfallSearch): la stampa scelta per una
// carta, poi il primo dei set della lista che ha la carta, poi la regola. Set da Scryfall (/sets, caricati al primo
// focus), carte dall'autocomplete; la stampa si sceglie nella griglia di Change edition (ArtPickerModal).
function PreferredPrinting() {
  const s = useSettings();
  const setsId = useId();
  const namesId = useId();
  const [sets, setSets] = useState(null); // null = da caricare
  const [setText, setSetText] = useState('');
  const [setsError, setSetsError] = useState(null);
  const [name, setName] = useState('');
  const [names, setNames] = useState([]);
  const [picking, setPicking] = useState(null); // { name, current? } carta di cui scegliere la stampa
  const loadSets = () => {
    if (!sets) paperSets().then((l) => { setSets(l); setSetsError(null); }, () => setSetsError('Scryfall did not answer, so the list of sets is not here yet.'));
  };
  // Nomi suggeriti mentre si scrive, 250 ms dopo l'ultimo tasto.
  useEffect(() => {
    if (name.trim().length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => autocomplete(name, ctrl.signal).then(setNames, () => {}), 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [name]);

  const prefSets = s.prefSets.filter((x) => typeof x?.code === 'string');
  const addSet = (e) => {
    e.preventDefault();
    const t = setText.trim().toLowerCase();
    const code = t.match(/\(([a-z0-9]+)\)$/)?.[1] || t;
    const hit = sets?.find((x) => x.code === code || x.name.toLowerCase() === t);
    if (!hit) { setSetsError(sets ? 'Pick a set from the list.' : 'The list of sets is still loading.'); return; }
    setSetsError(null);
    setSetText('');
    if (!prefSets.some((x) => x.code === hit.code)) setSetting('prefSets', [...prefSets, hit].slice(0, MAX_PREF_SETS));
  };
  const moveUp = (i) => setSetting('prefSets', [...prefSets.slice(0, i - 1), prefSets[i], prefSets[i - 1], ...prefSets.slice(i + 1)]);

  const favs = Object.entries(s.favPrints).filter(([, f]) => typeof f?.sid === 'string')
    .sort(([, a], [, b]) => String(a.name).localeCompare(String(b.name)));
  const setFav = (oid, fav) => setSetting('favPrints', Object.fromEntries([
    ...Object.entries(getSettings().favPrints).filter(([k]) => k !== oid), ...(fav ? [[oid, fav]] : []),
  ].slice(-MAX_FAV_PRINTS)));
  const pickPrint = async (p) => {
    const c = (await cardsByIds([p.id])).get(p.id);
    const oid = c?.oracle_id || c?.card_faces?.[0]?.oracle_id;
    if (!oid) throw new Error('This print was not found on Scryfall.');
    const img = c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || '';
    setFav(oid, { sid: c.id, name: c.name, set: c.set, cn: c.collector_number, img });
    setPicking(null);
    setName('');
  };

  return (
    <Card id="settings-printing" title="Preferred printing" className="settings-wide">
      <p className="profile-note">
        For the cards you add from the search. The printing you chose for a card comes first, then the first of your sets
        that has the card, then the rule.
      </p>
      <div className="settings-cols">
        <div className="settings-col">
          <Choice k="printRule" label="Rule" options={RULES} />
          <form className="settings-field" onSubmit={addSet}>
            <label htmlFor={`${setsId}-in`}>Preferred sets, in order</label>
            <div className="settings-add">
              <input id={`${setsId}-in`} className="import-link-input" list={setsId} value={setText} onFocus={loadSets}
                onChange={(e) => setSetText(e.target.value)} placeholder="Set name or code" spellCheck={false} autoComplete="off" />
              <button type="submit" className="btn-secondary deck-icon-btn" disabled={!setText.trim()} aria-label="Add the set" title="Add the set"><IconPlus size={16} /></button>
            </div>
            <datalist id={setsId}>{(sets || []).map((x) => <option key={x.code} value={`${x.name} (${x.code.toUpperCase()})`} />)}</datalist>
            {setsError && <p className="settings-hint settings-error" role="alert">{setsError}</p>}
          </form>
          {prefSets.length > 0 && (
            <ol className="settings-list">
              {prefSets.map((x, i) => (
                <li key={x.code}>
                  <span className="settings-list-name">{x.name} <span className="settings-list-code">{x.code.toUpperCase()}</span></span>
                  {i > 0 && (
                    <button type="button" className="btn-secondary deck-icon-btn" onClick={() => moveUp(i)}
                      aria-label={`Move ${x.name} up`} title="Move up"><IconArrowUp size={14} /></button>
                  )}
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setSetting('prefSets', prefSets.filter((y) => y.code !== x.code))}
                    aria-label={`Remove ${x.name}`} title="Remove"><IconX size={14} /></button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="settings-col">
          <form className="settings-field" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setPicking({ name: name.trim() }); }}>
            <label htmlFor={`${namesId}-in`}>Printing of a card</label>
            <div className="settings-add">
              <input id={`${namesId}-in`} className="import-link-input" list={namesId} value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Card name" spellCheck={false} autoComplete="off" />
              <button type="submit" className="btn-secondary deck-icon-btn" disabled={!name.trim()} aria-label="Choose the printing" title="Choose the printing"><IconImage size={16} /></button>
            </div>
            <datalist id={namesId}>{(name.trim().length >= 2 ? names : []).map((n) => <option key={n} value={n} />)}</datalist>
          </form>
          {favs.length > 0 && (
            <ul className="settings-list">
              {favs.map(([oid, f]) => (
                <li key={oid}>
                  {scryfallImg(f.img) && <img className="settings-list-img" src={scryfallImg(f.img)} alt="" loading="lazy" />}
                  <span className="settings-list-name">{f.name} <span className="settings-list-code">{String(f.set).toUpperCase()} #{f.cn}</span></span>
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setPicking({ name: f.name, current: { set: String(f.set), cn: f.cn } })}
                    aria-label={`Change the printing of ${f.name}`} title="Change printing"><IconImage size={14} /></button>
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setFav(oid, null)}
                    aria-label={`Remove ${f.name}`} title="Remove"><IconX size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {picking && (
        <ArtPickerModal name={picking.name} current={picking.current} title={`Preferred printing, ${picking.name}`}
          onClose={() => setPicking(null)} onPickPrint={pickPrint} />
      )}
    </Card>
  );
}

function PasswordForm({ email }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setInfo('Password changed.');
    } catch (err) {
      setError(WRONG_PASSWORD.includes(err.code) ? 'The current password is wrong.' : authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={submit}>
      {/* Per i password manager: a quale account appartiene la nuova password. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <input type="password" className="import-link-input" value={current} onChange={(e) => setCurrent(e.target.value)}
        placeholder="Current password" aria-label="Current password" autoComplete="current-password" required disabled={busy} />
      <input type="password" className="import-link-input" value={next} onChange={(e) => setNext(e.target.value)}
        placeholder="New password, at least 6 characters" aria-label="New password" autoComplete="new-password"
        minLength={6} required disabled={busy} />
      <button type="submit" className="btn-secondary signin-submit" disabled={busy}>
        {busy && <span className="import-spinner" />} Change password
      </button>
      {error && <div className="info-box info-box-error" role="alert"><span>{error}</span></div>}
      {info && <div className="info-box" role="status"><span>{info}</span></div>}
      <p className="field-hint">Forgot it? Sign out and use “Forgot password?” on the sign-in page.</p>
    </form>
  );
}
