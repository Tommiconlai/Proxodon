import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font inclusi nel bundle (OFL, Fontsource) invece di Google Fonts: nessuna richiesta a terzi, e funzionano offline
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import './utils/settings' // applica subito le impostazioni globali (Reduce motion)
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

// Dopo un aggiornamento i file della versione di prima (nomi con l'hash) non ci sono più: una pagina rimasta aperta
// che ne chiede uno (import dinamico: PDF, area mazzi, tutorial) fallisce. Si ricarica, al massimo una volta ogni
// 30 s (se il file manca anche dopo, o lo blocca la rete, resta l'errore); storage bloccato = niente ricarica, per non
// girare in tondo. Con carte da stampare il browser chiede prima (beforeunload in App): le immagini non sono salvate,
// ma la versione vecchia il PDF non lo può più generare.
window.addEventListener('vite:preloadError', () => {
  let last
  try {
    last = Number(sessionStorage.getItem('px-reloaded-at')) || 0
    sessionStorage.setItem('px-reloaded-at', String(Date.now()))
  } catch {
    return
  }
  if (Date.now() - last > 30000) window.location.reload()
})

// Dentro un iframe di un altro sito l'app non parte (clickjacking: click "rubati" su Delete o Like sotto un'esca).
// GitHub Pages non manda header, e frame-ancestors non vale in una CSP via meta: questo è il solo freno possibile.
// Gli iframe di Firebase (pagine loro) non c'entrano: lì questa pagina è in cima.
if (window.top !== window.self) {
  document.getElementById('root').textContent = 'Proxodon cannot run inside a frame. Open it directly.'
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary message="Something went wrong. Reload the page: your settings are kept.">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
