import { z } from 'zod'
import prisma from '../utils/prisma.js'
import { track } from '../utils/analytics.js'
import { sendPostWorkoutSummary } from '../services/aiTrainer/postWorkoutSummary.js'

/**
 * POST /api/v1/workouts
 *
 * Создать новую тренировку. Вызывается при нажатии "Начать тренировку".
 * Если есть активная незавершённая — возвращает её вместо создания новой.
 */
export async function create(req, res) {
  const data = z
    .object({
      programId: z.string().uuid().optional(),
      programDayIndex: z.number().int().nonnegative().optional(),
    })
    .parse(req.body)

  // Всё в транзакции — защита от race condition при двойном клике.
  // Serializable: на дефолтном ReadCommitted параллельные findFirst+create
  // не сериализуются и дают две активные тренировки. При конфликте Postgres
  // отклоняет одну из транзакций (Prisma → P2034) — повторяем её.
  // Более сильное решение — partial unique index
  //   CREATE UNIQUE INDEX ON "Workout"("userId") WHERE "finishedAt" IS NULL
  // но это ручной SQL на проде (миграций в проекте нет, БД общая с продом).
  const runTx = () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.workout.findFirst({
        where: { userId: req.user.id, finishedAt: null },
        include: {
          sets: { include: { exercise: true }, orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }] },
        },
      })

      if (existing) {
        if (existing.sets.length === 0) {
          await tx.workout.delete({ where: { id: existing.id } })
        } else {
          return { workout: existing, resumed: true }
        }
      }

      if (data.programId) {
        const program = await tx.program.findFirst({
          where: { id: data.programId, userId: req.user.id },
          select: { id: true, planJson: true },
        })
        if (!program) return { status: 404, error: 'Program not found' }

        // programDayIndex за пределами дней программы — ошибка клиента
        const daysCount = program.planJson?.days?.length ?? 0
        if (data.programDayIndex != null && data.programDayIndex >= daysCount) {
          return { status: 400, error: 'programDayIndex is out of range' }
        }
      }

      const workout = await tx.workout.create({
        data: {
          userId: req.user.id,
          programId: data.programId ?? null,
          programDayIndex: data.programDayIndex ?? null,
        },
        include: { sets: true },
      })
      return { workout, resumed: false, created: true }
    }, { isolationLevel: 'Serializable' })

  // Retry при serialization failure (P2034) — до 2 повторов
  let result
  for (let attempt = 0; ; attempt++) {
    try {
      result = await runTx()
      break
    } catch (err) {
      if (err?.code === 'P2034' && attempt < 2) continue
      throw err
    }
  }

  if (result.error) return res.status(result.status).json({ error: result.error })
  if (result.resumed) return res.json({ workout: result.workout, resumed: true })

  track(req.user.id, 'workout_started', { workoutId: result.workout.id })
  res.status(201).json({ workout: result.workout, resumed: false })
}

/**
 * GET /api/v1/workouts/active
 *
 * Незавершённая тренировка текущего юзера (finishedAt === null).
 * Нужна для восстановления состояния при перезаходе в мини-апп.
 */
export async function getActive(req, res) {
  const workout = await prisma.workout.findFirst({
    where: { userId: req.user.id, finishedAt: null },
    include: {
      sets: { include: { exercise: true }, orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }] },
    },
  })

  // Если тренировка привязана к программе — вернуть план дня
  let planExercises = null
  let planDayTitle = null

  if (workout?.programId && workout.programDayIndex != null) {
    const program = await prisma.program.findFirst({
      where: { id: workout.programId, userId: req.user.id },
      select: { planJson: true },
    })
    const day = program?.planJson?.days?.[workout.programDayIndex]
    if (day) {
      // Разовый оверрайд «только следующая» (рефайн через чат, фаза 5b):
      // если для этого дня есть оверрайд — берём его упражнения вместо шаблона.
      const override = await prisma.workoutPlanOverride.findUnique({
        where: {
          userId_programId_dayIndex: {
            userId: req.user.id,
            programId: workout.programId,
            dayIndex: workout.programDayIndex,
          },
        },
        select: { exercises: true },
      })

      planExercises = override ? override.exercises : day.exercises
      planDayTitle = day.title

      // Обогатить alternatives: UUID[] → { exerciseId, nameRu, slug }[]
      const allAltIds = planExercises.flatMap(pe => pe.alternatives || [])
      if (allAltIds.length > 0) {
        const altExercises = await prisma.exercise.findMany({
          where: { id: { in: allAltIds } },
          select: { id: true, nameRu: true, slug: true },
        })
        const altMap = Object.fromEntries(altExercises.map(e => [e.id, e]))
        for (const pe of planExercises) {
          if (pe.alternatives?.length) {
            pe.alternatives = pe.alternatives
              .map(id => altMap[id] ? { exerciseId: altMap[id].id, nameRu: altMap[id].nameRu, slug: altMap[id].slug } : null)
              .filter(Boolean)
          }
        }
      }
    }
  }

  res.json({ workout, planExercises, planDayTitle })
}

