/**
 * scheduler — почасовой cron-тик для проактивных сообщений тренера.
 *
 * Один процесс с Express+ботом (см. ARCHITECTURE «один процесс»). Тик раз в час;
 * для каждого юзера вычисляем локальное время через User.timezone (fallback
 * Europe/Moscow) и спрашиваем зарегистрированные джобы, надо ли слать.
 *
 * Идемпотентность (Railway рестартует процесс): перед отправкой claimNotification()
 * делает create в NotificationLog; дубль по @@unique([userId, kind, periodKey]) =
 * сообщение уже отправлено → пропуск.
 *
 * Сами джобы (пост-сводки, weekly, reminders) регистрируются в фазах 1+ через
 * registerJob(). В фазе 0 — только инфраструктура.
 */
import cron from 'node-cron'
import prisma from '../utils/prisma.js'

export const DEFAULT_TZ = 'Europe/Moscow'

/** @type {Array<{ kind: string, shouldRun: (local, user) => (string|null), run: (user, local) => Promise<void> }>} */
const jobs = []
let task = null

/**
 * Зарегистрировать джоб.
 * @param {object} job
 * @param {string} job.kind — стабильный идентификатор (идёт в NotificationLog.kind)
 * @param {(local: LocalTime, user: object) => string|null} job.shouldRun
 *        возвращает periodKey если пора слать, иначе null
 * @param {(user: object, local: LocalTime) => Promise<void>} job.run
 */
export function registerJob(job) {
  jobs.push(job)
}

/**
 * Идемпотентная отметка отправки. true = можно слать (только что записали),
 * false = уже отправляли в этом периоде (дубль) или ошибка БД.
 */
export async function claimNotification(userId, kind, periodKey) {
  try {
    await prisma.notificationLog.create({ data: { userId, kind, periodKey } })
    return true
  } catch (err) {
    if (err?.code === 'P2002') return false // unique violation — уже слали
    console.error('[scheduler] claimNotification failed', kind, periodKey, err.message)
    return false
  }
}

/**
 * @typedef {object} LocalTime
 * @property {number} hour    — 0..23 в TZ юзера
 * @property {number} weekday — 0=Вс..6=Сб
 * @property {string} dayKey  — '2026-06-13'
 * @property {string} weekKey — '2026-W24' (ISO-неделя)
 * @property {string} monthKey— '2026-06'
 */

/** Разбор локального времени юзера в TZ. */
export function getLocalTime(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
  }).formatToParts(date)

  const get = (t) => parts.find((p) => p.type === t)?.value
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  let hour = Number(get('hour'))
  if (hour === 24) hour = 0 // en-CA иногда отдаёт 24 в полночь

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = weekdayMap[get('weekday')] ?? 0

  const dayKey = `${year}-${pad(month)}-${pad(day)}`
  const monthKey = `${year}-${pad(month)}`
  const weekKey = isoWeekKey(year, month, day)

  return { hour, weekday, dayKey, weekKey, monthKey }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/** ISO-неделя по локальной дате юзера → '2026-W24'. */
export function isoWeekKey(year, month, day) {
  // Считаем по UTC от локальных Y-M-D (без сдвига TZ — нам нужен только номер недели).
  const d = new Date(Date.UTC(year, month - 1, day))
  const dayNum = d.getUTCDay() || 7 // Пн=1..Вс=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // ближайший четверг
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${pad(week)}`
}

/**
 * Один проход по всем юзерам и джобам. Экспортируется для ручного теста из скрипта.
 * @param {Date} [now]
 */
export async function tick(now = new Date()) {
  if (jobs.length === 0) return

  const users = await prisma.user.findMany({
    select: { id: true, telegramId: true, timezone: true, firstName: true },
  })

  for (const user of users) {
    const tz = user.timezone || DEFAULT_TZ
    let local
    try {
      local = getLocalTime(now, tz)
    } catch {
      local = getLocalTime(now, DEFAULT_TZ)
    }

    for (const job of jobs) {
      let periodKey
      try {
        periodKey = job.shouldRun(local, user)
      } catch (err) {
        console.error('[scheduler] shouldRun failed', job.kind, err.message)
        continue
      }
      if (!periodKey) continue

      const claimed = await claimNotification(user.id, job.kind, periodKey)
      if (!claimed) continue

      try {
        await job.run(user, local)
      } catch (err) {
        console.error('[scheduler] job run failed', job.kind, user.id, err.message)
      }
    }
  }
}

/** Запуск почасового тика. Вызывается из index.js при наличии бота. */
export function startScheduler() {
  if (task) return
  task = cron.schedule('0 * * * *', () => {
    tick().catch((err) => console.error('[scheduler] tick failed', err.message))
  })
  console.log(`[scheduler] started (hourly tick, ${jobs.length} jobs)`)
}

/** Остановка (graceful shutdown). */
export function stopScheduler() {
  if (task) {
    task.stop()
    task = null
  }
}
