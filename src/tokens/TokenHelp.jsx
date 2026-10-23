import { HelpPopover } from '../decks/DeckHelp';
import { useIsMobile } from '../hooks/useIsMobile';

// "?" di Tokens, nell'header accanto all'avatar (telefono: nel menu della X): come funziona la pagina e, in fondo, il
// tutorial su un token demo.
export default function TokenHelp() {
  const touch = useIsMobile();
  return (
    <HelpPopover label="How Tokens works" title="How it works">
      {touch ? (
        <ol>
          <li><b>From a deck</b>. In your deck, the <b>Tokens</b> section under the maybeboard: <b>Make custom</b> brings a token here with its text, you add the art.</li>
          <li><b>Image</b>. Tap the empty art window, or <b>Upload</b> under the card.</li>
          <li><b>Move and zoom</b>. Drag the image with a finger, pinch to zoom, or use the <b>Zoom</b> slider further down.</li>
          <li><b>Write</b>. Tap the name, type line, rules text, power and toughness or credit right on the card. In the type line, type to search types and subtypes.</li>
          <li><b>Frame</b>. Frame, colors, bleed and overlay are under the buttons. The red line is the real edge of the card.</li>
          <li><b>Done</b>. <b>Add to Print</b>, the first button, or <b>Download</b> the PNG. The token is not saved: it stays until you close the tab.</li>
        </ol>
      ) : (
        <ol>
          <li><b>From a deck</b>. In your deck, the <b>Tokens</b> section under the maybeboard: <b>Make custom</b> brings a token here with its text, you add the art.</li>
          <li><b>Image</b>. Drop an image on the card, paste one with <b>Ctrl+V</b> (Copy image on any website), or click the empty art window.</li>
          <li><b>Move and zoom</b>. Drag the image, zoom with the wheel or the <b>Zoom</b> slider. Arrow keys and <b>+ −</b> work too.</li>
          <li><b>Write</b>. Click the name, type line, rules text, power and toughness or credit right on the card. In the type line, type to search types and subtypes, <b>Enter</b> adds one. <b>{'{T}'}</b> and <b>{'{R}'}</b> in the rules become symbols.</li>
          <li><b>Frame</b>. Pick a frame and its colors in the sidebar. <b>Bleed</b> is the same as in Print: the red line is the real edge of the card.</li>
          <li><b>Overlay</b>. A cut-out image over the frame and the text. <b>Sync</b> moves and zooms it with the image.</li>
          <li><b>Done</b>. <b>Add to Print</b> puts the token in the print queue, <b>Download</b> saves the PNG. The token is not saved: it stays until you close the tab.</li>
        </ol>
      )}
      <p className="help-controls">
        {touch
          ? <><b>Drag</b> move · <b>Pinch</b> zoom</>
          : <><b>Drag</b> move · <b>Wheel</b> zoom · <b>Ctrl+V</b> paste an image</>}
      </p>
    </HelpPopover>
  );
}
