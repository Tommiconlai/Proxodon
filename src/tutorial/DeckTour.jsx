import { useLayoutEffect, useRef, useState } from 'react';
import Tutorial from './Tutorial';
import { touches } from './control';
import { Shell, ProfileStage, SettingsStage } from './AccountStages';
import { C, demoDeck, myDecks, communityDecks, LIKES, dilemmas, DILEMMA_VOTES, helps, HELP_REPLIES } from './demo';
import DeckSections from '../decks/DeckSections';
import { DeckTabs, DeckBand, DeckTitle, DeckCount, DeckBottomBar, DeckTagList, TabLabel, ListBand } from '../decks/DeckTabs';
import { DeckTile, GhostTile, FolderTile } from '../decks/DeckList';
import { DilemmaTile } from '../decks/Dilemmas';
import { HelpItem, HelpQuestion, CardChips } from '../decks/HelpRequests';
import { CardFrame, CardFrameDefs } from '../components/CardFrame';
import { useBracketSlide } from '../hooks/useBracketSlide';
import { FORMATS, formatLabel, coverRow, searchTerms, deckMatches, MAX_HELP_CARDS } from '../decks/deckModel';
import {
  IconPlus, IconMinus, IconCopy, IconTrash, IconPencil, IconExport, IconGlobe, IconPlay, IconFolder, IconArrowLeft,
  IconPrinter, IconEye, IconScale, IconLifebuoy, IconImage, IconList, IconCheck,
  IconDeckTag, IconDeckPrint, IconDeckExport, IconDeckPublic, IconDeckSearch, IconDeckHeart, IconDeckFilter,
} from '../components/icons';

// Tutorial delle pagine mazzi: per ogni pagina una copia demo (stesse classi e, dove si può, gli stessi componenti:
// DeckSections, DeckTile, DilemmaTile, HelpItem…) con mazzi, dilemmi e richieste inventati, solo in memoria.
// Niente letture o scritture su Firestore, niente impostazioni o localStorage: le copie demo cambiano solo il loro stato.
const noop = () => {};
const NO_FILTERS = { format: '', colors: [], card: '' };
const LIST_TABS = [['community', 'Community'], ['dilemmas', 'Dilemmas'], ['help', 'Help'], ['mine', 'My decks']];
const OWNERS = Object.fromEntries(communityDecks().map((d) => [d.id, d]));

// Ricerca carte finta (stesso markup di CardSearch): la tendina appare da 2 lettere, la prima voce è attiva.
const NAMES = ['Rhystic Study', 'Rhystic Circle', 'Rhystic Cave', 'Forest', 'Forest Bear', 'Forerunner of the Empire'];
function FakeSearch({ q, active = 0, adv = true }) {
  const list = q.length >= 2 ? NAMES.filter((n) => n.toLowerCase().startsWith(q.toLowerCase())) : [];
  return (
    <div className="card-search">
      <div className="search-wrap">
        <div className="search-box"><IconDeckSearch /><input value={q} readOnly placeholder="Search a card name" aria-label="Search cards" /></div>
        {list.length > 0 && <ul className="search-suggest">{list.map((n, i) => <li key={n} className={i === active ? 'active' : undefined}>{n}</li>)}</ul>}
      </div>
      {adv && <div className="search-foot"><button type="button" className="search-adv-toggle">Advanced search</button></div>}
    </div>
  );
}

// ── Pagina di un mazzo: editor (mode 'editor'), mazzo della Community ('community') o help request ('help') ──
const HELP = { ...helps()[0], uid: 'glitchmage' }; // la richiesta della demo è di un altro giocatore
const deckFor = (mode) => (mode === 'editor' ? demoDeck() : { ...demoDeck(), owner: 'glitchmage', public: true });

