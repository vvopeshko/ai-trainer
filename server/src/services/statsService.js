/**
 * statsService — чистые аналитические функции (userId, tz, opts) => data.
 *
 * Вынесено из statsController/progressController, чтобы переиспользовать в сводках,
 * инсайтах, чате и пост-анализе (AI_TRAINER_PLAN фаза 0.2). Функции НЕ зависят от
 * req/res — вызываются как из контроллеров, так и из шедулера/скриптов.
 *
 * Принцип «числа — кодом» (AI_TRAINER_PLAN §1): вся арифметика здесь, LLM только
 * интерпретирует результат.
 *
 * tz — IANA-таймзона юзера (из getUserTimezone(req) в API или User.timezone в шедулере).
 */
import prisma from '../utils/prisma.js'

// ─── Маппинг мышц (перенесено из progressController) ────────────────

/**
 * Маппинг отдельных мышц → 6 групп для UI.
 * Ключи — реальные значения primaryMuscles из базы + sub-muscle ключи из EXERCISE_MUSCLE_OVERRIDE.
 */
export const MUSCLE_GROUP_MAP = {
  chest: 'chest',
  upper_chest: 'chest',
  mid_chest: 'chest',
  lower_chest: 'chest',
  shoulders: 'shoulders',
  front_delt: 'shoulders',
  side_delt: 'shoulders',
  rear_delt: 'shoulders',
  traps: 'back',
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

/**
 * Для упражнений на грудь и плечи — заменяем generic "chest"/"shoulders"
 * на конкретные sub-muscle ключи, чтобы показать верх/середину/низ груди
 * и передние/средние/задние дельты.
 */
export const EXERCISE_MUSCLE_OVERRIDE = {
  // Chest → incline = upper, flat/fly = mid, dip = lower
  'smith-machine-incline-bench-press': { chest: 'upper_chest' },
  'machine-incline-press': { chest: 'upper_chest' },
  'incline-bench-db': { chest: 'upper_chest' },
  'incline-bench-press-barbell': { chest: 'upper_chest' },
  'machine-chest-press': { chest: 'mid_chest' },
  'bench-press-db': { chest: 'mid_chest' },
  'pec-fly': { chest: 'mid_chest' },
  'push-up': { chest: 'mid_chest' },
  'machine-chest-fly': { chest: 'mid_chest' },
  'standing-cable-crossover': { chest: 'mid_chest' },
  'bench-pullover-db': { chest: 'mid_chest' },
  'dip': { chest: 'lower_chest' },
  // Shoulders → press = front, lateral/upright = side, face-pull/reverse = rear
  'overhead-press-seated-db': { shoulders: 'front_delt' },
  'shoulder-press-machine': { shoulders: 'front_delt' },
  'lateral-raise-machine': { shoulders: 'side_delt' },
  'lateral-raise-db': { shoulders: 'side_delt' },
  'machine-shoulder-fly': { shoulders: 'side_delt' },
  'upright-row-barbell': { shoulders: 'side_delt' },
  'cable-face-pull': { shoulders: 'rear_delt' },
  'reverse-fly-db': { shoulders: 'rear_delt' },
  'single-arm-row-l-cable': { shoulders: 'rear_delt' },
  'single-arm-row-r-cable': { shoulders: 'rear_delt' },
}

function resolveMuscles(slug, primaryMuscles) {
  const overrides = EXERCISE_MUSCLE_OVERRIDE[slug] || {}
  return primaryMuscles.map((m) => overrides[m] || m)
}

const SUB_MUSCLE_NAMES_RU = {
  chest: 'Грудь',
  upper_chest: 'Верх груди',
  mid_chest: 'Середина груди',
  lower_chest: 'Низ груди',
  shoulders: 'Дельты',
  front_delt: 'Передние дельты',
  side_delt: 'Средние дельты',
  rear_delt: 'Задние дельты',
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

// ─── Хелперы ────────────────────────────────────────────────────────

function formatLocalDate(d) {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PERIODS = {
  week: { trunc: 'week', interval: '7 days' },
  month: { trunc: 'month', interval: '1 month' },
  year: { trunc: 'year', interval: '1 year' },
}

/**
 * Границы периодов (начало недели/месяца) в TZ юзера, посчитанные в Postgres
 * для consistency с остальными запросами.
 */
async function getBoundaries(tz) {
  const [row] = await prisma.$queryRaw`
    SELECT
      (DATE_TRUNC('week', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) AS "weekStart",
      (DATE_TRUNC('month', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) AS "monthStart"
  `
  return row
}

// ─── Streak ─────────────────────────────────────────────────────────

/**
 * Streak — последовательные дни (назад от сегодня), в которые была хотя бы
 * одна завершённая тренировка. Использует AT TIME ZONE для корректных date boundaries.
 */
export async function computeStreak(userId, tz) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT DATE("finishedAt" AT TIME ZONE ${tz}) AS d
    FROM "Workout"
    WHERE "userId" = ${userId}
      AND "finishedAt" IS NOT NULL
    ORDER BY d DESC
  `

  if (rows.length === 0) return 0

  const todayResult = await prisma.$queryRaw`
    SELECT DATE(NOW() AT TIME ZONE ${tz}) AS today
  `
  const today = todayResult[0].today

  const dateSet = new Set(rows.map((r) => r.d.toISOString().slice(0, 10)))
  const todayStr = today.toISOString().slice(0, 10)

  let streak = 0
  const check = new Date(today)

  // Если сегодня нет тренировки, начинаем со вчера
  if (!dateSet.has(todayStr)) {
    check.setDate(check.getDate() - 1)
  }

  for (let i = 0; i < 365; i++) {
    const key = check.toISOString().slice(0, 10)
    if (dateSet.has(key)) {
      streak++
      check.setDate(check.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

// ─── Период: тренировки + тоннаж + сравнение с прошлым ──────────────

/**
 * Тренировки и тоннаж за период + сравнение с предыдущим таким же периодом.
 * @param {'week'|'month'|'year'} period
 */
export async function getPeriodStats(userId, tz, period = 'month') {
  const p = PERIODS[period]
  if (!p) throw new Error(`getPeriodStats: unknown period "${period}"`)

  // trunc/interval — из белого списка PERIODS (не из пользовательского ввода),
  // поэтому безопасно инлайнить; tz и userId передаём параметрами ($1, $2).
  const rows = await prisma.$queryRawUnsafe(
    `
    WITH bounds AS (
      SELECT
        (DATE_TRUNC('${p.trunc}', NOW() AT TIME ZONE $1) AT TIME ZONE $1) AS cur_start,
        (DATE_TRUNC('${p.trunc}', NOW() AT TIME ZONE $1) AT TIME ZONE $1) - INTERVAL '${p.interval}' AS prev_start
    )
    SELECT
      (SELECT COUNT(*)::int FROM "Workout" w
         WHERE w."userId" = $2 AND w."finishedAt" IS NOT NULL
           AND w."finishedAt" >= (SELECT cur_start FROM bounds)) AS cur_workouts,
      (SELECT COALESCE(SUM(ws."weightKg" * ws.reps), 0)::float FROM "WorkoutSet" ws
         JOIN "Workout" w ON ws."workoutId" = w.id
         WHERE w."userId" = $2 AND w."finishedAt" IS NOT NULL
           AND w."finishedAt" >= (SELECT cur_start FROM bounds)) AS cur_tonnage,
      (SELECT COUNT(*)::int FROM "Workout" w
         WHERE w."userId" = $2 AND w."finishedAt" IS NOT NULL
           AND w."finishedAt" >= (SELECT prev_start FROM bounds)
           AND w."finishedAt" < (SELECT cur_start FROM bounds)) AS prev_workouts,
      (SELECT COALESCE(SUM(ws."weightKg" * ws.reps), 0)::float FROM "WorkoutSet" ws
         JOIN "Workout" w ON ws."workoutId" = w.id
         WHERE w."userId" = $2 AND w."finishedAt" IS NOT NULL
           AND w."finishedAt" >= (SELECT prev_start FROM bounds)
           AND w."finishedAt" < (SELECT cur_start FROM bounds)) AS prev_tonnage
    `,
    tz,
    userId,
  )

  const r = rows[0]
  return {
    period,
    workouts: r.cur_workouts,
    tonnageKg: Math.round(r.cur_tonnage),
    prevWorkouts: r.prev_workouts,
    prevTonnageKg: Math.round(r.prev_tonnage),
  }
}

/** Месяц + streak (используется stats/month и сводками). */
export async function getMonthStats(userId, tz) {
  const [stats, streak] = await Promise.all([
    getPeriodStats(userId, tz, 'month'),
    computeStreak(userId, tz),
  ])
  return { ...stats, streak }
}

/** Неделя (используется weekly-сводкой). */
export async function getWeekStats(userId, tz) {
  return getPeriodStats(userId, tz, 'week')
}

/** Год: сделано тренировок vs (цель добавляет вызывающий). */
export async function getYearStats(userId, tz) {
  const rows = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR FROM NOW() AT TIME ZONE ${tz})::int AS year,
      (SELECT COUNT(*)::int FROM "Workout" w
         WHERE w."userId" = ${userId} AND w."finishedAt" IS NOT NULL
           AND w."finishedAt" >= DATE_TRUNC('year', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) AS done
  `
  return { year: rows[0].year, done: rows[0].done }
}

// ─── Состояние данных (для UI empty-states) ─────────────────────────

export async function getWorkoutState(userId) {
  const totalFinished = await prisma.workout.count({
    where: { userId, finishedAt: { not: null } },
  })
  const state =
    totalFinished === 0 ? 'empty' : totalFinished < 3 ? 'mostly_empty' : 'has_data'
  return { totalFinished, state }
}

// ─── Соответствие плану (неделя) ────────────────────────────────────

export async function getPlanAdherence(userId, tz) {
  const { weekStart } = await getBoundaries(tz)

  const [weekWorkouts, activeProgram] = await Promise.all([
    prisma.workout.findMany({
      where: { userId, finishedAt: { not: null }, startedAt: { gte: weekStart } },
      select: { programDayIndex: true, startedAt: true },
    }),
    prisma.program.findFirst({
      where: { userId, isActive: true },
      select: { planJson: true },
    }),
  ])

  const days = activeProgram?.planJson?.days || []
  const planned = days.length
  const done = weekWorkouts.length
  const extra = planned > 0 ? Math.max(0, done - planned) : 0

  return {
    planned: planned || null,
    done,
    extra,
    weekStart: formatLocalDate(weekStart),
    doneDayIndices: weekWorkouts.map((w) => w.programDayIndex).filter((i) => i != null),
    doneDates: weekWorkouts.map((w) => formatLocalDate(w.startedAt)),
  }
}

// ─── Объём по мышцам (неделя): факт vs цель из программы ─────────────

export async function getMuscleVolume(userId, tz) {
  const { weekStart } = await getBoundaries(tz)

  const [weekSets, activeProgram] = await Promise.all([
    prisma.workoutSet.findMany({
      where: {
        workout: { userId, finishedAt: { not: null }, startedAt: { gte: weekStart } },
        isWarmup: false,
      },
      select: {
        exercise: { select: { slug: true, nameRu: true, primaryMuscles: true } },
      },
    }),
    prisma.program.findFirst({
      where: { userId, isActive: true },
      select: { planJson: true },
    }),
  ])

  const days = activeProgram?.planJson?.days || []

  // Факт: сеты по отдельным мышцам + упражнения по группам
  const actualByMuscle = {}
  const exercisesByGroup = {} // { group → { slug → { nameRu, sets } } }
  for (const s of weekSets) {
    const muscles = resolveMuscles(s.exercise.slug, s.exercise.primaryMuscles)
    for (const muscle of muscles) {
      const group = MUSCLE_GROUP_MAP[muscle]
      if (group) {
        actualByMuscle[muscle] = (actualByMuscle[muscle] || 0) + 1
        if (!exercisesByGroup[group]) exercisesByGroup[group] = {}
        const slug = s.exercise.slug
        if (!exercisesByGroup[group][slug]) {
          exercisesByGroup[group][slug] = { nameRu: s.exercise.nameRu || slug, sets: 0 }
        }
        exercisesByGroup[group][slug].sets += 1
      }
    }
  }

  // Цель: целевые сеты по отдельным мышцам из активной программы
  const targetByMuscle = {}
  if (days.length > 0) {
    const exerciseIds = [
      ...new Set(
        days.flatMap((d) => d.exercises?.map((e) => e.exerciseId).filter(Boolean) || []),
      ),
    ]
    const planExercises =
      exerciseIds.length > 0
        ? await prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            select: { id: true, slug: true, primaryMuscles: true },
          })
        : []
    const exerciseDataById = Object.fromEntries(planExercises.map((e) => [e.id, e]))

    for (const day of days) {
      for (const ex of day.exercises || []) {
        const data = exerciseDataById[ex.exerciseId]
        if (!data) continue
        const muscles = resolveMuscles(data.slug, data.primaryMuscles)
        const sets = ex.sets || 3
        for (const m of muscles) {
          if (MUSCLE_GROUP_MAP[m]) {
            targetByMuscle[m] = (targetByMuscle[m] || 0) + sets
          }
        }
      }
    }
  }

  // Сборка групп с sub-muscles
  return GROUP_ORDER.map((group) => {
    const groupMuscles = Object.keys(MUSCLE_GROUP_MAP).filter(
      (m) => MUSCLE_GROUP_MAP[m] === group,
    )

    const subMuscles = groupMuscles
      .filter((m) => (actualByMuscle[m] || 0) > 0 || (targetByMuscle[m] || 0) > 0)
      .map((m) => ({
        muscle: m,
        nameRu: SUB_MUSCLE_NAMES_RU[m] || m,
        setsActual: actualByMuscle[m] || 0,
        setsTarget: targetByMuscle[m] || null,
      }))
      .sort(
        (a, b) =>
          b.setsActual + (b.setsTarget || 0) - (a.setsActual + (a.setsTarget || 0)),
      )

    const totalActual = subMuscles.reduce((sum, s) => sum + s.setsActual, 0)
    const totalTarget = subMuscles.reduce((sum, s) => sum + (s.setsTarget || 0), 0) || null

    const groupExercises = Object.values(exercisesByGroup[group] || {}).sort(
      (a, b) => b.sets - a.sets,
    )

    return {
      group,
      nameRu: GROUP_NAMES_RU[group],
      setsActual: totalActual,
      setsTarget: totalTarget,
      subMuscles,
      exercises: groupExercises,
    }
  })
}

