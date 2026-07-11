/**
 * weeklySummary — еженедельная сводка тренера (AI_TRAINER_PLAN фаза 3.1).
 *
 * Воскресенье, вечер по timezone юзера. Первый потребитель шедулера для weekly.
 * Поток (job.run из scheduler, claim уже сделан по kind='weekly' + weekKey):
 *   1. числа считает statsService (принцип «числа — кодом, не LLM»);
 *   2. условие отправки §3.3: ≥1 тренировка за неделю, иначе молчим;
 *   3. один llm.chat() → 2–4 предложения наблюдения (промпт weeklySummary.md);
 *   4. сообщение = числовой блок (код) + наблюдение (LLM) + inline-кнопки;
 *   5. при фейле LLM — деградация до чисто числовой сводки.
 *
 * Экспортирует weeklySummaryJob для registerJob() (см. scheduler/jobs.js).
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import llm from '../../utils/llm.js'
import { track } from '../../utils/analytics.js'
import { notify, escapeHtml } from '../../bot/notifier.js'
import {
  getWeekStats,
  getPlanAdherence,
  getRecords,
  computeStreak,
} from '../statsService.js'
import { buildUserContext } from './buildUserContext.js'
import { isNotificationEnabled } from './notificationPrefs.js'

const DEFAULT_TZ = 'Europe/Moscow'
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173'

// ─── Загрузка промптов (tone + задача) ──────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const TONE = readFileSync(join(__dirname, 'prompts', '_tone.md'), 'utf-8')
const TASK = readFileSync(join(__dirname, 'prompts', 'weeklySummary.md'), 'utf-8')
const SYSTEM_BASE = `${TONE}\n\n---\n\n${TASK}`

// ─── Числовой блок (код) ────────────────────────────────────────────

function fmtDelta(cur, prev) {
  const d = cur - prev
  if (d === 0) return null
  return d > 0 ? `+${d}` : `${d}`
}

function buildNumbersHtml({ weekStats, adherence, streak, records }) {
  const lines = ['📅 <b>Итоги недели</b>']

  // Тренировки + тоннаж
  const statBits = [`${weekStats.workouts} трен.`, `${weekStats.tonnageKg} кг`]
  lines.push(`📊 ${statBits.join(' · ')}`)

  // Динамика к прошлой неделе
  const dWorkouts = fmtDelta(weekStats.workouts, weekStats.prevWorkouts)
  const dTonnage = fmtDelta(weekStats.tonnageKg, weekStats.prevTonnageKg)
  if (dWorkouts || dTonnage) {
    const parts = []
    if (dWorkouts) parts.push(`${dWorkouts} трен.`)
    if (dTonnage) parts.push(`${dTonnage} кг`)
    lines.push(`📈 К прошлой неделе: ${parts.join(', ')}`)
  }

  // План недели
  if (adherence.planned) {
    if (adherence.extra > 0) {
      lines.push(`🎯 ${adherence.done} из ${adherence.planned} — план перевыполнен (+${adherence.extra})`)
    } else {
      lines.push(`🎯 ${adherence.done} из ${adherence.planned} тренировок по плану`)
    }
  }

  // Серия
  if (streak > 1) lines.push(`🔥 Серия: ${streak} дн.`)

  // Рекорды недели (топ-3, встроены — не отдельным пушем)
  for (const r of records.slice(0, 3)) {
    lines.push(`🏆 Рекорд: ${escapeHtml(r.exerciseNameRu)} ${r.value} кг × ${r.reps}`)
  }

  return lines.join('\n')
}

// ─── Факты для LLM (вход, не Telegram — не экранируем) ──────────────

function buildFacts({ weekStats, adherence, streak, records }) {
  const head = ['Что произошло за неделю:']
  head.push(`- Тренировок: ${weekStats.workouts} (прошлая неделя: ${weekStats.prevWorkouts})`)
  head.push(`- Тоннаж: ${weekStats.tonnageKg} кг (прошлая неделя: ${weekStats.prevTonnageKg} кг)`)
  if (adherence.planned) {
    head.push(`- План недели: ${adherence.done} из ${adherence.planned} тренировок` +
      (adherence.extra > 0 ? ` (перевыполнено на ${adherence.extra})` : ''))
  } else {
    head.push('- Активной программы нет (свободные тренировки).')
  }
  head.push(`- Текущая серия: ${streak} дн.`)

  const blocks = [head.join('\n')]
  if (records.length) {
    blocks.push(
      `Новые рекорды за неделю:\n${records
        .slice(0, 5)
        .map((r) => `- ${r.exerciseNameRu}: ${r.value} кг × ${r.reps} (было ${r.previousBest} кг)`)
        .join('\n')}`,
    )
  }
  return blocks.join('\n\n')
}

// ─── Рендер (общий для legacy-отправки и durable-очереди) ───────────

/**
 * Собрать сводку без отправки. Числа — кодом, наблюдение — LLM (с деградацией).
 * Очередь сохраняет результат в job: retry доставки НЕ зовёт LLM повторно.
 *
 * @param {{ id: string, timezone?: string|null }} user
 * @returns {Promise<{ skip: string } | { html: string, pushTitle: string, pushBody: string, url: string, buttons?: object[][], meta: object }>}
 */
