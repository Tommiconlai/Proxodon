import { useEffect, useRef, useState } from 'react';
import { useBracketSlide } from '../hooks/useBracketSlide';
import { boardCounts, countTarget, countOk, deckTags } from './deckModel';
import { IconArrowUp, IconSearch } from '../components/icons';

const TABS = [['deck', 'Deck'], ['stats', 'Stats'], ['dilemmas', 'Dilemmas'], ['help', 'Help']];

// Testo di una scheda tra le sue parentesi (visibili solo su quella aperta, scivolano con useBracketSlide).
export function TabLabel({ children }) {
  return <><span className="br l" aria-hidden="true">[</span>{children}<span className="br r" aria-hidden="true">]</span></>;
}

// Schede del mazzo da telefono (Deck, Stats, Dilemmas, Help), [ ] su quella aperta come nella lista mazzi: sotto la
// testata, sticky in cima, col fondo della barra quando sono attaccate (.solid). Da desktop: DeckBand.
export function DeckTabs({ tab, onTab }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);
  useBracketSlide(ref, TABS.findIndex(([t]) => t === tab));
  useEffect(() => {
    const el = ref.current;
    const box = el?.closest('.deck-scroll');
    if (!box) return undefined;
    const check = () => setSolid(el.getBoundingClientRect().top - box.getBoundingClientRect().top <= 0.5);
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, []);
  return (
    // Pulsanti con aria-current (come le schede della lista), non il pattern tablist: niente frecce da gestire.
    <nav ref={ref} className={`deck-tabs${solid ? ' solid' : ''}`} aria-label="Deck view">
      {TABS.map(([t, label]) => (
        <button key={t} type="button" aria-current={tab === t ? 'true' : undefined} className="decks-title decks-tab" onClick={() => onTab(t)}><TabLabel>{label}</TabLabel></button>
      ))}
    </nav>
  );
}

// Fascia delle schede da desktop (Figma "Proxodon" 47:108): la linea sfumata con l'incavo a sinistra (format =
// il formato) e al centro le schede a trapezio, larghe 168 a passi di 132.67 (si sovrappongono: la sinistra
// sopra la destra, quella aperta sopra tutte; aperta = piena del gradiente, le altre scure col bordo al 50%).
// Ogni scheda ha il suo gradiente spostato del suo passo: i colori sono quelli del design (il gradiente della
// pagina preso nel punto della scheda) a ogni larghezza. Sticky sotto la barra del nome, col fondo quando è
// attaccata (.solid). Pulsanti ritagliati a trapezio: dove due schede si toccano vince quella che si vede.
const SLOT = 132.667;
const TAB_PATH = 'M35.0711 12.9289L10 38H178L152.929 12.9289C151.054 11.0536 148.51 10 145.858 10H42.1421C39.49 10 36.9464 11.0536 35.0711 12.9289Z';
const STOPS = [['0.1', '#FF2E96'], ['0.5', '#AB61ED'], ['0.9', '#00E5FF']];
let bands = 0; // id dei gradienti per istanza: con il tutorial aperto le fasce sono due, e un id ripetuto
// punterebbe ai defs dell'altra (nascosta = forme senza colore)
export function DeckBand({ tab, onTab, format }) {
  const [k] = useState(() => `deck-tab${++bands}`);
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
  const open = TABS.findIndex(([t]) => t === tab);
  const order = [3, 2, 1, 0].filter((i) => i !== open).concat(open);
  return (
    <div ref={ref} className={`deck-band${solid ? ' solid' : ''}`}>
      {format && <div className="deck-band-format">{format}</div>}
      <nav className="deck-tabs in-band" aria-label="Deck view">
        {TABS.map(([t, label], i) => (
          <button key={t} type="button" aria-current={tab === t ? 'true' : undefined} className="decks-tab"
            style={{ left: i * SLOT, zIndex: i === open ? 5 : 4 - i }} onClick={() => onTab(t)}>{label}</button>
        ))}
        {/* Forme sotto i pulsanti (z-index nel CSS); dopo nel DOM, così .decks-tab:nth-child(n) resta la scheda n. */}
        <svg className="deck-tab-shapes" width="586" height="48" viewBox="0 0 586 48" fill="none" aria-hidden="true" focusable="false">
          <defs>
            {TABS.map((_, i) => (
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
    </div>
  );
}

// Nome del mazzo da desktop (barra in alto): nome e cuore sulla stessa riga, sotto "by" l'autore (se c'è).
export function DeckTitle({ children, by }) {
  return (
    <div className="deck-title">
      <div className="deck-title-row">{children}</div>
      {by && <span className="deck-by">by {by}</span>}
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
// almeno 60), ambra se no. plain = senza chip, in fila (dentro DeckBottomBar).
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

// Telefono: barra in basso, scura all'80%, ferma mentre il mazzo scorre (scrollRef = .deck-scroll): a
// sinistra il conteggio senza chip (showCount, scheda Deck), a destra Back to top (dopo 600 px di
// scorrimento) e la lente (onSearch, solo nell'editor: apre la ricerca carte, al posto del vecchio +).
export function DeckBottomBar({ deck, showCount, scrollRef, onSearch }) {
  const [far, setFar] = useState(false);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return undefined;
    const check = () => setFar(box.scrollTop > 600);
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, [scrollRef]);
  return (
    <div className="deck-bottom-bar">
      {showCount ? <DeckCount deck={deck} plain /> : <span />}
      <span className="deck-bottom-actions">
        {far && (
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top" title="Back to top"><IconArrowUp size={18} /></button>
        )}
        {onSearch && <button type="button" className="btn-add deck-icon-btn" onClick={onSearch} aria-label="Search cards" title="Search cards"><IconSearch size={18} /></button>}
      </span>
    </div>
  );
}
