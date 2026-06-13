/**
 * chatTools — инструменты тренера для tool-use в чате (AI_TRAINER_PLAN фаза 2.3).
 *
 * Тонкие обёртки над statsService: LLM не угадывает числа, а дёргает функции.
 * Принцип «числа — кодом» (§1): statsService считает, инструмент отдаёт компактные
 * данные, LLM только интерпретирует. Read-only — ничего не меняем (действия — фаза 5).
 *
 * Резолв упражнения по имени — read-only (slug → nameRu/nameEn → alias), БЕЗ
 * auto-create (в отличие от exerciseResolver): в чате нельзя плодить упражнения.
 */
import prisma from '../../utils/prisma.js'
import {
  getPeriodStats,
  getRecords,
  getMuscleVolume,
  getExerciseHistory,
} from '../statsService.js'

const DEFAULT_TZ = 'Europe/Moscow'

// ─── Anthropic tool-схемы ───────────────────────────────────────────

export const CHAT_TOOLS = [
  {
    name: 'get_exercise_history',
    description:
      'История по конкретному упражнению: топ-вес и повторы по каждой тренировке, ' +
      'тренд прогресса. Используй когда юзер спрашивает про прогресс/динамику ' +
      'конкретного движения («как у меня жим?», «растёт ли присед?»).',
    input_schema: {
      type: 'object',
      properties: {
        exercise: {
          type: 'string',
          description: 'Название упражнения как его называет юзер (рус/англ) или slug.',
        },
      },
      required: ['exercise'],
    },
  },
  {
    name: 'get_period_stats',
    description:
      'Сводная статистика за неделю или месяц: число тренировок и тоннаж, ' +
      'сравнение с предыдущим периодом. Для вопросов «сколько я тренировался», ' +
      '«сколько тоннажа за месяц».',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week', 'month'], description: 'Период.' },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_records',
    description:
      'Личные рекорды (рост рабочего веса) за неделю или месяц. Для вопросов ' +
      '«какие у меня рекорды», «в чём прогресс».',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week', 'month'], description: 'Период.' },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_muscle_volume',
    description:
      'Объём по мышечным группам за текущую неделю: фактические подходы vs цель ' +
      'из программы. Для вопросов «что у меня отстаёт», «хватает ли объёма на спину».',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_program_details',
    description:
      'Детали активной программы: дни, упражнения, подходы/повторы, гайдлайны ' +
      'прогрессии. Для вопросов про саму программу («зачем мне столько подходов», ' +
      '«что в день 2»).',
    input_schema: { type: 'object', properties: {} },
  },
]

// ─── Read-only резолв упражнения (без auto-create) ──────────────────

async function resolveExerciseReadonly(query) {
  if (!query) return null
  const term = String(query).trim().toLowerCase()

  // slug → nameRu/nameEn (ILIKE) → alias. Один запрос с приоритетом.
  const rows = await prisma.$queryRaw`
    SELECT id, "nameRu", slug,
      CASE
        WHEN lower(slug) = ${term} THEN 0
        WHEN lower("nameRu") = ${term} OR lower("nameEn") = ${term} THEN 1
        WHEN EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) = ${term}) THEN 2
        WHEN lower("nameRu") ILIKE ${'%' + term + '%'} OR lower("nameEn") ILIKE ${'%' + term + '%'} THEN 3
        ELSE 9
      END AS priority
    FROM "Exercise"
    WHERE lower(slug) = ${term}
      OR lower("nameRu") = ${term} OR lower("nameEn") = ${term}
      OR lower("nameRu") ILIKE ${'%' + term + '%'} OR lower("nameEn") ILIKE ${'%' + term + '%'}
      OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) = ${term})
    ORDER BY priority ASC
    LIMIT 1
  `
  return rows[0] ?? null
}

// ─── Исполнитель инструментов ───────────────────────────────────────

/**
 * Возвращает executeTool(name, input) для конкретного юзера/таймзоны.
 * @param {string} userId
 * @param {string} [tz]
 */
export function buildToolExecutor(userId, tz = DEFAULT_TZ) {
  return async function executeTool(name, input = {}) {
    switch (name) {
      case 'get_exercise_history': {
        const ex = await resolveExerciseReadonly(input.exercise)
        if (!ex) {
          return { error: `Упражнение "${input.exercise}" не найдено в истории юзера.` }
        }
        const hist = await getExerciseHistory(userId, ex.id, { limit: 10 })
        if (!hist.points.length) {
          return { exercise: ex.nameRu, note: 'Юзер ещё не делал это упражнение.' }
        }
        return { exercise: ex.nameRu, ...hist }
      }

      case 'get_period_stats':
        return getPeriodStats(userId, tz, input.period === 'week' ? 'week' : 'month')

      case 'get_records':
        return getRecords(userId, tz, input.period === 'week' ? 'week' : 'month')

      case 'get_muscle_volume': {
        const groups = await getMuscleVolume(userId, tz)
        // Компактно: только группы с активностью или целью.
        return groups
          .filter((g) => g.setsActual > 0 || g.setsTarget)
          .map((g) => ({
            group: g.nameRu,
            setsActual: g.setsActual,
            setsTarget: g.setsTarget,
            subMuscles: g.subMuscles.map((s) => ({
              muscle: s.nameRu,
              actual: s.setsActual,
              target: s.setsTarget,
            })),
          }))
      }

      case 'get_program_details': {
        const prog = await prisma.program.findFirst({
          where: { userId, isActive: true },
          select: { name: true, planJson: true, guidelines: true },
        })
        if (!prog) return { note: 'У юзера нет активной программы.' }
        const days = (prog.planJson?.days || []).map((d, i) => ({
          day: i + 1,
          title: d.title || `День ${i + 1}`,
          exercises: (d.exercises || []).map((e) => ({
            name: e.nameRu,
            sets: e.sets ?? null,
            reps: e.reps ?? null,
          })),
        }))
        return { name: prog.name, days, guidelines: prog.guidelines ?? null }
      }

      default:
        return { error: `Неизвестный инструмент: ${name}` }
    }
  }
}

export default { CHAT_TOOLS, buildToolExecutor }