// ─── Рекорды (PR) ───────────────────────────────────────────────────

/**
 * Рекорды веса за период vs предыдущий максимум. Топ-10 по приросту.
 * @param {'week'|'month'} period
 */
export async function getRecords(userId, tz, period = 'month') {
  const { weekStart, monthStart } = await getBoundaries(tz)
  const start = period === 'week' ? weekStart : monthStart

  const rows = await prisma.$queryRaw`
    WITH period_maxes AS (
      SELECT
        ws."exerciseId",
        MAX(ws."weightKg") AS max_weight,
        (ARRAY_AGG(ws.reps ORDER BY ws."weightKg" DESC, ws."completedAt" DESC))[1] AS reps_at_max
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON ws."workoutId" = w.id
      WHERE w."userId" = ${userId}
        AND w."finishedAt" IS NOT NULL
        AND w."finishedAt" >= ${start}
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
        AND w."finishedAt" < ${start}
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
          AND w2."finishedAt" >= ${start}
          AND ws2."weightKg" = mm.max_weight
        ORDER BY ws2."completedAt" DESC
        LIMIT 1
      ) AS date
    FROM period_maxes mm
    JOIN "Exercise" e ON mm."exerciseId" = e.id
    LEFT JOIN prev_maxes pm ON mm."exerciseId" = pm."exerciseId"
    WHERE mm.max_weight > COALESCE(pm.prev_max, 0)
    ORDER BY (mm.max_weight - COALESCE(pm.prev_max, 0)) DESC
    LIMIT 10
  `

  return rows.map((r) => ({
    exerciseNameRu: r.exerciseNameRu,
    exerciseSlug: r.exerciseSlug,
    value: r.value,
    reps: r.reps,
    previousBest: r.previousBest,
    date: r.date ? formatLocalDate(new Date(r.date)) : null,
  }))
}

