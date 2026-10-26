import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TelegramContext } from '../TelegramProvider.jsx'
import { authClient } from '../../utils/authClient.js'
import { clearPersistedQueries } from '../../lib/queryPersistence.js'
import { tokenStorage } from '../../utils/tokenStorage.js'

// Auth-гейт web-платформы. Поставляет TelegramContext-совместимое значение
// ({ user, webApp: null }) — существующие компоненты с useTelegram() работают
// без изменений.
//
// Логика:
//   - публичные пути (/login, /auth/*, /demo) — рендер без проверки сессии
//   - токен есть → getSession(); невалиден → очистка + /login
//   - токена нет: DEV → мок Dev User (dev_bypass, как раньше); прод → /login?returnTo=

const PUBLIC_PREFIXES = ['/login', '/auth', '/demo']

const DEV_MOCK_USER = {
  id: 0,
  firstName: 'Dev',
  lastName: 'User',
  username: 'dev_user',
  languageCode: 'ru',
  photoUrl: null,
}

export function WebProvider({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isPublic = PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p))

  // status: 'checking' | 'authed' | 'dev' | 'anonymous'
  // Токен + профиль прошлой сессии → сразу 'authed' (рендер без ожидания сети),
  // getSession сверяет фоном. Профиля нет (первый вход) — честный 'checking'.
  const [state, setState] = useState(() => {
    if (tokenStorage.get()) {
      const cachedUser = tokenStorage.getUser()
      return cachedUser ? { status: 'authed', user: cachedUser } : { status: 'checking', user: null }
    }
    return import.meta.env.DEV
      ? { status: 'dev', user: DEV_MOCK_USER }
      : { status: 'anonymous', user: null }
  })

  // Сессию сверяем один раз на старте, если есть токен
  const [needsCheck] = useState(() => !!tokenStorage.get())

  useEffect(() => {
    if (!needsCheck) return
    let cancelled = false
    authClient
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.user) {
          // BA-поля name/image замаплены на firstName/photoUrl на сервере,
          // но клиентский getSession отдаёт канонические имена BA
          const u = data.user
          const user = {
            id: u.id,
            firstName: u.name || '',
            lastName: null,
            username: null,
            languageCode: u.languageCode ?? 'ru',
            photoUrl: u.image ?? null,
            email: u.email,
            emailVerified: u.emailVerified,
          }
          tokenStorage.setUser(user)
          // Тот же профиль (частый случай) — не трогаем state, без лишнего ре-рендера
          setState((prev) => (prev.status === 'authed' && JSON.stringify(prev.user) === JSON.stringify(user)
            ? prev
            : { status: 'authed', user }))
        } else {
          tokenStorage.clear()
          clearPersistedQueries()
          setState(
            import.meta.env.DEV
              ? { status: 'dev', user: DEV_MOCK_USER }
              : { status: 'anonymous', user: null },
          )
        }
      })
      .catch(() => {
        // Сеть/сервер недоступны — токен не трогаем, пробуем рендерить:
        // TanStack Query покажет свои ошибки, сессия может быть валидной.
        // Профиль из прошлой сессии (если был) оставляем.
        if (!cancelled) setState((prev) => (prev.status === 'authed' ? prev : { status: 'authed', user: null }))
      })
    return () => {
      cancelled = true
    }
  }, [needsCheck])

  // Редирект на логин — только приватные пути и только вне DEV
  useEffect(() => {
    if (state.status === 'anonymous' && !isPublic) {
      const returnTo = location.pathname + location.search
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
    }
  }, [state.status, isPublic, location.pathname, location.search, navigate])

  const value = useMemo(
    () => ({
      user: state.user,
      webApp: null, // haptic/safe-area/Telegram SDK на web нет — компоненты это уже умеют
      isDev: state.status === 'dev',
    }),
    [state],
  )

  if (state.status === 'checking' && !isPublic) {
    return null // первый вход: проверка сессии; splash из index.html ещё виден (его прячет App)
  }
  if (state.status === 'anonymous' && !isPublic) {
    return null // сейчас произойдёт redirect на /login
  }

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}
