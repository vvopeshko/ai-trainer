import { Router } from 'express'
import { z } from 'zod'
import prisma from '../utils/prisma.js'
import { auth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { webPushEnabled, getVapidPublicKey } from '../services/webPushService.js'
import { track } from '../utils/analytics.js'

// Web Push подписки PWA. Всё под auth (tma или Bearer — подписаться можно
// с любой платформы, но реально работает в браузере/standalone).

const router = Router()
router.use(auth)

/** GET /api/v1/push/key — VAPID public key для pushManager.subscribe. */
router.get('/key', (req, res) => {
  if (!webPushEnabled()) return res.status(503).json({ error: 'Web push is not configured' })
  res.json({ publicKey: getVapidPublicKey() })
})

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
})

/** POST /api/v1/push/subscribe — сохранить/переприсвоить подписку устройства. */
router.post('/subscribe', authLimiter, async (req, res, next) => {
  try {
    if (!webPushEnabled()) return res.status(503).json({ error: 'Web push is not configured' })
    const { endpoint, keys } = subscribeSchema.parse(req.body)

    // upsert по endpoint: подписка могла принадлежать другому юзеру на этом же
    // устройстве (сменили аккаунт) — переприсваиваем текущему
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: (req.header('user-agent') || '').slice(0, 255) || null,
      },
      update: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
    })
    track(req.user.id, 'push_subscribed')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1024) })

/** DELETE /api/v1/push/subscribe — удалить подписку устройства. */
router.delete('/subscribe', async (req, res, next) => {
  try {
    const { endpoint } = unsubscribeSchema.parse(req.body)
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user.id },
    })
    track(req.user.id, 'push_unsubscribed')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
