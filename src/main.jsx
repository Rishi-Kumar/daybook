import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// When the app comes back to the foreground, check for a new service worker.
// Combined with autoUpdate (skipWaiting + clientsClaim), this ensures the page
// reloads with the latest version as soon as the user opens the app after a deploy.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    navigator.serviceWorker?.getRegistration().then((reg) => reg?.update())
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
