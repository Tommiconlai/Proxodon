import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Content-Security-Policy del sito: GitHub Pages non manda header, quindi un meta, e solo nel build (in dev il
// plugin React inietta uno script inline e l'HMR usa un websocket). Host = quelli che l'app usa davvero:
// Scryfall (dati, immagini, simboli), le immagini Drive degli import MPC e le foto Google (googleusercontent),
// Firebase (solo i suoi host googleapis: Auth identitytoolkit + securetoken, Firestore, lo scambio del token di App Check,
// che c'è anche con App Check spento così accenderlo non rompe niente; mai *.googleapis.com, che comprende anche bucket
// di Storage di chiunque), il login Google (apis.google.com e l'iframe di authDomain), reCAPTCHA di App Check.
// 'wasm-unsafe-eval' per lcms (stampa CMYK). Un host nuovo (fetch, immagine, script) va aggiunto qui.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://cards.scryfall.io https://svgs.scryfall.io https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://api.scryfall.com https://cards.scryfall.io https://svgs.scryfall.io https://lh3.googleusercontent.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.google.com/recaptcha/",
  "frame-src https://proxoteca.firebaseapp.com https://accounts.google.com https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ')

const csp = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) => {
    const out = html.replace(/<meta charset="UTF-8" \/>/,
      (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    if (out === html) throw new Error('CSP: <meta charset="UTF-8" /> not found in index.html') // mai un sito senza CSP
    return out
  },
}

// https://vite.dev/config/
export default defineConfig({
  // base relativo: gli asset si risolvono sotto qualsiasi sottocartella
  // (GitHub Pages serve da /Impagina-Proxy/). App senza router → nessun lato negativo.
  base: './',
  plugins: [react(), csp],
})
