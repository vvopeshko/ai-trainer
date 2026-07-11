import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TelegramContext } from '../TelegramProvider.jsx'
import { authClient } from '../../utils/authClient.js'
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
  const [state, setState] = useState(() =>
    tokenStorage.get()
      ? { status: 'checking', user: null }
      : import.meta.env.DEV
        ? { status: 'dev', user: DEV_MOCK_USER }
        : { status: 'anonymous', user: null },
  )

  useEffect(() => {
    if (state.status !== 'checking') return
    let cancelled = false
    authClient
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.user) {
          // BA-поля name/image замаплены на firstName/photoUrl на сервере,
          // но клиентский getSession отдаёт канонические имена BA
          const u = data.user
          setState({
            status: 'authed',
            user: {
              id: u.id,
              firstName: u.name || '',
              lastName: null,
              username: null,
              languageCode: u.languageCode ?? 'ru',
              photoUrl: u.image ?? null,
              email: u.email,
              emailVerified: u.emailVerified,
            },
          })
        } else {
          tokenStorage.clear()
          setState(
            import.meta.env.DEV
              ? { status: 'dev', user: DEV_MOCK_USER }
              : { status: 'anonymous', user: null },
          )
        }
      })
      .catch(() => {
        // Сеть/сервер недоступны — токен не трогаем, пробуем рендерить:
        // TanStack Query покажет свои ошибки, сессия может быть валидной
        if (!cancelled) setState({ status: 'authed', user: null })
      })
    return () => {
      cancelled = true
    }
  }, [state.status])

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
    return null // мгновенная проверка сессии; splash из index.html ещё виден
  }
  if (state.status === 'anonymous' && !isPublic) {
    return null // сейчас произойдёт redirect на /login
  }

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}
