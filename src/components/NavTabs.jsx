// Tab principali (header desktop e mobile): link hash, quella attiva ha aria-current.
export default function NavTabs({ decks }) {
  return (
    <nav className="nav-tabs" aria-label="Sections">
      <a href="#/decks" className="nav-tab" aria-current={decks ? 'page' : undefined}>Decks</a>
      <a href="#/print" className="nav-tab" aria-current={decks ? undefined : 'page'}>Print</a>
    </nav>
  );
}
