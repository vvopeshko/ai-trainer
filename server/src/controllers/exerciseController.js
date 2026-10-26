import { z } from 'zod'
import prisma from '../utils/prisma.js'
import { findAlternatives } from '../services/exerciseAlternatives.js'

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
      targetMuscle: true, unilateral: true,
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

/** Search text: lower case, ё → е, single spaces (same as src/utils/exerciseSearch.js). */
export const normalizeSearch = s => (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/**
 * GET /api/v1/exercises/search?q=жим
 *
 * Текстовый поиск по nameRu, nameEn, aliases: регистр и ё/е не важны, каждое
 * слово запроса должно встретиться. Ранжирование — как в клиентском поиске
 * библиотеки (src/utils/exerciseSearch.js): точное имя/алиас → начало имени →
 * начало слова → подстрока имени → все слова в имени → только nameEn/алиасы;
 * при равенстве — короче, потом по алфавиту.
 */
export async function search(req, res) {
  const { q } = z
    .object({
      q: z.string().min(1).max(100),
    })
    .parse(req.query)

  const phrase = normalizeSearch(q)
  if (!phrase) return res.json({ exercises: [] })
  const words = phrase.split(' ')

  // position() вместо LIKE: % и _ из запроса не работают как шаблоны.
  const exercises = await prisma.$queryRaw`
    SELECT e.* FROM "Exercise" e
    CROSS JOIN LATERAL (SELECT
      replace(lower(e."nameRu"), 'ё', 'е') AS ru,
      replace(lower(coalesce(e."nameEn", '')), 'ё', 'е') AS en,
      ARRAY(SELECT replace(lower(a), 'ё', 'е') FROM unnest(e.aliases) a) AS aliases
    ) n
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(${words}::text[]) w
      WHERE position(w IN n.ru || ' | ' || n.en || ' | ' || array_to_string(n.aliases, ' | ')) = 0
    )
    ORDER BY
      CASE
        WHEN n.ru = ${phrase} OR n.en = ${phrase} OR ${phrase} = ANY(n.aliases) THEN 0
        WHEN starts_with(n.ru, ${phrase}) THEN 1
        WHEN position(' ' || ${phrase} IN ' ' || n.ru) > 0 THEN 2
        WHEN position(${phrase} IN n.ru) > 0 THEN 3
        WHEN NOT EXISTS (SELECT 1 FROM unnest(${words}::text[]) w WHERE position(w IN n.ru) = 0) THEN 4
        ELSE 5
      END,
      length(e."nameRu"), e."nameRu"
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

// Bounded, user-scoped history. In-progress workouts never affect progress.
export async function getHistory(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
  const setsWhere = { exerciseId: id, isWarmup: false }
  // Experience sets the plateau window on the client; null without a profile.
  const [workouts, profile] = await Promise.all([prisma.workout.findMany({
    where: { userId: req.user.id, finishedAt: { not: null }, startedAt: { gte: new Date(Date.now() - 183 * 86400000) }, sets: { some: setsWhere } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: 97,
    select: {
      id: true, startedAt: true,
      sets: {
        where: setsWhere,
        orderBy: [{ setOrder: 'asc' }, { id: 'asc' }],
        select: { weightKg: true, reps: true },
      },
    },
  }), prisma.userProfile.findUnique({ where: { userId: req.user.id }, select: { experienceLevel: true } })])
  res.json({ workouts: workouts.slice(0, 96), hasMore: workouts.length > 96, experienceLevel: profile?.experienceLevel ?? null })
}

const OVERVIEW_ACTIVE_DAYS = 42
const OVERVIEW_LIMIT = 30

// Progress overview for the Progress screen: every exercise trained in the
// last 6 weeks with the same bounded history as getHistory, plus its plan from
// the active program. Statuses are computed on the client by exerciseProgress.
export async function getProgressOverview(req, res) {
  const [workouts, profile, program] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: req.user.id, finishedAt: { not: null }, startedAt: { gte: new Date(Date.now() - 183 * 86400000) } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, startedAt: true,
        sets: {
          where: { isWarmup: false },
          orderBy: [{ setOrder: 'asc' }, { id: 'asc' }],
          select: { exerciseId: true, weightKg: true, reps: true },
        },
      },
    }),
    prisma.userProfile.findUnique({ where: { userId: req.user.id }, select: { experienceLevel: true } }),
    prisma.program.findFirst({ where: { userId: req.user.id, isActive: true }, select: { planJson: true } }),
  ])
  const activeSince = Date.now() - OVERVIEW_ACTIVE_DAYS * 86400000
  const byExercise = new Map()
  for (const w of workouts) {
    const sets = new Map()
    for (const { exerciseId, ...set } of w.sets) {
      if (!sets.has(exerciseId)) sets.set(exerciseId, [])
      sets.get(exerciseId).push(set)
    }
    for (const [exerciseId, list] of sets) {
      if (!byExercise.has(exerciseId)) byExercise.set(exerciseId, [])
      const history = byExercise.get(exerciseId)
      if (history.length < 96) history.push({ id: w.id, startedAt: w.startedAt, sets: list })
    }
  }
  // Workouts are newest first, so history[0] is the latest session.
  const active = [...byExercise].filter(([, history]) => new Date(history[0].startedAt).getTime() >= activeSince)
    .slice(0, OVERVIEW_LIMIT)
  const plans = new Map()
  for (const day of program?.planJson?.days ?? []) {
    for (const ex of day.exercises ?? []) {
      if (ex.exerciseId && !plans.has(ex.exerciseId)) plans.set(ex.exerciseId, { sets: ex.sets, repsMin: ex.repsMin, repsMax: ex.repsMax })
    }
  }
  const info = active.length ? await prisma.exercise.findMany({
    where: { id: { in: active.map(([id]) => id) } },
    select: { id: true, nameRu: true, slug: true },
  }) : []
  const names = new Map(info.map(e => [e.id, e]))
  res.json({
    experienceLevel: profile?.experienceLevel ?? null,
    exercises: active.filter(([id]) => names.has(id)).map(([id, history]) => ({
      id, nameRu: names.get(id).nameRu, slug: names.get(id).slug, plan: plans.get(id) ?? null, workouts: history,
    })),
  })
}

// Catalog alternatives for one exercise, ranked for this user (same main muscle
// and category, preferably another tool). The client adds last results itself.
export async function getAlternatives(req, res) {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
  const list = await findAlternatives(req.user.id, id)
  res.json({ alternatives: list.map(e => ({
    exerciseId: e.id, nameRu: e.nameRu, slug: e.slug, equipment: e.equipment, usedCount: e.usedCount,
  })) })
}
