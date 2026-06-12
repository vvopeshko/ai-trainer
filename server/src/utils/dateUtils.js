/**
 * Извлекает timezone юзера из заголовка X-Timezone или из req.user.timezone.
 * Fallback: UTC.
 */
export function getUserTimezone(req) {
  return req.header('X-Timezone') || req.user?.timezone || 'UTC'
}
