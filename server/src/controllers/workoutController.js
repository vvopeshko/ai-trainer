import { z } from 'zod'
import prisma from '../utils/prisma.js'
import { track } from '../utils/analytics.js'

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

  // Проверяем: может, уже есть незавершённая?
  const existing = await prisma.workout.findFirst({
    where: { userId: req.user.id, finishedAt: null },
    include: {
      sets: { include: { exercise: true }, orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }] },
    },
  })

  if (existing) {
    // Пустая активная тренировка (0 подходов) — удаляем и создаём свежую
    if (existing.sets.length === 0) {
      await prisma.workout.delete({ where: { id: existing.id } })
    } else {
      return res.json({ workout: existing, resumed: true })
    }
  }

  const workout = await prisma.workout.create({
    data: {
      userId: req.user.id,
      programId: data.programId ?? null,
      programDayIndex: data.programDayIndex ?? null,
    },
    include: {
      sets: true,
    },
  })

  track(req.user.id, 'workout_started', { workoutId: workout.id })
  res.status(201).json({ workout, resumed: false })
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

  res.json({ workout })
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
      sets: {
        select: { exerciseId: true, exercise: { select: { nameRu: true } } },
        orderBy: { exerciseOrder: 'asc' },
      },
    },
  })

  // Для каждой тренировки — уникальные упражнения
  const result = workouts.map(w => {
    const uniqueExercises = []
    const seen = new Set()
    for (const s of w.sets) {
      if (!seen.has(s.exerciseId)) {
        seen.add(s.exerciseId)
        uniqueExercises.push(s.exercise.nameRu)
      }
    }
    return {
      id: w.id,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      setsCount: w._count.sets,
      exercises: uniqueExercises,
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
 * PATCH /api/v1/workouts/:id
 *
 * Завершить тренировку. Вызывается при нажатии "Завершить".
 */
export async function finish(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)

  const data = z
    .object({
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

  // Если 0 подходов — удаляем вместо завершения (пустая тренировка)
  const setsCount = await prisma.workoutSet.count({ where: { workoutId: id } })
  if (setsCount === 0) {
    await prisma.workout.delete({ where: { id } })
    return res.json({ workout: null, deleted: true })
  }

  const updated = await prisma.workout.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      feltRating: data.feltRating ?? null,
      notes: data.notes ?? workout.notes,
    },
    include: {
      sets: { include: { exercise: true }, orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }] },
    },
  })

  track(req.user.id, 'workout_completed', {
    workoutId: id,
    setsCount: updated.sets.length,
    durationMin: Math.round((updated.finishedAt - updated.startedAt) / 60000),
  })

  res.json({ workout: updated })
}
