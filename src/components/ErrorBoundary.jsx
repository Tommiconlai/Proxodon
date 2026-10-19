import { Component } from 'react';
import { IconReplay } from './icons';

// Confine d'errore dell'area mazzi: se il chunk non si carica (offline) o Firebase non parte,
// mostra un messaggio invece di smontare tutta l'app (la coda di stampa resta intatta). Anche attorno a tutta
// l'app (main.jsx, message generico): un errore di render non lascia la pagina bianca.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // onError: chi lo usa può spegnere ciò che si è rotto (il tutorial); fallback: al posto del messaggio dei mazzi.
  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (!this.state.error) return this.props.children;
    if ('fallback' in this.props) return this.props.fallback;
    return (
      <div className="decks-root decks-center">
        <div className="signin-panel" role="alert">
          <p>{this.props.message ?? 'Couldn’t load Decks. Check your connection, then retry.'}</p>
          <button type="button" className="btn-secondary deck-icon-btn" onClick={() => window.location.reload()}
            aria-label="Retry" title="Retry"><IconReplay size={18} /></button>
        </div>
      </div>
    );
  }
}
