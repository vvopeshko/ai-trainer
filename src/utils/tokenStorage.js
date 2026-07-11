// Хранение session-токена Better Auth (web-платформа).
// Один opaque-токен в localStorage: refresh-флоу нет, сервер продлевает
// сессию сам (sliding). XSS-риск смягчён серверной инвалидацией
// (sign-out, сброс пароля). В Mini App не используется — там initData.

const KEY = 'ait.session-token'

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token)
    } catch {
      /* private mode — сессия проживёт до перезагрузки страницы */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}
