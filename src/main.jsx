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
