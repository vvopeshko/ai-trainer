/**
 * chat — диалог с AI-тренером в Telegram (AI_TRAINER_PLAN фаза 2.1).
 *
 * Чат живёт в боте (бот = диалог по USER_SCENARIOS §1), мини-апп не трогаем,
 * роут /api/v1/chat намеренно НЕ делаем — Telegram-чат это и есть нативный UI.
 *
 * Поток (из bot.on('text')):
 *   1. история = последние ~20 ChatMessage из БД;
 *   2. system = роль тренера (chatTrainer.md, тон _tone.md) + buildUserContext()
 *      + контекст активной тренировки если она идёт прямо сейчас;
 *   3. один llm.chat() → ответ тренера;
 *   4. сохранить оба сообщения (user + assistant) в ChatMessage с usage из ответа.
 *
 * Деградация: при фейле LLM возвращаем мягкую отбивку, входящее сообщение всё равно
 * сохраняем (история не теряется), ассистентское — нет. Исключение: если до фейла
 * успели выполниться write-инструменты (правка программы уже в БД) — сохраняем
 * компактный след в историю, чтобы модель на следующем ходе знала о правке.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import llm from '../../utils/llm.js'
import prisma from '../../utils/prisma.js'
import { track } from '../../utils/analytics.js'
import { buildUserContext } from './buildUserContext.js'
import { CHAT_TOOLS, buildToolExecutor } from './chatTools.js'
import { peekPendingContext } from './chatContext.js'

const HISTORY_LIMIT = 20
const MAX_TOKENS = 1024
const DEFAULT_TZ = 'Europe/Moscow'

// ─── Загрузка промптов (роль + тон) ─────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const TONE = readFileSync(join(__dirname, 'prompts', '_tone.md'), 'utf-8')
const ROLE = readFileSync(join(__dirname, 'prompts', 'chatTrainer.md'), 'utf-8')
const SYSTEM_BASE = `${TONE}\n\n---\n\n${ROLE}`

const FALLBACK_REPLY =
  'Что-то я сейчас туплю — не могу ответить. Попробуй ещё раз через минуту 🙏'

/**
 * Обрабатывает входящее текстовое сообщение и возвращает ответ тренера.
 *
 * @param {{ id: string, firstName?: string }} user — пользователь из БД
 * @param {string} text — текст сообщения юзера
 * @returns {Promise<{ reply: string, degraded: boolean }>}
 */
