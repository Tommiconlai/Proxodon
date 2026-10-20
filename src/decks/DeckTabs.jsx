import { useCallback, useEffect, useRef, useState } from 'react';
import CardMenu from '../components/CardMenu';
import { boardCounts, countTarget, countOk, deckTags, BRACKETS, gameChangers, autoBracket, deckBracket } from './deckModel';
import { IconArrowUp, IconDeckFilter } from '../components/icons';

const TABS = [['deck', 'Deck'], ['stats', 'Stats'], ['dilemmas', 'Dilemmas'], ['help', 'Help']];

// Schede a trapezio da desktop (Figma "Proxodon" 47:108 e 52:275): larghe 168 a passi di 132.67, si
// sovrappongono e più una scheda è vicina a quella aperta più sta sopra (aperta = piena del gradiente, in cima;
// le altre scure col bordo al 50%). Ogni scheda ha il suo gradiente spostato del suo passo: i colori sono quelli
// del design (il gradiente della pagina preso nel punto della scheda) a ogni larghezza. Pulsanti (o link, href)
// ritagliati a trapezio: dove due schede si toccano vince quella che si vede. items = [[chiave, etichetta, href?]].
const SLOT = 132.667;
const TAB_PATH = 'M35.0711 12.9289L10 38H178L152.929 12.9289C151.054 11.0536 148.51 10 145.858 10H42.1421C39.49 10 36.9464 11.0536 35.0711 12.9289Z';
const STOPS = [['0.1', '#FF2E96'], ['0.5', '#AB61ED'], ['0.9', '#00E5FF']];
let strips = 0; // id dei gradienti per istanza: con il tutorial aperto le fasce sono due, e un id ripetuto
// punterebbe ai defs dell'altra (nascosta = forme senza colore)
function TabStrip({ items, current, onTab, label }) {
  const [k] = useState(() => `tab-strip${++strips}`);
  const open = items.findIndex(([t]) => t === current);
  const near = (i) => items.length - Math.abs(i - open); // più vicina alla scheda aperta = più in alto
  const order = items.map((_, i) => i).sort((a, b) => near(a) - near(b));
  return (
    <nav className="deck-tabs in-band" aria-label={label}>
      {items.map(([t, text, href], i) => {
        const props = { className: 'decks-tab', style: { left: i * SLOT, zIndex: near(i) } };
        return href
          ? <a key={t} href={href} aria-current={t === current ? 'page' : undefined} {...props}>{text}</a>
          : <button key={t} type="button" aria-current={t === current ? 'true' : undefined} onClick={() => onTab(t)} {...props}>{text}</button>;
      })}
      {/* Forme sotto i pulsanti (z-index nel CSS); dopo nel DOM, così .decks-tab:nth-child(n) resta la scheda n. */}
      <svg className="deck-tab-shapes" width={items.length * SLOT + 55.33} height="48" fill="none" aria-hidden="true" focusable="false">
        <defs>
          {items.map((_, i) => (
            <linearGradient key={i} id={`${k}-g${i}`} gradientUnits="userSpaceOnUse" x1={-667.5 - i * SLOT} y1="11.6471" x2={1249.5 - i * SLOT} y2="11.6471">
              {STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
            </linearGradient>
          ))}
          <filter id={`${k}-shadow`} x="0" y="0" width="188" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset />
            <feGaussianBlur stdDeviation="5" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.75 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          </filter>
          <mask id={`${k}-inner`} fill="white"><path d={TAB_PATH} /></mask>
        </defs>
        {order.map((i) => (
          <g key={i} transform={`translate(${i * SLOT} 0)`} filter={`url(#${k}-shadow)`}>
            {i === open ? <path d={TAB_PATH} fill={`url(#${k}-g${i})`} /> : (
              <>
                <path d={TAB_PATH} fill="#0B0B14" />
                <path d={TAB_PATH} stroke={`url(#${k}-g${i})`} strokeWidth="4" strokeOpacity="0.5" mask={`url(#${k}-inner)`} />
              </>
            )}
          </g>
        ))}
      </svg>
    </nav>
  );
}

// Fascia del mazzo da desktop (Figma 47:108): la linea sfumata con l'incavo a sinistra (format = il formato) e
// al centro le schede Deck / Stats / Dilemmas / Help. Sticky sotto la barra del nome, col fondo quando è
// attaccata (.solid).
export function DeckBand({ tab, onTab, format }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const box = el?.closest('.deck-scroll');
    if (!box) return undefined;
    const stick = parseFloat(getComputedStyle(el).top) + 0.5; // top dello sticky (62 px), letto una volta
    const check = () => setSolid(el.getBoundingClientRect().top - box.getBoundingClientRect().top <= stick);
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, []);
  return (
    <div ref={ref} className={`deck-band${solid ? ' solid' : ''}`}>
      {format && <div className="deck-band-format">{format}</div>}
      <TabStrip items={TABS} current={tab} onTab={onTab} label="Deck view" />
    </div>
  );
}

// Fascia delle liste da desktop (Figma 52:275): Community / Dilemmas / Help / My decks come link, sulla linea
// sfumata che a destra sale con uno scalino verso il bordo.
export function ListBand({ items, current }) {
  return <div className="list-band"><TabStrip items={items} current={current} label="Decks" /></div>;
}

