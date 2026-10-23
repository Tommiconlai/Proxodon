// Il token in lavorazione resta finché la scheda è aperta (andando su Print e tornando c'è ancora); niente salvataggio.
// Qui e non in TokensPage perché ci scrivono anche i mazzi (Make custom, sezione Tokens): la pagina lo legge quando si apre.
export const P0 = { x: 0, y: 0, zoom: 1 };
export const EMPTY = {
  template: 'classic', colors: [], name: '', types: [], subtypes: [], rules: '', power: '', toughness: '', credit: '',
  pos: P0, overlayPos: P0, sync: true, target: 'overlay',
};
export const draft = { state: EMPTY, art: null, overlay: null };

// C'è qualcosa da perdere: un testo, un tipo, l'immagine o l'overlay (cornice e colori da soli no).
export const draftInUse = () => !!(draft.art || draft.overlay || draft.state.types.length || draft.state.subtypes.length
  || ['name', 'rules', 'power', 'toughness', 'credit'].some((k) => draft.state[k].trim()));

// Make custom: il token importato (i suoi campi, tokenFromScryfall) diventa quello in lavorazione, senza immagini.
export const startDraft = (fields) => Object.assign(draft, { state: { ...EMPTY, ...fields }, art: null, overlay: null });