function DeckStage({ apiRef, mobile, mode }) {
  const [deck, setDeck] = useState(() => deckFor(mode));
  const [tab, setTab] = useState('deck');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0); // voce evidenziata nella tendina della ricerca
  const [liked, setLiked] = useState(false);
  const [cut, setCut] = useState([]);
  const [add, setAdd] = useState([]);
  const [why, setWhy] = useState('');
  const [over, setOver] = useState(false);
  const [stuck, setStuck] = useState(false); // come nell'editor: la barra in alto prende lo sfondo quando la testata esce
  const scrollRef = useRef(null);
  const heroRef = useRef(null);
  useLayoutEffect(() => {
    const once = (set) => (card) => set((l) => (l.some((c) => c.oid === card.oid) ? l : [...l, card]));
    apiRef.current = {
      update: (fn) => setDeck((d) => fn(d)), tab: setTab, query: setQ, active: setActive, like: () => setLiked((v) => !v),
      cut: once(setCut), suggest: once(setAdd), why: setWhy, over: setOver,
    };
  }, [apiRef]);
  const update = (fn) => setDeck((d) => fn(d));
  const editor = mode === 'editor';
  const help = mode === 'help';
  const cover = coverRow(deck)?.card.art;
  const art = cover && (
    <>
      <span className="deck-hero-blur" aria-hidden="true"><span style={{ backgroundImage: `url("${cover}")` }} /></span>
      <span className="deck-hero-img" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />
    </>
  );
  const name = editor ? <input className="deck-name" value={deck.name} readOnly aria-label="Deck name" />
    : <h2 className="deck-name deck-name-static">{deck.name}</h2>;
  const likes = 12 + (liked ? 1 : 0);
  const like = (
    <button type="button" className={`deck-like${liked ? ' on' : ''}`} aria-label={`Like, ${likes} likes`} title="Like">
      <IconDeckHeart filled={liked} /> <span>{likes}</span>
    </button>
  );
  const format = editor ? (
    <select className="deck-format" value={deck.format} aria-label="Format" onChange={noop}>
      {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
    </select>
  ) : <span className="deck-format-static">{formatLabel(deck.format)}</span>;
  const inHero = mobile || help; // come nell'editor e nella Community: da desktop nome in alto, formato nella fascia
  const btn = (Icon, label, extra = '') => (
    <button type="button" className={`btn-secondary deck-icon-btn${extra}`} aria-label={label} title={label}><Icon size={17} /></button>
  );
  return (
    <Shell mobile={mobile}>
      <div className={`deck-editor${mobile ? ' is-mobile' : ''}`}>
        <div className="deck-scroll" ref={scrollRef}
          onScroll={mobile ? undefined : (e) => setStuck(e.currentTarget.scrollTop > (heroRef.current?.offsetHeight || 0) - 72)}>
          {!mobile && !help && (
            <div className="deck-sticky">
              <div className={`deck-sticky-bar${stuck ? ' stuck' : ''}`}>
                <DeckTitle by={editor ? 'demoplayer' : deck.owner}>{name}{!editor && like}</DeckTitle>
                {editor && <div className="deck-hero-search"><FakeSearch q={q} active={active} /></div>}
              </div>
            </div>
          )}
          <header className={`deck-hero${mobile && !help ? ' has-tabs' : ''}`} ref={heroRef}>
            {editor ? <button type="button" className="deck-hero-art" aria-label="Deck cover">{art}</button> : <span className="deck-hero-art">{art}</span>}
            <div className="deck-hero-content">
              {inHero && <div className="deck-hero-title">{name}{!editor && like}</div>}
              {help && <HelpQuestion help={HELP} />}
              <DeckTagList deck={deck} />
              <div className="deck-hero-meta">
                {inHero && (editor ? format : <span className="deck-price">{formatLabel(deck.format)}</span>)}
                <span className="deck-hero-actions">
                  {editor ? <>{btn(IconDeckTag, 'Tags')}{btn(IconDeckPrint, 'Print deck')}{btn(IconDeckExport, 'Export')}{btn(IconDeckPublic, 'Share in Community', ' is-public')}</>
                    : <>{btn(IconCopy, 'Copy to my decks')}{btn(IconDeckExport, 'Export')}</>}
                </span>
                {(editor || inHero) && <span className="deck-sync">{editor ? 'Saved 2 minutes ago' : `by ${deck.owner}`}</span>}
              </div>
            </div>
          </header>
          {!help && (mobile ? <DeckTabs tab={tab} onTab={setTab} /> : <DeckBand tab={tab} onTab={setTab} format={format} />)}
          <div className="deck-body">
            <section className="deck-main">
              {help ? <HelpReplyDemo deck={deck} update={update} mobile={mobile} cut={cut} add={add} q={q} why={why} over={over} />
                : tab === 'dilemmas' ? <TabDilemmas deck={deck} mine={editor} />
                : tab === 'help' ? <TabHelps deck={deck} mine={editor} /> : (
                <DeckSections deck={deck} update={update} touch={mobile} readOnly={!editor} tab={tab} onTab={setTab} notify={noop}
                  onPrint={editor ? noop : undefined} onDilemma={editor ? noop : undefined} onHelp={editor ? noop : undefined} />
              )}
            </section>
          </div>
        </div>
        {mobile ? <DeckBottomBar deck={deck} showCount={tab === 'deck'} scrollRef={scrollRef} onSearch={editor ? noop : undefined} />
          : tab === 'deck' && !help && <DeckCount deck={deck} />}
      </div>
    </Shell>
  );
}

// Schede Dilemmas e Help del mazzo (copie di DeckDilemmas e DeckHelps): i dilemmi e la richiesta della demo, con il +
// del nuovo dilemma sul proprio mazzo (la nuova richiesta no: ce n'è già una aperta).
function TabDilemmas({ deck, mine }) {
  return (
    <div className="deck-sections">
      <div className="dilemma-head"><h3 className="deck-analysis-head">Dilemmas</h3></div>
      <ul className="dilemma-list">
        {dilemmas().slice(0, 2).map((d) => <DilemmaTile key={d.id} deckId={deck.id} d={d} uid="tutorial" solved={false} votes={d.votes} onClick={noop} />)}
        {mine && (
          <li>
            <button type="button" className="dilemma-tile dilemma-add" aria-label="New dilemma" title="New dilemma"><span className="dilemma-split"><IconPlus size={44} /></span></button>
          </li>
        )}
      </ul>
    </div>
  );
}
function TabHelps({ deck, mine }) {
  const h = helps()[0];
  return (
    <div className="deck-sections">
      <div className="dilemma-head"><h3 className="deck-analysis-head">Help requests</h3></div>
      <ul className="help-list">
        <HelpItem deckId={deck.id} info={deck} h={h} mine={mine} onClick={noop} counts={{ replies: HELP_REPLIES[h.id], fresh: mine ? 2 : 0 }} />
      </ul>
    </div>
  );
}