// Commander bracket accanto al nome (solo mazzi Commander). Con update (mazzo proprio) la pillola apre un menu con
// le stesse pillole: Bracket 1-5 e None (spento). Scegliere il bracket calcolato dai Game Changer torna all'automatico
// (segue le carte), gli altri restano fissi. Spento resta qui sbiadito, per riaccenderlo. Senza update (mazzo altrui)
// solo la pillola, niente se è spento.
export function DeckBracket({ deck, update }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const closeMenu = useCallback(() => setMenu(null), []);
  if (deck.format !== 'commander') return null;
  const b = deckBracket(deck);
  const n = gameChangers(deck);
  const auto = autoBracket(deck);
  const how = deck.bracket == null ? `auto, ${n} Game Changer${n === 1 ? '' : 's'}` : 'set by hand';
  const title = b ? `Bracket ${b}: ${BRACKETS[b - 1]} (${how})` : 'No bracket';
  if (!update) return b && <span className="deck-bracket" title={title}>Bracket {b}</span>;
  const set = (v) => update((d) => ({ ...d, bracket: v }));
  const items = [
    ...BRACKETS.map((name, i) => ({ key: i + 1, label: `Bracket ${i + 1}`, checked: b === i + 1, run: () => set(i + 1 === auto ? undefined : i + 1) })),
    { key: 'none', label: 'None', checked: !b, run: () => set(0) },
  ];
  return (
    <>
      <button type="button" className={`deck-bracket${b ? '' : ' off'}`} aria-haspopup="menu" aria-expanded={!!menu}
        aria-label={`Commander bracket: ${title}`} title={`${title}. Click to change`}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 6 }); }}>
        {b ? `Bracket ${b}` : 'No bracket'}
      </button>
      {menu && <CardMenu className="bracket-menu" x={menu.x} y={menu.y} title="Commander bracket" items={items} onClose={closeMenu} />}
    </>
  );
}

// Nome del mazzo da desktop (barra in alto): nome e cuore sulla stessa riga, sotto "by" l'autore (se c'è).
// byHref = la pagina pubblica dell'autore (mazzo altrui): il nome diventa un link.
export function DeckTitle({ children, by, byHref }) {
  return (
    <div className="deck-title">
      <div className="deck-title-row">{children}</div>
      {by && <span className="deck-by">by {byHref ? <a className="deck-by-link" href={byHref}>{by}</a> : by}</span>}
    </div>
  );
}

// Tag del mazzo nella testata (editor e Community), niente se non ce ne sono.
export function DeckTagList({ deck }) {
  const tags = deckTags(deck);
  return tags.length > 0 && (
    <ul className="deck-tags" aria-label="Tags">{tags.map((t) => <li key={t} className="deck-tag">{t}</li>)}</ul>
  );
}

// Conteggio carte, fisso in basso a sinistra della vista mazzo (scheda Deck, editor e Community): un chip
// "N main" (comandanti compresi) e sotto "N side" nei formati che usano la sideboard (tutti tranne
// Commander); il numero del main è ciano se va bene per il formato (Commander esattamente 100, gli altri
// almeno 60), ambra se no. plain = senza chip, in fila (dentro DeckTopBar).
export function DeckCount({ deck, plain }) {
  const c = boardCounts(deck);
  const side = deck.format === 'commander' ? 0 : c.side;
  const target = countTarget(deck.format);
  const detail = `Main deck ${c.main}${target ? (deck.format === 'commander' ? ` of ${target}` : ` (at least ${target})`) : ''}${side ? `, sideboard ${side}` : ''}`;
  return (
    <div className={`deck-count${plain ? ' plain' : ''}`} role="status" title={detail} aria-label={detail}>
      <span className={`deck-count-chip${countOk(deck.format, c.main) ? '' : ' warn'}`}><span className="n">{c.main}</span> main</span>
      {deck.format !== 'commander' && <span className="deck-count-chip"><span className="n">{side}</span> side</span>}
    </div>
  );
}

// Telefono e tablet: barra ferma in cima sotto la testata (sticky, col fondo quando è attaccata, .solid): la ricerca
// delle carte sempre aperta e larga quanto la barra (search, solo nell'editor), sotto il conteggio senza chip a sinistra
// e a destra Back to top (dopo 600 px di scorrimento, scrollRef = .deck-scroll) e il tasto filtri, come nelle liste:
// apre Advanced search (onFilters, filtersOpen). Niente schede: carte, Stats, Dilemmas e Help stanno in fila nella pagina.
export function DeckTopBar({ deck, scrollRef, search, onFilters, filtersOpen }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);
  const [far, setFar] = useState(false);
  useEffect(() => {
    const box = scrollRef.current;
    const el = ref.current;
    if (!box || !el) return undefined;
    const check = () => {
      setFar(box.scrollTop > 600);
      setSolid(el.getBoundingClientRect().top - box.getBoundingClientRect().top <= 0.5);
    };
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, [scrollRef]);
  return (
    <div ref={ref} className={`deck-top-bar${solid ? ' solid' : ''}`}>
      {search && <div className="deck-top-search">{search}</div>}
      <DeckCount deck={deck} plain />
      {far && (
        <button type="button" className="btn-secondary deck-icon-btn" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top" title="Back to top"><IconArrowUp size={18} /></button>
      )}
      {onFilters && (
        <button type="button" className={`decks-filter-btn${filtersOpen ? ' on' : ''}`} aria-expanded={filtersOpen} onClick={onFilters}
          aria-label="Advanced search" title="Advanced search"><IconDeckFilter /></button>
      )}
    </div>
  );
}
