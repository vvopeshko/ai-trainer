import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import App from './App.jsx'
import { hideSplash } from './utils/splash.js'
import { queryClient } from './lib/queryClient.js'
import { TranslationProvider } from './i18n/TranslationProvider.jsx'
import { TelegramProvider } from './components/TelegramProvider.jsx'
import { PlatformProvider, usePlatform } from './contexts/PlatformContext.jsx'
import { ActiveWorkoutProvider } from './contexts/ActiveWorkoutContext.jsx'
import { QueryPersistence } from './components/QueryPersistence.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import './utils/installPrompt.js' // слушатель beforeinstallprompt — до события

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
                  <QueryPersistence>
                    <ActiveWorkoutProvider>
                      <App />
                    </ActiveWorkoutProvider>
                  </QueryPersistence>
                </QueryClientProvider>
              </ToastProvider>
            </AuthProvider>
          </PlatformProvider>
        </TranslationProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)

// Splash прячет App, когда реально есть что показать (на web до этого грузится
// чанк WebProvider и идёт проверка сессии — раньше там был пустой тёмный экран).
// Страховка: если App не дошёл до рендера (ошибка провайдера) — убираем через 8 с,
// чтобы не закрыть собой ErrorBoundary.
setTimeout(hideSplash, 8000)

// PWA service worker — только web-платформа: Telegram Mini App живёт без SW,
// чтобы прекэш index.html не задерживал обновления мини-аппа. autoUpdate:
// новая версия подхватывается молча при следующем открытии.
if ('serviceWorker' in navigator && !window.Telegram?.WebApp?.initData) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {}) // dev без сгенерированного SW — не критично
}
