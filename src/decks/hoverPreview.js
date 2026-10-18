import { cachedImg } from './cardLang';

// Larghezza dell'anteprima al passaggio del mouse (Settings › preview).
export const PREVIEW = { off: 0, small: 240, medium: 320, large: 400 };

// Anteprima accanto a un elemento (rc = il suo rettangolo), a destra se c'è spazio, sennò a sinistra. Le carte a
// due facce mostrano fronte a sinistra e retro a destra (strette se non stanno nella finestra). La disegna
// HoverCard (DeckSections): nel mazzo e nella decklist dei dilemmi.
export function previewAt(rc, card, previewW) {
  const back = card.back && cachedImg(card, 1);
  const w = back ? Math.min(previewW, Math.floor((window.innerWidth - 40) / 2)) : previewW;
  const total = back ? w * 2 + 8 : w;
  const ph = Math.round((w * 680) / 488);
  const x = rc.right + 12 + total <= window.innerWidth ? rc.right + 12 : Math.max(8, rc.left - total - 12);
  const y = Math.min(Math.max(8, rc.top + rc.height / 2 - ph / 2), window.innerHeight - ph - 8);
  return { img: cachedImg(card), back, w, x, y };
}
