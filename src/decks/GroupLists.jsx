import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listenGroupLists, listenGroupList, listenGroupCards, countGroupCards, createGroupList, renameGroupList, inviteToGroupList,
  removeFromGroupList, setGroupInvite, inviteLink, joinGroupList, leaveGroupList, deleteGroupList, addGroupCards, setGroupQty,
  removeGroupCard, MAX_GROUP_QTY,
} from './groupStore';
import { getPublicProfile } from './deckStore';
import { toPrintEntries } from './deckModel';
import { useCount } from './useCount';
import { useSettings } from '../utils/settings';
import { navigate } from '../hooks/useHashRoute';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { TileFrame, GhostTile } from './DeckList';
import { NameFormatDialog } from './dialogs';
import CardSearch from './CardSearch';
import CardImg from './CardImg';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  IconArrowLeft, IconPlus, IconMinus, IconX, IconTrash, IconUsers, IconUserPlus, IconCopy, IconCrown, IconDeckPrint, IconLogOut, IconGlobe,
} from '../components/icons';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sumQty = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const errorText = (e) => (e?.code === 'permission-denied' ? 'Not allowed. The new Firestore rules may not be published yet.' : e?.message || 'Something went wrong.');

// Nickname dei membri (profili pubblici, una lettura per membro, tenuti per la sessione): "a player" senza nickname.
const names = new Map();
function useNames(uids) {
  const [, bump] = useState(0);
  const key = uids.join(',');
  useEffect(() => {
    let on = true;
    key.split(',').filter((u) => u && !names.has(u)).forEach((u) => {
      names.set(u, null);
      getPublicProfile(u).then((p) => { names.set(u, p.nickname); if (on) bump((n) => n + 1); }, () => names.delete(u));
    });
    return () => { on = false; };
  }, [key]);
  return (u) => names.get(u) || 'a player';
}

// ── My decks: la sezione sotto i mazzi ──────────────────────────────────

// Le liste di gruppo di cui si è membri (create da sé o da altri), un riquadro ciascuna, e il + per crearne una.
export function GroupListsSection({ uid, notify }) {
  const [lists, setLists] = useState(null);
  const [naming, setNaming] = useState(false);
  useEffect(() => listenGroupLists(uid, setLists, () => setLists([])), [uid]);
  return (
    <section className="group-lists" aria-labelledby="group-lists-h">
      <header className="decks-head profile-next"><h2 id="group-lists-h" className="decks-title">Group lists</h2></header>
      {lists === null ? <span className="import-spinner" aria-label="Loading" /> : (
        <ul className="deck-grid">
          {lists.map((l) => <GroupTile key={l.id} list={l} uid={uid} />)}
          <GhostTile label="New group list" onClick={() => setNaming(true)}><IconPlus size={44} /></GhostTile>
        </ul>
      )}
      {naming && (
        <NameFormatDialog title="New group list" confirmLabel="Create" showFormat={false} placeholder="Proxies for Friday" maxLength={80}
          onClose={() => setNaming(false)}
          onSubmit={({ name }) => {
            const { id, done } = createGroupList(uid, name);
            done.catch((e) => notify(errorText(e), 'error'));
            setNaming(false);
            navigate(`/decks/list/${id}`);
          }} />
      )}
    </section>
  );
}

function GroupTile({ list, uid }) {
  const cards = useCount(countGroupCards, list.id);
  const n = list.members.length;
  return (
    <li className="deck-tile-wrap">
      <a className="deck-tile group-tile" href={`#/decks/list/${list.id}`} aria-label={`Open group list ${list.name}, ${plural(n, 'member')}`}>
        <TileFrame><span className="group-tile-art" aria-hidden="true"><IconUsers size={56} /></span></TileFrame>
        <span className="deck-tile-body">
          <span className="deck-tile-name">{list.name}</span>
          <span className="deck-tile-meta">
            <span>{plural(n, 'member')}</span><span>{plural(cards, 'card')}</span>
            <span className="deck-tile-by">{list.owner === uid ? 'yours' : 'shared with you'}</span>
          </span>
        </span>
      </a>
    </li>
  );
}

// ── La lista (#/decks/list/:id) ──────────────────────────────────────

