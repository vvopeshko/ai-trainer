/**
 * postWorkoutSummary — пост-тренировочная сводка от тренера (AI_TRAINER_PLAN фаза 1).
 *
 * Самое частое касание тренера: после каждой завершённой тренировки.
 * Поток (fire-and-forget из finish-хука workoutController):
 *   1. числа считает statsService (принцип «числа — кодом, не LLM»);
 *   2. один llm.chat() → 2–4 предложения наблюдения тренера (тон _tone.md);
 *   3. сообщение = числовой блок (код) + наблюдение (LLM) + inline-кнопка;
 *   4. при фейле LLM — деградация до чисто числовой сводки.
 *
 * Рекорды встраиваются в это же сообщение (не отдельный пуш — анти-спам §4).
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import llm from '../../utils/llm.js'
import prisma from '../../utils/prisma.js'
import { track } from '../../utils/analytics.js'
import { notify, escapeHtml } from '../../bot/notifier.js'
import {
  getWorkoutSummary,
  getMonthStats,
  getPlanAdherence,
  getRecords,
  getWorkoutState,
} from '../statsService.js'
import { buildUserContext } from './buildUserContext.js'
import { isNotificationEnabled } from './notificationPrefs.js'

const DEFAULT_TZ = 'Europe/Moscow'
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173'

// ─── Загрузка промптов (tone + задача) ──────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const TONE = readFileSync(join(__dirname, 'prompts', '_tone.md'), 'utf-8')
const TASK = readFileSync(join(__dirname, 'prompts', 'postWorkoutSummary.md'), 'utf-8')
const SYSTEM_BASE = `${TONE}\n\n---\n\n${TASK}`

// ─── Хелперы ────────────────────────────────────────────────────────

function fmtDuration(sec) {
  if (!sec || sec <= 0) return null
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return mm ? `${h} ч ${mm} мин` : `${h} ч`
}

function fmtTopSet(topSet) {
  if (!topSet) return '—'
  return topSet.weightKg ? `${topSet.weightKg}×${topSet.reps}` : `${topSet.reps} повт`
}

/**
 * Рекорды, поставленные именно на этой тренировке: упражнение есть в тренировке
 * и недельный максимум совпал с лучшим подходом сессии (значит пик — сегодня).
 */
function detectWorkoutPRs(summary, weekRecords) {
  const bySlug = new Map(summary.exercises.map((e) => [e.slug, e]))
  return weekRecords.filter((r) => {
    const ex = bySlug.get(r.exerciseSlug)
    return ex && ex.topSet?.weightKg && Math.abs(ex.topSet.weightKg - r.value) < 0.001
  })
}

// ─── Числовой блок (код) ────────────────────────────────────────────

function buildNumbersHtml({ summary, adherence, monthStats, dayTitle, plannedCount, isFirst, prs }) {
  const done = summary.exercises.length
  const duration = fmtDuration(summary.durationSec)
  const lines = []

  // Заголовок
  if (isFirst) {
    lines.push('🎉 <b>Первая тренировка завершена!</b>')
  } else {
    lines.push(`🏁 <b>${dayTitle ? escapeHtml(dayTitle) : 'Тренировка'} — готово</b>`)
  }

  // Основная строка статистики
  const statBits = [`${done} упр.`, `${summary.setsCount} подходов`, `${summary.tonnageKg} кг`]
  if (duration) statBits.push(duration)
  lines.push(`📊 ${statBits.join(' · ')}`)

  // Частичная тренировка (не все упражнения дня)
  if (plannedCount && done < plannedCount) {
    lines.push(`▫️ Сделано ${done} из ${plannedCount} упражнений дня`)
  }

  // Прогресс по весам к прошлой такой тренировке
  const gains = summary.exercises
    .filter((e) => e.deltaWeightKg != null && e.deltaWeightKg > 0)
    .slice(0, 3)
    .map((e) => `${escapeHtml(e.nameRu)} +${e.deltaWeightKg} кг`)
  if (gains.length) lines.push(`📈 ${gains.join(', ')}`)

  // Соответствие плану недели
  if (adherence.planned) {
    lines.push(`🎯 ${adherence.done} из ${adherence.planned} тренировок на этой неделе`)
  }

  // Серия
  if (monthStats.streak > 1) lines.push(`🔥 Серия: ${monthStats.streak} дн.`)

  // Рекорды (встроены, не отдельным пушем)
  for (const r of prs) {
    lines.push(`🏆 Рекорд: ${escapeHtml(r.exerciseNameRu)} ${r.value} кг × ${r.reps}`)
  }

  return lines.join('\n')
}

