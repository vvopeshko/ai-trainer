import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import App from './App.jsx'
import { queryClient } from './lib/queryClient.js'
import { TranslationProvider } from './i18n/TranslationProvider.jsx'
import { TelegramProvider } from './components/TelegramProvider.jsx'
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
              <QueryClientProvider client={queryClient}>
                <ActiveWorkoutProvider>
                  <App />
                </ActiveWorkoutProvider>
              </QueryClientProvider>
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
