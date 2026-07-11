import { apiGet, apiPost, apiDelete } from './api.js'

// Web Push подписка (PWA). Работает только на web-платформе с зарегистрированным
// SW; на iOS — только в установленном приложении (standalone, iOS 16.4+).

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Текущая подписка устройства (null если нет). */
export async function getPushSubscription() {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/**
 * Подписаться: разрешение → pushManager.subscribe (VAPID key с сервера) →
 * сохранить подписку на сервере.
 * @returns {Promise<'subscribed'|'denied'|'unsupported'|'error'>}
 */
export async function subscribePush() {
  if (!isPushSupported()) return 'unsupported'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const { publicKey } = await apiGet('/api/v1/push/key')
    const reg = await navigator.serviceWorker.ready
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }))

    await apiPost('/api/v1/push/subscribe', subscription.toJSON())
    return 'subscribed'
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return 'error'
  }
}

/** Отписать текущее устройство (и на сервере, и в браузере). */
export async function unsubscribePush() {
  try {
    const subscription = await getPushSubscription()
    if (!subscription) return true
    await apiDelete('/api/v1/push/subscribe', { body: { endpoint: subscription.endpoint } })
      .catch(() => {}) // сервер почистит по 410 при следующей отправке
    await subscription.unsubscribe()
    return true
  } catch {
    return false
  }
}

// VAPID public key: base64url → Uint8Array (формат pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i)
  return output
}