export async function handleChatMessage(user, text) {
  const userId = user.id
  const tz = user.timezone || DEFAULT_TZ

  // Сохраняем входящее сразу — даже если LLM упадёт, история не теряется.
  await prisma.chatMessage.create({
    data: { userId, role: 'user', content: text },
  })

  // История, контекст юзера, активная тренировка и pending-контекст из мини-аппа — параллельно.
  const [historyDesc, userContext, activeCtx, pendingCtx] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    }),
    buildUserContext(userId, { recentLimit: 5 }),
    buildActiveWorkoutContext(userId),
    peekPendingContext(userId, tz),
  ])

  // findMany desc → разворачиваем в хронологический порядок.
  // Только user/assistant роли идут в messages (system собираем отдельно).
  const messages = historyDesc
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
  // API требует, чтобы первое сообщение было от user: окно из HISTORY_LIMIT
  // может обрезаться так, что первым окажется assistant — отбрасываем ведущие.
  while (messages[0]?.role === 'assistant') messages.shift()

  // Prompt caching: стабильный префикс (tools + SYSTEM_BASE ~10КБ) кэшируется
  // между сообщениями (TTL 5 мин), динамический контекст — отдельным блоком
  // с своим breakpoint'ом: внутри одного tool-цикла (до 4 запросов) префикс
  // идентичен целиком. Срезает основную часть input-токенов чата.
  let dynamicCtx = ''
  if (userContext) dynamicCtx += `\n\n---\n\n# Контекст пользователя\n${userContext}`
  if (activeCtx) dynamicCtx += `\n\n---\n\n# Активная тренировка (идёт прямо сейчас)\n${activeCtx}`
  if (pendingCtx) dynamicCtx += `\n\n---\n\n# Контекст запроса (юзер пришёл из мини-аппа)\n${pendingCtx.block}`

  const system = [
    { type: 'text', text: SYSTEM_BASE, cache_control: { type: 'ephemeral' } },
    ...(dynamicCtx
      ? [{ type: 'text', text: dynamicCtx, cache_control: { type: 'ephemeral' } }]
      : []),
  ]

  let reply = FALLBACK_REPLY
  let degraded = true
  let model = null
  let usage = null

  // Аккумулятор выполненных write-инструментов (replace/adjust/add/remove):
  // правка применяется в БД посреди tool-петли — если LLM упадёт после неё,
  // след всё равно должен попасть в историю (см. ниже).
  const writeOps = []

  try {
    const res = await llm.chat(messages, {
      system,
      maxTokens: MAX_TOKENS,
      tools: CHAT_TOOLS,
      executeTool: buildToolExecutor(userId, tz, writeOps),
      meta: { userId, feature: 'chat' },
    })
    const out = res.text?.trim()
    if (out) {
      reply = out
      degraded = false
      model = res.model
      usage = res.usage
    }
  } catch (err) {
    console.error('[chat] LLM failed:', err.message)
  }

  // Сохраняем ответ тренера только если он реальный (не отбивка-деградация).
  if (!degraded) {
    await prisma.chatMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: reply,
        model,
        tokensInput: usage?.input_tokens ?? null,
        tokensOutput: usage?.output_tokens ?? null,
      },
    })
    // Контекст из мини-аппа помечаем использованным только после успешного
    // ответа: если LLM упал и юзер переспросил — контекст ещё жив (peek/commit).
    if (pendingCtx) {
      await pendingCtx
        .commit()
        .catch((err) => console.error('[chat] pending context commit failed:', err.message))
    }
  } else if (writeOps.length) {
    // LLM упал ПОСЛЕ выполнения write-инструментов: правка уже в БД, а юзер
    // получил отбивку. Фиксируем компактный след в истории — иначе модель на
    // следующем ходе не знает о правке и может применить её повторно.
    const trail = writeOps
      .map((w) => `${w.tool} (день ${w.dayIndex + 1}, scope: ${w.scope}) — ${w.summary}`)
      .join('; ')
    await prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: `[Применил правку программы: ${trail}]` },
    })
  }

  track(userId, 'chat_message', {
    degraded,
    hadActiveWorkout: Boolean(activeCtx),
    chars: text.length,
  })

  return { reply, degraded }
}

/**
 * Контекст незавершённой тренировки для system-промпта.
 * Возвращает компактную строку или null если активной тренировки нет.
 */
async function buildActiveWorkoutContext(userId) {
  const workout = await prisma.workout.findFirst({
    where: { userId, finishedAt: null },
    orderBy: { startedAt: 'desc' },
    select: {
      programDayIndex: true,
      program: { select: { planJson: true } },
      sets: {
        orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
        select: {
          weightKg: true,
          reps: true,
          isWarmup: true,
          exercise: { select: { nameRu: true } },
        },
      },
    },
  })
  if (!workout) return null

  const lines = []

  const dayTitle = workout.program?.planJson?.days?.[workout.programDayIndex]?.title
  const plannedCount =
    workout.program?.planJson?.days?.[workout.programDayIndex]?.exercises?.length ?? null

  // Сколько разных упражнений уже сделано (по рабочим сетам).
  const doneExercises = new Set(
    workout.sets.filter((s) => !s.isWarmup).map((s) => s.exercise.nameRu),
  )
  if (dayTitle) {
    lines.push(
      `День: ${dayTitle}${plannedCount ? ` (${doneExercises.size}/${plannedCount} упражнений)` : ''}`,
    )
  } else if (plannedCount) {
    lines.push(`Сделано ${doneExercises.size}/${plannedCount} упражнений`)
  }

  // Последний рабочий сет.
  const lastWorking = [...workout.sets].reverse().find((s) => !s.isWarmup)
  if (lastWorking) {
    const w = lastWorking.weightKg
    lines.push(
      `Последний сет: ${lastWorking.exercise.nameRu} ${w ? `${w}×${lastWorking.reps}` : `${lastWorking.reps} повт.`}`,
    )
  } else {
    lines.push('Сеты ещё не записаны.')
  }

  return lines.join('\n')
}

export default { handleChatMessage }
