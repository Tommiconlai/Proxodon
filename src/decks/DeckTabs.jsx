import { useEffect, useRef, useState } from 'react';

const TABS = [['deck', 'Deck'], ['stats', 'Stats'], ['dilemmas', 'Dilemmas']];

// Schede del mazzo (Deck, Stats, Dilemmas), [ ] su quella aperta come nella lista mazzi. Desktop (bar): al
// centro della barra in alto, tra nome e ricerca, già sticky. Telefono: sotto la testata, sticky in cima,
// col fondo della barra quando sono attaccate (.solid).
export function DeckTabs({ tab, onTab, bar }) {
  const ref = useRef(null);
  const [solid, setSolid] = useState(false);
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
