import { useEffect, useRef, useState } from 'react';
import { useBracketSlide } from '../hooks/useBracketSlide';
import { boardCounts, countTarget, countOk } from './deckModel';
import { IconArrowUp, IconSearch } from '../components/icons';

const TABS = [['deck', 'Deck'], ['stats', 'Stats'], ['dilemmas', 'Dilemmas']];

// Testo di una scheda tra le sue parentesi (visibili solo su quella aperta, scivolano con useBracketSlide).
export function TabLabel({ children }) {
  return <><span className="br l" aria-hidden="true">[</span>{children}<span className="br r" aria-hidden="true">]</span></>;
}

// Schede del mazzo (Deck, Stats, Dilemmas), [ ] su quella aperta come nella lista mazzi. Desktop (bar): al
// centro della barra in alto, tra nome e ricerca, già sticky. Telefono: sotto la testata, sticky in cima,
// col fondo della barra quando sono attaccate (.solid).
export function DeckTabs({ tab, onTab, bar }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);
  useBracketSlide(ref, TABS.findIndex(([t]) => t === tab));
  useEffect(() => {
    const el = ref.current;
    const box = !bar && el?.closest('.deck-scroll');
    if (!box) return undefined;
    const check = () => setSolid(el.getBoundingClientRect().top - box.getBoundingClientRect().top <= 0.5);
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, [bar]);
  return (
    // Pulsanti con aria-current (come le schede della lista), non il pattern tablist: niente frecce da gestire.
    <nav ref={ref} className={`deck-tabs${bar ? ' in-bar' : ''}${solid ? ' solid' : ''}`} aria-label="Deck view">
      {TABS.map(([t, label]) => (
        <button key={t} type="button" aria-current={tab === t ? 'true' : undefined} className="decks-title decks-tab" onClick={() => onTab(t)}><TabLabel>{label}</TabLabel></button>
      ))}
    </nav>
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
