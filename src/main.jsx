import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font inclusi nel bundle (OFL, Fontsource) invece di Google Fonts: l'app Android parte giusta anche offline
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
import { Capacitor } from '@capacitor/core'

// App Android: il tasto Indietro scorre la cronologia (overlay, cartelle, mazzi, vedi useBackClose); alla radice
// riduce l'app, come le app di sistema, senza chiuderla (le carte caricate restano)
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App: NativeApp }) => NativeApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else NativeApp.minimizeApp();
  }));
}

// Dentro un iframe di un altro sito l'app non parte (clickjacking: click "rubati" su Delete o Like sotto un'esca).
// GitHub Pages non manda header, e frame-ancestors non vale in una CSP via meta: questo è il solo freno possibile.
// L'app Android e gli iframe di Firebase (pagine loro) non c'entrano: lì questa pagina è in cima.
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
