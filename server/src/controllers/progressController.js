import prisma from '../utils/prisma.js'

/**
 * Маппинг отдельных мышц → 6 групп для UI.
 * Ключи — реальные значения primaryMuscles из базы упражнений.
 */
const MUSCLE_GROUP_MAP = {
  chest: 'chest',
  shoulders: 'shoulders',
  traps: 'shoulders',
  lats: 'back',
  'middle back': 'back',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abdominals: 'core',
  obliques: 'core',
}

const SUB_MUSCLE_NAMES_RU = {
  chest: 'Грудь',
  shoulders: 'Дельты',
  traps: 'Трапеции',
  lats: 'Широчайшие',
  'middle back': 'Середина спины',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  forearms: 'Предплечья',
  quadriceps: 'Квадрицепс',
  hamstrings: 'Задняя поверхность',
  glutes: 'Ягодичные',
  calves: 'Голени',
  adductors: 'Приводящие',
  abdominals: 'Пресс',
  obliques: 'Косые',
}

const GROUP_NAMES_RU = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  arms: 'Руки',
  legs: 'Ноги',
  core: 'Кор',
}

const GROUP_ORDER = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core']

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatLocalDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * GET /api/v1/progress
 *
 * Единый эндпоинт прогресса Phase 1:
 * planAdherence + muscleVolume (с sub-muscles) + records.
 */
