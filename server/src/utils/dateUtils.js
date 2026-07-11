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
