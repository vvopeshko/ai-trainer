import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Лёгкая обёртка над Telegram.WebApp. В dev без Telegram — подставляем мок.
// API: const { user, webApp, isDev } = useTelegram()

const TelegramContext = createContext({
  user: null,
  webApp: null,
  isDev: true,
})

export function TelegramProvider({ children }) {
  const [state, setState] = useState(() => resolveInitial())

  useEffect(() => {
    // WebApp может подгрузиться чуть позже скрипта в index.html —
    // перечитываем на всякий случай после первого рендера.
    const resolved = resolveInitial()
    setState(resolved)

    const webApp = resolved.webApp
    if (webApp) {
      try {
        webApp.ready()
        webApp.expand()
      } catch {
        /* ignore */
      }
      applySafeAreaVars(webApp)
      webApp.onEvent?.('safeAreaChanged', () => applySafeAreaVars(webApp))
      webApp.onEvent?.('contentSafeAreaChanged', () => applySafeAreaVars(webApp))
    }
  }, [])

  const value = useMemo(() => state, [state])
  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}

export function useTelegram() {
  return useContext(TelegramContext)
}

function applySafeAreaVars(webApp) {
  const sa = webApp.safeAreaInset || {}
  const csa = webApp.contentSafeAreaInset || {}
  const root = document.documentElement.style
  root.setProperty('--safe-top', `${(sa.top || 0) + (csa.top || 0)}px`)
  root.setProperty('--safe-bottom', `${sa.bottom || 0}px`)
}

function resolveInitial() {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  const tgUser = webApp?.initDataUnsafe?.user

  if (tgUser) {
    return {
      user: {
        id: tgUser.id,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        languageCode: tgUser.language_code,
        photoUrl: tgUser.photo_url,
      },
      webApp,
      isDev: false,
    }
  }

  // Dev-режим: бота нет, мини-апп открыли в обычном браузере.
  return {
    user: {
      id: 0,
      firstName: 'Dev',
      lastName: 'User',
      username: 'dev_user',
      languageCode: 'ru',
      photoUrl: null,
    },
    webApp: null,
    isDev: true,
  }
}
