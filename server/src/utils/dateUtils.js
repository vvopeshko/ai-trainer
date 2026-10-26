/**
 * Проверяет, что строка — валидная IANA timezone (Intl бросает RangeError на мусоре).
 */
function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Извлекает timezone юзера из заголовка X-Timezone или из req.user.timezone.
 * Fallback: UTC.
 *
 * Заголовок подконтролен клиенту: невалидная TZ уходит в raw SQL как
 * AT TIME ZONE 'мусор' и роняет статистику 500-ками — валидируем через Intl.
 */
export function getUserTimezone(req) {
  for (const tz of [req.header('X-Timezone'), req.user?.timezone]) {
    if (tz && isValidTimezone(tz)) return tz
  }
  return 'UTC'
}

// ─── Границы периодов в TZ юзера (без похода в БД) ──────────────────

const partsFormatters = new Map() // tz → Intl.DateTimeFormat

function localParts(date, tz) {
  let fmt = partsFormatters.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    })
    partsFormatters.set(tz, fmt)
  }
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, Number(x.value)]))
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second }
}

// Смещение TZ в момент instant, мс (local − UTC)
function tzOffsetMs(instant, tz) {
  const p = localParts(new Date(instant), tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000
}

/** UTC-момент локальной полуночи y-m-d в tz (DST-safe: смещение перепроверяется). */
export function localMidnightUtc(year, month, day, tz) {
  const guess = Date.UTC(year, month - 1, day)
  let result = guess - tzOffsetMs(guess, tz)
  const corrected = guess - tzOffsetMs(result, tz)
  if (corrected !== result) result = corrected
  return new Date(result)
}

/**
 * Начало текущей недели (понедельник) и месяца в TZ юзера + сегодняшняя дата.
 * Эквивалент DATE_TRUNC('week'|'month', NOW() AT TIME ZONE tz) AT TIME ZONE tz.
 * @returns {{ weekStart: Date, monthStart: Date, today: Date }} today — полночь UTC локальной даты
 */
export function getPeriodBoundaries(tz, now = new Date()) {
  const { year, month, day } = localParts(now, tz)
  const today = new Date(Date.UTC(year, month - 1, day))
  const daysSinceMonday = (today.getUTCDay() + 6) % 7
  const monday = new Date(today.getTime() - daysSinceMonday * 86_400_000)
  return {
    weekStart: localMidnightUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), tz),
    monthStart: localMidnightUtc(year, month, 1, tz),
    today,
  }
}
