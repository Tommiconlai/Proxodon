import { useState } from 'react';
import { lsGet, lsSet } from '../utils/settings';
import { PrivacyButton } from './PrivacyPanel';
import { IconCheck } from './icons';

// Avviso, non consenso: Proxodon usa solo storage tecnico (impostazioni, cache, sessione), che non chiede il consenso
// (ePrivacy art. 5.3). Un cookie o uno script di analytics vorrebbe un vero Accept / Decline prima di caricarlo.
// `ip:cookieConsent` era il vecchio banner con Accept / Decline per analytics mai esistiti: si toglie.
const KEY = 'ip:privacyNotice';
try { localStorage.removeItem('ip:cookieConsent'); } catch { /* storage bloccato */ }

export default function CookieBanner() {
    const [seen, setSeen] = useState(() => lsGet(KEY));
    if (seen) return null;

    return (
        <div className="cookie-banner" role="region" aria-label="Privacy notice">
            <p className="cookie-text">
                No ads, no analytics, no tracking cookies. Proxodon keeps your settings on this device, plus your
                session if you sign in. Card data and images load from Scryfall.
            </p>
            <div className="cookie-actions">
                <PrivacyButton />
                <button type="button" className="btn-add deck-icon-btn" aria-label="Got it" title="Got it"
                    onClick={() => { lsSet(KEY, '1'); setSeen('1'); }}><IconCheck size={16} /></button>
            </div>
        </div>
    );
}
