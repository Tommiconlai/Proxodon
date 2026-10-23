// Simboli di mana dalle SVG ufficiali di Scryfall: {2/W} → 2W.svg, {W/U/P} → WUP.svg. Qui e non in Mana.jsx perché li
// usano anche i token (tokenModel, provato con node, che il JSX non lo legge).
export const symUrl = (s) => `https://svgs.scryfall.io/card-symbols/${s.replace(/\//g, '')}.svg`;

// Solo simboli plausibili ({2}, {W/U/P}, {1000000}, {½}…): il testo è libero e diventerebbe il percorso dell'immagine
// (richieste a caso verso Scryfall dall'IP di chi guarda).
export const SYMBOL = /^\{[0-9A-Z½∞]{1,7}(\/[0-9A-Z]{1,2}){0,2}\}$/;
