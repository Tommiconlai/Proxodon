import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDeck, useScryfallRefresh, syncText } from './useDeck';
import { usePrintDeck } from './usePrintDeck';
import { useNames, errorText } from './useNames';
import { listenTeam, teamDecks, renameTeam, assignPlayer, removePlayer, deleteTeam, createSlotDeck, deleteSlotDeck } from './teamStore';
import { listenDecks } from './deckStore';
import { teamOverLimit, addCard, boardCounts, toPrintEntries, formatLabel, importNote } from './deckModel';
import { TEAM_FORMATS } from './formats';
import { navigate } from '../hooks/useHashRoute';
import { useIsMobile } from '../hooks/useIsMobile';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import DeckSections from './DeckSections';
import CardSearch from './CardSearch';
import NewDeckDialog from './NewDeckDialog';
import { DeckBand, DeckCount } from './DeckTabs';
import { ListName } from './GroupLists';
import { ExportDeckDialog, NameFormatDialog } from './dialogs';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  IconArrowLeft, IconTrash, IconLogOut, IconUsers, IconCrown, IconX, IconUserPlus, IconPlus, IconCopy, IconPencil, IconDeckPrint, IconDeckExport,
} from '../components/icons';

const TEAM_TABS = [['deck', 'Decks'], ['stats', 'Stats']];
const CONFLICT = 'This deck changed (another player or device): your last change was not saved. You now see the saved version.';

// Team Trios (#/decks/team/:id): i tre mazzi di una squadra per un torneo a squadre. Testata ferma: indietro, nome della
// squadra (il leader lo rinomina sul posto), Delete (leader) o Leave. Da desktop la fascia con Decks e Stats.
// Decks: i tre mazzi uno sotto l'altro, sempre in Stacks, ognuno col nome tra [ ] e sotto formato, giocatore (o posto
// libero), conteggio e icone. Un mazzo lo modifica il leader o il giocatore del suo posto (ricerca sopra le carte), gli
// altri lo vedono in sola lettura. Limite di squadra: 4 copie di una carta sui tre mazzi (teamOverLimit), segnato sulle
// carte di ogni mazzo che le ha, mai bloccante. Stats: un menu sceglie il mazzo. Telefono: niente schede, i mazzi e
// sotto le statistiche del mazzo scelto (senza la mano di prova).
export default function TeamPage({ uid, id, notify, printQueueCount, onPrintDeck }) {
  const [team, setTeam] = useState(undefined); // undefined = caricamento, null = eliminata o non se ne fa più parte
  const [err, setErr] = useState(null);
  useEffect(() => listenTeam(id, setTeam, (e) => { setTeam(null); setErr(e); }), [id]);
  if (team === undefined) return <div className="decks-root decks-center"><span className="import-spinner" aria-label="Loading" /></div>;
  if (!team) {
    return (
      <div className="decks-root decks-center">
        <div className="decks-empty">
          <p className="decks-empty-title">This team is not available</p>
          <p className="field-hint">{err?.code === 'permission-denied' ? 'You are not in it any more, or it was deleted.' : 'It was deleted.'} <a href="#/decks">Back to My decks</a></p>
        </div>
      </div>
    );
  }
  return <TeamDecks team={team} uid={uid} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />;
}

// I tre mazzi, come nell'editor (useDeck: tutto il mazzo salvato 800 ms dopo l'ultima modifica; rev e ver rifiutano la
// copia vecchia di chi modificava lo stesso mazzo, che torna alla versione salvata). Chi non può modificare un mazzo
// cambia Group by e analisi delle terre solo qui, come nella Community.
function TeamDecks({ team, uid, notify, printQueueCount, onPrintDeck }) {
  const syncError = useCallback((e) => notify(syncText(e, CONFLICT), 'error', e.retry && { label: 'Retry', onClick: e.retry }), [notify]);
  const col = teamDecks(team.id);
  const d0 = useDeck(col, '0', syncError);
  const d1 = useDeck(col, '1', syncError);
  const d2 = useDeck(col, '2', syncError);
  const can = (i) => team.owner === uid || team.slots[i] === uid;
  useScryfallRefresh(d0.deck, d0.synced && can(0), d0.update);
  useScryfallRefresh(d1.deck, d1.synced && can(1), d1.update);
  useScryfallRefresh(d2.deck, d2.synced && can(2), d2.update);
  const [local, setLocal] = useState({}); // posto → { groupBy, landAnalysis } di chi guarda senza modificare
  const slots = [d0, d1, d2].map((s, i) => {
    if (can(i)) return { deck: s.deck, update: s.update, canEdit: true, saving: s.saving, unsaved: s.unsaved };
    const deck = s.deck && local[i] ? { ...s.deck, ...local[i] } : s.deck;
    const update = (fn) => setLocal((l) => { const d = fn(deck); return { ...l, [i]: { groupBy: d.groupBy, landAnalysis: d.landAnalysis } }; });
    return { deck, update, canEdit: false };
  });
  const nameOf = useNames(team.members);
  return <TeamBody team={team} uid={uid} slots={slots} nameOf={nameOf} notify={notify} printQueueCount={printQueueCount} onPrintDeck={onPrintDeck} />;
}

