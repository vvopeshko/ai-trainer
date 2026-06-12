// Тонкий wrapper над fetch с авто-аттачем Authorization-заголовка.
// В Telegram WebApp: отдаём initData. В dev без Telegram: dev_bypass.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_TIMEOUT = 15_000

function authHeader() {
  const initData = window.Telegram?.WebApp?.initData
  if (initData) return `tma ${initData}`
  // Dev-bypass работает только на бэке с NODE_ENV=development.
  return 'tma dev_bypass'
}

function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const timeoutController = new AbortController()
  const id = setTimeout(() => timeoutController.abort(), timeout)
  // Если передан внешний signal, совмещаем: любой из двух прерывает запрос
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal
  return fetch(url, { ...options, signal })
    .finally(() => clearTimeout(id))
}

export async function apiGet(path, { timeout, signal } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    headers: {
      Authorization: authHeader(),
    },
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiPost(path, body, { timeout, signal } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body ?? {}),
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiPut(path, body, { timeout, signal } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body ?? {}),
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiPatch(path, body, { timeout, signal } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body ?? {}),
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiDelete(path, { timeout, signal } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: authHeader(),
    },
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

async function makeError(res) {
  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* ignore */
  }
  const err = new Error(payload?.error ?? `HTTP ${res.status}`)
  err.status = res.status
  err.payload = payload
  return err
}