// Pagina della help request per chi aiuta (copia di ReplyDraft): zone Cuts e Suggestions, perché e invio, sotto il mazzo.
function HelpReplyDemo({ deck, update, mobile, cut, add, q, why, over }) {
  return (
    <div className="help-reply-body">
      <div className="help-page">
        <div className="dilemma-head">
          <button type="button" className="btn-secondary deck-icon-btn" aria-label="Back" title="Back"><IconArrowLeft size={18} /></button>
          <h3 className="deck-analysis-head">Suggest changes</h3>
        </div>
      </div>
      <div className="help-zones-bar">
        <div className="help-zones">
          <section className={`help-zone cut${over ? ' over' : ''}`} aria-label="Cuts: cards to take out">
            <h4>Cuts <span className="n">{cut.length} of {MAX_HELP_CARDS}</span></h4>
            {cut.length > 0 ? <CardChips cards={cut} label="Cards to cut" sign="−" className="cut" onRemove={noop} />
              : <p className="help-zone-hint">{mobile ? 'Long press a card in the deck below, then Suggest cut.' : 'Drag cards here from the deck below, or open a card’s menu (right click or Shift+F10): Suggest cut.'}</p>}
          </section>
          <section className="help-zone add" aria-label="Suggestions: cards to add">
            <h4>Suggestions <span className="n">{add.length} of {MAX_HELP_CARDS}</span></h4>
            <FakeSearch q={q} adv={false} />
            {add.length > 0 && <CardChips cards={add} label="Cards to add" sign="+" className="add" onRemove={noop} />}
          </section>
        </div>
      </div>
      <div className="help-page">
        <div className="help-why">
          <label className="field-label" htmlFor="tut-help-why">Why? <span className="field-hint">Optional</span></label>
          <textarea id="tut-help-why" className="import-link-input" value={why} readOnly rows={3} placeholder="What would these changes fix in the deck?" />
          <div className="help-why-actions">
            <button type="button" className="btn-generate deck-icon-btn" disabled={!cut.length && !add.length && !why} aria-label="Send suggestion" title="Send suggestion"><IconCheck size={18} /></button>
          </div>
        </div>
      </div>
      <DeckSections deck={deck} update={update} touch={mobile} readOnly tab="deck" onTab={noop} notify={noop} onCut={noop} />
    </div>
  );
}

// ── Lista mazzi: My decks, Community, Dilemmas (con il dilemma aperto) e Help ──
function ListStage({ apiRef, step, mobile, tab }) {
  const tabsRef = useRef(null);
  useBracketSlide(tabsRef, LIST_TABS.findIndex(([t]) => t === tab));
  const [q, setQ] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [decks, setDecks] = useState(() => (tab === 'community' ? communityDecks() : myDecks()));
  const [dropOn, setDropOn] = useState(null);
  const [open, setOpen] = useState(step.open ?? null); // dilemma aperto (il passo Vote parte già aperto)
  const [pick, setPick] = useState(null);
  const [voted, setVoted] = useState(false);
  useLayoutEffect(() => {
    apiRef.current = {
      query: setQ, filters: setFiltersOpen, drop: setDropOn, open: setOpen, pick: setPick, vote: () => setVoted(true),
      // Un mazzo lasciato su un altro: una cartella nuova con i due, come in DeckList.
      folder: (a, b) => setDecks((l) => l.map((d) => (d.id === a || d.id === b ? { ...d, folder: { id: 'tut-new', name: 'New folder' } } : d))),
    };
  }, [apiRef]);
  const feed = tab === 'dilemmas' || tab === 'help';
  const label = tab === 'dilemmas' ? 'Search dilemmas' : tab === 'help' ? 'Search requests' : 'Search decks by name or tag';
  const terms = searchTerms(q);
  const searching = terms.length > 0;
  const shown = decks.filter((d) => deckMatches(d, terms, NO_FILTERS));
  const folders = [];
  for (const d of decks) {
    if (!d.folder?.id) continue;
    let f = folders.find((x) => x.id === d.folder.id);
    if (!f) folders.push(f = { id: d.folder.id, name: d.folder.name, decks: [] });
    f.decks.push(d);
  }
  const dilemma = open && dilemmas().find((d) => d.id === open);
  let body;
  if (tab === 'mine') {
    body = (
      <ul className="deck-grid">
        {!searching && folders.map((f) => <FolderTile key={f.id} folder={f} onOpen={noop} onRename={noop} active={dropOn === f.id} drop={{ 'data-deck': f.id }} />)}
        {(searching ? shown : decks.filter((d) => !d.folder?.id)).map((d) => (
          <li key={d.id} className={`deck-tile-wrap${dropOn === d.id ? ' drop' : ''}`} data-deck={d.id}>
            <DeckTile deck={d} stats={{ likes: d.public ? 12 : 0, help: d.id === 'tut-deck' }} />
          </li>
        ))}
        {!searching && <GhostTile label="New deck" onClick={noop}><IconPlus size={44} /></GhostTile>}
      </ul>
    );
  } else if (tab === 'community') {
    body = (
      <ul className="deck-grid">
        {shown.map((d) => (
          <li key={d.id} className="deck-tile-wrap" data-deck={d.id}><DeckTile deck={d} by={d.owner} stats={{ likes: LIKES[d.id], help: d.id === 'tut-c1' }} /></li>
        ))}
      </ul>
    );
  } else if (tab === 'dilemmas') {
    body = dilemma ? <DilemmaDemo d={dilemma} pick={pick} voted={voted} /> : (
      <ul className="dilemma-list">
        {dilemmas().map((d) => (
          <DilemmaTile key={d.id} deckId={d.deckId} d={d} uid="tutorial" solved={false} votes={d.votes} onClick={noop}
            meta={<><b>{OWNERS[d.deckId].name}</b> by {OWNERS[d.deckId].owner}</>} />
        ))}
      </ul>
    );
  } else {
    body = (
      <ul className="help-list">
        {helps().map((h) => (
          <HelpItem key={h.id} deckId={h.deckId} info={h.deck} h={h} mine={h.uid === 'tutorial'} inFeed onClick={noop}
            flags={h.uid === 'tutorial' ? ['Yours'] : h.id === 'tut-h3' ? ['Replied'] : []}
            counts={{ replies: HELP_REPLIES[h.id], fresh: h.uid === 'tutorial' ? 2 : 0 }} />
        ))}
      </ul>
    );
  }
  return (
    <Shell mobile={mobile}>
      <div className="decks-root decks-page">
        {/* Come DeckList: da desktop la fascia a trapezi, da telefono le schede tra [ ]. */}
        {mobile ? (
          <header className="decks-head">
            <nav className="decks-tabs" aria-label="Decks" ref={tabsRef}>
              {LIST_TABS.map(([t, text]) => <a key={t} className="decks-title decks-tab" aria-current={tab === t ? 'page' : undefined}><TabLabel>{text}</TabLabel></a>)}
            </nav>
          </header>
        ) : <ListBand items={LIST_TABS} current={tab} />}
        {!open && (
          <div className="decks-search" role="search">
            <label className="decks-search-box">
              <IconDeckSearch />
              <input type="search" className="import-link-input" value={q} readOnly placeholder={label} aria-label={label} />
            </label>
            {feed ? (
              <select className="decks-format" value="" aria-label="Format" title="Format" onChange={noop}><option value="">Any format</option></select>
            ) : (
              <button type="button" className="decks-filter-btn" aria-expanded={filtersOpen} aria-label="Filters" title="Filters"><IconDeckFilter /></button>
            )}
            {tab === 'dilemmas' && (
              <div className="decks-actions">
                <button type="button" className="btn-add deck-new deck-icon-btn" aria-label="Play dilemmas" title="Play dilemmas"><IconPlay size={18} /></button>
              </div>
            )}
          </div>
        )}
        {filtersOpen && (
          <div className="decks-filters">
            <label className="decks-filter"><span>Format</span><select value="" onChange={noop}><option value="">Any</option></select></label>
            <label className="decks-filter"><span>Contains card</span><input type="search" className="import-link-input decks-card-filter" value="" readOnly placeholder="Card name" /></label>
          </div>
        )}
        {body}
      </div>
    </Shell>
  );
}

