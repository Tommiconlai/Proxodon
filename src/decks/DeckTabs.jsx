import { useEffect, useRef, useState } from 'react';

const TABS = [['deck', 'Deck'], ['stats', 'Stats'], ['dilemmas', 'Dilemmas']];

// Schede del mazzo (Deck, Stats, Dilemmas), centrate in fondo alla testata e [ ] su quella aperta,
// come nella lista mazzi. Sticky a `top` (sotto la barra del nome nell'editor da desktop, 0 altrove):
// restano sempre a portata; quando sono attaccate prendono il fondo della barra (.solid).
export function DeckTabs({ tab, onTab, top = 0 }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const box = el?.closest('.deck-scroll');
    if (!box) return undefined;
    const check = () => setSolid(el.getBoundingClientRect().top - box.getBoundingClientRect().top <= top + 0.5);
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, [top]);
  return (
    // Pulsanti con aria-current (come le schede della lista), non il pattern tablist: niente frecce da gestire.
    <nav ref={ref} className={`deck-tabs${solid ? ' solid' : ''}`} style={{ top }} aria-label="Deck view">
      {TABS.map(([t, label]) => (
        <button key={t} type="button" aria-current={tab === t ? 'true' : undefined} className="decks-title decks-tab" onClick={() => onTab(t)}>{label}</button>
      ))}
    </nav>
  );
}

// Scheda Dilemmas: vuota per ora, il contenuto arriverà.
export function DeckDilemmas() {
  return (
    <div className="deck-sections">
      <section className="deck-dilemmas" aria-labelledby="deck-dilemmas-head">
        <h3 className="deck-analysis-head" id="deck-dilemmas-head">Dilemmas</h3>
        <p className="field-hint">Nothing here yet.</p>
      </section>
    </div>
  );
}
