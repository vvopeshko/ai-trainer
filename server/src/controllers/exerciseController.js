import { z } from 'zod'
import prisma from '../utils/prisma.js'

/**
 * GET /api/v1/exercises
 *
 * Список упражнений. Опционально фильтрует по группе мышц.
 * Query params:
 *   muscle — фильтр по primaryMuscles (e.g. "chest")
 *   limit  — количество (default 100)
 */
export async function list(req, res) {
  const { muscle, limit } = z
    .object({
      muscle: z.string().optional(),
      limit: z.coerce.number().int().positive().max(1500).default(100),
    })
    .parse(req.query)

  const where = {}
  if (muscle) {
    where.primaryMuscles = { has: muscle }
  }

  const exercises = await prisma.exercise.findMany({
    where,
    orderBy: { nameRu: 'asc' },
    take: limit,
    select: {
      id: true, slug: true, nameRu: true, nameEn: true,
      primaryMuscles: true, secondaryMuscles: true, equipment: true,
      difficulty: true, category: true, gifUrl: true, aliases: true,
    },
  })

  res.json({ exercises })
}

/**
 * GET /api/v1/exercises/:id
 *
 * Полные данные одного упражнения (включая instructions, description, typicalMistakes).
 */
export async function getById(req, res) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: req.params.id },
  })
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' })
  res.json({ exercise })
}

/**
 * GET /api/v1/exercises/search?q=жим
 *
 * Текстовый поиск по nameRu, nameEn, aliases.
 * Используется при добавлении внепланового упражнения.
 */
export async function search(req, res) {
  const { q } = z
    .object({
      q: z.string().min(1).max(100),
    })
    .parse(req.query)

  const lower = q.toLowerCase()

  // Prisma не поддерживает полнотекстовый поиск по массивам из коробки.
  // Используем raw SQL: ищем по nameRu, nameEn и aliases (unnest).
  const exercises = await prisma.$queryRaw`
    SELECT * FROM "Exercise"
    WHERE
      lower("nameRu") LIKE '%' || ${lower} || '%'
      OR lower("nameEn") LIKE '%' || ${lower} || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(aliases) AS a
        WHERE lower(a) LIKE '%' || ${lower} || '%'
      )
    ORDER BY "nameRu"
    LIMIT 20
  `

  res.json({ exercises })
}

/**
 * GET /api/v1/exercises/settings
 *
 * All exercise settings for the current user.
 * Returns { settings: { [slug]: { preset, unit, step, ... } } }
 */
export async function getAllSettings(req, res) {
  const rows = await prisma.userExerciseSettings.findMany({
    where: { userId: req.user.id },
  })

  const settings = {}
  for (const row of rows) {
    settings[row.exerciseSlug] = {
      preset: row.preset,
      unit: row.unit,
      step: row.step,
      stepUnit: row.stepUnit,
      minWeight: row.minWeight,
      maxWeight: row.maxWeight,
      type: row.type,
      updatedAt: row.updatedAt,
    }
  }

  res.json({ settings })
}

/**
 * PUT /api/v1/exercises/settings/:slug
 *
 * Upsert exercise settings for a given slug.
 */
export async function upsertSettings(req, res) {
  // slug приходит из URL — валидируем как непустую строку разумной длины.
  const { slug } = z
    .object({ slug: z.string().min(1).max(200) })
    .parse(req.params)

  const body = z.object({
    preset: z.string().nullable().optional(),
    unit: z.enum(['kg', 'lbs']).optional(),
    step: z.number().positive().max(100).optional(),
    stepUnit: z.enum(['kg', 'lbs']).optional(),
    minWeight: z.number().min(0).optional(),
    maxWeight: z.number().positive().optional(),
    type: z.enum(['reps', 'timer']).optional(),
  })
    .refine((b) => b.minWeight == null || b.maxWeight == null || b.minWeight <= b.maxWeight, {
      message: 'minWeight must be <= maxWeight',
      path: ['minWeight'],
    })
    .parse(req.body)

  const record = await prisma.userExerciseSettings.upsert({
    where: {
      userId_exerciseSlug: {
        userId: req.user.id,
        exerciseSlug: slug,
      },
    },
    create: {
      userId: req.user.id,
      exerciseSlug: slug,
      ...body,
    },
    update: body,
  })

  res.json({
    setting: {
      preset: record.preset,
      unit: record.unit,
      step: record.step,
      stepUnit: record.stepUnit,
      minWeight: record.minWeight,
      maxWeight: record.maxWeight,
      type: record.type,
      updatedAt: record.updatedAt,
    },
  })
}

/**
 * POST /api/v1/exercises/batch-last-results
 *
 * Последние результаты пользователя по нескольким упражнениям за один запрос.
 * Body: { exerciseIds: ["uuid1", "uuid2", ...] }
 * Ответ: { results: { "uuid1": { lastSets, date }, "uuid2": { lastSets, date }, ... } }
 */
export async function batchLastResults(req, res) {
  const { exerciseIds } = z
    .object({ exerciseIds: z.array(z.string().uuid()).min(1).max(50) })
    .parse(req.body)

  // DISTINCT ON: последняя завершённая тренировка по каждому упражнению,
  // затем только её рабочие подходы. Prisma-вариант тянул ВСЕ сеты юзера
  // по этим упражнениям за всю историю — на длинной истории это сотни строк зря.
  const rows = await prisma.$queryRaw`
    WITH last AS (
      SELECT DISTINCT ON (ws."exerciseId") ws."exerciseId", ws."workoutId", w."startedAt"
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON w.id = ws."workoutId"
      WHERE ws."exerciseId" = ANY(${exerciseIds})
        AND w."userId" = ${req.user.id}
        AND w."finishedAt" IS NOT NULL
        AND ws."isWarmup" = false
      ORDER BY ws."exerciseId", w."startedAt" DESC
    )
    SELECT ws."exerciseId", ws."weightKg", ws.reps, l."startedAt"
    FROM "WorkoutSet" ws
    JOIN last l ON l."workoutId" = ws."workoutId" AND l."exerciseId" = ws."exerciseId"
    WHERE ws."isWarmup" = false
    ORDER BY ws."setOrder" ASC
  `

  const results = {}
  for (const exId of exerciseIds) {
    results[exId] = { lastSets: null, date: null }
  }
  for (const r of rows) {
    const entry = results[r.exerciseId]
    if (!entry.lastSets) {
      entry.lastSets = []
      entry.date = r.startedAt
    }
    entry.lastSets.push({ weightKg: r.weightKg, reps: r.reps })
  }

  res.json({ results })
}