export async function renderWeeklySummary(user) {
  const userId = user.id
  const tz = user.timezone || DEFAULT_TZ

  // Настройки уведомлений (§Фаза 0.4).
  if (!(await isNotificationEnabled(userId, 'weekly'))) return { skip: 'digest_disabled' }

  // Числа — кодом. Параллельно.
  const [weekStats, adherence, records, streak] = await Promise.all([
    getWeekStats(userId, tz),
    getPlanAdherence(userId, tz),
    getRecords(userId, tz, 'week'),
    computeStreak(userId, tz),
  ])

  // §3.3 — шлём только тем, кто тренировался на этой неделе.
  if (weekStats.workouts < 1) return { skip: 'no_activity' }

  const ctx = { weekStats, adherence, streak, records }
  const numbersHtml = buildNumbersHtml(ctx)

  // Наблюдение тренера (LLM) — с деградацией: сбой AI не отменяет сводку.
  let observation = null
  try {
    const userContext = await buildUserContext(userId, { recentLimit: 7, insights: true })
    const system = userContext
      ? `${SYSTEM_BASE}\n\n---\n\n# Контекст пользователя\n${userContext}`
      : SYSTEM_BASE
    const res = await llm.chat([{ role: 'user', content: buildFacts(ctx) }], {
      system,
      maxTokens: 512,
      meta: { userId, feature: 'weekly_summary' },
    })
    observation = res.text?.trim() || null
  } catch (err) {
    console.error('[weeklySummary] LLM failed, degrading to numbers-only:', err.message)
  }

  const html = observation ? `${numbersHtml}\n\n${escapeHtml(observation)}` : numbersHtml

  // Кнопки: отчёт + начать следующую. web_app только при https (Telegram-требование).
  const buttons = WEBAPP_URL.startsWith('https://')
    ? [
        [{ text: '📊 Отчёт', web_app: { url: `${WEBAPP_URL}/progress` } }],
        [{ text: '▶️ Начать следующую', web_app: { url: `${WEBAPP_URL}/` } }],
      ]
    : undefined

  return {
    html,
    pushTitle: `Итоги недели: ${weekStats.workouts} трен. · ${weekStats.tonnageKg} кг`,
    pushBody: observation || 'Открой отчёт — посмотри динамику недели',
    url: '/progress',
    buttons,
    meta: { hadObservation: Boolean(observation), workouts: weekStats.workouts, recordCount: records.length },
  }
}

// ─── Legacy-отправка (rollback-путь при NOTIFICATION_QUEUE=off) ──────

/**
 * Сформировать и отправить еженедельную сводку напрямую в Telegram.
 * @param {{ id: string, telegramId: bigint, timezone?: string|null }} user
 * @returns {Promise<boolean>} true если сообщение отправлено
 */
export async function sendWeeklySummary(user) {
  const rendered = await renderWeeklySummary(user)
  if (rendered.skip) return false

  const sent = await notify(user.telegramId, rendered.html, { buttons: rendered.buttons })

  track(user.id, 'summary_sent', { kind: 'weekly', sent, ...rendered.meta })

  return sent
}

// ─── Джоб для шедулера ──────────────────────────────────────────────

/**
 * weekly-сводка: воскресенье, 19:00 по локальному времени юзера.
 * periodKey = ISO-неделя (claim защищает от повторной отправки в эту неделю).
 */
export const weeklySummaryJob = {
  kind: 'weekly',
  shouldRun(local) {
    return local.weekday === 0 && local.hour === 19 ? local.weekKey : null
  },
  run(user) {
    return sendWeeklySummary(user)
  },
}