// La pagina, solo presentazione (anche nel tutorial, su dati demo): slots = [{ deck, update, canEdit, saving, unsaved }]
// nell'ordine dei posti; deck undefined = caricamento, null = posto senza mazzo, false = non caricato. nameOf(uid) = il
// nickname di un giocatore.
export function TeamBody({ team, uid, slots, nameOf, notify, printQueueCount, onPrintDeck }) {
  const mobile = useIsMobile();
  const [tab, setTab] = useState('deck');
  const [pick, setPick] = useState(0); // il mazzo di Stats
  const [dialog, setDialog] = useState(null); // { kind: 'new' | 'copy' | 'rename', slot }
  const [exporting, setExporting] = useState(null);
  const [ask, setAsk] = useState(null); // 'delete' | 'leave' | il posto del mazzo da togliere
  const [startPrint, printDialog] = usePrintDeck(printQueueCount, onPrintDeck);
  const scrollRef = useRef(null);
  const [jump, setJump] = useState(null); // { slot, ids }: Select in deck dalle Stats, le carte da selezionare nel mazzo
  // Decks è lungo tre mazzi: ogni scheda parte dall'alto (Select in deck poi scorre fino alla carta).
  const onTab = (t, ids) => { setTab(t); setJump(ids ? { slot: shown, ids } : null); scrollRef.current?.scrollTo(0, 0); };
  const [a, b, c] = slots.map((s) => s.deck || null);
  const over = useMemo(() => teamOverLimit([a, b, c]), [a, b, c]);
  const leader = team.owner === uid;
  const fail = (e) => notify(errorText(e), 'error');
  const ready = [0, 1, 2].filter((i) => slots[i].deck);
  const shown = ready.includes(pick) ? pick : ready[0];

  const slotView = (s, i) => {
    const d = s.deck;
    const player = team.slots[i];
    const add = (card, opts) => s.update((x) => {
      const r = addCard(x, card, opts);
      if (!r.added) notify('This deck already has 500 rows', 'error');
      return r.deck;
    });
    return (
      <section key={i} className="team-deck" aria-labelledby={`team-deck-${i}`}>
        <div className="team-deck-head">
          <h3 className="decks-title team-deck-name" id={`team-deck-${i}`}>{d ? d.name : `Deck ${i + 1}`}</h3>
          <div className="team-deck-meta">
            {d && (s.canEdit ? (
              <select className="deck-format" value={d.format} aria-label={`Format of ${d.name}`} onChange={(e) => s.update((x) => ({ ...x, format: e.target.value }))}>
                {TEAM_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            ) : <span className="team-format">{formatLabel(d.format)}</span>)}
            {player ? (
              <span className="group-member">
                {player === team.owner && <IconCrown size={13} />}
                <span>{nameOf(player)}{player === uid ? ' (you)' : ''}</span>
                {leader && player !== uid && (
                  <button type="button" className="group-member-x" onClick={() => removePlayer(team, player).catch(fail)}
                    aria-label={`Remove ${nameOf(player)} from the team`} title="Remove from the team (the deck stays)"><IconX size={12} /></button>
                )}
              </span>
            ) : leader ? <AddPlayer team={team} slot={i} notify={notify} /> : <span className="team-open">Open slot</span>}
            {d && <DeckCount deck={d} plain />}
            {d && s.canEdit && <span className="deck-sync">{s.unsaved ? 'Not saved' : s.saving ? 'Saving…' : 'Saved'}</span>}
            <span className="team-deck-actions">
              {d ? (
                <>
                  {s.canEdit && (
                    <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setDialog({ kind: 'rename', slot: i })}
                      aria-label={`Rename ${d.name}`} title="Rename the deck"><IconPencil size={16} /></button>
                  )}
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => startPrint(d)} disabled={!boardCounts(d).main}
                    aria-label={`Print ${d.name}`} title="Print deck"><IconDeckPrint /></button>
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setExporting(d)} disabled={!d.cards.length}
                    aria-label={`Export ${d.name}`} title="Export"><IconDeckExport /></button>
                  {s.canEdit && (
                    <button type="button" className="btn-secondary deck-icon-btn settings-delete" onClick={() => setAsk(i)}
                      aria-label={`Remove ${d.name} from the team`} title="Remove the deck"><IconTrash size={18} /></button>
                  )}
                </>
              ) : s.canEdit && d === null && (
                <>
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setDialog({ kind: 'new', slot: i })}
                    aria-label={`New deck for slot ${i + 1}`} title="New deck"><IconPlus size={18} /></button>
                  <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setDialog({ kind: 'copy', slot: i })}
                    aria-label={`Copy one of your decks to slot ${i + 1}`} title="Copy one of your decks"><IconCopy size={16} /></button>
                </>
              )}
            </span>
          </div>
        </div>
        {d === undefined ? <span className="import-spinner team-empty" aria-label="Loading" />
          : d === false ? <p className="field-hint team-empty" role="alert">Could not load this deck.</p>
            : d === null ? <p className="field-hint team-empty">{s.canEdit ? 'No deck yet: create one, or copy one of yours (an independent copy).' : 'No deck yet.'}</p>
              : (
                <>
                  {s.canEdit && <div className="team-search"><CardSearch format={d.format} onAdd={add} notify={notify} noAdvanced label={`Search cards for ${d.name}`} /></div>}
                  <DeckSections deck={d} update={s.update} touch={mobile} readOnly={!s.canEdit} tab="deck" fixedView="stacks" teamOver={over} notify={notify}
                    select={jump?.slot === i ? jump : undefined}
                    onPrint={(rows) => onPrintDeck(toPrintEntries({ cards: rows.map((r) => ({ ...r, board: 'main' })) }), true)} />
                </>
              )}
      </section>
    );
  };

  const stats = shown === undefined ? <p className="field-hint team-empty">No decks yet.</p> : (
    <div className="team-stats">
      <label className="deck-tool team-pick">
        <span>Deck</span>
        <select value={shown} onChange={(e) => setPick(Number(e.target.value))}>
          {ready.map((i) => <option key={i} value={i}>{slots[i].deck.name}</option>)}
        </select>
      </label>
      <DeckSections key={shown} deck={slots[shown].deck} update={slots[shown].update} touch={mobile} readOnly={!slots[shown].canEdit} tab="stats" onTab={onTab} notify={notify} />
    </div>
  );

  return (
    <div className={`deck-editor team-page${mobile ? ' is-mobile' : ''}`}>
      <div className="deck-scroll" ref={scrollRef}>
        <div className="folder-head group-head team-bar">
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => navigate('/decks')} aria-label="My decks" title="My decks"><IconArrowLeft size={18} /></button>
          <IconUsers size={20} />
          {leader ? <ListName name={team.name} what="team" onRename={(name) => renameTeam(team.id, name).catch(fail)} /> : <h2 className="group-name">{team.name}</h2>}
          <span className="group-actions">
            {leader
              ? <button type="button" className="btn-secondary deck-icon-btn settings-delete" onClick={() => setAsk('delete')} aria-label="Delete the team" title="Delete the team"><IconTrash size={18} /></button>
              : <button type="button" className="btn-secondary deck-icon-btn" onClick={() => setAsk('leave')} aria-label="Leave the team" title="Leave the team"><IconLogOut size={18} /></button>}
          </span>
        </div>
        {!mobile && <DeckBand tab={tab} onTab={onTab} items={TEAM_TABS} format={<span className="deck-format-static">Team Trios</span>} />}
        <div className="deck-body">
          <section className="deck-main">
            {mobile ? <>{slots.map(slotView)}<div className="team-part">{stats}</div></> : tab === 'stats' ? stats : slots.map(slotView)}
          </section>
        </div>
      </div>
      {printDialog}
      {exporting && <ExportDeckDialog deck={exporting} onClose={() => setExporting(null)} />}
      {dialog?.kind === 'new' && (
        <NewDeckDialog title={`New deck, slot ${dialog.slot + 1}`} formats={TEAM_FORMATS} allowPublic={false}
          initialFormat={slots.find((s) => s.deck)?.deck.format} onClose={() => setDialog(null)}
          onCreate={(deck, notFound, left = 0) => {
            createSlotDeck(team.id, String(dialog.slot), deck).done.catch(fail);
            setDialog(null);
            if (deck.cards.length) notify(...importNote(notFound, left));
          }} />
      )}
      {dialog?.kind === 'copy' && (
        <CopyDeckDialog uid={uid} onClose={() => setDialog(null)}
          onPick={(deck) => {
            createSlotDeck(team.id, String(dialog.slot), deck).done.then(() => notify(`${deck.name} copied to the team`), fail);
            setDialog(null);
          }} />
      )}
      {dialog?.kind === 'rename' && slots[dialog.slot].deck && (
        <NameFormatDialog title="Rename deck" confirmLabel="Rename" showFormat={false} initialName={slots[dialog.slot].deck.name}
          placeholder="Mono-red burn" onClose={() => setDialog(null)}
          onSubmit={({ name }) => { slots[dialog.slot].update((d) => ({ ...d, name })); setDialog(null); }} />
      )}
      {createPortal(
        <>
          <ConfirmDialog open={ask === 'delete'} confirmLabel="Delete team"
            message={`Delete “${team.name}” for every player? Its decks go too. This can’t be undone.`}
            onCancel={() => setAsk(null)}
            onConfirm={() => { setAsk(null); navigate('/decks'); deleteTeam(team.id).then(() => notify('Team deleted'), fail); }} />
          <ConfirmDialog open={ask === 'leave'} confirmLabel="Leave"
            message={`Leave “${team.name}”? Your deck stays in the team, with the team leader.`}
            onCancel={() => setAsk(null)}
            onConfirm={() => { setAsk(null); navigate('/decks'); removePlayer(team, uid).then(() => notify('You left the team'), fail); }} />
          <ConfirmDialog open={typeof ask === 'number'} confirmLabel="Remove deck"
            message={typeof ask === 'number' && slots[ask].deck ? `Remove “${slots[ask].deck.name}” from the team? This can’t be undone.` : ''}
            onCancel={() => setAsk(null)}
            onConfirm={() => { deleteSlotDeck(team.id, String(ask)).then(() => notify('Deck removed'), fail); setAsk(null); }} />
        </>,
        document.body,
      )}
    </div>
  );
}

