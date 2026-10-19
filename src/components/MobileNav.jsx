import { useEffect, useRef, useState } from 'react';
import { Wordmark } from './icons';
import { useBackClose } from '../hooks/useBackClose';
import { navigate } from '../hooks/useHashRoute';
import { navItems } from './navItems';

// Posizioni sull'arco sopra la X (Figma 57:116: quattro voci da 167° a 13°, raggio 58); con più voci il raggio
// cresce, così tra due tondi da 32 restano almeno 6 px.
function arc(n) {
  const r = n <= 4 ? 58 : n === 5 ? 66 : 76;
  return Array.from({ length: n }, (_, i) => {
    const a = ((167 - (154 * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    return [Math.round(r * Math.cos(a)), Math.round(-r * Math.sin(a))];
  });
}

// Il menu da telefono e tablet: la X del logo sempre in basso al centro; premuta fa il flip delle V (quello
// dell'hover del logo) e apre l'arco delle voci, con il ? a sinistra e il profilo a destra (children); premuta di
// nuovo, l'inverso. Chiuso, voci e angoli sono inert. Anche nel tutorial (copia con lo stato suo).
export function NavMenu({ items, current, onItem, open, onToggle, children }) {
  const pos = arc(items.length);
  return (
    <nav className={`mnav${open ? ' open' : ''}`} aria-label="Main">
      <ul className="mnav-items" inert={!open}>
        {items.map((item, i) => {
          const [key, label, href, Icon] = item;
          return (
            <li key={key}>
              <a href={href} className="mnav-item" aria-label={label} title={label} aria-current={key === current ? 'page' : undefined}
                onClick={(e) => onItem(href, e)} style={{ '--x': `${pos[i][0]}px`, '--y': `${pos[i][1]}px`, '--i': i }}><Icon /></a>
            </li>
          );
        })}
      </ul>
      <div className="mnav-extras" inert={!open}>{children}</div>
      <button type="button" className="mnav-x" aria-expanded={open} aria-label={open ? 'Close menu' : 'Menu'} title={open ? 'Close menu' : 'Menu'} onClick={onToggle}>
        <Wordmark height={26} mark className="wordmark" aria-hidden="true" />
      </button>
    </nav>
  );
}

// Nell'app (MobileLayout): le pagine, accesa quella della rotta. Si chiude scegliendo una voce, con la X, Esc, il back
// del sistema o toccando fuori (non nel menu dell'avatar, che è un portale).
export default function MobileNav({ route, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useBackClose(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.card-menu')) setOpen(false); };
    // Esc chiude il livello in cima: prima il menu dell'avatar, il pannello del ? o un dialogo, poi il menu.
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.card-menu, .help.open, .modal-overlay')) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const { items, current } = navItems(route);
  // La pagina nuova prende il posto della voce del menu in cronologia (navigate). Col default del link la chiusura del
  // menu farebbe history.back() dopo il cambio di hash, e si tornerebbe alla pagina di prima.
  const onItem = (href, e) => {
    e.preventDefault();
    setOpen(false);
    if (href !== window.location.hash) navigate(href.slice(1)); // la pagina aperta: si chiude e basta
  };
  return (
    <div className="mnav-wrap" ref={ref}>
      <NavMenu items={items} current={current} onItem={onItem} open={open} onToggle={() => setOpen((o) => !o)}>{children}</NavMenu>
    </div>
  );
}
