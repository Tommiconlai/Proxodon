import { IconPlay } from '../components/icons';
import { startTutorial } from './control';

// Riga in fondo ai popover ? (stampa, mazzi e Tokens): il tutorial della pagina aperta, su dati demo. onStart chiude il popover.
export default function HelpTour({ onStart }) {
  return (
    <div className="help-tour">
      <span>Guided tour of this page, on demo cards. Yours stay untouched.</span>
      <button type="button" className="btn-add deck-icon-btn" aria-label="Start the tutorial" title="Start the tutorial"
        onClick={() => { onStart?.(); startTutorial(); }}><IconPlay size={16} /></button>
    </div>
  );
}
