/**
 * Общие форматтеры, используемые на нескольких экранах.
 */

/**
 * Форматирует длительность в секундах → "42 мин" (через i18n).
 */
export function formatDuration(sec, t) {
  if (sec == null) return null
  const mins = Math.round(sec / 60)
  if (mins < 1) return t('home.durationLessMin')
  return t('home.durationMin', { n: mins })
}

/**
 * Форматирует дату в относительную строку: "Пн, сегодня" / "Вт, вчера" / "Ср, 3 дн. назад".
 */
export function formatDateLine(dateStr, t, weekdayNames) {
  const date = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((todayStart - dateStart) / 86400000)

  const weekday = weekdayNames[date.getDay()]
  if (diffDays === 0) return `${weekday}, ${t('home.today').toLowerCase()}`
  if (diffDays === 1) return `${weekday}, ${t('home.yesterday').toLowerCase()}`
  return `${weekday}, ${t('home.daysAgo', { n: diffDays })}`
}

export const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