// Testata (indietro, nome: il creatore lo rinomina sul posto; Print, link d'invito, elimina / esci), membri (il creatore
// invita per nickname e toglie gli altri), ricerca per aggiungere carte, poi le carte: ognuna col nickname di chi l'ha
// messa; − + e togli solo sulle proprie. Print manda tutte le copie di tutti nella stampa, come Print deck.
export function GroupListPage({ uid, id, notify, printQueueCount, onPrintDeck }) {
  const [list, setList] = useState(undefined); // undefined = caricamento, null = non c'è più
  const [rows, setRows] = useState(null);
  const [ask, setAsk] = useState(null); // 'delete' | 'leave' | 'print'
  const [err, setErr] = useState(null);
  const settings = useSettings();
  useEffect(() => listenGroupList(id, setList, (e) => { setList(null); setErr(e); }), [id]);
  const member = !!list;
  useEffect(() => (member ? listenGroupCards(id, setRows, () => setRows([])) : undefined), [id, member]);
  const nameOf = useNames(list?.members || []);
  if (list === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  if (!list) {
    return (
      <div className="decks-root decks-center">
        <div className="decks-empty">
          <p className="decks-empty-title">This group list is not available</p>
          <p className="field-hint">{err?.code === 'permission-denied' ? 'You are not in it any more, or it was deleted.' : 'It was deleted.'} <a href="#/decks">Back to My decks</a></p>
        </div>
      </div>
    );
  }
  const owner = list.owner === uid;
  const fail = (e) => notify(errorText(e), 'error');
  const sorted = [...(rows || [])].sort((a, b) => a.card.name.localeCompare(b.card.name) || (a.owner || '').localeCompare(b.owner || ''));
  const total = sumQty(sorted);
  const print = () => {
    setAsk(null);
    onPrintDeck(toPrintEntries({ cards: sorted.map((r) => ({ qty: r.qty, board: 'main', card: r.card })) }), settings.printAdd);
  };
  const startPrint = () => (printQueueCount && !settings.printAdd ? setAsk('print') : print());
  const add = (card, { qty }) => addGroupCards(id, uid, [{ card, qty }]).catch(fail);

  return (
    <div className="decks-root decks-page group-page">
      <div className="folder-head group-head">
        <button type="button" className="btn-secondary deck-icon-btn" onClick={() => navigate('/decks')} aria-label="My decks" title="My decks"><IconArrowLeft size={18} /></button>
        <IconUsers size={20} />
        {owner ? <ListName name={list.name} onRename={(name) => renameGroupList(id, name).catch(fail)} /> : <h2 className="group-name">{list.name}</h2>}
        <span className="group-count">{plural(total, 'card')}</span>
        <span className="group-actions">
          <button type="button" className="btn-secondary deck-icon-btn" onClick={startPrint} disabled={!total} aria-label="Print the list" title="Print the list"><IconDeckPrint /></button>
          {owner
            ? <button type="button" className="btn-secondary deck-icon-btn settings-delete" onClick={() => setAsk('delete')} aria-label="Delete the list" title="Delete the list"><IconTrash size={18} /></button>
            : <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setAsk('leave')} aria-label="Leave the list" title="Leave the list"><IconLogOut size={18} /></button>}
        </span>
      </div>
      <Members list={list} uid={uid} owner={owner} nameOf={nameOf} notify={notify} />
      <div className="group-search">
        <CardSearch format="casual" onAdd={add} notify={notify} noAdvanced />
      </div>
      {rows === null ? <span className="import-spinner" aria-label="Loading" /> : !sorted.length ? (
        <p className="field-hint group-empty">No cards yet. Add them with the search above, or from a deck: right-click a card (long press on a phone), To group list.</p>
      ) : (
        <ul className="group-cards">
          {sorted.map((r) => {
            const mine = r.uid === uid;
            const by = r.owner || nameOf(r.uid);
            return (
              <li key={r.id} className={`group-card${mine ? ' mine' : ''}`}>
                <CardImg card={r.card} className="group-card-img" alt={`${r.card.name}, ${r.qty} ${r.qty === 1 ? 'copy' : 'copies'}, by ${by}`} />
                <span className="group-card-qty" aria-hidden="true">{r.qty}</span>
                <span className="group-card-by">by {by}</span>
                {mine && (
                  <span className="group-card-actions">
                    <button type="button" className="btn-secondary deck-icon-btn" aria-label={`One less ${r.card.name}`} title="One less"
                      onClick={() => (r.qty > 1 ? setGroupQty(id, r.id, r.qty - 1) : removeGroupCard(id, r.id)).catch(fail)}><IconMinus size={14} /></button>
                    <button type="button" className="btn-secondary deck-icon-btn" aria-label={`One more ${r.card.name}`} title="One more" disabled={r.qty >= MAX_GROUP_QTY}
                      onClick={() => setGroupQty(id, r.id, r.qty + 1).catch(fail)}><IconPlus size={14} /></button>
                    <button type="button" className="btn-secondary deck-icon-btn" aria-label={`Remove ${r.card.name}`} title="Remove"
                      onClick={() => removeGroupCard(id, r.id).catch(fail)}><IconX size={14} /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {createPortal(
        <>
          <ConfirmDialog open={ask === 'delete'} confirmLabel="Delete list"
            message={`Delete “${list.name}” for every member? Its cards go too. This can’t be undone.`}
            onCancel={() => setAsk(null)}
            onConfirm={() => { setAsk(null); navigate('/decks'); deleteGroupList(id).then(() => notify('Group list deleted'), fail); }} />
          <ConfirmDialog open={ask === 'leave'} confirmLabel="Leave"
            message={`Leave “${list.name}”? The cards you added are removed from it.`}
            onCancel={() => setAsk(null)}
            onConfirm={() => { setAsk(null); navigate('/decks'); leaveGroupList(id, uid).then(() => notify('You left the group list'), fail); }} />
          <ConfirmDialog open={ask === 'print'} confirmLabel="Replace and print"
            message={`Replace the ${plural(printQueueCount, 'card')} in the print queue with this list?`}
            onCancel={() => setAsk(null)} onConfirm={print} />
        </>,
        document.body,
      )}
    </div>
  );
}

// Nome della lista per il creatore: click = si rinomina sul posto (Enter o uscita salvano, Esc annulla, vuoto = resta).
function ListName({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const open = useRef(false); // una sola chiusura: Enter / Esc smontano l'input e il blur non deve ripetere
  if (!editing) return <button type="button" className="folder-name in-head" onClick={() => { open.current = true; setEditing(true); }} title="Rename the list">{name}</button>;
  const finish = (v) => {
    if (!open.current) return;
    open.current = false;
    setEditing(false);
    if (v && v !== name) onRename(v);
  };
  return (
    <input className="folder-name-input in-head" defaultValue={name} maxLength={80} autoFocus aria-label="List name" spellCheck={false}
      onFocus={(e) => e.target.select()} onBlur={(e) => finish(e.target.value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value.trim());
        if (e.key === 'Escape') { e.stopPropagation(); finish(name); }
      }} />
  );
}

// Membri: chip col nickname (corona = chi l'ha creata). Il creatore invita per nickname, toglie gli altri (le loro
// carte restano, e solo lui può toglierle), attiva o spegne il link d'invito e lo copia.
function Members({ list, uid, owner, nameOf, notify }) {
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const invite = async (e) => {
    e.preventDefault();
    const name = nick.trim();
    if (!name) return;
    setBusy(true);
    try { await inviteToGroupList(list, name); setNick(''); notify(`${name} is in the list`); } catch (err) { notify(errorText(err), 'error'); } finally { setBusy(false); }
  };
  const copy = () => navigator.clipboard.writeText(inviteLink(list)).then(() => notify('Invite link copied'), () => notify('Could not copy the link.', 'error'));
  return (
    <div className="group-members">
      <ul className="group-member-list" aria-label="Members">
        {list.members.map((m) => (
          <li key={m} className="group-member">
            {m === list.owner && <IconCrown size={13} />}
            <span>{nameOf(m)}{m === uid ? ' (you)' : ''}</span>
            {owner && m !== uid && (
              <button type="button" className="group-member-x" onClick={() => removeFromGroupList(list.id, m).catch((err) => notify(errorText(err), 'error'))}
                aria-label={`Remove ${nameOf(m)} from the list`} title="Remove from the list"><IconX size={12} /></button>
            )}
          </li>
        ))}
      </ul>
      {owner && (
        <div className="group-invite">
          <form className="settings-add" onSubmit={invite}>
            <input className="import-link-input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Invite by nickname"
              aria-label="Invite by nickname" spellCheck={false} autoComplete="off" disabled={busy} />
            <button type="submit" className="btn-secondary deck-icon-btn" disabled={busy || !nick.trim()} aria-label="Invite" title="Invite"><IconUserPlus size={16} /></button>
          </form>
          <button type="button" className={`btn-secondary deck-icon-btn${list.invite ? ' on' : ''}`} aria-pressed={!!list.invite}
            onClick={() => setGroupInvite(list.id, !list.invite).catch((err) => notify(errorText(err), 'error'))}
            aria-label={list.invite ? 'Turn off the invite link' : 'Turn on an invite link'} title={list.invite ? 'Invite link on: click to turn it off' : 'Turn on an invite link'}><IconGlobe size={16} /></button>
          {list.invite && <button type="button" className="btn-secondary deck-icon-btn" onClick={copy} aria-label="Copy the invite link" title="Copy the invite link"><IconCopy size={16} /></button>}
        </div>
      )}
    </div>
  );
}

// ── Invito col link (#/decks/join/:id/:codice) ──────────────────────────────

// Chi non è ancora membro non può leggere la lista: entra con Join (le regole controllano il codice), poi la vede.
// Chi c'è già (la lista si legge) va dritto alla lista.
export function JoinGroupList({ uid, id, code }) {
  const [state, setState] = useState(null); // null | 'busy' | errore
  useEffect(() => listenGroupList(id, (l) => { if (l) navigate(`/decks/list/${id}`); }, () => {}), [id]);
  const join = () => {
    setState('busy');
    joinGroupList(id, uid, code).then(() => navigate(`/decks/list/${id}`), (e) => setState(e));
  };
  return (
    <div className="decks-root decks-center">
      <div className="decks-empty">
        <p className="decks-empty-title">You are invited to a group list</p>
        <p className="field-hint">Join to see its cards and add yours. You can leave whenever you want.</p>
        {state && state !== 'busy' && <p className="field-hint settings-error" role="alert">{state.code === 'permission-denied' ? 'This invite link does not work any more. Ask for a new one.' : errorText(state)}</p>}
        <button type="button" className="btn-generate import-btn" onClick={join} disabled={state === 'busy'}>Join</button>
      </div>
    </div>
  );
}

// ── To group list (menu delle carte di un mazzo) ───────────────────────────

// Le righe scelte nel mazzo vanno nella lista scelta, con le loro copie; il mazzo non cambia.
export function ToGroupListDialog({ uid, rows, notify, onClose }) {
  const [lists, setLists] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  useEffect(() => listenGroupLists(uid, setLists, () => setLists([])), [uid]);
  const n = sumQty(rows);
  const send = (l) => {
    setBusy(true);
    addGroupCards(l.id, uid, rows.map((r) => ({ card: r.card, qty: r.qty })))
      .then(() => { notify(`${rows.length === 1 ? rows[0].card.name : plural(n, 'card')} added to ${l.name}`); onClose(); },
        (e) => { notify(errorText(e), 'error'); setBusy(false); });
  };
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-confirm" ref={ref} role="dialog" aria-modal="true" aria-label="To group list" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>To group list</h2></div>
        <p className="modal-hint">{rows.length === 1 ? `${n} ${rows[0].card.name}` : plural(n, 'card')} {n === 1 ? 'goes' : 'go'} to the list you pick. The deck stays as it is.</p>
        {lists === null ? <span className="import-spinner" aria-label="Loading" />
          : !lists.length ? <p className="modal-hint">You have no group lists yet. Create one in <a href="#/decks" onClick={onClose}>My decks</a>, under your decks.</p>
          : (
            <ul className="group-pick">
              {lists.map((l) => (
                <li key={l.id}>
                  <button type="button" className="btn-secondary group-pick-btn" disabled={busy} onClick={() => send(l)}>
                    <IconUsers size={16} /><span>{l.name}</span><span className="group-pick-n">{plural(l.members.length, 'member')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} autoFocus>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