// ─── Факты для LLM (вход, не Telegram — не экранируем) ──────────────

function buildFacts({ summary, adherence, monthStats, dayTitle, plannedCount, isFirst, returningAfterDays, prs }) {
  const done = summary.exercises.length
  const duration = fmtDuration(summary.durationSec)
  const head = ['Что произошло на тренировке:']
  head.push(`- День программы: ${dayTitle || '—'}`)
  head.push(`- Упражнений выполнено: ${done}${plannedCount ? ` из ${plannedCount} запланированных` : ''}`)
  head.push(`- Подходов: ${summary.setsCount}, тоннаж: ${summary.tonnageKg} кг${duration ? `, время: ${duration}` : ''}`)
  head.push(`- Серия: ${monthStats.streak} дн.; за месяц: ${monthStats.workouts} трен.`)
  if (adherence.planned) head.push(`- На этой неделе: ${adherence.done} из ${adherence.planned} тренировок`)
  if (summary.feltRating) head.push(`- Ощущения после тренировки: ${summary.feltRating}/5`)
  if (isFirst) head.push('- ЭТО ПЕРВАЯ тренировка пользователя.')
  if (returningAfterDays >= 7) head.push(`- Вернулся после паузы в ${returningAfterDays} дн.`)

  const exLines = summary.exercises.map((e) => {
    const delta =
      e.deltaWeightKg != null && e.deltaWeightKg !== 0
        ? ` (${e.deltaWeightKg > 0 ? '+' : ''}${e.deltaWeightKg} кг к прошлому разу)`
        : ''
    return `- ${e.nameRu}: ${fmtTopSet(e.topSet)}${delta}`
  })

  const blocks = [
    head.join('\n'),
    `По упражнениям (лучший рабочий подход):\n${exLines.join('\n')}`,
  ]
  if (prs.length) {
    blocks.push(
      `Новые рекорды на этой тренировке:\n${prs
        .map((r) => `- ${r.exerciseNameRu}: ${r.value} кг × ${r.reps} (было ${r.previousBest} кг)`)
        .join('\n')}`,
    )
  }
  return blocks.join('\n\n')
}

// ─── Рендер (общий для legacy-отправки и durable-очереди) ───────────

/**
 * Собрать пост-тренировочную сводку без отправки. Очередь сохраняет результат
 * в job: retry доставки НЕ зовёт LLM повторно.
 *
 * @param {{ id: string, timezone?: string|null }} user
 * @param {{ id: string, programId?: string|null, programDayIndex?: number|null }} workout
 * @returns {Promise<{ skip: string } | { html, pushTitle, pushBody, url, buttons, meta }>}
 */