// Dilemma aperto (copia di DilemmaView): scelta, conferma, percentuali con il voto della demo.
function DilemmaDemo({ d, pick, voted }) {
  const n = d.cards.length;
  const counts = DILEMMA_VOTES.map((v, i) => v + (voted && pick === i ? 1 : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const pct = (a) => Math.round((a / total) * 100);
  return (
    <div className="deck-sections dilemma-view">
      <div className="dilemma-head">
        <button type="button" className="btn-secondary deck-icon-btn" aria-label="Back" title="Back"><IconArrowLeft size={18} /></button>
        <h3 className="deck-analysis-head">Dilemma</h3>
        {!voted && <button type="button" className="btn-add deck-icon-btn tut-confirm" disabled={pick === null} aria-label="Confirm vote" title="Confirm vote"><IconCheck size={18} /></button>}
      </div>
      <CardFrameDefs />
      <div className={`dilemma-cards n${n}${voted ? ' voted' : pick !== null ? ' picked' : ''}`}>
        {d.cards.map((c, i) => (
          <button key={c.oid} type="button" className={`dilemma-card${pick === i ? ' selected' : ''}`} style={{ '--r': `${(i - (n - 1) / 2) * (8 / (n - 1))}deg` }}>
            <img src={c.img} alt="" />
            <CardFrame />
            {voted && <span className="dilemma-pct">{pct(counts[i])}%</span>}
          </button>
        ))}
      </div>
      <p className="dilemma-deck"><a>{OWNERS[d.deckId].name}</a></p>
      <p className="dilemma-question">{d.question}</p>
      {!voted && <p className="field-hint dilemma-hint">{pick === null ? 'Choose the card you would play.' : `${d.cards[pick].name}: change it if you like, then confirm your vote.`}</p>}
      {voted && <p className="dilemma-same"><b>{pct(counts[pick])}%</b> chose {d.cards[pick].name} like you ({total} votes).</p>}
    </div>
  );
}

// ── Gesti e passi ──
const rowSel = (id) => `.deck-row[data-row-id="${id}"] .deck-row-main`;
const select = (el) => el.click();
// Copia dell'immagine di una carta da trascinare (vista lista: nessuna immagine, si trascina solo il cursore).
const clone = (g, id) => {
  const img = g.el(`.deck-row[data-row-id="${id}"] img`)?.cloneNode();
  if (img) img.className = 'tut-card-img';
  return img;
};
const tile = (id) => `[data-deck="${id}"] .deck-tile`;
// Selezione ad area sulle carte: dal vuoto sopra il primo gruppo con almeno 3 carte fino alla terza.
async function area(g) {
  const group = g.els('.deck-columns .deck-group').find((s) => s.querySelectorAll('.deck-row').length >= 3);
  const rows = group.querySelectorAll('.deck-row');
  rows[2].scrollIntoView({ block: 'nearest' });
  const r = group.getBoundingClientRect();
  await g.marquee({ x: r.left - 14, y: r.top - 6 }, g.at(rows[2], 0.55, 0.3), {
    effect: (box) => g.els('.deck-row').filter((li) => touches(box, li)).forEach((li) => li.querySelector('.deck-row-main').click()),
  });
}
const CARD_MENU = {
  title: 'Counterspell',
  items: [[IconEye, 'View card'], [IconPrinter, 'Print'], [IconScale, 'Dilemma'], [IconLifebuoy, 'Ask for help'], [IconImage, 'Change edition'],
    [IconPlus, 'Move to a new section…'], [IconList, 'Move to maybeboard'], [IconTrash, 'Remove', true]],
};
const DECK_MENU = (name, pub) => ({
  title: name,
  items: [[IconPencil, 'Rename'], [IconGlobe, pub ? 'Make private' : 'Share in Community'], [IconCopy, 'Duplicate'], [IconFolder, 'Move to “Brews”'], [IconFolder, 'Move to a new folder'], [IconExport, 'Export…'], [IconTrash, 'Delete', true]],
});
// Il cursore passa sui pulsanti e ne dice il nome.
async function pointAt(g, list) {
  for (const [sel, text] of list) {
    await g.move(sel);
    g.say(text);
    await g.wait(1000);
  }
}

// Trascinamento vero nella demo: dragstart sulla riga (DeckSections apre le zone in basso a sinistra), dragover e drop
// sulla zona, dragend; il cursore finto fa vedere il gesto. alt = una copia sola (Alt+drag).
function realDrag(g, rowId, zone, { alt, text = alt ? 'Alt+drag' : 'Drag' } = {}) {
  const dt = new DataTransfer();
  const src = g.el(`.deck-row[data-row-id="${rowId}"]`);
  const fire = (el, type) => el?.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, altKey: !!alt }));
  return g.drag(rowSel(rowId), `[data-zone="${zone}"]`, {
    text, ghost: clone(g, rowId),
    over: (on) => { if (on) fire(src, 'dragstart'); },
    arrive: (el) => fire(el, 'dragover'),
    effect: () => { fire(g.el(`[data-zone="${zone}"]`), 'drop'); fire(src, 'dragend'); },
  });
}
const addRow = (g, id, card, qty = 1) => g.api.update((d) => ({ ...d, cards: [...d.cards, { id, qty, board: 'main', commander: false, section: null, card }] }));