/**
 * GET /api/v1/workouts/recent?limit=4
 *
 * Последние завершённые тренировки. Для Home-экрана.
 */
export async function getRecent(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 4, 20)

  const workouts = await prisma.workout.findMany({
    where: { userId: req.user.id, finishedAt: { not: null } },
    orderBy: { finishedAt: 'desc' },
    take: limit,
    include: {
      _count: { select: { sets: true } },
      program: { select: { planJson: true } },
      sets: {
        select: { exerciseId: true, exercise: { select: { nameRu: true } } },
        orderBy: { exerciseOrder: 'asc' },
      },
    },
  })

  // Для каждой тренировки — уникальные упражнения + название дня
  const result = workouts.map(w => {
    const uniqueExercises = []
    const seen = new Set()
    for (const s of w.sets) {
      if (!seen.has(s.exerciseId)) {
        seen.add(s.exerciseId)
        uniqueExercises.push(s.exercise.nameRu)
      }
    }

    // Название из программы (напр. "День 2 · Pull")
    const dayTitle = w.program?.planJson?.days?.[w.programDayIndex]?.title || null

    // Чистая длительность в секундах (без пауз)
    const durationSec = w.finishedAt && w.startedAt
      ? Math.max(0, Math.floor((new Date(w.finishedAt) - new Date(w.startedAt) - (w.totalPausedMs || 0)) / 1000))
      : null

    return {
      id: w.id,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      setsCount: w._count.sets,
      exercises: uniqueExercises,
      dayTitle,
      durationSec,
      programDayIndex: w.programDayIndex,
    }
  })

  res.json({ workouts: result })
}

/**
 * GET /api/v1/workouts/:id
 *
 * Конкретная тренировка со всеми подходами и упражнениями.
 */
export async function getById(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)

  const workout = await prisma.workout.findFirst({
    where: { id, userId: req.user.id },
    include: {
      sets: { include: { exercise: true }, orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }] },
    },
  })

  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' })
  }

  res.json({ workout })
}

/**
 * POST /api/v1/workouts/:id/sets
 *
 * Залогировать подход. Вызывается при нажатии "Сделал".
 * Оптимистичный UI: фронт добавляет подход мгновенно, этот запрос идёт в фоне.
 */
export async function logSet(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)

  const data = z
    .object({
      exerciseId: z.string().uuid(),
      exerciseOrder: z.number().int().nonnegative(),
      setOrder: z.number().int().nonnegative(),
      weightKg: z.number().nonnegative().nullable().optional(),
      reps: z.number().int().positive(),
      rpe: z.number().min(1).max(10).optional(),
      isWarmup: z.boolean().default(false),
    })
    .parse(req.body)

  // Проверяем что тренировка принадлежит юзеру и не завершена
  const workout = await prisma.workout.findFirst({
    where: { id, userId: req.user.id, finishedAt: null },
  })

  if (!workout) {
    return res.status(404).json({ error: 'Active workout not found' })
  }

  if (workout.pausedAt) {
    return res.status(400).json({ error: 'Workout is paused' })
  }

  const set = await prisma.workoutSet.create({
    data: {
      workoutId: id,
      exerciseId: data.exerciseId,
      exerciseOrder: data.exerciseOrder,
      setOrder: data.setOrder,
      weightKg: data.weightKg ?? null,
      reps: data.reps,
      rpe: data.rpe ?? null,
      isWarmup: data.isWarmup,
    },
    include: { exercise: true },
  })

  track(req.user.id, 'set_logged', {
    workoutId: id,
    exerciseId: data.exerciseId,
    weightKg: data.weightKg,
    reps: data.reps,
  })

  res.status(201).json({ set })
}

/**
 * DELETE /api/v1/workouts/:id/sets/:setId
 *
 * Удалить подход. Проверяет что тренировка принадлежит юзеру и не завершена.
 */
export async function deleteSet(req, res) {
  const { id, setId } = z
    .object({ id: z.string().uuid(), setId: z.string().uuid() })
    .parse(req.params)

  const workout = await prisma.workout.findFirst({
    where: { id, userId: req.user.id, finishedAt: null },
  })

  if (!workout) {
    return res.status(404).json({ error: 'Active workout not found' })
  }

  const set = await prisma.workoutSet.findFirst({
    where: { id: setId, workoutId: id },
  })

  if (!set) {
    return res.status(404).json({ error: 'Set not found' })
  }

  await prisma.workoutSet.delete({ where: { id: setId } })

  res.json({ deleted: true })
}