export async function renderPostWorkoutSummary(user, workout) {
  {
    const userId = user.id
    const tz = user.timezone || DEFAULT_TZ

    if (!(await isNotificationEnabled(userId, 'postWorkout'))) return { skip: 'digest_disabled' }

    const summary = await getWorkoutSummary(workout.id)
    // Пустая/удалённая тренировка (0 сетов) — ничего не шлём.
    if (!summary) return { skip: 'empty_workout' }

    // Числа — кодом. Параллельно.
    const [monthStats, adherence, weekRecords, workoutState, prevWorkout, program] =
      await Promise.all([
        getMonthStats(userId, tz),
        getPlanAdherence(userId, tz),
        getRecords(userId, tz, 'week'),
        getWorkoutState(userId),
        prisma.workout.findFirst({
          where: { userId, finishedAt: { not: null }, id: { not: workout.id } },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true },
        }),
        workout.programId != null && workout.programDayIndex != null
          ? prisma.program.findFirst({
              where: { id: workout.programId, userId },
              select: { planJson: true },
            })
          : Promise.resolve(null),
      ])

    const day = program?.planJson?.days?.[workout.programDayIndex]
    const dayTitle = day?.title || null
    const plannedCount = day?.exercises?.length ?? null

    const isFirst = workoutState.totalFinished <= 1
    const returningAfterDays =
      prevWorkout && summary.finishedAt
        ? Math.floor(
            (new Date(summary.finishedAt) - new Date(prevWorkout.finishedAt)) / 86400000,
          )
        : 0

    const prs = detectWorkoutPRs(summary, weekRecords)

    const ctx = { summary, adherence, monthStats, dayTitle, plannedCount, isFirst, returningAfterDays, prs }
    const numbersHtml = buildNumbersHtml(ctx)

    // Наблюдение тренера (LLM) — с деградацией.
    let observation = null
    try {
      const userContext = await buildUserContext(userId, { recentLimit: 5 })
      const system = userContext ? `${SYSTEM_BASE}\n\n---\n\n# Контекст пользователя\n${userContext}` : SYSTEM_BASE
      const res = await llm.chat([{ role: 'user', content: buildFacts(ctx) }], {
        system,
        maxTokens: 512,
        meta: { userId, feature: 'post_workout' },
      })
      observation = res.text?.trim() || null
    } catch (err) {
      console.error('[postWorkoutSummary] LLM failed, degrading to numbers-only:', err.message)
    }

    const html = observation ? `${numbersHtml}\n\n${escapeHtml(observation)}` : numbersHtml

    // Кнопка «Детали» → progress. web_app только при https (Telegram-требование).
    const buttons = WEBAPP_URL.startsWith('https://')
      ? [[{ text: '📊 Детали', web_app: { url: `${WEBAPP_URL}/progress` } }]]
      : undefined

    const tonnage = summary.tonnageKg != null ? ` · ${summary.tonnageKg} кг` : ''
    return {
      html,
      pushTitle: `Тренировка записана: ${summary.setsCount} подходов${tonnage}`,
      pushBody: observation || 'Открой детали — посмотри цифры и рекорды',
      url: '/progress',
      buttons,
      meta: { workoutId: workout.id, hadObservation: Boolean(observation), prCount: prs.length, isFirst },
    }
  }
}

// ─── Legacy-отправка (rollback-путь при NOTIFICATION_QUEUE=off) ──────

/**
 * Сформировать и отправить пост-тренировочную сводку в Telegram.
 * Fire-and-forget: вызывается без await из finish-хука, ошибки не пробрасывает.
 *
 * @param {{ id: string, telegramId: bigint, timezone?: string|null }} user — req.user
 * @param {{ id: string, programId?: string|null, programDayIndex?: number|null }} workout
 * @returns {Promise<boolean>} true если сообщение отправлено
 */
export async function sendPostWorkoutSummary(user, workout) {
  try {
    // Сводка уходит через бота: web-only юзеру (telegramId=null) слать некуда —
    // выходим до LLM-вызова, чтобы не жечь токены впустую.
    if (!user.telegramId) return false

    const rendered = await renderPostWorkoutSummary(user, workout)
    if (rendered.skip) return false

    const sent = await notify(user.telegramId, rendered.html, { buttons: rendered.buttons })

    track(user.id, 'summary_sent', { sent, ...rendered.meta })

    return sent
  } catch (err) {
    // Fire-and-forget: не роняем основной поток finish-хука.
    console.error('[postWorkoutSummary] failed:', err.message)
    return false
  }
}
