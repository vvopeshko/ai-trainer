// Тонкий wrapper над fetch с авто-аттачем Authorization-заголовка.
// В Telegram WebApp: отдаём initData. В dev без Telegram: dev_bypass.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function authHeader() {
  const initData = window.Telegram?.WebApp?.initData
  if (initData) return `tma ${initData}`
  // Dev-bypass работает только на бэке с NODE_ENV=development.
  return 'tma dev_bypass'
}

export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: authHeader(),
    },
  })
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body ?? {}),
  })
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