function editorSteps(mobile) {
  const tap = mobile ? 'Tap' : 'Click';
  const hero = {
    target: '.deck-hero', title: 'Your deck',
    text: `A demo deck: name, format and tags. Print sends it to the print sheet, Export copies the list, the globe shares it in Community. ${tap} the art to pick the cover card.`,
    play: (g) => pointAt(g, [['Tags', 'Tags'], ['Print deck', 'Print deck'], ['Export', 'Export'], ['Share in Community', 'Public']].map(([l, t]) => [`.deck-hero-actions [aria-label="${l}"]`, t])),
  };
  const search = mobile ? [{
    target: '.deck-bottom-bar .btn-add', title: 'Add cards',
    text: 'Tap the lens to search a card by name and tap a result to add it. Advanced search has filters.',
    play: (g) => g.click('.deck-bottom-bar .btn-add', 'Tap'),
  }] : [{
    target: '.deck-hero-search', side: 'left', title: 'Search a card',
    text: 'Type at least two letters of a name: the suggestions show only cards you can play in this format and, in Commander, in your commander’s colors. ↑ and ↓ move through them.',
    play: async (g) => {
      await g.type('.deck-hero-search input', 'Rhys', g.api.query);
      await g.wait(500);
      g.say('↓');
      g.api.active(1);
      await g.wait(700);
      g.say('↑');
      g.api.active(0);
      await g.wait(900);
    },
  }, {
    target: '.deck-hero-search', side: 'left', title: 'Add it',
    text: 'Enter adds one copy of the highlighted card: it lands in its group, here Enchantments.',
    play: async (g) => {
      await g.move('.deck-hero-search input');
      g.api.query('Rhys');
      await g.wait(700);
      g.say('Enter');
      await g.wait(700);
      g.api.query('');
      addRow(g, 'r20', C.rhysticStudy);
      g.spot('.deck-sections');
      await g.wait(300);
      await g.move(rowSel('r20'));
      g.say('Added');
      await g.wait(1300);
    },
  }, {
    target: '.deck-hero-search', side: 'left', title: 'More copies, other boards',
    text: 'Shift+Enter adds 4 copies. Alt+Enter sends the card to the sideboard, or to the maybeboard in Commander. Advanced search, under the bar, has filters.',
    play: async (g) => {
      await g.type('.deck-hero-search input', 'Fore', g.api.query);
      await g.wait(500);
      g.say('Shift+Enter');
      await g.wait(800);
      g.api.query('');
      g.api.update((d) => ({ ...d, cards: d.cards.map((r) => (r.id === 'r18' ? { ...r, qty: r.qty + 4 } : r)) }));
      g.spot('.deck-sections');
      await g.wait(300);
      await g.move(rowSel('r18'));
      g.say('+4');
      await g.wait(1300);
    },
  }];
  const choose = {
    target: '.deck-sections', title: 'Select cards',
    text: mobile ? 'Tap a card to select or deselect it. With one card selected, − and + appear above the bottom bar.'
      : 'Click a card to select or deselect it, Shift+click for a range, Esc to clear. Hover a card for + and −.',
    play: async (g) => {
      await g.click(rowSel('r2'), tap, select);
      await g.click(rowSel('r13'), tap, select);
      await g.wait(1000);
    },
  };
  const menu = {
    target: '.deck-sections', title: 'Card options',
    text: mobile ? 'Long-press a card, or the selection: view it, print, ask a dilemma or for help, change edition, move it to a board or a section, remove.'
      : 'Right-click a card or the selection, or press Shift+F10: view it, print, ask a dilemma or for help, change edition, split, set the commander, move, remove.',
    play: (g) => g.menu(rowSel('r13'), CARD_MENU, mobile ? { text: 'Long press', hold: true, effect: select } : { effect: select }),
  };
  const organize = {
    target: '.deck-toolbar', title: 'Group, sort and view',
    text: 'Group by type, mana value or your own sections. Sort and View apply to every deck.',
    play: (g) => g.click('.deck-toolbar .deck-tool:nth-of-type(3) select', mobile ? 'Tap' : 'Group by', () => g.api.update((d) => ({ ...d, groupBy: 'mv' }))),
  };
  const tabStep = (n, title, text) => ({
    target: '.deck-tabs', title, text,
    play: async (g) => {
      await g.click(`.deck-tabs .decks-tab:nth-child(${n})`, tap, () => g.api.tab(['deck', 'stats', 'dilemmas', 'help'][n - 1]));
      g.spot('.deck-main');
      await g.wait(1600);
    },
  });
  const tabs = [
    tabStep(2, 'Stats', 'Mana curve, colors, card types, prices and the cards that need attention. A bar selects its cards in the deck.'),
    {
      target: '.deck-tabs', side: 'above', title: 'Sample hand',
      text: 'Under the stats: draw a sample hand, mulligan, draw a card, play a card to see what you could cast.',
      play: async (g) => {
        g.api.tab('stats');
        await g.wait(400);
        g.spot('.sample-hand');
        await g.click('.sample-hand-bar .btn-secondary', mobile ? 'Tap' : 'New hand', select);
        await g.click('.sample-hand-cards li:first-child .sample-card', mobile ? 'Tap' : 'Play', select);
        await g.wait(1200);
      },
    },
    tabStep(3, 'Dilemmas', 'Ask the community which card fits better: pick 2 to 4 cards (also from the card menu, Dilemma) and write the question. The deck must be public.'),
    tabStep(4, 'Help', 'Ask for help on the whole deck (cuts, upgrades, budget, mana base): players suggest cards to cut and to add, you apply them in one click.'),
  ];
  if (mobile) return [hero, ...search, choose, menu, organize, ...tabs];
  return [hero, ...search, choose, {
    target: '.deck-sections', title: 'Select an area',
    text: 'Press on an empty spot and drag: every card the box touches joins the selection.',
    play: async (g) => { await area(g); await g.wait(1000); },
  }, {
    target: '.deck-sections', title: 'Drag a card',
    text: 'Pick up a card: on the left, above the count, the zones where it can go appear (Main, Sideboard, Maybeboard, your sections). Drop it there from anywhere in the deck, no scrolling. Dropping on a group works too.',
    play: async (g) => { await realDrag(g, 'r2', 'zone-maybe'); await g.wait(800); },
  }, {
    target: '.deck-sections', title: 'Move a selection',
    text: 'Drag a selected card and the whole selection moves with it.',
    play: async (g) => {
      await g.click(rowSel('r3'), tap, select);
      await g.click(rowSel('r4'), tap, select);
      await realDrag(g, 'r3', 'zone-maybe');
      await g.wait(800);
    },
  }, {
    target: '.deck-sections', title: 'One copy',
    text: 'Alt+drag moves one copy: one Forest goes to the maybeboard, the others stay in the deck.',
    play: async (g) => { await realDrag(g, 'r18', 'zone-maybe', { alt: true }); await g.wait(800); },
  }, {
    target: '.deck-sections', title: 'Your sections',
    text: 'New section (+) makes your own group and the deck switches to Custom sections. Your sections join the zones while you drag; rename or delete them from their title.',
    play: async (g) => {
      await g.click('.deck-new-section', 'New section', () => g.api.update((d) => ({ ...d, groupBy: 'custom', sections: [...d.sections, { id: 'tut-ramp', name: 'Ramp' }] })));
      await g.wait(500);
      await realDrag(g, 'r7', 'zone-tut-ramp');
      await g.wait(800);
    },
  }, menu, organize, ...tabs];
}

