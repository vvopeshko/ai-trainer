/**
 * chatTools — инструменты тренера для tool-use в чате.
 *
 * Read-инструменты (фаза 2.3 + 5): тонкие обёртки над statsService — LLM не
 * угадывает числа, а дёргает функции. Принцип «числа — кодом» (§1).
 *
 * Write-инструменты (фаза 5 — рефайн программы): replace/adjust/add/remove
 * упражнений через programEditor. Применяются по дисциплине propose→confirm
 * (см. chatTrainer.md): модель сначала описывает предложение текстом и зовёт
 * write-инструмент ТОЛЬКО после явного «да» юзера.
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
  getLoggedExercisesSummary,
} from '../statsService.js'
import { getRecentWorkouts } from './buildUserContext.js'
import { applyProgramEdit, computeNextDayIndex } from './programEditor.js'
import { track } from '../../utils/analytics.js'

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
      'Детали активной программы: дни (с dayIndex), упражнения, подходы/повторы, ' +
      'гайдлайны прогрессии. Для вопросов про саму программу («зачем мне столько ' +
      'подходов», «что в день 2») И как первый шаг перед правкой программы — чтобы ' +
      'узнать dayIndex и точные названия упражнений.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_logged_exercises',
    description:
      'Полный список упражнений, которые юзер хоть раз логировал: сколько ' +
      'тренировок (sessions), дата последней, последний топ-вес. Это «словарь» ' +
      'движений юзера — бери отсюда, что можно запросить в get_exercise_history. ' +
      'Для вопросов «какие упражнения я делал», «что я вообще тренирую».',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_workouts',
    description:
      'Последние N завершённых тренировок: дата, день программы, ключевые подъёмы. ' +
      'Используй когда юзер просит обзор истории («покажи последние тренировки», ' +
      '«что я делал на неделе»). Историю тяни этим инструментом — не выдумывай.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Сколько тренировок вернуть (default 10, max 30).',
        },
      },
    },
  },
  {
    name: 'search_exercises',
    description:
      'Поиск упражнений ТОЛЬКО в существующем каталоге (920+ упр.). Возвращает ' +
      'id, nameRu, primaryMuscles, equipment. Используй чтобы найти кандидата для ' +
      'замены/добавления и получить его id (toExerciseId) — иначе изменить программу ' +
      'нельзя. Можно фильтровать по мышце и оборудованию.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Текст для поиска по названию/синонимам (рус/англ).' },
        muscle: {
          type: 'string',
          description:
            'Фильтр по основной мышце (англ. ключ): chest, lats, biceps, triceps, ' +
            'quadriceps, hamstrings, glutes, shoulders, calves, abdominals и т.п.',
        },
        equipment: {
          type: 'string',
          description: 'Фильтр по оборудованию (англ.): barbell, dumbbell, machine, cable, bodyweight и т.п.',
        },
      },
    },
  },
  {
    name: 'replace_exercise',
    description:
      'Заменить упражнение в дне программы на другое из каталога (сохраняя подходы/' +
      'повторы/отдых). ВЫЗЫВАЙ ТОЛЬКО после явного подтверждения юзера. Сначала ' +
      'найди замену через search_exercises и возьми её id (toExerciseId).',
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['program', 'next'],
          description: '"program" — менять во все следующие тренировки (шаблон); "next" — только в ближайшую.',
        },
        dayIndex: { type: 'integer', description: 'Индекс дня в программе (0-based). Узнай через get_program_details.' },
        fromExercise: { type: 'string', description: 'Какое упражнение заменить (название/slug как в программе).' },
        toExerciseId: { type: 'string', description: 'id нового упражнения из search_exercises.' },
      },
      required: ['scope', 'dayIndex', 'fromExercise', 'toExerciseId'],
    },
  },
  {
    name: 'adjust_exercise',
    description:
      'Скорректировать параметры упражнения в дне программы: подходы (sets), ' +
      'повторы (repsMin/repsMax), отдых (restSec). ВЫЗЫВАЙ ТОЛЬКО после явного ' +
      'подтверждения юзера. Передавай только меняемые поля.',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['program', 'next'] },
        dayIndex: { type: 'integer', description: 'Индекс дня (0-based).' },
        exercise: { type: 'string', description: 'Какое упражнение менять (название/slug).' },
        sets: { type: 'integer' },
        repsMin: { type: 'integer' },
        repsMax: { type: 'integer' },
        restSec: { type: 'integer' },
      },
      required: ['scope', 'dayIndex', 'exercise'],
    },
  },
  {
    name: 'add_exercise',
    description:
      'Добавить упражнение в день программы. ВЫЗЫВАЙ ТОЛЬКО после явного ' +
      'подтверждения юзера. Сначала найди упражнение через search_exercises (нужен toExerciseId).',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['program', 'next'] },
        dayIndex: { type: 'integer', description: 'Индекс дня (0-based).' },
        toExerciseId: { type: 'string', description: 'id упражнения из search_exercises.' },
        sets: { type: 'integer' },
        repsMin: { type: 'integer' },
        repsMax: { type: 'integer' },
        restSec: { type: 'integer', description: 'Отдых в секундах (по умолчанию 90).' },
      },
      required: ['scope', 'dayIndex', 'toExerciseId', 'sets', 'repsMin', 'repsMax'],
    },
  },
  {
    name: 'remove_exercise',
    description:
      'Убрать упражнение из дня программы. ВЫЗЫВАЙ ТОЛЬКО после явного подтверждения юзера.',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['program', 'next'] },
        dayIndex: { type: 'integer', description: 'Индекс дня (0-based).' },
        exercise: { type: 'string', description: 'Какое упражнение убрать (название/slug).' },
      },
      required: ['scope', 'dayIndex', 'exercise'],
    },
  },
]

// ─── Read-only резолв упражнения (без auto-create) ──────────────────

/**
 * Экранирует спецсимволы LIKE/ILIKE (%, _, \) в пользовательском вводе —
 * иначе term вроде "100%" или "_" ломает паттерн или матчит всё подряд.
 */
