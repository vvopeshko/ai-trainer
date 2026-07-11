import prisma from './prisma.js'
import { track } from './analytics.js'

// Session-tracking, общий для обеих веток auth (tma → telegramAuth, Bearer → Better Auth):
// debounce-обновление lastSeenAt/timezone + событие user_seen не чаще раза в 5 мин на юзера.
// Вынесен из telegramAuth, иначе web-юзеры выпадали бы из DAU/WAU.

const userLastSeen = new Map() // userId → timestamp
const SEEN_INTERVAL = 5 * 60 * 1000

/**
 * Fire-and-forget: не await'ится, ошибки глотаются.
 * @param {{ id: string, timezone?: string|null }} user
 * @param {{ timezone?: string|null, path?: string|null }} [meta]
 */
export function trackSeen(user, { timezone = null, path = null } = {}) {
  const now = Date.now()
  const lastSeen = userLastSeen.get(user.id)
  if (lastSeen && now - lastSeen <= SEEN_INTERVAL) return

  userLastSeen.set(user.id, now)
  const updateData = { lastSeenAt: new Date() }
  if (timezone && timezone !== user.timezone) updateData.timezone = timezone
  prisma.user
    .update({ where: { id: user.id }, data: updateData })
    .catch(() => {})
  track(user.id, 'user_seen', { path })
}