/**
 * PATCH /api/v1/workouts/:id
 *
 * Обновить тренировку: поставить на паузу, возобновить или завершить.
 * action: 'pause' | 'resume' | 'finish' (default: 'finish')
 */
export async function update(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)

  const data = z
    .object({
      action: z.enum(['pause', 'resume', 'finish']).default('finish'),
      feltRating: z.number().int().min(1).max(5).optional(),
      notes: z.string().max(500).optional(),
    })
    .parse(req.body)

  const workout = await prisma.workout.findFirst({
    where: { id, userId: req.user.id, finishedAt: null },
  })

  if (!workout) {
    return res.status(404).json({ error: 'Active workout not found' })
  }

  // ── Pause ──
  if (data.action === 'pause') {
    if (workout.pausedAt) {
      return res.status(400).json({ error: 'Workout is already paused' })
    }
    const updated = await prisma.workout.update({
      where: { id },
      data: { pausedAt: new Date() },
    })
    track(req.user.id, 'workout_paused', { workoutId: id })
    return res.json({ workout: updated })
  }

  // ── Resume ──
  if (data.action === 'resume') {
    if (!workout.pausedAt) {
      return res.status(400).json({ error: 'Workout is not paused' })
    }
    const pauseDuration = Date.now() - new Date(workout.pausedAt).getTime()
    const updated = await prisma.workout.update({
      where: { id },
      data: {
        pausedAt: null,
        totalPausedMs: workout.totalPausedMs + pauseDuration,
      },
    })
    track(req.user.id, 'workout_resumed', { workoutId: id })
    return res.json({ workout: updated })
  }

  // ── Finish ──
  // Если на паузе — авто-resume перед завершением
  let totalPausedMs = workout.totalPausedMs
  if (workout.pausedAt) {
    totalPausedMs += Date.now() - new Date(workout.pausedAt).getTime()
  }

  // Если 0 подходов — удаляем вместо завершения (пустая тренировка).
  // Одним атомарным statement (count + delete раздельно = окно гонки:
  // параллельный logSet между ними терял бы подход при cascade-удалении).
  const { count: deletedCount } = await prisma.workout.deleteMany({
    where: { id, sets: { none: {} } },
  })
  if (deletedCount > 0) {
    return res.json({ workout: null, deleted: true })
  }

  const updated = await prisma.workout.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      pausedAt: null,
      totalPausedMs,
      // ?? workout.feltRating (не null): finish без рейтинга не должен
      // затирать ранее сохранённый — симметрично notes ниже
      feltRating: data.feltRating ?? workout.feltRating,
      notes: data.notes ?? workout.notes,
    },
    include: {
      sets: { include: { exercise: true }, orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }] },
    },
  })

  // Consume разового оверрайда дня (рефайн через чат, фаза 5b): после успешного
  // финиша удаляем оверрайд, чтобы он не «прилипал» к следующим циклам программы.
  if (updated.programId != null && updated.programDayIndex != null) {
    await prisma.workoutPlanOverride
      .delete({
        where: {
          userId_programId_dayIndex: {
            userId: req.user.id,
            programId: updated.programId,
            dayIndex: updated.programDayIndex,
          },
        },
      })
      .catch(() => {}) // нет оверрайда — ок, ничего не делаем
  }

  const netDurationMs = updated.finishedAt - updated.startedAt - totalPausedMs
  track(req.user.id, 'workout_completed', {
    workoutId: id,
    setsCount: updated.sets.length,
    durationMin: Math.round(netDurationMs / 60000),
  })

  // Пост-тренировочная сводка тренера (AI_TRAINER_PLAN фаза 1) — fire-and-forget:
  // не блокирует ответ, ошибки не пробрасываются (как track()).
  sendPostWorkoutSummary(req.user, updated).catch((err) =>
    console.error('[workout] post-summary failed:', err.message),
  )

  res.json({ workout: updated })
}

/**
 * DELETE /api/v1/workouts/:id
 *
 * Удалить тренировку (любую — активную или завершённую).
 * WorkoutSets удаляются каскадом (onDelete: Cascade в schema).
 */
export async function destroy(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)

  const workout = await prisma.workout.findFirst({
    where: { id, userId: req.user.id },
  })

  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' })
  }

  await prisma.workout.delete({ where: { id } })

  track(req.user.id, 'workout_deleted', { workoutId: id })
  res.json({ deleted: true })
}