// ─── История по одному упражнению (для чата tool-use, фаза 2.3; плато — фаза 4) ──

/**
 * История по конкретному упражнению: топ-сет (рабочий) каждой тренировки,
 * где оно встречалось. Read-only, числа считает код.
 *
 * @param {string} userId
 * @param {string} exerciseId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ exerciseNameRu: string|null, points: Array<{date, topWeightKg, reps, sets, maxReps}>, trend: object }>}
 */
export async function getExerciseHistory(userId, exerciseId, opts = {}) {
  const limit = opts.limit ?? 10

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { nameRu: true },
  })

  // По каждой завершённой тренировке с этим упражнением: топ рабочий вес,
  // повторы на топ-весе, число рабочих сетов. Берём последние N точек.
  const rows = await prisma.$queryRaw`
    WITH per_workout AS (
      SELECT
        w.id AS workout_id,
        w."finishedAt" AS finished_at,
        MAX(ws."weightKg") FILTER (WHERE ws."isWarmup" = false) AS top_weight,
        COUNT(*) FILTER (WHERE ws."isWarmup" = false)::int AS working_sets,
        MAX(ws.reps) FILTER (WHERE ws."isWarmup" = false) AS max_reps
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON ws."workoutId" = w.id
      WHERE w."userId" = ${userId}
        AND w."finishedAt" IS NOT NULL
        AND ws."exerciseId" = ${exerciseId}
      GROUP BY w.id, w."finishedAt"
    )
    SELECT
      pw.finished_at AS date,
      pw.top_weight::float AS "topWeightKg",
      pw.working_sets AS sets,
      pw.max_reps AS "maxReps",
      (
        SELECT ws2.reps
        FROM "WorkoutSet" ws2
        WHERE ws2."workoutId" = pw.workout_id
          AND ws2."exerciseId" = ${exerciseId}
          AND ws2."isWarmup" = false
          AND ws2."weightKg" = pw.top_weight
        ORDER BY ws2.reps DESC
        LIMIT 1
      ) AS "repsAtTop"
    FROM per_workout pw
    ORDER BY pw.finished_at DESC
    LIMIT ${limit}
  `

  // В хронологический порядок (старые → новые).
  const points = rows.reverse().map((r) => ({
    date: r.date ? formatLocalDate(new Date(r.date)) : null,
    topWeightKg: r.topWeightKg != null ? Math.round(r.topWeightKg * 10) / 10 : null,
    reps: r.repsAtTop ?? null,
    sets: r.sets,
    maxReps: r.maxReps ?? null,
  }))

  let trend = null
  if (points.length >= 2) {
    const first = points[0]
    const last = points[points.length - 1]
    const deltaWeightKg =
      first.topWeightKg != null && last.topWeightKg != null
        ? Math.round((last.topWeightKg - first.topWeightKg) * 10) / 10
        : null
    trend = {
      sessions: points.length,
      from: { date: first.date, topWeightKg: first.topWeightKg, reps: first.reps },
      to: { date: last.date, topWeightKg: last.topWeightKg, reps: last.reps },
      deltaWeightKg,
    }
  }

  return { exerciseNameRu: exercise?.nameRu ?? null, points, trend }
}