function communitySteps(mobile) {
  return [{
    target: '.deck-hero', title: 'A public deck',
    text: 'A demo deck shared by another player: name, format, author and likes. The heart likes it.',
    play: (g) => g.click('.deck-like', mobile ? 'Tap' : 'Like', () => g.api.like()),
  }, {
    target: '.deck-hero-actions', title: 'Copy or export',
    text: 'Copy to my decks makes your own copy to edit. Export gives you the list as text.',
    play: (g) => pointAt(g, [['.deck-hero-actions [aria-label="Copy to my decks"]', 'Copy to my decks'], ['.deck-hero-actions [aria-label="Export"]', 'Export']]),
  }, {
    target: '.deck-sections', title: 'Read only',
    text: `Group, sort and view change only your screen. ${mobile ? 'Long-press' : 'Right-click'} a card to see it full screen.`,
    play: (g) => g.menu(rowSel('r13'), { title: 'Counterspell', items: [[IconEye, 'View card']] }, mobile ? { text: 'Long press', hold: true } : {}),
  }, {
    target: '.deck-tabs', title: 'Stats, Dilemmas, Help',
    text: 'The deck’s Stats, its Dilemmas to vote on and its Help requests to answer.',
  }];
}

function helpReplySteps(mobile) {
  return [{
    target: '.deck-hero-question', title: 'The request',
    text: 'What the owner asks about the deck, with the cards in focus. You answer with cuts, cards to add and why. This one is a demo.',
  }, {
    target: '.help-zones-bar', title: 'Suggest cuts',
    text: mobile ? 'Long-press a card in the deck below, then Suggest cut: it goes in Cuts.'
      : 'Drag cards from the deck below into Cuts, or use Suggest cut in the card menu (right-click or Shift+F10).',
    play: async (g) => {
      if (mobile) {
        await g.menu(rowSel('r9'), { title: 'Rampant Growth', items: [[IconEye, 'View card'], [IconMinus, 'Suggest cut']] }, { text: 'Long press', hold: true });
        g.hideMenu();
        g.api.cut(C.rampantGrowth);
        g.spot('.help-zones-bar');
        await g.move('.help-zone.cut');
        await g.wait(1200);
      } else {
        await g.drag(rowSel('r9'), '.help-zone.cut', { ghost: clone(g, 'r9'), over: g.api.over, effect: () => g.api.cut(C.rampantGrowth) });
      }
    },
  }, {
    target: '.help-zone.add', side: 'left', title: 'Suggest cards',
    text: 'Search a card by name and pick it: it goes in Suggestions. Up to 10 cards in each zone.',
    play: async (g) => {
      await g.type('.help-zone.add input', 'Rhys', g.api.query);
      await g.wait(500);
      g.say(mobile ? 'Tap' : 'Enter');
      await g.wait(600);
      g.api.query('');
      g.api.suggest(C.rhysticStudy);
      await g.wait(1000);
    },
  }, {
    target: '.help-why', title: 'Explain and send',
    text: 'Say why, if you like, then send. You can change or delete your suggestion later; the owner applies it to the deck.',
    play: async (g) => {
      g.api.cut(C.rampantGrowth);
      await g.type('.help-why textarea', 'Explore draws a card too.', g.api.why);
      await g.move('.help-why-actions .btn-generate');
      g.say('Send');
      await g.wait(1200);
    },
  }];
}

