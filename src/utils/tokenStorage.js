// Хранение session-токена Better Auth (web-платформа).
// Один opaque-токен в localStorage: refresh-флоу нет, сервер продлевает
// сессию сам (sliding). XSS-риск смягчён серверной инвалидацией
// (sign-out, сброс пароля). В Mini App не используется — там initData.

const KEY = 'ait.session-token'
// Профиль из последней проверенной сессии: старт PWA рисует приложение сразу,
// не дожидаясь getSession (он идёт фоном и при невалидной сессии уводит на логин)
const USER_KEY = 'ait.session-user'

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
      // Новый токен — возможно, другой аккаунт: профиль узнаем заново
      localStorage.removeItem(USER_KEY)
    } catch {
      /* private mode — сессия проживёт до перезагрузки страницы */
    }
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    } catch {
      return null
    }
  },
  setUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
      localStorage.removeItem(USER_KEY)
    } catch {
      /* ignore */
    }
  },
}
