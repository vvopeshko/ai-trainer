import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './App.jsx'
import { TranslationProvider } from './i18n/TranslationProvider.jsx'
import { TelegramProvider } from './components/TelegramProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TranslationProvider>
        <TelegramProvider>
          <App />
        </TelegramProvider>
      </TranslationProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Скрываем splash сразу после гидрации React
requestAnimationFrame(() => {
  const splash = document.getElementById('splash')
  if (splash) {
    splash.classList.add('hidden')
    setTimeout(() => splash.remove(), 400)
  }
})
