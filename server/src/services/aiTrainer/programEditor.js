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
 * Оркестратор: применяет правку к дню активной программы с учётом scope.
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

  const program = await prisma.program.findFirst({
    where: { userId, isActive: true },
    select: { id: true, planJson: true },
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
    const existing = await prisma.workoutPlanOverride.findUnique({
      where: { userId_programId_dayIndex: { userId, programId: program.id, dayIndex } },
      select: { exercises: true },
    })
    const baseExercises = existing?.exercises || days[dayIndex].exercises || []
    const { exercises, summary } = await editDayExercises(baseExercises, op, params)

    await prisma.workoutPlanOverride.upsert({
      where: { userId_programId_dayIndex: { userId, programId: program.id, dayIndex } },
      create: { userId, programId: program.id, dayIndex, exercises },
      update: { exercises },
    })
    return { scope, dayIndex, dayTitle, summary }
  }

  // scope === 'program' — пишем в шаблон программы.
  const baseExercises = days[dayIndex].exercises || []
  const { exercises, summary } = await editDayExercises(baseExercises, op, params)
  const newDays = days.map((d, i) => (i === dayIndex ? { ...d, exercises } : d))

  await prisma.program.update({
    where: { id: program.id },
    data: { planJson: { ...program.planJson, days: newDays } },
  })
  return { scope, dayIndex, dayTitle, summary }
}

export default { editDayExercises, applyProgramEdit }