// ─── Словарь логированных упражнений (для чата tool-use, фаза 5) ────

/**
 * Все упражнения, которые юзер хоть раз логировал в завершённых тренировках.
 * Даёт LLM полный «словарь» движений: что можно запросить в get_exercise_history
 * или заменить/скорректировать в программе. Read-only, числа считает код.
 *
 * @param {string} userId
 * @returns {Promise<Array<{ nameRu: string, slug: string, sessions: number, lastDate: string|null, lastTopWeightKg: number|null }>>}
 */
export async function getLoggedExercisesSummary(userId) {
  const rows = await prisma.$queryRaw`
    WITH ex_workouts AS (
      SELECT
        ws."exerciseId" AS exercise_id,
        w.id AS workout_id,
        w."finishedAt" AS finished_at,
        MAX(ws."weightKg") FILTER (WHERE ws."isWarmup" = false) AS top_weight
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON ws."workoutId" = w.id
      WHERE w."userId" = ${userId}
        AND w."finishedAt" IS NOT NULL
      GROUP BY ws."exerciseId", w.id, w."finishedAt"
    ),
    ranked AS (
      SELECT
        exercise_id,
        finished_at,
        top_weight,
        ROW_NUMBER() OVER (PARTITION BY exercise_id ORDER BY finished_at DESC) AS rn,
        COUNT(*) OVER (PARTITION BY exercise_id)::int AS sessions
      FROM ex_workouts
    )
    SELECT
      e."nameRu" AS "nameRu",
      e.slug AS slug,
      r.sessions AS sessions,
      r.finished_at AS "lastDate",
      r.top_weight::float AS "lastTopWeightKg"
    FROM ranked r
    JOIN "Exercise" e ON r.exercise_id = e.id
    WHERE r.rn = 1
    ORDER BY r.sessions DESC, r.finished_at DESC
  `

  return rows.map((r) => ({
    nameRu: r.nameRu,
    slug: r.slug,
    sessions: r.sessions,
    lastDate: r.lastDate ? formatLocalDate(new Date(r.lastDate)) : null,
    lastTopWeightKg:
      r.lastTopWeightKg != null ? Math.round(r.lastTopWeightKg * 10) / 10 : null,
  }))
}

