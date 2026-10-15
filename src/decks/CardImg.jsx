import { useCardImg } from './cardLang';

// Immagine di una carta del mazzo nella lingua scelta in Settings (inglese se non c'è); side 1 = retro.
export default function CardImg({ card, side = 0, ...props }) {
  return <img src={useCardImg(card, side)} alt="" loading="lazy" draggable={false} {...props} />;
}
