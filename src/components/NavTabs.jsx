// Tab principali dell'header desktop: link hash, quella dell'area aperta (decks, print, tokens) ha aria-current.
const TABS = [['decks', '#/decks', 'Decks'], ['print', '#/print', 'Print'], ['tokens', '#/tokens', 'Tokens']];
export default function NavTabs({ area }) {
  return (
    <nav className="nav-tabs" aria-label="Sections">
      {TABS.map(([k, href, label]) => <a key={k} href={href} className="nav-tab" aria-current={k === area ? 'page' : undefined}>{label}</a>)}
    </nav>
  );
}
