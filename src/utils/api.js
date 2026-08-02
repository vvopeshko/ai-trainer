// Тонкий wrapper над fetch с авто-аттачем Authorization-заголовка.
// Telegram WebApp → initData; web → Bearer-токен Better Auth;
// dev-браузер без того и другого → dev_bypass (только сборка DEV).

import { tokenStorage } from './tokenStorage.js'
import { queryClient } from '../lib/queryClient.js'
import { queryKeys } from '../lib/queryKeys.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_TIMEOUT = 15_000

function authHeader() {
  const initData = window.Telegram?.WebApp?.initData
  if (initData) return `tma ${initData}`
  const token = tokenStorage.get()
  if (token) return `Bearer ${token}`
  // Dev-bypass работает только на бэке с ALLOW_DEV_BYPASS=true.
  if (import.meta.env.DEV) return 'tma dev_bypass'
  return null
}

// TZ считаем один раз при загрузке модуля: Intl.DateTimeFormat().resolvedOptions()
// на Android WebView небесплатен, а зона в рамках сессии не меняется.
const TIMEZONE = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone }
  catch { return 'UTC' }
})()

function baseHeaders() {
  const headers = { 'X-Timezone': TIMEZONE }
  const auth = authHeader()
  if (auth) headers.Authorization = auth
  return headers
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
    headers: baseHeaders(),
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiPost(path, body, { timeout, signal } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/json',
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
      ...baseHeaders(),
      'Content-Type': 'application/json',
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
      ...baseHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
    signal,
  }, timeout)
  if (!res.ok) throw await makeError(res)
  return res.json()
}

export async function apiDelete(path, { timeout, signal, body } = {}) {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: body ? { ...baseHeaders(), 'Content-Type': 'application/json' } : baseHeaders(),
    ...(body && { body: JSON.stringify(body) }),
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
  // Hard paywall: сервер отбил запрос requirePremium'ом — рефетчим статус
  // подписки, BillingGate уведёт на /paywall сам (ARCHITECTURE_PAYMENTS.md §5.4)
  if (res.status === 403 && payload?.code === 'PREMIUM_REQUIRED') {
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.status })
  }
  const err = new Error(payload?.error ?? `HTTP ${res.status}`)
  err.status = res.status
  err.payload = payload
  return err
}
