/**
 * notificationCore — чистая логика durable-очереди уведомлений.
 * Без Prisma и внешних зависимостей: всё тестируется unit'ами, время
 * передаётся явным `now` (тесты не зависят от системных часов).
 *
 * Архитектура — по образцу Flamy (см. product/NOTIFICATIONS.md).
 */

export const DEFAULT_TZ = 'Europe/Moscow'

/**
 * Локальные дата/время в TZ. Невалидная IANA-зона бросает RangeError —
 * planner учитывает такие записи отдельно, НЕ подменяя зону молча.
 * @returns {{ year:number, month:number, day:number, hour:number, minute:number, weekday:number, dayKey:string, weekKey:string }}
 */
export function localDateTimeParts(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, // RangeError на мусорной зоне — осознанно
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(now)

  const get = (t) => parts.find((p) => p.type === t)?.value
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  let hour = Number(get('hour'))
  if (hour === 24) hour = 0 // en-CA отдаёт 24 в полночь
  const minute = Number(get('minute'))
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = weekdayMap[get('weekday')] ?? 0

  return {
    year, month, day, hour, minute, weekday,
    dayKey: `${year}-${pad(month)}-${pad(day)}`,
    weekKey: isoWeekKey(year, month, day),
  }
}

/** Сдвиг календарного ключа 'YYYY-MM-DD' на N дней (через UTC-календарь). */
export function shiftDateKey(dayKey, deltaDays) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** ISO-неделя → '2026-W28'. */
export function isoWeekKey(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${pad(week)}`
}

/**
 * Due/catch-up расчёт: наступил ли запланированный локальный слот.
 *
 * Слот считается due, если локальное время внутри окна
 * [targetHour:00, targetHour:00 + windowHours) — окно догоняет расписание,
 * если backend не работал в точную минуту, в т.ч. через локальную полночь
 * (слот 23:00 остаётся due в 01:30 следующего дня при окне ≥ 3ч).
 *
 * @param {{ hour:number, minute:number, weekday:number, dayKey:string }} local — localDateTimeParts()
 * @param {{ hour:number, weekday?:number|null, windowHours?:number }} schedule
 *        weekday: null/undefined = ежедневно; число 0..6 = конкретный день
 * @returns {{ due: boolean, slotDayKey: string|null }} slotDayKey — локальная дата слота
 *        (для periodKey; при переходе через полночь — вчерашняя)
 */
export function dueSchedule(local, { hour, weekday = null, windowHours = 6 }) {
  const minutesNow = local.hour * 60 + local.minute
  const target = hour * 60
  const windowMin = windowHours * 60

  // Слот сегодняшнего локального дня
  const sinceToday = minutesNow - target
  if (sinceToday >= 0 && sinceToday < windowMin) {
    if (weekday === null || local.weekday === weekday) {
      return { due: true, slotDayKey: local.dayKey }
    }
  }

  // Слот вчерашнего дня, если окно тянется через полночь
  const sinceYesterday = minutesNow + (24 * 60 - target)
  if (sinceYesterday >= 0 && sinceYesterday < windowMin) {
    const yesterdayKey = shiftDateKey(local.dayKey, -1)
    const yesterdayWeekday = (local.weekday + 6) % 7
    if (weekday === null || yesterdayWeekday === weekday) {
      return { due: true, slotDayKey: yesterdayKey }
    }
  }

  return { due: false, slotDayKey: null }
}

/** Backoff: 1 мин → 5 → 15 → 60 → 180 (дальше — по максимуму). */
const RETRY_DELAYS_MIN = [1, 5, 15, 60, 180]

export function retryDelayMs(attempt) {
  const idx = Math.min(Math.max(attempt - 1, 0), RETRY_DELAYS_MIN.length - 1)
  return RETRY_DELAYS_MIN[idx] * 60_000
}

/**
 * Классификация ошибки доставки → retry или permanent.
 * @param {any} err
 * @param {'telegram'|'web_push'} channel
 * @returns {{ permanent: boolean, code: string, retryAfterMs?: number }}
 */
export function classifyDeliveryError(err, channel) {
  const status = err?.response?.error_code ?? err?.statusCode ?? err?.status ?? null
  const message = String(err?.message || err || '')

  if (channel === 'telegram') {
    if (status === 403) return { permanent: true, code: 'tg_forbidden' } // юзер заблокировал бота
    if (status === 400 && /chat not found/i.test(message)) return { permanent: true, code: 'tg_chat_not_found' }
    if (status === 429) {
      const retryAfter = err?.response?.parameters?.retry_after
      return { permanent: false, code: 'tg_rate_limited', retryAfterMs: retryAfter ? retryAfter * 1000 : undefined }
    }
    if (status >= 500) return { permanent: false, code: 'tg_server_error' }
  }

  if (channel === 'web_push') {
    // 404/410 конкретной подписки чистятся в webPushService; сюда доходит агрегат
    if (status === 404 || status === 410) return { permanent: true, code: 'push_gone' }
    if (status === 429) return { permanent: false, code: 'push_rate_limited' }
    if (status >= 500) return { permanent: false, code: 'push_server_error' }
  }

  // Сетевые временные
  if (/(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network|fetch failed|timeout)/i.test(message)) {
    return { permanent: false, code: 'network' }
  }

  // Неизвестное — ретраим (maxAttempts ограничит)
  return { permanent: false, code: 'unknown' }
}

/** Ограничение сохраняемого текста ошибки (в БД, не в логи юзерского текста). */
export function truncateError(message, max = 500) {
  const s = String(message ?? '')
  return s.length > max ? s.slice(0, max) : s
}

function pad(n) {
  return String(n).padStart(2, '0')
}
