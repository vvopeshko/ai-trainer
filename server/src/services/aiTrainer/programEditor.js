/**
 * programEditor — мутации planJson активной программы для рефайна через чат (фаза 5).
 *
 * Инкапсулирует операции над списком упражнений дня программы:
 *   - replace — заменить упражнение X на Y (сохраняя sets/reps/rest);
 *   - adjust  — скорректировать sets/repsMin/repsMax/restSec;
 *   - add     — добавить новое упражнение;
 *   - remove  — убрать упражнение.
 *
 * Принципы:
 *   - «Новое» упражнение резолвится ТОЛЬКО из существующего каталога: по exerciseId
 *     (из search_exercises) или по имени через read-only resolveExerciseReadonly.
 *     Auto-create НЕ используется → дубли в каталоге невозможны.
 *   - Результирующий элемент валидируется тем же Zod-путём (planExerciseSchema),
 *     что и updateProgram — единый контракт элемента упражнения.
 *
 * scope:
 *   - 'program' — пишем в Program.planJson активной программы (меняет «все следующие»);
 *   - 'next'    — апсертим WorkoutPlanOverride (меняет «конкретно следующую» тренировку).
 */
import prisma from '../../utils/prisma.js'
import { resolveExerciseReadonly } from './chatTools.js'
import { planExerciseSchema } from '../../controllers/programController.js'

const DEFAULT_REST_SEC = 90

function normalize(s) {
  return String(s ?? '').trim().toLowerCase()
}

/** Найти индекс упражнения в дне по exerciseId / slug / nameRu (точно или вхождением). */
function findExerciseIndex(exercises, ref) {
  const term = normalize(ref)
  if (!term) return -1
  // Сначала точные совпадения, потом вхождение по nameRu.
  let idx = exercises.findIndex(
    (e) =>
      e.exerciseId === ref ||
      normalize(e.slug) === term ||
      normalize(e.nameRu) === term,
  )
  if (idx === -1) {
    idx = exercises.findIndex((e) => normalize(e.nameRu).includes(term))
  }
  return idx
}

/** Резолв нового упражнения из каталога: по id или по имени. Без auto-create. */
async function resolveCatalogExercise({ exerciseId, exerciseName }) {
  if (exerciseId) {
    const ex = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, slug: true, nameRu: true },
    })
    if (!ex) {
      throw new Error(
        `Упражнение с id "${exerciseId}" не найдено в каталоге. Сначала найди его через search_exercises.`,
      )
    }
    return ex
  }
  const ex = await resolveExerciseReadonly(exerciseName)
  if (!ex) {
    throw new Error(
      `Упражнение "${exerciseName}" не найдено в каталоге. Найди его через search_exercises и передай toExerciseId.`,
    )
  }
  return ex
}

/** Собирает валидный элемент упражнения плана с дефолтами. */
function buildPlanExercise(ex, { sets, repsMin, repsMax, restSec }) {
  return planExerciseSchema.parse({
    exerciseId: ex.id,
    slug: ex.slug,
    nameRu: ex.nameRu,
    sets,
    repsMin,
    repsMax,
    restSec: restSec ?? DEFAULT_REST_SEC,
    alternatives: [],
  })
}

/**
 * Применяет операцию к списку упражнений дня. Не мутирует вход — возвращает новый массив.
 *
 * @param {Array<object>} dayExercises — текущие упражнения дня (из planJson или оверрайда)
 * @param {'replace'|'adjust'|'add'|'remove'} op
 * @param {object} params
 * @returns {Promise<{ exercises: Array<object>, summary: string }>}
 */
export async function editDayExercises(dayExercises, op, params = {}) {
  const list = (dayExercises || []).map((e) => ({ ...e }))

  switch (op) {
    case 'replace': {
      const idx = findExerciseIndex(list, params.fromExercise)
      if (idx === -1) {
        throw new Error(`Упражнение "${params.fromExercise}" не найдено в этом дне.`)
      }
      const old = list[idx]
      const ex = await resolveCatalogExercise({
        exerciseId: params.toExerciseId,
        exerciseName: params.toExercise,
      })
      const replaced = buildPlanExercise(ex, {
        sets: old.sets,
        repsMin: old.repsMin,
        repsMax: old.repsMax,
        restSec: old.restSec,
      })
      list[idx] = replaced
      return {
        exercises: list,
        summary: `Заменил «${old.nameRu}» на «${ex.nameRu}» (${replaced.sets}×${replaced.repsMin}–${replaced.repsMax}).`,
      }
    }

    case 'adjust': {
      const idx = findExerciseIndex(list, params.exercise)
      if (idx === -1) {
        throw new Error(`Упражнение "${params.exercise}" не найдено в этом дне.`)
      }
      const cur = { ...list[idx] }
      if (params.sets != null) cur.sets = params.sets
      if (params.repsMin != null) cur.repsMin = params.repsMin
      if (params.repsMax != null) cur.repsMax = params.repsMax
      if (params.restSec != null) cur.restSec = params.restSec
      list[idx] = planExerciseSchema.parse(cur)
      return {
        exercises: list,
        summary: `Обновил «${list[idx].nameRu}»: ${list[idx].sets}×${list[idx].repsMin}–${list[idx].repsMax}, отдых ${list[idx].restSec}с.`,
      }
    }

    case 'add': {
      const ex = await resolveCatalogExercise({
        exerciseId: params.toExerciseId,
        exerciseName: params.toExercise,
      })
      // Защита от дублей: ретрай модели / двойное «да» юзера не должны
      // добавить упражнение второй раз. Ошибка уходит модели как tool_result.
      const dupIdx = list.findIndex(
        (e) => e.exerciseId === ex.id || normalize(e.slug) === normalize(ex.slug),
      )
      if (dupIdx !== -1) {
        throw new Error(
          `«${ex.nameRu}» уже есть в этом дне — добавлять повторно не нужно. Если хочешь изменить его параметры, используй adjust_exercise.`,
        )
      }
      const added = buildPlanExercise(ex, {
        sets: params.sets,
        repsMin: params.repsMin,
        repsMax: params.repsMax,
        restSec: params.restSec,
      })
      list.push(added)
      return {
        exercises: list,
        summary: `Добавил «${ex.nameRu}» (${added.sets}×${added.repsMin}–${added.repsMax}).`,
      }
    }

    case 'remove': {
      const idx = findExerciseIndex(list, params.exercise)
      if (idx === -1) {
        throw new Error(`Упражнение "${params.exercise}" не найдено в этом дне.`)
      }
      const [removed] = list.splice(idx, 1)
      return { exercises: list, summary: `Убрал «${removed.nameRu}» из дня.` }
    }

    default:
      throw new Error(`Неизвестная операция: ${op}`)
  }
}

