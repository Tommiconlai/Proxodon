import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import HelpTour from '../tutorial/HelpTour';

// "?" con il suo popover, nell'header accanto all'avatar (mazzi e Tokens): come il ? della stampa, in fondo avvia il
// tutorial della pagina. label = nome del pulsante, title = titolo del popover. Click apre e chiude; click fuori o Esc chiude.
export function HelpPopover({ label, title, children }) {
  const touch = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className={`help${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="help-btn" aria-label={label} title={label} aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>?</button>
      <div className="help-tooltip" role="tooltip">
        {touch && <button type="button" className="help-tooltip-close" aria-label="Close help" title="Close help" onClick={() => setOpen(false)}>✕</button>}
        <strong>{title}</strong>
        {children}
        <HelpTour onStart={() => setOpen(false)} />
      </div>
    </div>
  );
}

// "?" delle pagine mazzi: nell'editor (editor) spiega tasti e gesti che la pagina non mostra più.
export default function DeckHelp({ editor }) {
  const touch = useIsMobile();
  return (
    <HelpPopover label={editor ? 'How the deck editor works' : 'Help for this page'} title={editor ? 'How the deck editor works' : 'This page'}>
      {!editor ? null : touch ? (
        <ol>
          <li><b>Add cards</b>. Type a name in the search bar at the top, then tap a result. The filters button under it opens <b>Advanced search</b>.</li>
          <li><b>Select</b>. Tap a card to select or deselect it.</li>
          <li><b>Options</b>. Long-press a card, or the selection: change edition, split, set as commander, move to a board or a section, remove.</li>
          <li><b>Organize</b>. <b>Group</b>, <b>Sort</b> and <b>View</b> above the cards. <b>New section</b>, the last option of <b>Group by</b>, makes your own groups.</li>
          <li><b>Tokens</b>. Under the maybeboard, the tokens your cards create. <b>Make custom</b>, the card with the star, opens one in Tokens with its text written: you add the art.</li>
          <li><b>Cover</b>. Tap the art behind the deck name to pick another card.</li>
          <li><b>Bracket</b> (Commander). Worked out from the Game Changers: none = 2, 1 to 3 = 3, 4 or more = 4. Tap it to set it by hand or turn it off.</li>
          <li><b>More</b>. <b>Stats</b>, <b>Dilemmas</b> and <b>Help</b> follow the cards, further down.</li>
        </ol>
      ) : (
        <ol>
          <li><b>Add cards</b>. Type a name in the search bar and pick it with ↑↓. <b>Enter</b> adds 1, <b>Shift+Enter</b> 4, <b>Alt+Enter</b> goes to the sideboard (maybeboard in Commander). <b>Advanced search</b> has filters, and its <b>+</b> takes the same keys.</li>
          <li><b>Select</b>. Click a card to select or deselect it, <b>Shift+click</b> for a range, or drag on an empty spot to select an area. Click outside or press <b>Esc</b> to clear.</li>
          <li><b>Move</b>. Drag cards between main deck, sideboard, maybeboard and your sections, or onto the zones that appear bottom left while you drag. <b>Alt+drag</b> moves one copy.</li>
          <li><b>Options</b>. Right-click a card, or the selection: change edition, split, set as commander, move, remove. Hover a card for <b>+</b> and <b>−</b>.</li>
          <li><b>Organize</b>. <b>Group</b>, <b>Sort</b> and <b>View</b> above the cards. <b>New section</b> makes your own groups.</li>
          <li><b>Tokens</b>. Under the maybeboard, the tokens your cards create. <b>Make custom</b>, the card with the star, opens one in Tokens with its text written: you add the art.</li>
          <li><b>Cover</b>. Click the art behind the deck name to pick another card.</li>
          <li><b>Bracket</b> (Commander), next to the name. Worked out from the Game Changers: none = 2, 1 to 3 = 3, 4 or more = 4. Click it to set it by hand or turn it off.</li>
        </ol>
      )}
      {editor && <p className="help-controls">
        {touch
          ? <><b>Tap</b> select or deselect · <b>Long-press</b> options</>
          : <><b>Click</b> select · <b>Right-click</b> options · <b>Drag</b> move · <b>Alt+drag</b> one copy</>}
      </p>}
    </HelpPopover>
  );
}