export async function getProgress(req, res) {
  const userId = req.user.id
  const now = new Date()
  const weekStart = getMonday(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalFinished,
    weekWorkouts,
    activeProgram,
    weekSets,
    monthRecords,
  ] = await Promise.all([
    // 1. Общее кол-во завершённых тренировок → state
    prisma.workout.count({
      where: { userId, finishedAt: { not: null } },
    }),

    // 2. Тренировки за неделю → plan adherence
    prisma.workout.findMany({
      where: { userId, finishedAt: { not: null }, startedAt: { gte: weekStart } },
      select: { programDayIndex: true },
    }),

    // 3. Активная программа → planned days + targets
    prisma.program.findFirst({
      where: { userId, isActive: true },
      select: { planJson: true },
    }),

    // 4. Сеты за неделю (не warmup) → muscle volume
    prisma.workoutSet.findMany({
      where: {
        workout: { userId, finishedAt: { not: null }, startedAt: { gte: weekStart } },
        isWarmup: false,
      },
      select: {
        exercise: { select: { primaryMuscles: true } },
      },
    }),

    // 5. Рекорды: max вес за месяц vs предыдущий max
    prisma.$queryRaw`
      WITH month_maxes AS (
        SELECT
          ws."exerciseId",
          MAX(ws."weightKg") AS max_weight,
          (ARRAY_AGG(ws.reps ORDER BY ws."weightKg" DESC, ws."completedAt" DESC))[1] AS reps_at_max
        FROM "WorkoutSet" ws
        JOIN "Workout" w ON ws."workoutId" = w.id
        WHERE w."userId" = ${userId}
          AND w."finishedAt" IS NOT NULL
          AND w."finishedAt" >= ${monthStart}
          AND ws."isWarmup" = false
          AND ws."weightKg" IS NOT NULL
          AND ws."weightKg" > 0
        GROUP BY ws."exerciseId"
      ),
      prev_maxes AS (
        SELECT
          ws."exerciseId",
          MAX(ws."weightKg") AS prev_max
        FROM "WorkoutSet" ws
        JOIN "Workout" w ON ws."workoutId" = w.id
        WHERE w."userId" = ${userId}
          AND w."finishedAt" IS NOT NULL
          AND w."finishedAt" < ${monthStart}
          AND ws."isWarmup" = false
          AND ws."weightKg" IS NOT NULL
          AND ws."weightKg" > 0
        GROUP BY ws."exerciseId"
      )
      SELECT
        mm."exerciseId",
        e."nameRu" AS "exerciseNameRu",
        e.slug AS "exerciseSlug",
        mm.max_weight::float AS value,
        mm.reps_at_max AS reps,
        COALESCE(pm.prev_max, 0)::float AS "previousBest",
        (
          SELECT ws2."completedAt"
          FROM "WorkoutSet" ws2
          JOIN "Workout" w2 ON ws2."workoutId" = w2.id
          WHERE ws2."exerciseId" = mm."exerciseId"
            AND w2."userId" = ${userId}
            AND w2."finishedAt" IS NOT NULL
            AND w2."finishedAt" >= ${monthStart}
            AND ws2."weightKg" = mm.max_weight
          ORDER BY ws2."completedAt" DESC
          LIMIT 1
        ) AS date
      FROM month_maxes mm
      JOIN "Exercise" e ON mm."exerciseId" = e.id
      LEFT JOIN prev_maxes pm ON mm."exerciseId" = pm."exerciseId"
      WHERE mm.max_weight > COALESCE(pm.prev_max, 0)
      ORDER BY (mm.max_weight - COALESCE(pm.prev_max, 0)) DESC
      LIMIT 10
    `,
  ])

  // ── State ──
  const state = totalFinished === 0 ? 'empty' : totalFinished < 3 ? 'mostly_empty' : 'has_data'

  // ── Plan adherence ──
  const days = activeProgram?.planJson?.days || []
  const planned = days.length
  const done = weekWorkouts.length
  const extra = planned > 0 ? Math.max(0, done - planned) : 0

  const planAdherence = {
    planned: planned || null,
    done,
    extra,
    weekStart: formatLocalDate(weekStart),
  }

  // ── Muscle volume (per individual muscle, then aggregate to groups) ──
  const actualByMuscle = {}
  for (const s of weekSets) {
    for (const muscle of s.exercise.primaryMuscles) {
      if (MUSCLE_GROUP_MAP[muscle]) {
        actualByMuscle[muscle] = (actualByMuscle[muscle] || 0) + 1
      }
    }
  }

  // Target sets per individual muscle from program
  const targetByMuscle = {}
  if (days.length > 0) {
    const exerciseIds = [...new Set(days.flatMap(d => d.exercises?.map(e => e.exerciseId).filter(Boolean) || []))]
    const planExercises = exerciseIds.length > 0
      ? await prisma.exercise.findMany({
          where: { id: { in: exerciseIds } },
          select: { id: true, primaryMuscles: true },
        })
      : []
    const muscleById = Object.fromEntries(planExercises.map(e => [e.id, e.primaryMuscles]))

    for (const day of days) {
      for (const ex of day.exercises || []) {
        const muscles = muscleById[ex.exerciseId] || []
        const sets = ex.sets || 3
        for (const m of muscles) {
          if (MUSCLE_GROUP_MAP[m]) {
            targetByMuscle[m] = (targetByMuscle[m] || 0) + sets
          }
        }
      }
    }
  }

  // Build groups with sub-muscles
  const muscleVolume = GROUP_ORDER.map(group => {
    const groupMuscles = Object.keys(MUSCLE_GROUP_MAP).filter(m => MUSCLE_GROUP_MAP[m] === group)

    const subMuscles = groupMuscles
      .filter(m => (actualByMuscle[m] || 0) > 0 || (targetByMuscle[m] || 0) > 0)
      .map(m => ({
        muscle: m,
        nameRu: SUB_MUSCLE_NAMES_RU[m] || m,
        setsActual: actualByMuscle[m] || 0,
        setsTarget: targetByMuscle[m] || null,
      }))
      .sort((a, b) => (b.setsActual + (b.setsTarget || 0)) - (a.setsActual + (a.setsTarget || 0)))

    const totalActual = subMuscles.reduce((sum, s) => sum + s.setsActual, 0)
    const totalTarget = subMuscles.reduce((sum, s) => sum + (s.setsTarget || 0), 0) || null

    return {
      group,
      nameRu: GROUP_NAMES_RU[group],
      setsActual: totalActual,
      setsTarget: totalTarget,
      subMuscles,
    }
  })

  // ── Records ──
  const records = monthRecords.map(r => ({
    exerciseNameRu: r.exerciseNameRu,
    exerciseSlug: r.exerciseSlug,
    value: r.value,
    reps: r.reps,
    previousBest: r.previousBest,
    date: r.date ? formatLocalDate(new Date(r.date)) : null,
  }))

  res.json({ state, planAdherence, muscleVolume, records })
}