function escapeLike(s) {
  return s.replace(/[\\%_]/g, '\\$&')
}

// Экспортируется для programEditor (резолв «нового» упражнения по имени).
// Function declaration → hoisted, поэтому безопасно при циклическом импорте.
export async function resolveExerciseReadonly(query) {
  if (!query) return null
  const term = String(query).trim().toLowerCase()
  const like = `%${escapeLike(term)}%` // для ILIKE; точные сравнения — по сырому term

  // slug → nameRu/nameEn (ILIKE) → alias. Один запрос с приоритетом.
  const rows = await prisma.$queryRaw`
    SELECT id, "nameRu", slug,
      CASE
        WHEN lower(slug) = ${term} THEN 0
        WHEN lower("nameRu") = ${term} OR lower("nameEn") = ${term} THEN 1
        WHEN EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) = ${term}) THEN 2
        WHEN lower("nameRu") ILIKE ${like} OR lower("nameEn") ILIKE ${like} THEN 3
        ELSE 9
      END AS priority
    FROM "Exercise"
    WHERE lower(slug) = ${term}
      OR lower("nameRu") = ${term} OR lower("nameEn") = ${term}
      OR lower("nameRu") ILIKE ${like} OR lower("nameEn") ILIKE ${like}
      OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) = ${term})
    ORDER BY priority ASC
    LIMIT 1
  `
  return rows[0] ?? null
}

/** Диапазон повторов из planJson (repsMin/repsMax) в читаемую строку «8–10». */
function formatReps(e) {
  const { repsMin, repsMax } = e
  if (repsMin != null && repsMax != null) {
    return repsMin === repsMax ? String(repsMin) : `${repsMin}–${repsMax}`
  }
  if (repsMin != null) return String(repsMin)
  return e.reps != null ? String(e.reps) : null
}

// ─── Поиск кандидатов в каталоге (read-only, без auto-create) ───────

async function searchCatalog({ query, muscle, equipment } = {}) {
  const term = query ? String(query).trim().toLowerCase() : null
  const like = term ? `%${escapeLike(term)}%` : null // LIKE-паттерн с экранированием %/_/\
  const muscleF = muscle ? String(muscle).trim().toLowerCase() : null
  const equipF = equipment ? String(equipment).trim().toLowerCase() : null

  const rows = await prisma.$queryRaw`
    SELECT id, "nameRu", "primaryMuscles", equipment
    FROM "Exercise"
    WHERE
      (${term}::text IS NULL
        OR lower("nameRu") LIKE ${like}
        OR lower("nameEn") LIKE ${like}
        OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) LIKE ${like}))
      AND (${muscleF}::text IS NULL OR ${muscleF} = ANY("primaryMuscles"))
      AND (${equipF}::text IS NULL OR ${equipF} = ANY(equipment))
    ORDER BY "nameRu"
    LIMIT 25
  `
  return rows.map((r) => ({
    id: r.id,
    nameRu: r.nameRu,
    primaryMuscles: r.primaryMuscles,
    equipment: r.equipment,
  }))
}

