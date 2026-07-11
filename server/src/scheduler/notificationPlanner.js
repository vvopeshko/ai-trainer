/**
 * notificationPlanner — идемпотентное создание NotificationJob (этап 1 из 3).
 *
 * Минутный тик: для каждого юзера с доступным каналом (telegramId или
 * push-подписка) считает локальное время и создаёт jobs для наступивших
 * слотов одним createMany({ skipDuplicates }) — unique-ключ
 * [type, recipientKey, periodKey] гарантирует один job на период даже при
 * нескольких инстансах backend.
 *
 * Плановые типы v1: weekly (вс 19:00 локально, catch-up 24ч).
 * Событийные (post_workout) создаёт enqueueNotification() из контроллера.
 * reminder остаётся на legacy-шедулере (telegram-only) — см. NOTIFICATIONS.md.
 */
import prisma from '../utils/prisma.js'
import { localDateTimeParts, dueSchedule, DEFAULT_TZ } from './notificationCore.js'
import { webPushEnabled } from '../services/webPushService.js'

// Расписания плановых типов. weekday: 0=Вс.
const SCHEDULES = [
  { type: 'weekly', hour: 19, weekday: 0, windowHours: 24, periodKeyOf: (local) => local.weekKey },
]

export function queueMode() {
  const v = process.env.NOTIFICATION_QUEUE || 'off'
  return ['off', 'shadow', 'on'].includes(v) ? v : 'off'
}

/** Выбор канала в момент планирования (канал фиксируется в job). */
export function pickChannel(user) {
  if (user.telegramId) return 'telegram'
  if (webPushEnabled() && user._count?.pushSubscriptions > 0) return 'web_push'
  return null // доставить нечем — job не создаём
}

/**
 * Один проход планировщика.
 * @param {Date} [now]
 * @returns {Promise<{ users:number, due:number, created:number, invalidTimezone:number }>}
 */
export async function planTick(now = new Date()) {
  const mode = queueMode()
  if (mode === 'off') return { users: 0, due: 0, created: 0, invalidTimezone: 0 }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ telegramId: { not: null } }, { pushSubscriptions: { some: {} } }],
    },
    select: {
      id: true,
      telegramId: true,
      timezone: true,
      _count: { select: { pushSubscriptions: true } },
    },
  })

  const jobs = []
  let due = 0
  let invalidTimezone = 0

  for (const user of users) {
    const channel = pickChannel(user)
    if (!channel) continue

    const tz = user.timezone || DEFAULT_TZ
    let local
    try {
      local = localDateTimeParts(now, tz)
    } catch {
      invalidTimezone += 1
      local = localDateTimeParts(now, DEFAULT_TZ)
    }

    for (const schedule of SCHEDULES) {
      const { due: isDue } = dueSchedule(local, schedule)
      if (!isDue) continue
      due += 1
      jobs.push({
        type: schedule.type,
        channel,
        recipientKey: `user:${user.id}`,
        periodKey: schedule.periodKeyOf(local),
        timezone: tz,
        scheduledFor: now,
        // Shadow: jobs создаются сразу skipped — проверяем планирование без доставки,
        // legacy продолжает слать. Unique-ключ при переключении на 'on' не даст дубля.
        ...(mode === 'shadow' && { status: 'skipped', errorCode: 'SHADOW_MODE' }),
      })
    }
  }

  let created = 0
  if (jobs.length > 0) {
    const res = await prisma.notificationJob.createMany({ data: jobs, skipDuplicates: true })
    created = res.count
  }

  if (created > 0 || invalidTimezone > 0) {
    console.log(
      `[notifications][planner] users=${users.length} due=${due} created=${created} invalidTimezone=${invalidTimezone}`,
    )
  }
  return { users: users.length, due, created, invalidTimezone }
}

/**
 * Событийный job (post_workout и будущие) — из контроллеров.
 * Идемпотентен по [type, recipientKey, periodKey]; при queue=off/shadow
 * не создаёт ничего (вызывающий использует legacy-путь).
 *
 * @returns {Promise<boolean>} true если job создан (доставит очередь)
 */
export async function enqueueNotification({ type, user, periodKey, payload = null }) {
  if (queueMode() !== 'on') return false

  // req.user приходит без _count — канал резолвим сами
  let channel = user.telegramId ? 'telegram' : null
  if (!channel && webPushEnabled()) {
    const subs = await prisma.pushSubscription.count({ where: { userId: user.id } })
    if (subs > 0) channel = 'web_push'
  }
  if (!channel) return false

  const res = await prisma.notificationJob.createMany({
    data: [
      {
        type,
        channel,
        recipientKey: `user:${user.id}`,
        periodKey,
        timezone: user.timezone || DEFAULT_TZ,
        scheduledFor: new Date(),
        payload,
      },
    ],
    skipDuplicates: true,
  })
  return res.count > 0
}
