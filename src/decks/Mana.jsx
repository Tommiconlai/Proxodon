// Simboli di mana dalle SVG ufficiali di Scryfall: {2/W} → 2W.svg, {W/U/P} → WUP.svg.
const symUrl = (s) => `https://svgs.scryfall.io/card-symbols/${s.replace(/\//g, '')}.svg`;

export function ManaCost({ cost }) {
  const toks = (cost || '').match(/\{[^}]+\}/g) || [];
  if (!toks.length) return null;
  return (
    <span className="mana" role="img" aria-label={cost}>
      {toks.map((t, i) => <img key={i} src={symUrl(t.slice(1, -1))} alt="" width="14" height="14" loading="lazy" />)}
    </span>
  );
}

// Identità di colore (WUBRG); vuota = incolore.
export function ManaPips({ colors }) {
  const list = colors.length ? colors : ['C'];
  return (
    <span className="mana" role="img" aria-label={`Color identity: ${colors.join('') || 'colorless'}`}>
      {list.map((c) => <img key={c} src={symUrl(c)} alt="" width="16" height="16" loading="lazy" />)}
    </span>
  );
}
