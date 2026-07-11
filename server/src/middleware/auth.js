import { fromNodeHeaders } from 'better-auth/node'
import { auth as betterAuth } from '../auth/index.js'
import { telegramAuth } from './telegramAuth.js'
import prisma from '../utils/prisma.js'
import { trackSeen } from '../utils/sessionTracking.js'

// Единый auth middleware (см. product/ARCHITECTURE_WEB_AUTH.md §4.3):
//
//   Authorization: tma <initData>  → telegramAuth (существующий, без изменений)
//   Authorization: Bearer <token>  → сессия Better Auth → prisma User → req.user
//   иначе                          → 401
//
// Route-файлы импортируют { auth } отсюда вместо { telegramAuth }.

export async function auth(req, res, next) {
  const header = req.header('authorization') || req.header('Authorization') || ''

  if (header.startsWith('tma ')) {
    return telegramAuth(req, res, next)
  }

  if (header.startsWith('Bearer ')) {
    if (!betterAuth) {
      return res.status(401).json({ error: 'Web auth is not configured' })
    }
    try {
      const session = await betterAuth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })
      if (!session?.user) {
        return res.status(401).json({ error: 'Invalid or expired session' })
      }
      // Перечитываем юзера из БД: BA отдаёт свой маппинг полей (name/image),
      // а контроллеры ждут полный prisma-объект (как из telegramAuth).
      const user = await prisma.user.findUnique({ where: { id: session.user.id } })
      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }
      req.user = user

      // Fire-and-forget lastSeenAt + timezone + analytics (debounce внутри)
      trackSeen(user, { timezone: req.header('X-Timezone') || null, path: req.path })

      return next()
    } catch (err) {
      return next(err)
    }
  }

  return res.status(401).json({ error: 'Missing Authorization: tma <initData> or Bearer <token>' })
}
