/**
 * chatContext — handoff контекста из мини-аппа в чат-бота (AI_TRAINER_PLAN фаза 2.2).
 *
 * Юзер не должен объяснять тренеру, о чём речь — контекст передаёт мини-апп.
 * Поток:
 *   1. мини-апп: POST /chat/context { type, refId } → createPendingContext()
 *      (+ проактивная подсказка через notifier) → openTelegramLink открывает бота;
 *   2. бот: при следующем сообщении consumePendingContext() берёт свежий (TTL ~10 мин)
 *      неиспользованный контекст, помечает consumed и отдаёт markdown-блок для system.
 *
 * Резолв упражнения/программы — read-only (числа считает statsService, принцип №1).
 */
import prisma from '../../utils/prisma.js'
import { escapeHtml } from '../../bot/notifier.js'
import { getExerciseHistory, getPlanAdherence } from '../statsService.js'

const TTL_MS = 10 * 60 * 1000
const DEFAULT_TZ = 'Europe/Moscow'
export const VALID_CONTEXT_TYPES = ['exercise', 'program', 'workout']

// ─── Создание (сторона мини-аппа) ───────────────────────────────────

/**
 * Создаёт pending-контекст. Старые неиспользованные гасит (актуален последний).
 * @returns {Promise<{ id: string, name: string|null }>}
 */
export async function createPendingContext(userId, type, refId) {
  let name = null
  if (type === 'exercise' && refId) {
    const ex = await prisma.exercise.findUnique({
      where: { id: refId },
      select: { nameRu: true },
    })
    name = ex?.nameRu ?? null
  } else if (type === 'program' && refId) {
    const p = await prisma.program.findFirst({
      where: { id: refId, userId },
      select: { name: true },
    })
    name = p?.name ?? null
  }

  // Гасим прежние неподхваченные — в чат уходит самый свежий запрос.
  await prisma.pendingChatContext.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  const row = await prisma.pendingChatContext.create({
    data: { userId, type, refId: refId ?? null, payload: name ? { name } : undefined },
  })
  return { id: row.id, name }
}

/** Текст проактивной подсказки (код, не LLM — простая type-aware отбивка). */
export function buildNudge(type, name) {
  if (type === 'exercise') {
    return name
      ? `Ты про <b>${escapeHtml(name)}</b> 💪 Что хочешь узнать — технику, частые ошибки, замену?`
      : 'Спрашивай про упражнение — техника, ошибки, замена?'
  }
  if (type === 'program') {
    return name
      ? `Давай обсудим программу <b>${escapeHtml(name)}</b>. Что смущает?`
      : 'Давай обсудим твою программу. Что смущает?'
  }
  if (type === 'workout') {
    return 'Ты на тренировке — спрашивай, помогу прямо по ходу.'
  }
  return 'Спрашивай — я тут.'
}

// ─── Подхват (сторона бота) ─────────────────────────────────────────

/**
 * Берёт свежий неиспользованный контекст, помечает consumed, резолвит в блок system.
 * @returns {Promise<{ type: string, block: string }|null>}
 */
export async function consumePendingContext(userId, tz = DEFAULT_TZ) {
  const cutoff = new Date(Date.now() - TTL_MS)
  const ctx = await prisma.pendingChatContext.findFirst({
    where: { userId, consumedAt: null, createdAt: { gte: cutoff } },
    orderBy: { createdAt: 'desc' },
  })
  if (!ctx) return null

  await prisma.pendingChatContext.update({
    where: { id: ctx.id },
    data: { consumedAt: new Date() },
  })

  const block = await resolveContextBlock(userId, ctx, tz)
  return block ? { type: ctx.type, block } : null
}

async function resolveContextBlock(userId, ctx, tz) {
  if (ctx.type === 'exercise' && ctx.refId) return resolveExerciseBlock(userId, ctx.refId)
  if (ctx.type === 'program') return resolveProgramBlock(userId, ctx.refId, tz)
  if (ctx.type === 'workout') {
    // Активная тренировка уже в system (buildActiveWorkoutContext, фаза 2.1) — даём подсказку.
    return 'Юзер пришёл с экрана активной тренировки — см. блок «Активная тренировка».'
  }
  return null
}

async function resolveExerciseBlock(userId, exerciseId) {
  const ex = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: {
      nameRu: true,
      primaryMuscles: true,
      secondaryMuscles: true,
      equipment: true,
      instructions: true,
      typicalMistakes: true,
      description: true,
    },
  })
  if (!ex) return null

  const lines = [`Упражнение: ${ex.nameRu}`]
  if (ex.primaryMuscles?.length) lines.push(`Основные мышцы: ${ex.primaryMuscles.join(', ')}`)
  if (ex.secondaryMuscles?.length) lines.push(`Вспомогательные: ${ex.secondaryMuscles.join(', ')}`)
  if (ex.equipment?.length) lines.push(`Оборудование: ${ex.equipment.join(', ')}`)
  if (ex.instructions) lines.push(`Техника: ${ex.instructions}`)
  if (ex.typicalMistakes) lines.push(`Частые ошибки: ${ex.typicalMistakes}`)
  else if (ex.description) lines.push(`Описание: ${ex.description}`)

  // История юзера по упражнению (числа — кодом).
  const hist = await getExerciseHistory(userId, exerciseId, { limit: 6 })
  if (hist.points.length) {
    const pts = hist.points
      .map((p) => `${p.date}: ${p.topWeightKg ? `${p.topWeightKg}×${p.reps}` : `${p.reps} повт.`} (${p.sets} сетов)`)
      .join('; ')
    lines.push(`История юзера: ${pts}`)
    if (hist.trend?.deltaWeightKg != null) {
      lines.push(`Тренд веса: ${hist.trend.deltaWeightKg >= 0 ? '+' : ''}${hist.trend.deltaWeightKg} кг за ${hist.trend.sessions} тренировок`)
    }
  } else {
    lines.push('История юзера: ещё не делал это упражнение.')
  }

  return `Юзер открыл это упражнение в мини-аппе и спрашивает про него.\n${lines.join('\n')}`
}

async function resolveProgramBlock(userId, programId, tz) {
  const where = programId ? { id: programId, userId } : { userId, isActive: true }
  const prog = await prisma.program.findFirst({
    where,
    select: { name: true, planJson: true, guidelines: true },
  })
  if (!prog) return null

  const lines = [`Программа: ${prog.name}`]
  const days = prog.planJson?.days || []
  for (const [i, d] of days.entries()) {
    const ex = (d.exercises || [])
      .map((e) => `${e.nameRu}${e.sets ? ` ${e.sets}×${e.reps ?? '—'}` : ''}`)
      .join(', ')
    lines.push(`  День ${i + 1} — ${d.title || `День ${i + 1}`}: ${ex || '—'}`)
  }
  if (prog.guidelines?.progression) {
    lines.push(`Прогрессия: ${stringifyShort(prog.guidelines.progression)}`)
  }

  const adherence = await getPlanAdherence(userId, tz)
  if (adherence.planned) {
    lines.push(`На этой неделе: ${adherence.done}/${adherence.planned} тренировок плана.`)
  }

  return `Юзер открыл программу в мини-аппе и хочет её обсудить.\n${lines.join('\n')}`
}

function stringifyShort(val) {
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val)
  } catch {
    return String(val)
  }
}
