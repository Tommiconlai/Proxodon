import { Component } from 'react';

// Confine d'errore dell'area mazzi: se il chunk non si carica (offline) o Firebase non parte,
// mostra un messaggio invece di smontare tutta l'app (la coda di stampa resta intatta).
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
          <p>Couldn’t load Decks. Check your connection, then retry.</p>
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }
}
