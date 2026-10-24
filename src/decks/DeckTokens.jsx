import { useEffect, useState } from 'react';
import { deckTokens } from './scryfallSearch';
import { tokenFromScryfall } from '../tokens/tokenModel';
import { draftInUse, startDraft } from '../tokens/tokenDraft';
import { navigate } from '../hooks/useHashRoute';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconNavTokens, IconReplay } from '../components/icons';

// Sezione Tokens sotto il maybeboard, solo nei propri mazzi (DeckEditor): i token che creano le carte del mazzo (main,
// comandante e sideboard, non il maybeboard), dagli all_parts di Scryfall, uno per oracle (un Treasure creato da tre
// carte compare una volta): solo l'immagine, con Make custom sopra in alto a destra. Sempre aperta (scelta dell'utente):
// Scryfall si interroga aprendo il mazzo e le risposte restano in cache per la sessione (aggiungendo una carta si chiede
// solo lei). Make custom porta quel token nel generatore (Tokens) con i testi già scritti e l'immagine da caricare, uno
// alla volta: se lì ce n'è già uno in lavorazione, prima si chiede. demo (tutorial) = la lista già pronta, niente
// Scryfall. La lista viene da deckTokens (scryfallSearch), la stessa che Print deck offre di stampare.

// Senza immagine su Scryfall niente src (si vede il riquadro grigio), non uno vuoto.
const imageOf = (c) => c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || undefined;

export default function DeckTokens({ deck, demo }) {
  const [list, setList] = useState(demo || null); // null = da cercare
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [replace, setReplace] = useState(null); // il token che aspetta la conferma
  useEffect(() => {
    if (demo) return undefined;
    let on = true;
    deckTokens(deck.cards.filter((r) => r.board !== 'maybe'))
      .then((l) => { if (on) { setList(l); setFailed(false); } }, () => { if (on) setFailed(true); });
    return () => { on = false; };
  }, [demo, deck.cards, retry]);
  const custom = (card) => { startDraft(tokenFromScryfall(card)); navigate('/tokens'); };

  return (
    <section className="deck-tokens" aria-label="Tokens">
      <h3 className="deck-group-head"><span className="deck-group-name">Tokens</span> {list && <span className="n">{list.length}</span>}</h3>
      {failed ? (
        <p className="deck-tokens-note">
          Scryfall did not answer, so the tokens are not here yet.
          <button type="button" className="btn-secondary deck-icon-btn" aria-label="Try again" title="Try again"
            onClick={() => { setFailed(false); setRetry((n) => n + 1); }}><IconReplay size={16} /></button>
        </p>
      ) : !list ? (
        <p className="deck-tokens-note" role="status"><span className="import-spinner" aria-hidden="true" /> Looking for the tokens your cards create…</p>
      ) : !list.length ? (
        <p className="deck-tokens-note">No card in this deck creates a token.</p>
      ) : (
        <ul className="deck-token-grid">
          {list.map(({ key, card, from }) => {
            const t = tokenFromScryfall(card);
            const pt = t.power || t.toughness ? `${t.power}/${t.toughness}` : ''; // due Beast diversi: 3/3 e 4/4
            const name = [t.name, pt].filter(Boolean).join(' ');
            return (
              <li key={key} className="deck-token">
                {/* Solo l'immagine (nome, tipo e F/C sono sulla carta): le carte che lo creano nel suo testo e al passaggio. */}
                <img src={imageOf(card)} alt={`${name} token, from ${from.join(', ')}`} title={`${name}, from ${from.join(', ')}`} loading="lazy" />
                <button type="button" className="deck-token-custom" aria-label={`Make ${name} custom`}
                  title="Make custom: open it in Tokens with its text, you add the art"
                  onClick={() => (draftInUse() ? setReplace(card) : custom(card))}><IconNavTokens size={18} /></button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={!!replace} confirmLabel="Replace"
        message={`Replace the token you are making with ${replace ? tokenFromScryfall(replace).name : ''}? Its text and images will be lost.`}
        onConfirm={() => { const card = replace; setReplace(null); custom(card); }} onCancel={() => setReplace(null)} />
    </section>
  );
}
