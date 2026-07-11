import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import App from './App.jsx'
import { queryClient } from './lib/queryClient.js'
import { TranslationProvider } from './i18n/TranslationProvider.jsx'
import { TelegramProvider } from './components/TelegramProvider.jsx'
import { PlatformProvider, usePlatform } from './contexts/PlatformContext.jsx'
import { ActiveWorkoutProvider } from './contexts/ActiveWorkoutContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'

// Платформа выбирает auth-провайдера: Mini App → TelegramProvider (initData),
// браузер → WebProvider (Bearer-сессия Better Auth / dev-мок). Оба поставляют
// TelegramContext — useTelegram() работает везде. WebProvider — lazy: клиент
// better-auth не попадает в бандл мини-аппа.
const WebProvider = lazy(() =>
  import('./components/web/WebProvider.jsx').then((m) => ({ default: m.WebProvider })),
)

function AuthProvider({ children }) {
  const { isTelegram } = usePlatform()
  if (isTelegram) return <TelegramProvider>{children}</TelegramProvider>
  return (
    <Suspense fallback={null}>
      <WebProvider>{children}</WebProvider>
    </Suspense>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <TranslationProvider>
          <PlatformProvider>
            <AuthProvider>
              <ToastProvider>
                <QueryClientProvider client={queryClient}>
                  <ActiveWorkoutProvider>
                    <App />
                  </ActiveWorkoutProvider>
                </QueryClientProvider>
              </ToastProvider>
            </AuthProvider>
          </PlatformProvider>
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
