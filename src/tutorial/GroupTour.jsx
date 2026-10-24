import { useLayoutEffect, useState } from 'react';
import { Shell } from './AccountStages';
import { C } from './demo';
import {
  IconArrowLeft, IconUsers, IconDeckPrint, IconTrash, IconCrown, IconX, IconUserPlus, IconGlobe, IconCopy, IconDeckSearch,
} from '../components/icons';

// Tutorial della lista di gruppo (#/decks/list/:id e l'invito): copia demo di GroupListPage (stesse classi), con una lista,
// membri e carte inventati, solo in memoria: niente Firestore (i passi sono in DeckTour, groupSteps). In fondo il dialog
// demo di To group list, usato anche dall'editor del mazzo.
const ME = 'demoplayer';
const MEMBERS = [ME, 'mira', 'jonas'];
const START = [
  { id: 'g1', card: C.solRing, qty: 2, by: ME },
  { id: 'g2', card: C.counterspell, qty: 1, by: 'mira' },
  { id: 'g3', card: C.lightningBolt, qty: 4, by: ME },
  { id: 'g4', card: C.swordsToPlowshares, qty: 1, by: 'jonas' },
];
const NAMES = ['Sol Ring', 'Soldevi Sentry', 'Solemn Simulacrum'];
const DEMO_LISTS = [{ id: 'l1', name: 'Friday proxies', members: 3 }, { id: 'l2', name: 'Cube night', members: 5 }];
const copies = (n) => `${n} ${n === 1 ? 'copy' : 'copies'}`;

export function GroupStage({ apiRef, mobile }) {
  const [rows, setRows] = useState(START);
  const [q, setQ] = useState('');
  useLayoutEffect(() => { apiRef.current = { rows: setRows, query: setQ }; }, [apiRef]);
  const total = rows.reduce((n, r) => n + r.qty, 0);
  const sugg = q.length >= 2 ? NAMES.filter((n) => n.toLowerCase().startsWith(q.toLowerCase())) : [];
  return (
    <Shell mobile={mobile}>
      <div className="decks-root decks-page group-page">
        <div className="folder-head group-head">
          <button type="button" className="btn-secondary deck-icon-btn" aria-label="My decks" title="My decks"><IconArrowLeft size={18} /></button>
          <IconUsers size={20} />
          <button type="button" className="folder-name in-head" title="Rename the list">Friday proxies</button>
          <span className="group-count">{total} cards</span>
          <span className="group-actions">
            <button type="button" className="btn-secondary deck-icon-btn" aria-label="Print the list" title="Print the list"><IconDeckPrint /></button>
            <button type="button" className="btn-secondary deck-icon-btn settings-delete" aria-label="Delete the list" title="Delete the list"><IconTrash size={18} /></button>
          </span>
        </div>
        <div className="group-members">
          <ul className="group-member-list" aria-label="Members">
            {MEMBERS.map((m) => (
              <li key={m} className="group-member">
                {m === ME && <IconCrown size={13} />}
                <span>{m}{m === ME ? ' (you)' : ''}</span>
                {m !== ME && <button type="button" className="group-member-x" aria-label={`Remove ${m} from the list`} title="Remove from the list"><IconX size={12} /></button>}
              </li>
            ))}
          </ul>
          <div className="group-invite">
            <div className="settings-add">
              <input className="import-link-input" placeholder="Invite by nickname" aria-label="Invite by nickname" readOnly />
              <button type="button" className="btn-secondary deck-icon-btn" aria-label="Invite" title="Invite"><IconUserPlus size={16} /></button>
            </div>
            <button type="button" className="btn-secondary deck-icon-btn on" aria-pressed="true" aria-label="Turn off the invite link" title="Invite link on"><IconGlobe size={16} /></button>
            <button type="button" className="btn-secondary deck-icon-btn" aria-label="Copy the invite link" title="Copy the invite link"><IconCopy size={16} /></button>
          </div>
        </div>
        <div className="group-search">
          <div className="card-search">
            <div className="search-wrap">
              <div className="search-box"><IconDeckSearch /><input value={q} readOnly placeholder="Search a card name" aria-label="Search cards" /></div>
              {sugg.length > 0 && <ul className="search-suggest">{sugg.map((n, i) => <li key={n} className={i === 0 ? 'active' : undefined}>{n}</li>)}</ul>}
            </div>
          </div>
        </div>
        <p className="field-hint group-tip">Click, right-click or long-press a card you added: add or remove copies, change its edition.</p>
        <ul className="group-cards">
          {[...rows].sort((a, b) => a.card.name.localeCompare(b.card.name)).map((r) => {
            const mine = r.by === ME;
            const label = `${r.card.name}, ${copies(r.qty)}, by ${r.by}`;
            const face = <><img className="group-card-img" src={r.card.img} alt={label} draggable={false} /><span className="group-card-qty" aria-hidden="true">{r.qty}</span></>;
            return (
              <li key={r.id} data-row={r.id} className={`group-card${mine ? ' mine' : ''}`}>
                {mine ? <button type="button" className="group-card-btn" aria-label={`${label}. Options`}>{face}</button> : face}
                <span className="group-card-by">by {r.by}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}

// Il dialog di To group list nella demo dell'editor (stesse classi di ToGroupListDialog): le liste sono inventate.
export const DemoGroupPick = ({ rows }) => {
  const n = rows.reduce((s, r) => s + r.qty, 0);
  return (
    <div className="modal-overlay">
      <div className="modal modal-confirm" role="dialog" aria-modal="true" aria-label="To group list">
        <div className="modal-header"><h2>To group list</h2></div>
        <p className="modal-hint">{rows.length === 1 ? `${n} ${rows[0].card.name}` : `${n} cards`} {n === 1 ? 'goes' : 'go'} to the list you pick. The deck stays as it is.</p>
        <ul className="group-pick">
          {DEMO_LISTS.map((l) => (
            <li key={l.id}>
              <button type="button" className="btn-secondary group-pick-btn"><IconUsers size={16} /><span>{l.name}</span><span className="group-pick-n">{l.members} members</span></button>
            </li>
          ))}
        </ul>
        <div className="modal-actions"><button type="button" className="btn-secondary">Cancel</button></div>
      </div>
    </div>
  );
};
