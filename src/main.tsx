import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW: (_serviceWorkerUrl, registration) => {
      if (!registration) {
        return
      }

      const updateWhenVisible = () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      }

      document.addEventListener('visibilitychange', updateWhenVisible)
    },
    onRegisterError: () => {
      // The online app remains usable when service worker setup fails.
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
