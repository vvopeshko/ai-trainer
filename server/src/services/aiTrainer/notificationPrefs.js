/**
 * notificationPrefs — проверка настроек уведомлений пользователя.
 *
 * Хранятся в UserProfile.notificationsJson (Json?). null = дефолт «всё включено»
 * (UI-переключатели появятся позже на /me). Ключи: postWorkout, weekly, monthly,
 * reminders, records. Любой ключ считается включённым, пока явно не выставлен в false.
 */
import prisma from '../../utils/prisma.js'

/**
 * @param {string} userId
 * @param {'postWorkout'|'weekly'|'monthly'|'reminders'|'records'} key
 * @returns {Promise<boolean>}
 */
export async function isNotificationEnabled(userId, key) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { notificationsJson: true },
  })
  const prefs = profile?.notificationsJson
  if (!prefs || typeof prefs !== 'object') return true // null = всё включено
  return prefs[key] !== false
}
