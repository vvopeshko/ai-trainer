/**
 * webPushService — доставка Web Push на все подписки юзера (VAPID).
 *
 * Без VAPID-ключей сервис выключен: enabled()=false, планировщик не выберет
 * канал web_push, эндпоинты подписки отвечают 503. Подписки, на которые push
 * service ответил 404/410 (protocol: юзер отозвал/переустановил), удаляются.
 */
import webpush from 'web-push'
import prisma from '../utils/prisma.js'

let configured = false

export function webPushEnabled() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null
}

function ensureConfigured() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@gymwithai.me',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  configured = true
}

/**
 * Отправить payload на все устройства юзера.
 * @param {string} userId
 * @param {{ title: string, body?: string, url?: string, tag?: string }} payload
 * @returns {Promise<{ sent: number, gone: number, failed: number, lastError: any }>}
 *   sent=0 && подписок не было → у вызывающего permanent skip/fail
 */
export async function sendPushToUser(userId, payload) {
  if (!webPushEnabled()) {
    const err = new Error('web push is not configured')
    err.statusCode = 503
    throw err
  }
  ensureConfigured()

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) {
    return { sent: 0, gone: 0, failed: 0, lastError: null, noSubscriptions: true }
  }

  const body = JSON.stringify(payload)
  let sent = 0
  let gone = 0
  let failed = 0
  let lastError = null

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 3600 }, // час: протухшая сводка не догоняет юзера вечером
        )
        sent += 1
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          gone += 1
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          failed += 1
          lastError = err
        }
      }
    }),
  )

  return { sent, gone, failed, lastError }
}
