import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './App.jsx'
import { TranslationProvider } from './i18n/TranslationProvider.jsx'
import { TelegramProvider } from './components/TelegramProvider.jsx'
import { HomeDataProvider } from './contexts/HomeDataContext.jsx'
import { ProgressDataProvider } from './contexts/ProgressDataContext.jsx'
import { ActiveWorkoutProvider } from './contexts/ActiveWorkoutContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <TranslationProvider>
          <TelegramProvider>
            <ToastProvider>
              <HomeDataProvider>
                <ProgressDataProvider>
                  <ActiveWorkoutProvider>
                    <App />
                  </ActiveWorkoutProvider>
                </ProgressDataProvider>
              </HomeDataProvider>
            </ToastProvider>
          </TelegramProvider>
        </TranslationProvider>
      </ErrorBoundary>
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
