import { symUrl, SYMBOL } from '../utils/manaSymbols';

// Costo di mana: al massimo 16 simboli, solo quelli plausibili (SYMBOL): il costo di un mazzo altrui è testo libero.
export function ManaCost({ cost }) {
  const toks = ((cost || '').match(/\{[^}]+\}/g) || []).filter((t) => SYMBOL.test(t)).slice(0, 16);
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
