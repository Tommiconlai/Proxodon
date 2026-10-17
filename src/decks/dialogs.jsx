import { useMemo, useState } from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { FORMATS, DECK_TAGS, MAX_TAGS, coverRow, exportText } from './deckModel';
import { IconX, IconCopy, IconDownload } from '../components/icons';
import { downloadText } from '../utils/download';

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck';

// Copertina del mazzo: l'arte di una sua carta (una per carta, maybeboard escluso) oppure
// "Automatic" (primo comandante, sennò prima carta del main). onPick(oid | null).
export function CoverDialog({ deck, onPick, onClose }) {
  const ref = useOverlayDismiss(onClose);
  const [q, setQ] = useState('');
  const cards = useMemo(() => {
    const by = new Map();
    for (const r of deck.cards) if (r.board !== 'maybe' && r.card.art && !by.has(r.card.oid)) by.set(r.card.oid, r.card);
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [deck]);
  const shown = cards.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const auto = coverRow({ ...deck, cover: null })?.card;
  const current = deck.cover && cards.some((c) => c.oid === deck.cover) ? deck.cover : null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-art" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Deck cover" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deck cover</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <div className="art-search-row">
          <input type="search" className="import-link-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter the deck's cards" aria-label="Filter cards" spellCheck={false} />
          <span className="art-search-count" aria-live="polite">{shown.length} of {cards.length} cards</span>
        </div>
        <div className="art-grid cover-grid">
          {auto && !q.trim() && (
            <button type="button" className={`art-cell${current ? '' : ' current'}`} onClick={() => onPick(null)}
              title={`Automatic: ${auto.name}`}>
              <img src={auto.art} alt="" />
              <span>Automatic</span>
            </button>
          )}
          {shown.map((c) => (
            <button key={c.oid} type="button" className={`art-cell${current === c.oid ? ' current' : ''}`} onClick={() => onPick(c.oid)} title={c.name}>
              <img src={c.art} alt="" loading="lazy" />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Tag del mazzo dalla lista fissa, al massimo MAX_TAGS: click = metti o togli (onChange(tags)).
// I già scelti in testa, ordine fissato all'apertura così le voci non saltano mentre si clicca.
export function TagsDialog({ tags, onChange, onClose }) {
  const ref = useOverlayDismiss(onClose);
  const [q, setQ] = useState('');
  const [order] = useState(() => [...tags, ...DECK_TAGS.filter((t) => !tags.includes(t))]);
  const shown = order.filter((t) => t.toLowerCase().includes(q.trim().toLowerCase()));
  const full = tags.length >= MAX_TAGS;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-art" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Deck tags" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deck tags</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={18} /></button>
        </div>
        <div className="art-search-row">
          <input type="search" className="import-link-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter tags" aria-label="Filter tags" spellCheck={false} />
          <span className="art-search-count" aria-live="polite">{tags.length} of {MAX_TAGS}</span>
        </div>
        <div className="tag-grid">
          {shown.map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} type="button" className={`deck-tag${on ? ' on' : ''}`} aria-pressed={on} disabled={full && !on}
                onClick={() => onChange(on ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Export del mazzo: testo semplice ("4 Lightning Bolt") o con espansione e numero
// ("4 Lightning Bolt (M10) 146", reimportabile con la stessa stampa). Copia o scarica .txt.
export function ExportDeckDialog({ deck, onClose }) {
  const [specs, setSpecs] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useOverlayDismiss(onClose);
  const text = exportText(deck, { specs });
  const pick = (v) => { setSpecs(v); setCopied(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* appunti bloccati: il testo resta selezionabile */ }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Export ${deck.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export deck</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <div className="deck-mode export-mode" role="group" aria-label="Export format">
          <button type="button" aria-pressed={!specs} onClick={() => pick(false)}>Plain text</button>
          <button type="button" aria-pressed={specs} onClick={() => pick(true)}>With set and number</button>
        </div>
        <textarea className="import-textarea export-text" value={text} readOnly rows={12} spellCheck={false} aria-label="Deck list"
          onFocus={(e) => e.target.select()} />
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => downloadText(`${safeName(deck.name)}.txt`, `${text}\n`).catch(() => { /* salvataggio fallito: il testo resta qui da copiare */ })}>
            <IconDownload size={15} /> Download .txt
          </button>
          <button type="button" className="btn-generate import-btn" onClick={copy}><IconCopy size={15} /> {copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}

// Cosa salviamo e come cancellarlo (menu account).
export function PrivacyPanel({ onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Privacy" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Privacy</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Signing in (with Google, or with email and password) lets Proxodon keep your decks on Firebase (Google Cloud), so they sync between your devices.</p>
        <ul className="privacy-list">
          <li><b>Stored:</b> your account id and email, plus name and photo with Google, and the nickname, profile photo and profile background if you set them (kept by Firebase Authentication; passwords are stored hashed by Firebase, never by Proxodon) and your decks.</li>
          <li><b>Where:</b> Firebase, with the deck database in the EU.</li>
          <li><b>Who can read it:</b> only you. Access rules block every other account. Two exceptions: your nickname is reserved in a list that other signed-in accounts can check to see whether a name is free (only the name and your account id), and the decks you share in Community can be read by every signed-in account, with your nickname and account id. Decks are private until you share them. A like you give is stored on that deck with your account id; others only see the count. On dilemmas (questions on public decks), your choice and optional explanation are stored with your account id and nickname, and other signed-in accounts who answered see the explanations; the count of dilemmas you answered stays in your account. On help requests (on public decks), your suggestion (text and cards) is stored with your account id and nickname and every signed-in account can read it.</li>
          <li><b>How to delete it:</b> account menu, Delete account and data. It removes your decks, their Community copies and your account; likes you gave stay in the counts, tied only to the deleted account's id; your dilemma answers, your help suggestions, and the dilemmas and help requests on your decks are deleted. Make private removes a deck from Community.</li>
        </ul>
        <p className="modal-hint">The print area works without an account and keeps nothing on a server.</p>
      </div>
    </div>
  );
}

// Fonti di immagini, dati, profili colore, font e librerie (menu dell'avatar → Credits).
const CREDITS = [
  ['Cards', [
    ['Scryfall', 'https://scryfall.com', 'card search, data, images, art crops, mana symbols and prices (Cardmarket, TCGplayer). Artists are named in the art pickers.'],
    ['Wizards of the Coast', 'https://company.wizards.com/en/legal/fancontentpolicy', 'Magic: The Gathering, card names, art and symbols. Proxodon is unofficial Fan Content permitted under the Fan Content Policy. Not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.'],
    ['MPC Autofill', 'https://github.com/chilli-axe/mpc-autofill', 'the XML orders you import; their images are loaded from Google Drive and belong to their creators.'],
  ]],
  ['Print', [
    ['European Color Initiative', 'https://www.eci.org', 'ICC profiles ISO Coated v2, PSO Coated v3 and PSO Uncoated v3 (FOGRA52).'],
    ['Little CMS', 'https://www.littlecms.com', 'color conversion, through lcms-wasm (MIT).'],
    ['jsPDF and pdf-lib', 'https://github.com/parallax/jsPDF', 'PDF export (MIT).'],
    ['jpeg-js', 'https://github.com/jpeg-js/jpeg-js', 'CMYK JPEG decoding (Apache-2.0).'],
    ['UpscalerJS', 'https://upscalerjs.com', 'AI upscale with the ESRGAN medium model on TensorFlow.js (MIT, Apache-2.0), loaded from jsDelivr.'],
  ]],
  ['Look', [
    ['Fontsource', 'https://fontsource.org', 'Chakra Petch (Cadson Demak), Space Grotesk (Florian Karsten) and JetBrains Mono (JetBrains), SIL Open Font License, bundled with the app.'],
    ['Lucide', 'https://lucide.dev', 'icons (ISC).'],
  ]],
  ['Built with', [
    ['Firebase', 'https://firebase.google.com', 'accounts and deck sync.'],
    ['React, Vite and react-dropzone', 'https://react.dev', 'the app itself (MIT).'],
  ]],
];

export function CreditsPanel({ onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-credits" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Credits" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Credits</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Proxodon builds on the work of these people and projects.</p>
        {CREDITS.map(([group, items]) => (
          <section key={group} className="credits-group" aria-label={group}>
            <h3 className="profile-h">{group}</h3>
            <ul className="privacy-list">
              {items.map(([name, url, what]) => (
                <li key={name}><a href={url} target="_blank" rel="noopener noreferrer"><b>{name}</b></a>: {what}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// Nuovo mazzo (nome + formato), Rinomina e le sezioni custom (solo nome).
export function NameFormatDialog({ title, confirmLabel, initialName = '', initialFormat = 'commander', showFormat = true, placeholder = 'Atraxa superfriends', maxLength = 80, onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const [format, setFormat] = useState(initialFormat);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onSubmit({ name: name.trim(), format });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal modal-confirm deck-form" ref={ref} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header"><h2>{title}</h2></div>
        <label className="field-label" htmlFor="deck-name">Name</label>
        <input id="deck-name" className="import-link-input" value={name} onChange={(e) => setName(e.target.value)}
          autoFocus maxLength={maxLength} placeholder={placeholder} spellCheck={false} />
        {showFormat && (
          <>
            <label className="field-label" htmlFor="deck-format">Format</label>
            <select id="deck-format" value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-generate import-btn" disabled={!name.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

// Conferma "Print deck": sostituzione della coda (se non vuota) o aggiunta (add, da Settings) e
// sideboard opzionale (spuntata di default se lo dice Settings).
export function PrintDeckDialog({ queueCount, sideCount, add, defaultSide, onConfirm, onClose }) {
  const [side, setSide] = useState(!!defaultSide);
  const ref = useOverlayDismiss(onClose, true, { focusContainer: false });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-confirm" ref={ref} role="dialog" aria-modal="true" aria-label="Print deck" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Print deck</h2></div>
        {queueCount > 0 && (add
          ? <p className="modal-hint">The deck goes after the {queueCount} card{queueCount !== 1 ? 's' : ''} already in the print queue.</p>
          : <p className="modal-hint">Replace the {queueCount} card{queueCount !== 1 ? 's' : ''} in the print queue?</p>)}
        {sideCount > 0 && (
          <label className="checkbox-row">
            <input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} />
            <span className="anim-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
                <polyline points="1 9 7 14 15 4" />
              </svg>
            </span>
            Include sideboard ({sideCount})
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} autoFocus>Cancel</button>
          <button type="button" className="btn-generate import-btn" onClick={() => onConfirm(side)}>{queueCount > 0 ? (add ? 'Add and print' : 'Replace and print') : 'Print'}</button>
        </div>
      </div>
    </div>
  );
}
