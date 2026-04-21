import prisma from './prisma.js'

/**
 * Fire-and-forget событие. Вызывается БЕЗ await, не блокирует ответ пользователю.
 * Ошибки логируются, но никогда не пробрасываются наверх.
 *
 * Примеры:
 *   track(userId, 'workout_logged', { workoutId, totalSets: 12 })
 *   track(null, 'unauthorized_access', { path: req.path })
 */
export function track(userId, event, payload) {
  prisma.analyticsEvent
    .create({
      data: {
        userId: userId ?? null,
        event,
        payload: payload ?? null,
      },
    })
    .catch((err) => {
      // Аналитика не должна ронять основной поток.
      console.error('[analytics] failed to track', event, err.message)
    })
}
