import { useState } from 'react';

// Banner consenso cookie. I settaggi vivono in localStorage (sempre, tecnici);
// la scelta qui (`ip:cookieConsent` = accepted|declined) abilita/nega eventuali
// cookie di analytics futuri. Basta leggere il flag prima di caricarli.
const KEY = 'ip:cookieConsent';

export default function CookieBanner() {
    const [choice, setChoice] = useState(() => localStorage.getItem(KEY));
    if (choice) return null;

    const decide = (v) => { localStorage.setItem(KEY, v); setChoice(v); };

    return (
        <div className="cookie-banner" role="dialog" aria-label="Cookie consent" aria-live="polite">
            <p className="cookie-text">
                Proxodon keeps your settings in your browser's local storage. Signing in to Decks also
                keeps a session there. With your consent we may also use cookies for anonymous usage analytics.
            </p>
            <div className="cookie-actions">
                <button className="btn-secondary" onClick={() => decide('declined')}>Decline</button>
                <button className="btn-generate cookie-accept" onClick={() => decide('accepted')}>Accept</button>
            </div>
        </div>
    );
}