function listSteps(tab, mobile) {
  const tap = mobile ? 'Tap' : 'Click';
  const tabsStep = {
    target: '.decks-tabs, .list-band', title: { mine: 'Your decks', community: 'Community', dilemmas: 'Dilemmas', help: 'Help requests' }[tab],
    text: {
      mine: 'These are demo decks, not yours. Four tabs share one search: Community, Dilemmas, Help and My decks.',
      community: 'The latest public decks of other players, here with demo decks.',
      dilemmas: 'Other players ask which card to play, and you vote. These are demo dilemmas.',
      help: 'Open help requests from public decks: owners ask for cuts, upgrades, mana base. These are demo requests.',
    }[tab],
  };
  if (tab === 'dilemmas') {
    return [tabsStep, {
      target: '.decks-actions', title: 'Play',
      text: 'Play shows the dilemmas you have not answered, one after another: pick with ← → or 1 to 4, Enter for the next.',
      play: async (g) => { await g.move('.decks-actions .btn-add'); g.say('Play'); await g.wait(1200); },
    }, {
      target: '.dilemma-list', title: 'Open a dilemma',
      text: 'Each tile shows the cards, the votes so far and New on the latest ones. Open one to answer.',
      play: async (g) => {
        await g.click('.dilemma-list li:first-child .dilemma-tile', tap, () => g.api.open('tut-d1'));
        g.spot('.dilemma-view');
        await g.wait(1400);
      },
    }, {
      target: '.dilemma-view', open: 'tut-d1', title: 'Vote',
      text: 'Choose the card you would play, change it if you like, then confirm: you see how the others chose, and you can say why.',
      play: async (g) => {
        await g.click('.dilemma-card:first-child', tap, () => g.api.pick(0));
        await g.wait(500);
        await g.click('.tut-confirm', tap, () => g.api.vote());
        await g.wait(1600);
      },
    }];
  }
  if (tab === 'help') {
    return [tabsStep, {
      target: '.help-list li:first-child', title: 'Yours first',
      text: 'Your requests come first, marked Yours, with the new suggestions: they open your deck, where you read and apply them.',
    }, {
      target: '.help-list li:nth-child(2)', title: 'Help someone',
      text: 'Open a request to suggest cuts and cards for that deck. Search and the format menu narrow the list.',
      play: (g) => g.click('.help-list li:nth-child(2) .help-card', tap),
    }];
  }
  const search = [{
    target: '.decks-search', title: 'Search',
    text: 'Search by name or tag: the list narrows while you type.',
    play: async (g) => {
      await g.type('.decks-search input', tab === 'mine' ? 'grave' : 'mob', g.api.query);
      g.spot('.decks-root');
      await g.wait(1500);
    },
  }, {
    target: '.decks-search', title: 'Filters',
    text: 'Filters narrow by format, colors and a card the deck must contain. The number on the button says how many are on.',
    play: async (g) => {
      await g.click('.decks-filter-btn', tap, () => g.api.filters(true));
      g.spot('.decks-filters');
      await g.wait(1500);
    },
  }];
  if (tab === 'community') {
    return [tabsStep, ...search, {
      target: '.deck-grid', title: 'Open a deck',
      text: `Each tile shows format, likes, colors and author. ${tap} it to open the deck, like it or copy it to your decks.`,
      play: (g) => g.click(tile('tut-c1'), tap),
    }, {
      target: '.deck-grid li:first-child', title: 'Share yours',
      text: 'To share one of your decks: Share in Community in its menu, or the globe in the deck page.',
    }];
  }
  return [tabsStep, ...search, {
    target: '.deck-grid', title: 'Open a deck',
    text: `${tap} a deck to open it. The wrench marks an open help request, the icon on the corner exports the list.`,
    play: (g) => g.click(tile('tut-deck'), tap),
  }, mobile ? {
    target: '.deck-grid', title: 'Deck options and folders',
    text: 'Long-press a deck: rename, share in Community, duplicate, move to a folder, export, delete.',
    play: (g) => g.menu(tile('tut-krenko'), DECK_MENU('Goblin Rush'), { text: 'Long press', hold: true }),
  } : {
    target: '.deck-grid', title: 'Folders',
    text: 'Drag a deck onto another to make a folder, or onto a folder to put it in. Click the folder name to rename it.',
    play: (g) => g.drag(tile('tut-atraxa'), tile('tut-krenko'), {
      ghost: Object.assign(document.createElement('img'), { src: C.atraxa.art, className: 'tut-card-img tut-art' }),
      over: (on) => g.api.drop(on ? 'tut-krenko' : null), effect: () => g.api.folder('tut-atraxa', 'tut-krenko'),
    }),
  }, ...(mobile ? [] : [{
    target: '.deck-grid', title: 'Deck options',
    text: 'Right-click a deck, or press Shift+F10: rename, share in Community, duplicate, move to a folder, export, delete.',
    play: (g) => g.menu(tile('tut-deck'), DECK_MENU('Tidal Bloom', true)),
  }]), {
    target: '.deck-add', title: 'New deck',
    text: 'Start a deck from scratch, or paste a list to import it.',
  }];
}