// Il leader dà un posto libero a un giocatore, per nickname.
function AddPlayer({ team, slot, notify }) {
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    const name = nick.trim();
    if (!name) return;
    setBusy(true);
    try { await assignPlayer(team, slot, name); setNick(''); notify(`${name} plays deck ${slot + 1}`); } catch (err) { notify(errorText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <form className="settings-add team-invite" onSubmit={add}>
      <input className="import-link-input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Player nickname"
        aria-label={`Player of deck ${slot + 1}, by nickname`} spellCheck={false} autoComplete="off" disabled={busy} />
      <button type="submit" className="btn-secondary deck-icon-btn" disabled={busy || !nick.trim()} aria-label="Add player" title="Add player"><IconUserPlus size={16} /></button>
    </form>
  );
}

// Uno dei propri mazzi in un posto: copia indipendente (teamCopy), il mazzo resta com'è.
function CopyDeckDialog({ uid, onClose, onPick }) {
  const [decks, setDecks] = useState(null);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  useEffect(() => listenDecks(uid, setDecks, () => setDecks([])), [uid]);
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-confirm" ref={ref} role="dialog" aria-modal="true" aria-label="Copy one of your decks" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Copy one of your decks</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">An independent copy: changes here do not touch your deck. Commander and the other command zone formats become Casual.</p>
        {decks === null ? <span className="import-spinner" aria-label="Loading" />
          : !decks.length ? <p className="modal-hint">You have no decks yet.</p>
            : (
              <ul className="group-pick">
                {decks.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="btn-secondary group-pick-btn" onClick={() => onPick(d)}>
                      <span>{d.name}</span><span className="group-pick-n">{formatLabel(d.format)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </div>
    </div>,
    document.body,
  );
}