// ─── Сводка по одной тренировке (для пост-тренировочной сводки, фаза 1) ──

/**
 * Разбор завершённой тренировки: сеты по упражнениям + сравнение с прошлой
 * тренировкой того же дня программы (прогресс/регресс по весам).
 *
 * Возвращает null если тренировки нет или в ней нет сетов.
 */
export async function getWorkoutSummary(workoutId) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      sets: {
        include: { exercise: { select: { slug: true, nameRu: true } } },
        orderBy: [{ exerciseOrder: 'asc' }, { setOrder: 'asc' }],
      },
    },
  })

  if (!workout || workout.sets.length === 0) return null

  // Группировка сетов по упражнению (рабочие, без разминки)
  const byExercise = new Map()
  let tonnageKg = 0
  for (const s of workout.sets) {
    if (s.weightKg && s.reps) tonnageKg += s.weightKg * s.reps
    if (s.isWarmup) continue
    const key = s.exerciseId
    if (!byExercise.has(key)) {
      byExercise.set(key, {
        exerciseId: s.exerciseId,
        slug: s.exercise.slug,
        nameRu: s.exercise.nameRu,
        sets: 0,
        topSet: null, // { weightKg, reps }
        volumeKg: 0,
      })
    }
    const agg = byExercise.get(key)
    agg.sets += 1
    agg.volumeKg += (s.weightKg || 0) * s.reps
    const w = s.weightKg || 0
    if (!agg.topSet || w > agg.topSet.weightKg) {
      agg.topSet = { weightKg: w, reps: s.reps }
    }
  }

  // Сравнение с прошлой тренировкой того же дня программы
  let comparedTo = null
  let prevMaxByExercise = {}
  if (workout.programId != null && workout.programDayIndex != null) {
    const prev = await prisma.workout.findFirst({
      where: {
        userId: workout.userId,
        programId: workout.programId,
        programDayIndex: workout.programDayIndex,
        finishedAt: { not: null, lt: workout.finishedAt ?? new Date() },
        id: { not: workout.id },
      },
      orderBy: { finishedAt: 'desc' },
      select: {
        id: true,
        sets: { where: { isWarmup: false }, select: { exerciseId: true, weightKg: true } },
      },
    })
    if (prev) {
      comparedTo = prev.id
      for (const s of prev.sets) {
        const w = s.weightKg || 0
        if (!(s.exerciseId in prevMaxByExercise) || w > prevMaxByExercise[s.exerciseId]) {
          prevMaxByExercise[s.exerciseId] = w
        }
      }
    }
  }

  const exercises = [...byExercise.values()].map((e) => {
    const prevMax = prevMaxByExercise[e.exerciseId]
    const curMax = e.topSet?.weightKg ?? 0
    const deltaWeightKg =
      comparedTo && prevMax != null ? Math.round((curMax - prevMax) * 100) / 100 : null
    return {
      slug: e.slug,
      nameRu: e.nameRu,
      sets: e.sets,
      topSet: e.topSet,
      volumeKg: Math.round(e.volumeKg),
      deltaWeightKg,
    }
  })

  const durationSec =
    workout.finishedAt && workout.startedAt
      ? Math.max(
          0,
          Math.floor(
            (new Date(workout.finishedAt) -
              new Date(workout.startedAt) -
              (workout.totalPausedMs || 0)) /
              1000,
          ),
        )
      : null

  return {
    workoutId: workout.id,
    finishedAt: workout.finishedAt,
    durationSec,
    feltRating: workout.feltRating,
    programDayIndex: workout.programDayIndex,
    setsCount: workout.sets.length,
    tonnageKg: Math.round(tonnageKg),
    exercises,
    comparedTo,
  }
}