const profileSteps = () => [{
  target: '.profile-hero', title: 'Your profile',
  text: 'A demo profile. Click the background or the photo to change them, the pencil to set your nickname.',
  play: (g) => pointAt(g, [['.profile-banner', 'Background'], ['.profile-avatar', 'Photo'], ['.profile-icon-btn', 'Nickname']]),
}, {
  target: '.tut-profile-decks', title: 'Decks',
  text: 'Your latest decks. See all opens My decks.',
}, {
  target: '.dilemma-list', title: 'Dilemmas',
  text: 'The dilemmas of your public decks, with their votes.',
}];

const settingsSteps = () => [{
  target: '.settings-note', title: 'Settings',
  text: 'Your account, plus preferences saved on this device. This is a demo copy: nothing you see here changes.',
}, {
  target: '#tut-set-account', title: 'Account',
  text: 'Email and how you sign in. With email and password you change the password here.',
}, {
  target: '#tut-set-decks', title: 'Decks',
  text: 'Format and grouping of new decks, and the view and sort of every deck.',
}, {
  target: '#tut-set-lang', title: 'Card language',
  text: 'Card images in your language when Scryfall has them, in decks and in Print deck.',
}, {
  target: '#tut-set-backup', title: 'Backup',
  text: 'Download all your decks as one file. Restore adds the decks of a backup to the ones you have.',
}];

// Tour per rotta (stessa lettura di DecksView) e layout, costruiti una volta: i passi restano gli stessi oggetti.
const cache = {};
const bind = (Stage, extra) => function TourStage(props) { return <Stage {...props} {...extra} />; };
const MAKE = {
  mine: (m) => ({ label: 'My decks', Stage: bind(ListStage, { tab: 'mine' }), steps: listSteps('mine', m) }),
  community: (m) => ({ label: 'Community', Stage: bind(ListStage, { tab: 'community' }), steps: listSteps('community', m) }),
  dilemmas: (m) => ({ label: 'Dilemmas', Stage: bind(ListStage, { tab: 'dilemmas' }), steps: listSteps('dilemmas', m) }),
  help: (m) => ({ label: 'Help', Stage: bind(ListStage, { tab: 'help' }), steps: listSteps('help', m) }),
  editor: (m) => ({ label: 'Deck editor', Stage: bind(DeckStage, { mode: 'editor' }), steps: editorSteps(m) }),
  communityDeck: (m) => ({ label: 'Public deck', Stage: bind(DeckStage, { mode: 'community' }), steps: communitySteps(m) }),
  reply: (m) => ({ label: 'Help request', Stage: bind(DeckStage, { mode: 'help' }), steps: helpReplySteps(m) }),
  profile: () => ({ label: 'Profile', Stage: ProfileStage, steps: profileSteps() }),
  settings: () => ({ label: 'Settings', Stage: SettingsStage, steps: settingsSteps() }),
};
function tourFor(route, mobile) {
  const [, area, id, sub] = route.split('/');
  const kind = route === '/profile' ? 'profile' : route === '/settings' ? 'settings'
    : area === 'dilemmas' ? 'dilemmas' : area === 'help' ? (id && sub ? 'reply' : 'help')
      : area === 'community' ? (id ? 'communityDeck' : 'community') : area === 'decks' && id && id !== 'folder' ? 'editor' : 'mine';
  const key = `${kind}:${mobile}`;
  cache[key] ??= MAKE[kind](mobile);
  return cache[key];
}

export default function DeckTour({ route, mobile, onClose }) {
  return <Tutorial tour={tourFor(route, mobile)} mobile={mobile} onClose={onClose} />;
}
