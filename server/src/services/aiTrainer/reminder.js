/**
 * reminder — напоминание «Готов вернуться?» при 7+ днях тишины (AI_TRAINER_PLAN фаза 3.2).
 *
 * Ежедневный тик (полдень по локальному времени). БЕЗ LLM — 3–4 заготовки с ротацией
 * (плата за вариативность тут не нужна, а LLM дорог и может фантазировать).
 *
 * Анти-спам (§3.2 + §4 «максимум 1 проактивное сообщение в день»):
 *   - шлём только тем, кто тренировался хоть раз и молчит 7+ дней;
 *   - не активна тренировка прямо сейчас;
 *   - не чаще 1 раза в 10 дней (NotificationLog kind='reminder');
 *   - после 3 неотвеченных подряд — замолкаем до возвращения в зал (уважение > retention).
 *
 * Двухуровневый claim: scheduler клеймит kind='reminder_gate' (раз в день, защита от
 * двойного тика при рестарте). Фактическую отправку фиксируем отдельной записью
 * kind='reminder' — её и читают throttle/silence-запросы.
 *
 * Экспортирует reminderJob для registerJob() (см. scheduler/jobs.js).
 */
import prisma from '../../utils/prisma.js'
import { track } from '../../utils/analytics.js'
import { notify, escapeHtml } from '../../bot/notifier.js'
import { claimNotification } from '../../scheduler/index.js'
import { isNotificationEnabled } from './notificationPrefs.js'

const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173'
const DAY_MS = 86400000
const SILENCE_DAYS = 7 // молчит N дней → можно напомнить
const THROTTLE_DAYS = 10 // не чаще 1 раза в N дней
const MAX_UNANSWERED = 3 // после N неотвеченных подряд — замолкаем

// ─── Заготовки (ротация по числу уже отправленных напоминаний) ──────

function pickTemplate(firstName, sentCount) {
  const name = firstName ? escapeHtml(firstName) : 'друг'
  const templates = [
    `Привет, ${name}! Давно тебя не было в зале — всё в порядке? Готов вместе вернуться, когда захочешь. 💪`,
    `${name}, неделя без тренировок — это нормально, бывает. Но если есть полчаса, давай разомнёмся? 😉`,
    `Эй, ${name}! Не обязательно выкладываться по полной — даже короткая сессия лучше, чем ноль. Вернёмся?`,
    `${name}, я тут и готов продолжить, когда будешь готов ты. Открой приложение — подскажу, с чего начать.`,
  ]
  return templates[sentCount % templates.length]
}

// ─── Основная функция ───────────────────────────────────────────────

/**
 * Проверить условия и при необходимости отправить напоминание.
 * Вызывается из шедулера; ошибки логируются, не пробрасываются.
 *
 * @param {{ id: string, telegramId: bigint, firstName?: string|null }} user
 * @param {{ dayKey: string }} local
 * @returns {Promise<boolean>} true если напоминание отправлено
 */
export async function sendReminder(user, local) {
  const userId = user.id

  // Настройки уведомлений.
  if (!(await isNotificationEnabled(userId, 'reminders'))) return false

  // Активная (незавершённая) тренировка → юзер в процессе, не дёргаем.
  const active = await prisma.workout.findFirst({
    where: { userId, finishedAt: null },
    select: { id: true },
  })
  if (active) return false

  // Последняя завершённая тренировка.
  const lastWorkout = await prisma.workout.findFirst({
    where: { userId, finishedAt: { not: null } },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true },
  })
  // §3.3 — новым без истории тренировок ничего не шлём.
  if (!lastWorkout) return false

  const daysSilent = Math.floor((Date.now() - new Date(lastWorkout.finishedAt).getTime()) / DAY_MS)
  if (daysSilent < SILENCE_DAYS) return false

  // Throttle: не чаще 1 раза в THROTTLE_DAYS дней.
  const lastReminder = await prisma.notificationLog.findFirst({
    where: { userId, kind: 'reminder' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  if (lastReminder && Date.now() - new Date(lastReminder.sentAt).getTime() < THROTTLE_DAYS * DAY_MS) {
    return false
  }

  // Silence: после MAX_UNANSWERED неотвеченных подряд замолкаем до возвращения.
  const recent = await prisma.notificationLog.findMany({
    where: { userId, kind: 'reminder' },
    orderBy: { sentAt: 'desc' },
    take: MAX_UNANSWERED,
    select: { sentAt: true },
  })
  if (recent.length >= MAX_UNANSWERED) {
    const oldest = recent[recent.length - 1].sentAt
    const trainedSince = await prisma.workout.findFirst({
      where: { userId, finishedAt: { gt: oldest } },
      select: { id: true },
    })
    if (!trainedSince) return false // 3 напоминания без ответа — уважаем тишину
  }

  // Фиксируем отправку записью kind='reminder' (её читают throttle/silence).
  const claimed = await claimNotification(userId, 'reminder', local.dayKey)
  if (!claimed) return false

  // Текст — заготовка по числу уже отправленных (для ротации).
  const sentCount = await prisma.notificationLog.count({ where: { userId, kind: 'reminder' } })
  const html = pickTemplate(user.firstName, sentCount - 1)

  const buttons = WEBAPP_URL.startsWith('https://')
    ? [[{ text: '▶️ Начать тренировку', web_app: { url: `${WEBAPP_URL}/` } }]]
    : undefined

  const sent = await notify(user.telegramId, html, { buttons })

  track(userId, 'reminder_sent', { sent, daysSilent, sentCount })

  return sent
}

// ─── Джоб для шедулера ──────────────────────────────────────────────

/**
 * Напоминание: ежедневно в 12:00 по локальному времени юзера.
 * kind='reminder_gate' — дневной шлюз (claim защищает от двойного тика).
 * Реальная отправка фиксируется отдельной записью kind='reminder' внутри run.
 */
export const reminderJob = {
  kind: 'reminder_gate',
  shouldRun(local) {
    return local.hour === 12 ? local.dayKey : null
  },
  run(user, local) {
    return sendReminder(user, local)
  },
}
