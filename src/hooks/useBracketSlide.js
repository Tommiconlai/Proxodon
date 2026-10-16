import { useLayoutEffect, useRef } from 'react';

const STEP = 240; // ms per parentesi

// Parentesi [ ] delle schede (.decks-tab con due .br) che scivolano verso la scheda nuova: prima quella dal
// lato di arrivo (] andando a destra, [ andando a sinistra), poi l'altra. FLIP: le parentesi della nuova
// scheda partono traslate dove stavano quelle vecchie e tornano a 0. A metà animazione si misura la
// posizione visibile, quindi click ravvicinati ripartono da dove sono.
export function useBracketSlide(navRef, active) {
  const prev = useRef(active);
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = active;
    const tabs = navRef.current?.querySelectorAll('.decks-tab');
    if (from === active || !tabs?.[from] || !tabs[active]) return;
    const [oldL, oldR] = tabs[from].querySelectorAll('.br');
    const [newL, newR] = tabs[active].querySelectorAll('.br');
    const order = active > from ? [[newR, oldR], [newL, oldL]] : [[newL, oldL], [newR, oldR]];
    order.forEach(([el, old], i) => {
      const dx = old.getBoundingClientRect().left - el.getBoundingClientRect().left;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
      el.getBoundingClientRect(); // applica la posizione di partenza prima della transizione
      el.style.transition = `transform ${STEP}ms cubic-bezier(0.4, 0, 0.2, 1) ${i * STEP}ms`;
      el.style.transform = '';
    });
  }, [navRef, active]);
}
