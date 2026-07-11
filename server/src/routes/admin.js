import { Router } from 'express'
import prisma from '../utils/prisma.js'

// Админ-диагностика (не под telegram/BA auth — гейт по ANALYTICS_SECRET).
// payload/renderedText не возвращаются: содержимое уведомлений не раскрываем.

const router = Router()

router.use((req, res, next) => {
  const secret = process.env.ANALYTICS_SECRET
  if (!secret || req.query.key !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

/** GET /api/v1/admin/notifications?key=... — состояние очереди. */
router.get('/notifications', async (req, res, next) => {
  try {
    const [byStatus, oldestQueued, recentProblems] = await Promise.all([
      prisma.notificationJob.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.notificationJob.findFirst({
        where: { status: { in: ['pending', 'retry'] } },
        orderBy: { scheduledFor: 'asc' },
        select: { id: true, type: true, status: true, scheduledFor: true, attempts: true },
      }),
      prisma.notificationJob.findMany({
        where: { status: { in: ['failed', 'skipped'] } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true, type: true, channel: true, status: true,
          errorCode: true, attempts: true, updatedAt: true,
        },
      }),
    ])

    res.json({
      queue: process.env.NOTIFICATION_QUEUE || 'off',
      worker: process.env.NOTIFICATION_WORKER || 'on',
      counts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      oldestQueued,
      recentProblems,
    })
  } catch (err) {
    next(err)
  }
})

export default router
