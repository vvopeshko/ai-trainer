import { apiPost } from './api.js'

/**
 * Handoff в чат-бота с контекстом (AI_TRAINER_PLAN фаза 2.2).
 *
 * Сохраняет на бэке, о чём юзер хочет спросить (POST /chat/context), и открывает
 * бота через openTelegramLink. Бот при следующем сообщении подхватит контекст.
 *
 * @param {object|null} webApp — window.Telegram.WebApp (из useTelegram), null в dev
 * @param {{ type: 'exercise'|'program'|'workout', refId?: string }} ctx
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function openTrainerChat(webApp, { type, refId } = {}) {
  const { link } = await apiPost('/api/v1/chat/context', { type, refId })
  if (!link) return { ok: false, reason: 'no_bot' }

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(link)
  } else {
    // dev / вне Telegram — открываем ссылку в новой вкладке
    window.open(link, '_blank', 'noopener')
  }
  return { ok: true }
}
