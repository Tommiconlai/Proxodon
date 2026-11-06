import { useIsMobile } from '../hooks/useIsMobile';
import { IconLink } from '../components/icons';

// Link di un mazzo o di una squadra pubblici (path = la rotta, es. /community/:id), da mandare anche a chi non ha un
// account: dal telefono il foglio di condivisione del sistema, dal computer negli appunti.
export default function ShareLink({ path, title, notify }) {
  const share = useIsMobile() && !!navigator.share;
  const label = share ? 'Share link' : 'Copy link';
  const run = () => {
    const url = `${location.origin}${location.pathname}#${path}`;
    if (share) {
      navigator.share({ title, url }).catch((e) => { if (e.name !== 'AbortError') notify('Could not share the link.', 'error'); });
      return;
    }
    navigator.clipboard.writeText(url).then(() => notify('Link copied'), () => notify('Could not copy the link.', 'error'));
  };
  return (
    <button type="button" className="btn-secondary deck-icon-btn" onClick={run} aria-label={label} title={label}>
      <IconLink size={17} />
    </button>
  );
}