/**
 * Индекс следующего дня программы по циклу: последняя завершённая тренировка
 * этой программы +1 (mod число дней). Тот же расчёт использует
 * getNextWorkout (API) и get_program_details (чат-инструменты) — чтобы
 * правка со scope: 'next' легла на реально следующий день.
 *
 * @param {string} userId
 * @param {string} programId
 * @param {number} totalDays — days.length из planJson
 * @param {object} [db=prisma] — prisma-клиент или транзакция (tx)
 * @returns {Promise<number>}
 */
export async function computeNextDayIndex(userId, programId, totalDays, db = prisma) {
  if (!totalDays) return 0
  const lastWorkout = await db.workout.findFirst({
    where: {
      userId,
      programId,
      finishedAt: { not: null },
      programDayIndex: { not: null },
    },
    orderBy: { finishedAt: 'desc' },
    select: { programDayIndex: true },
  })
  return lastWorkout ? (lastWorkout.programDayIndex + 1) % totalDays : 0
}

/**
 * Оркестратор: применяет правку к дню активной программы с учётом scope.
 *
 * Read-modify-write planJson обёрнут в interactive-транзакцию с оптимистичной
 * блокировкой по updatedAt: параллельная правка (второе сообщение в чате,
 * PATCH из мини-аппа) не затирается молча — конфликт возвращается ошибкой,
 * которую модель видит как tool_result и может повторить операцию.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {'program'|'next'} args.scope
 * @param {number} args.dayIndex
 * @param {'replace'|'adjust'|'add'|'remove'} args.op
 * @param {object} args.params
 * @returns {Promise<{ scope: string, dayIndex: number, dayTitle: string|null, summary: string }>}
 */
export async function applyProgramEdit({ userId, scope, dayIndex, op, params }) {
  if (scope !== 'program' && scope !== 'next') {
    throw new Error(`Некорректный scope "${scope}". Ожидается "program" или "next".`)
  }

  return prisma.$transaction(async (tx) => {
    // Программу читаем ВНУТРИ транзакции — правим то, что реально в БД сейчас.
    const program = await tx.program.findFirst({
      where: { userId, isActive: true },
      select: { id: true, planJson: true, updatedAt: true },
    })
    if (!program) {
      throw new Error('У юзера нет активной программы — нечего редактировать.')
    }

    const days = program.planJson?.days || []
    if (dayIndex == null || dayIndex < 0 || dayIndex >= days.length) {
      throw new Error(
        `Некорректный dayIndex ${dayIndex}. В программе ${days.length} дн. (индексы 0..${days.length - 1}).`,
      )
    }

    const dayTitle = days[dayIndex].title ?? null

    if (scope === 'next') {
      // База для правки = текущий оверрайд (если уже есть) или упражнения дня шаблона.
      const existing = await tx.workoutPlanOverride.findUnique({
        where: { userId_programId_dayIndex: { userId, programId: program.id, dayIndex } },
        select: { exercises: true },
      })
      const baseExercises = existing?.exercises || days[dayIndex].exercises || []
      const { exercises, summary } = await editDayExercises(baseExercises, op, params)

      await tx.workoutPlanOverride.upsert({
        where: { userId_programId_dayIndex: { userId, programId: program.id, dayIndex } },
        create: { userId, programId: program.id, dayIndex, exercises },
        update: { exercises },
      })
      return { scope, dayIndex, dayTitle, summary }
    }

    // scope === 'program' — пишем в шаблон программы. Условный update по
    // updatedAt: если planJson изменился между чтением и записью — count 0.
    const baseExercises = days[dayIndex].exercises || []
    const { exercises, summary } = await editDayExercises(baseExercises, op, params)
    const newDays = days.map((d, i) => (i === dayIndex ? { ...d, exercises } : d))

    const { count } = await tx.program.updateMany({
      where: { id: program.id, updatedAt: program.updatedAt },
      data: { planJson: { ...program.planJson, days: newDays } },
    })
    if (count === 0) {
      throw new Error('Программа изменилась параллельно (другая правка). Повтори операцию.')
    }
    return { scope, dayIndex, dayTitle, summary }
  })
}

export default { editDayExercises, applyProgramEdit, computeNextDayIndex }
