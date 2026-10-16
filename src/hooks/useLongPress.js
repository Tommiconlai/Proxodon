import { useRef } from 'react';

// Punto del menu contestuale: dove si è cliccato; Shift+F10 / tasto menu arrivano con 0,0, allora
// 24 px dentro l'elemento.
export const menuPoint = (e) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + 24, y: r.top + 24 };
};

// Pressione lunga (touch/penna, 500 ms) = menu contestuale, come le carte in stampa. Annullata se
// il dito si sposta >10 px (scroll) o si alza prima. `consumed()` va chiamato nel click: dice se
// quel click chiude una pressione lunga (allora non deve anche selezionare/aprire).
export function useLongPress() {
  const press = useRef(null);
  const swallow = useRef(false);
  const cancel = () => { clearTimeout(press.current?.timer); press.current = null; };
  const bind = (onLong) => ({
    onPointerDown: (e) => {
      swallow.current = false; // nuovo gesto
      if (e.pointerType === 'mouse') return;
      const { clientX: x, clientY: y } = e;
      cancel();
      press.current = {
        x, y,
        timer: setTimeout(() => {
          press.current = null;
          swallow.current = true;
          navigator.vibrate?.(10);
          onLong(x, y);
        }, 500),
      };
    },
    onPointerMove: (e) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  });
  const consumed = () => {
    if (!swallow.current) return false;
    swallow.current = false;
    return true;
  };
  return { bind, consumed };
}