// ─── Применение правки программы + аналитика ────────────────────────

async function runProgramEdit(userId, op, input, params, writeOps) {
  const out = await applyProgramEdit({
    userId,
    scope: input.scope,
    dayIndex: input.dayIndex,
    op,
    params,
  })
  // След выполненной write-операции: chat.js сохранит его в историю, если
  // финальный ответ LLM не родился — иначе модель не узнает о применённой правке.
  writeOps?.push({
    tool: `${op}_exercise`,
    scope: out.scope,
    dayIndex: out.dayIndex,
    summary: out.summary,
  })
  track(userId, 'program_edit', { scope: out.scope, op, dayIndex: out.dayIndex })
  return out
}

// ─── Исполнитель инструментов ───────────────────────────────────────

/**
 * Возвращает executeTool(name, input) для конкретного юзера/таймзоны.
 * @param {string} userId
 * @param {string} [tz]
 * @param {Array<object>} [writeOps] — аккумулятор выполненных write-операций
 *   (replace/adjust/add/remove): вызывающий код видит, что программа уже
 *   изменена, даже если LLM-петля упала после выполнения инструмента.
 */
export function buildToolExecutor(userId, tz = DEFAULT_TZ, writeOps = null) {
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
          select: { id: true, name: true, planJson: true, guidelines: true },
        })
        if (!prog) return { note: 'У юзера нет активной программы.' }
        const rawDays = prog.planJson?.days || []
        const days = rawDays.map((d, i) => ({
          dayIndex: i, // 0-based — передавать в write-инструменты (replace/adjust/...)
          day: i + 1,
          title: d.title || `День ${i + 1}`,
          exercises: (d.exercises || []).map((e) => ({
            name: e.nameRu,
            sets: e.sets ?? null,
            reps: formatReps(e),
          })),
        }))
        // Какой день будет следующим — критично для scope: 'next': без этого
        // оверрайд может лечь не на тот день и молча ждать его по циклу.
        const nextDayIndex = await computeNextDayIndex(userId, prog.id, rawDays.length)
        const nextTitle = rawDays[nextDayIndex]?.title || `День ${nextDayIndex + 1}`
        return {
          name: prog.name,
          days,
          nextDayIndex,
          nextDayHint: `Следующая тренировка юзера: день ${nextDayIndex + 1} («${nextTitle}») — для scope "next" передавай dayIndex=${nextDayIndex}.`,
          guidelines: prog.guidelines ?? null,
        }
      }

      // ─── Расширенный контекст (read-only) ───

      case 'list_logged_exercises': {
        const items = await getLoggedExercisesSummary(userId)
        if (!items.length) return { note: 'Юзер ещё не логировал упражнения.' }
        return { count: items.length, exercises: items }
      }

      case 'get_recent_workouts': {
        const raw = parseInt(input.limit, 10)
        const limit = Math.min(Math.max(Number.isNaN(raw) ? 10 : raw, 1), 30)
        const workouts = await getRecentWorkouts(userId, tz, limit)
        if (!workouts.length) return { note: 'У юзера нет завершённых тренировок.' }
        return { count: workouts.length, workouts }
      }

      case 'search_exercises': {
        const found = await searchCatalog(input)
        if (!found.length) {
          return { note: 'Ничего не найдено. Уточни запрос/мышцу/оборудование.' }
        }
        return { count: found.length, exercises: found }
      }

      // ─── Рефайн программы (write, фаза 5) ───

      case 'replace_exercise':
        return runProgramEdit(userId, 'replace', input, {
          fromExercise: input.fromExercise,
          toExerciseId: input.toExerciseId,
        }, writeOps)

      case 'adjust_exercise':
        return runProgramEdit(userId, 'adjust', input, {
          exercise: input.exercise,
          sets: input.sets,
          repsMin: input.repsMin,
          repsMax: input.repsMax,
          restSec: input.restSec,
        }, writeOps)

      case 'add_exercise':
        return runProgramEdit(userId, 'add', input, {
          toExerciseId: input.toExerciseId,
          sets: input.sets,
          repsMin: input.repsMin,
          repsMax: input.repsMax,
          restSec: input.restSec,
        }, writeOps)

      case 'remove_exercise':
        return runProgramEdit(userId, 'remove', input, { exercise: input.exercise }, writeOps)

      default:
        return { error: `Неизвестный инструмент: ${name}` }
    }
  }
}

export default { CHAT_TOOLS, buildToolExecutor }
