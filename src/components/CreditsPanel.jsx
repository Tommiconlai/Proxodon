import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { PrivacyButton } from './PrivacyPanel';
import { IconX, IconSparkles } from './icons';

// Fonti dell'analisi delle terre: nei Credits e, con LandSources, in fondo al pannello del mazzo (LandPanel).
const LAND = {
  karsten: 'https://www.tcgplayer.com/content/article/How-Many-Lands-Do-You-Need-in-Your-Deck-An-Updated-Analysis/cd1c1a24-d439-4a8e-b369-b936edb0b38a/',
  widget: 'https://github.com/kvnchen/formulaWidget',
  chen: 'https://canadianhighlander.ca/2023/07/17/how-to-build-a-manabase-for-singleton-formats/',
  freemully: 'https://freemully.com/how-many-lands',
};

const Ext = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

export function LandSources() {
  return (
    <>
      Sources: Frank Karsten, <Ext href={LAND.karsten}>How Many Lands Do You Need in Your Deck? An Updated Analysis</Ext> (the
      formula and the MDFC weights); <Ext href={LAND.widget}>formulaWidget</Ext> (what counts as cheap draw and ramp, other deck
      sizes); Kelvin Chen, <Ext href={LAND.chen}>How To Build A Manabase For Singleton Formats</Ext> (MDFCs and fast mana taken
      off the land count); FreeMully, <Ext href={LAND.freemully}>How many lands does a Commander deck need?</Ext> (cheap up to
      mana value 3 in Commander).
    </>
  );
}

// Fonti di immagini, dati, formule, profili colore, font e librerie: [nome, link, cosa]. I testi di licenza sono in
// third-party-licenses.txt, scritto dal build (vite.config.js); un'icona, un font o un pacchetto nuovo va anche lì.
const CREDITS = [
  ['Cards', [
    ['Scryfall', 'https://scryfall.com', 'card search, card data and legalities, images, art crops, mana symbols and prices (Cardmarket, TCGplayer). Proxodon is not produced by or endorsed by Scryfall.'],
    ['Wizards of the Coast', 'https://company.wizards.com/en/legal/fancontentpolicy', 'Magic: The Gathering, card names, card art (by the artists credited on each card) and symbols, the formats’ deck building rules, and the Commander Brackets with their Game Changers list. Proxodon is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.'],
    ['MPC Autofill', 'https://github.com/chilli-axe/mpc-autofill', 'the XML orders you import; their images are loaded from Google Drive and belong to their creators.'],
  ]],
  ['Deck stats', [
    ['Frank Karsten', LAND.karsten, 'How Many Lands Do You Need in Your Deck? An Updated Analysis (TCGplayer): the land count formula and the MDFC weights.'],
    ['formulaWidget', LAND.widget, 'an open implementation of that formula: what counts as cheap draw and ramp, and other deck sizes.'],
    ['Kelvin Chen', LAND.chen, 'How To Build A Manabase For Singleton Formats (Canadian Highlander): MDFCs and fast mana taken off the land count.'],
    ['FreeMully', LAND.freemully, 'How many lands does a Commander deck need?: cheap up to mana value 3, the Commander default.'],
  ]],
  ['Print', [
    ['European Color Initiative', 'https://www.eci.org', 'ICC profiles ISO Coated v2 (© 2000-2006 Heidelberger Druckmaschinen AG), PSO Coated v3 and PSO Uncoated v3 (FOGRA52, © 2015 Heidelberger Druckmaschinen AG), made available by ECI with permission of Heidelberg.'],
    ['Little CMS', 'https://www.littlecms.com', 'color conversion, through lcms-wasm (MIT).'],
    ['jsPDF and pdf-lib', 'https://github.com/parallax/jsPDF', 'PDF export (MIT).'],
    ['jpeg-js', 'https://github.com/jpeg-js/jpeg-js', 'CMYK JPEG decoding (Apache-2.0).'],
    ['UpscalerJS', 'https://upscalerjs.com', 'the AI upscale (Kevin Scott, MIT) and its ESRGAN medium model (MIT), bundled with the app, running on TensorFlow.js (Google, Apache-2.0).'],
    ['ESRGAN', 'https://arxiv.org/abs/1809.00219', 'the model architecture: Xintao Wang et al., ESRGAN: Enhanced Super-Resolution Generative Adversarial Networks (2018).'],
  ]],
  ['Look', [
    ['Fontsource', 'https://fontsource.org', 'Chakra Petch (Cadson Demak), Space Grotesk (Florian Karsten) and JetBrains Mono (JetBrains), SIL Open Font License, bundled with the app.'],
    ['Lucide', 'https://lucide.dev', 'most icons (ISC), some of them from Feather by Cole Bemis (MIT).'],
    ['Iconify', 'https://iconify.design', <>phone menu and Print bar icons: Fluent UI System Icons (Microsoft, MIT), Akar Icons (Arturo Wibawa, MIT), Famicons (Family, MIT) and <Ext href="https://www.figma.com/community/file/931906394678748246"><b>Basil</b></Ext> by Craftwork (<Ext href="https://creativecommons.org/licenses/by/4.0/"><b>CC BY 4.0</b></Ext>, redrawn in one color).</>],
  ]],
  ['Built with', [
    ['Firebase', 'https://firebase.google.com', 'accounts and deck sync (Apache-2.0).'],
    ['React, Vite and react-dropzone', 'https://react.dev', 'the app itself (MIT).'],
  ]],
];

// Menu dell'avatar → Credits, e il tasto qui sotto (aiuto, accesso): fuori dal chunk dei mazzi come la privacy.
export default function CreditsPanel({ onClose }) {
  const ref = useOverlayDismiss(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-credits" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Credits" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Credits</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" title="Close"><IconX size={18} /></button>
        </div>
        <p className="modal-hint">Proxodon builds on the work of these people and projects.</p>
        {CREDITS.map(([group, items]) => (
          <section key={group} className="credits-group" aria-label={group}>
            <h3 className="profile-h">{group}</h3>
            <ul className="privacy-list">
              {items.map(([name, url, what]) => (
                <li key={name}><Ext href={url}><b>{name}</b></Ext>: {what}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="modal-hint">Every license text, with all the packages in the site: <Ext href="third-party-licenses.txt">third-party-licenses.txt</Ext>.</p>
      </div>
    </div>
  );
}

// Tasto che apre i Credits. Il pannello va nel body: fuori da contenitori animati o col backdrop-filter.
export function CreditsButton({ className = 'btn-secondary deck-icon-btn' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-label="Credits" title="Credits" onClick={() => setOpen(true)}><IconSparkles size={16} /></button>
      {open && createPortal(<CreditsPanel onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

// Riga in fondo ai popover ? (stampa, mazzi, Tokens): Credits e Privacy anche senza account (il menu dell'avatar
// c'è solo da loggati). I popover ignorano i click nei pannelli, sennò chiudendosi li smonterebbero.
export function HelpAbout() {
  return (
    <div className="help-tour">
      <span>Proxodon is unofficial, not approved/endorsed by Wizards. Card data and images: Scryfall.</span>
      <CreditsButton />
      <PrivacyButton />
    </div>
  );
}
