/**
 * notifier — отправка сообщений по telegramId вне update-контекста.
 *
 * Бот живёт в module scope server/src/index.js и не доступен из сервисов/шедулера,
 * где нет `ctx`. Этот модуль хранит ссылку на bot (через setBot из index.js) и даёт
 * notify() для проактивных сообщений (сводки, напоминания, инсайты).
 *
 * Семантика fire-and-forget как у track(): ошибка отправки (юзер заблокировал бота,
 * сети нет) логируется, но НЕ бросается наверх — не должна ронять основной поток.
 *
 * parse_mode: 'HTML' (не Markdown): имена упражнений/программ из LLM с непарным
 * `*`/`_` роняют Markdown-парсер Telegram. HTML экранируется escapeHtml().
 */

let _bot = null

/** Вызывается из index.js после createBot(). */
export function setBot(bot) {
  _bot = bot
}

/**
 * Экранирование под parse_mode: 'HTML'.
 * Telegram HTML поддерживает только <b>,<i>,<u>,<s>,<a>,<code>,<pre> — всё остальное
 * экранируем. Применять к динамическим вставкам (имена, числа), не к самой разметке.
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Отправить сообщение юзеру по telegramId.
 *
 * @param {bigint|number|string} telegramId — chat id (= telegramId для приватных чатов)
 * @param {string} html — текст с HTML-разметкой (динамику пропускать через escapeHtml)
 * @param {object} [opts]
 * @param {Array<Array<object>>} [opts.buttons] — inline_keyboard: массив рядов кнопок,
 *        каждая кнопка — { text, url } | { text, callback_data } | { text, web_app }
 * @returns {Promise<boolean>} true если отправлено, false при ошибке/отсутствии бота
 */
export async function notify(telegramId, html, { buttons } = {}) {
  if (!_bot) {
    console.warn('[notifier] bot not set — message skipped')
    return false
  }

  const options = { parse_mode: 'HTML', disable_web_page_preview: true }
  if (buttons?.length) {
    options.reply_markup = { inline_keyboard: buttons }
  }

  try {
    await _bot.telegram.sendMessage(String(telegramId), html, options)
    return true
  } catch (err) {
    // Юзер заблокировал бота / удалил чат → 403; не наша забота ронять поток.
    console.error('[notifier] failed to send to', String(telegramId), err.message)
    return false
  }
}
