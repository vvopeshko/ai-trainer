import { createContext, useContext, useMemo } from 'react'

// Платформа определяется по НЕПУСТОТЕ initData: telegram-web-app.js подключён
// в index.html безусловно, в обычном браузере initData === ''.
// Web живёт на тех же URL, что и Telegram — платформа выбирает провайдера,
// не префикс пути (см. product/ARCHITECTURE_WEB_AUTH.md §5).

const PlatformContext = createContext({
  platform: 'telegram',
  isTelegram: true,
  isWeb: false,
})

export function detectPlatform() {
  const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : ''
  return initData ? 'telegram' : 'web'
}

export function PlatformProvider({ children }) {
  const value = useMemo(() => {
    const platform = detectPlatform()
    return { platform, isTelegram: platform === 'telegram', isWeb: platform === 'web' }
  }, [])
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  return useContext(PlatformContext)
}
