import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDecks, createDeck, saveDeck, deleteDeck } from './deckStore';
import {
  newDeck, duplicateDeck, boardCounts, countTarget, countOk, deckIdentity, deckCover, exportText,
  toBackup, fromBackup, formatLabel,
} from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { useLongPress } from '../hooks/useLongPress';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { ManaPips } from './Mana';
import { NameFormatDialog } from './dialogs';
import { IconPlus, IconList, IconUpload, IconCopy, IconTrash, IconPencil, IconDownload } from '../components/icons';

const download = (filename, text, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck';
// Shift+F10 / tasto menu arrivano con 0,0: ancora il menu all'elemento.
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.top + 24 };
};

export default function DeckList({ uid, notify, account }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'new' | { rename: deck } | { del: deck }
  const [menu, setMenu] = useState(null); // { deck, x, y }
  const fileRef = useRef(null);
  const press = useLongPress();
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => listenDecks(uid, setDecks, (e) => notify(`Could not load your decks: ${e.message}`, 'error')), [uid, notify]);

  const writeError = (e) => notify(`Sync error: ${e.message}`, 'error');
  const create = (deck) => {
    const { id, done } = createDeck(uid, deck);
    done.catch(writeError);
    return id;
  };

  const exportBackup = () => {
    download(`proxoteca-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks), null, 2), 'application/json');
    notify(`Backup of ${decks.length} deck${decks.length !== 1 ? 's' : ''} downloaded`);
  };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const restored = fromBackup(JSON.parse(await file.text()));
      restored.forEach(create);
      notify(`Restored ${restored.length} deck${restored.length !== 1 ? 's' : ''}`);
    } catch (err) {
      notify(err instanceof SyntaxError ? 'This file is not valid JSON.' : err.message, 'error');
    }
  };

  const menuItems = menu ? [
    { key: 'rename', Icon: IconPencil, label: 'Rename', run: () => setDialog({ rename: menu.deck }) },
    { key: 'dup', Icon: IconCopy, label: 'Duplicate', run: () => { create(duplicateDeck(menu.deck)); notify('Deck duplicated'); } },
    { key: 'txt', Icon: IconDownload, label: 'Export text', run: () => download(`${safeName(menu.deck.name)}.txt`, `${exportText(menu.deck)}\n`, 'text/plain') },
    { key: 'del', Icon: IconTrash, label: 'Delete', danger: true, run: () => setDialog({ del: menu.deck }) },
  ] : [];

  return (
    <div className="decks-root">
      <header className="decks-head">
        <h2 className="decks-title">Your decks</h2>
        <div className="decks-actions">
          <button type="button" className="btn-secondary" onClick={exportBackup} disabled={!decks?.length}><IconList size={15} /> Backup</button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current.click()}><IconUpload size={15} /> Restore</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
          <button type="button" className="btn-add deck-new" onClick={() => setDialog('new')}><IconPlus size={16} /> New deck</button>
          {account}
        </div>
      </header>

      {decks === null && <span className="import-spinner" aria-label="Loading" />}
      {decks?.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">Start your first deck</p>
          <p className="field-hint">Create one from scratch, or import a list or a Moxfield, Archidekt or Tappedout link.</p>
        </div>
      )}
      {decks?.length > 0 && (
        <ul className="deck-grid">
          {decks.map((d) => {
            const main = boardCounts(d).main;
            const target = countTarget(d.format);
            const cover = deckCover(d);
            return (
              <li key={d.id}>
                <button type="button" className="deck-tile"
                  onClick={() => { if (!press.consumed()) navigate(`/decks/${d.id}`); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ deck: d, ...menuPoint(e) }); }}
                  {...press.bind((x, y) => setMenu({ deck: d, x, y }))}>
                  <span className="deck-tile-art" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden="true" />
                  <span className="deck-tile-body">
                    <span className="deck-tile-name">{d.name}</span>
                    <span className="deck-tile-meta">
                      {formatLabel(d.format)} · <span className={countOk(d.format, main) ? undefined : 'warn'}>{main}{target ? `/${target}` : ''}</span>
                    </span>
                    <ManaPips colors={deckIdentity(d)} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {menu && <CardMenu x={menu.x} y={menu.y} title={menu.deck.name} items={menuItems} onClose={closeMenu} />}
      {dialog === 'new' && (
        <NameFormatDialog title="New deck" confirmLabel="Create" onClose={() => setDialog(null)}
          onSubmit={(v) => { setDialog(null); navigate(`/decks/${create(newDeck(v))}`); }} />
      )}
      {dialog?.rename && (
        <NameFormatDialog title="Rename deck" confirmLabel="Rename" initialName={dialog.rename.name} showFormat={false}
          onClose={() => setDialog(null)}
          onSubmit={({ name }) => { saveDeck(uid, { ...dialog.rename, name }).catch(writeError); setDialog(null); }} />
      )}
      <ConfirmDialog open={!!dialog?.del} message={`Delete “${dialog?.del?.name}”? This can’t be undone.`} confirmLabel="Delete deck"
        onCancel={() => setDialog(null)}
        onConfirm={() => { deleteDeck(uid, dialog.del.id).catch(writeError); setDialog(null); }} />
    </div>
  );
}
