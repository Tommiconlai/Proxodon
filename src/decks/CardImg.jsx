import { useCardImg } from './cardLang';

// Immagine di una carta del mazzo nella lingua scelta in Settings (inglese se non c'è).
export default function CardImg({ card, ...props }) {
  return <img src={useCardImg(card)} alt="" loading="lazy" draggable={false} {...props} />;
}
