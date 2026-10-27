import { readFileSync, readdirSync } from 'node:fs'
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

// Licenze di quello che il sito distribuisce: MIT, ISC, Apache-2.0 e OFL chiedono il loro testo con ogni copia e il
// minificatore toglie i commenti. Esce third-party-licenses.txt accanto all'index (link nei Credits): prima
// third-party-notices.txt (icone copiate, jpeg-js, profili ECI, modello ESRGAN), poi ogni pacchetto npm finito nel
// bundle con i suoi file LICENSE / NOTICE; un testo uguale a uno già scritto rimanda a quello. Solo nel build: in dev il
// link non trova il file. Il worker delle terre ha solo codice nostro (un worker con pacchetti va in worker.plugins).
const licenses = {
  name: 'licenses',
  apply: 'build',
  generateBundle() {
    const roots = new Set()
    for (const id of this.getModuleIds()) {
      const m = id.replace(/\\/g, '/').match(/^\0?(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//)
      if (m) roots.add(m[1])
    }
    const pkgs = new Map()
    for (const root of roots) {
      const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'))
      const files = readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isFile() && /^(licen[cs]e|notice|copying)/i.test(e.name)).map((e) => e.name).sort()
      pkgs.set(`${pkg.name}@${pkg.version}`, { pkg, text: files.map((f) => readFileSync(`${root}/${f}`, 'utf8').trim()).join('\n\n') })
    }
    if (!pkgs.size) this.error('licenses: no npm package found among the module ids') // mai un elenco vuoto in silenzio
    const seen = new Map() // testo → primo pacchetto che l'ha scritto
    const blocks = [...pkgs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, { pkg, text }]) => {
      const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || pkg.licenses?.map((l) => l.type ?? l).join(', ') || 'not stated'
      const repo = pkg.homepage || (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url) || ''
      const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
      const body = !text ? `No license file in the package (license: ${license}${author ? `, author: ${author}` : ''}).`
        : seen.has(text) ? `License text: the same as ${seen.get(text)}, above.` : text
      if (text && !seen.has(text)) seen.set(text, key)
      return `${'-'.repeat(78)}\n${key} (${license})${repo ? `\n${repo}` : ''}\n\n${body}\n`
    })
    const notices = readFileSync(new URL('./third-party-notices.txt', import.meta.url), 'utf8').trim()
    this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source: `${notices}\n\n${blocks.join('\n')}` })
  },
}

// https://vite.dev/config/
export default defineConfig({
  // base relativo: gli asset si risolvono sotto qualsiasi sottocartella
  // (GitHub Pages serve da /Impagina-Proxy/). App senza router → nessun lato negativo.
  base: './',
  plugins: [react(), csp, licenses],
})
