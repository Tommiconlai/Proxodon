import { useCallback, useEffect, useRef, useState } from 'react';
import { listenDecks, createDeck, saveDeck, deleteDeck } from './deckStore';
import {
  newDeck, duplicateDeck, boardCounts, countTarget, countOk, deckIdentity, deckCover,
  toBackup, fromBackup, formatLabel,
} from './deckModel';
import { navigate } from '../hooks/useHashRoute';
import { useLongPress } from '../hooks/useLongPress';
import CardMenu from '../components/CardMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { ManaPips } from './Mana';
import { NameFormatDialog, ExportDeckDialog } from './dialogs';
import { downloadText } from '../utils/download';
import { timeAgo } from '../utils/timeAgo';
import ImportDeckDialog from './ImportDeckDialog';
import { IconPlus, IconList, IconUpload, IconCopy, IconTrash, IconPencil, IconDownload, IconExport } from '../components/icons';

// Shift+F10 / tasto menu arrivano con 0,0: ancora il menu all'elemento.
const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.top + 24 };
};

export default function DeckList({ uid, notify }) {
  const [decks, setDecks] = useState(null); // null = caricamento
  const [dialog, setDialog] = useState(null); // 'new' | 'import' | { rename: deck } | { del: deck } | { exp: deck }
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
    downloadText(`proxoteca-decks-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks), null, 2), 'application/json');
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
    { key: 'txt', Icon: IconExport, label: 'Export…', run: () => setDialog({ exp: menu.deck }) },
    { key: 'del', Icon: IconTrash, label: 'Delete', danger: true, run: () => setDialog({ del: menu.deck }) },
  ] : [];

  return (
    <div className="decks-root">
      <header className="decks-head">
        <h2 className="decks-title">Your decks</h2>
        <div className="decks-actions">
          <button type="button" className="btn-secondary" onClick={() => setDialog('import')}><IconDownload size={15} /> Import</button>
          <button type="button" className="btn-secondary" onClick={exportBackup} disabled={!decks?.length}><IconList size={15} /> Backup</button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current.click()}><IconUpload size={15} /> Restore</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
          <button type="button" className="btn-add deck-new" onClick={() => setDialog('new')}><IconPlus size={16} /> New deck</button>
        </div>
      </header>

      {decks === null && <span className="import-spinner" aria-label="Loading" />}
      {decks?.length === 0 && (
        <div className="decks-empty">
          <p className="decks-empty-title">Start your first deck</p>
          <p className="field-hint">Create one from scratch, or import a list.</p>
        </div>
      )}
      {decks?.length > 0 && (
        <ul className="deck-grid">
          {decks.map((d) => {
            const main = boardCounts(d).main;
            const target = countTarget(d.format);
            const cover = deckCover(d);
            const updated = d.updatedAt?.toMillis?.();
            return (
              <li key={d.id} className="deck-tile-wrap">
                <button type="button" className="deck-tile"
                  onClick={() => { if (!press.consumed()) navigate(`/decks/${d.id}`); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ deck: d, ...menuPoint(e) }); }}
                  {...press.bind((x, y) => setMenu({ deck: d, x, y }))}>
                  <span className="deck-tile-art" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden="true" />
                  {/* Come il frame Figma "Proxoteca" 35:208: nome e ultima modifica, formato, poi
                      identità di colore e numero di carte sulla stessa riga. */}
                  <span className="deck-tile-body">
                    <span className="deck-tile-top">
                      <span className="deck-tile-name">{d.name}</span>
                      {updated && <span className="deck-tile-updated">Last update<br />{timeAgo(updated)}</span>}
                    </span>
                    <span className="deck-tile-format">{formatLabel(d.format)}</span>
                    <span className="deck-tile-foot">
                      <ManaPips colors={deckIdentity(d)} />
                      <span className={`deck-tile-count${countOk(d.format, main) ? '' : ' warn'}`}>{main}{target ? `/${target}` : ''}</span>
                    </span>
                  </span>
                </button>
                {/* Fuori dal riquadro (niente pulsanti annidati), posato sull'angolo dell'arte. */}
                <button type="button" className="deck-tile-export" aria-label={`Export ${d.name}`} title="Export"
                  onClick={() => setDialog({ exp: d })}><IconExport size={16} /></button>
              </li>
            );
          })}
        </ul>
      )}

      {menu && <CardMenu x={menu.x} y={menu.y} title={menu.deck.name} items={menuItems} onClose={closeMenu} />}
      {dialog === 'import' && (
        <ImportDeckDialog onClose={() => setDialog(null)}
          onImported={(deck, notFound) => {
            setDialog(null);
            const id = create(deck);
            notify(notFound.length
              ? `Imported. Not found: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ` and ${notFound.length - 5} more` : ''}`
              : 'Deck imported', notFound.length ? 'error' : 'success');
            navigate(`/decks/${id}`);
          }} />
      )}
      {dialog === 'new' && (
        <NameFormatDialog title="New deck" confirmLabel="Create" onClose={() => setDialog(null)}
          onSubmit={(v) => { setDialog(null); navigate(`/decks/${create(newDeck(v))}`); }} />
      )}
      {dialog?.exp && <ExportDeckDialog deck={dialog.exp} onClose={() => setDialog(null)} />}
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
