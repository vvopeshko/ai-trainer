import prisma from '../utils/prisma.js'
import { getUserTimezone } from '../utils/dateUtils.js'

// 4 тренировки/неделю × 52 = 208. Переопределяется через env.
const ANNUAL_WORKOUT_TARGET = Number(process.env.ANNUAL_WORKOUT_TARGET) || 208

/**
 * GET /api/v1/stats/month
 *
 * Статистика за текущий месяц: тренировки, тоннаж, серия (streak).
 * Все date-boundary запросы используют AT TIME ZONE для корректной работы с TZ юзера.
 */
export async function getMonth(req, res) {
  const userId = req.user.id
  const tz = getUserTimezone(req)

  const [workoutResult, tonnageResult, streak] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "Workout"
      WHERE "userId" = ${userId}
        AND "finishedAt" IS NOT NULL
        AND "finishedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}
    `,

    prisma.$queryRaw`
      SELECT COALESCE(SUM(ws."weightKg" * ws.reps), 0)::float AS tonnage
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON ws."workoutId" = w.id
      WHERE w."userId" = ${userId}
        AND w."finishedAt" IS NOT NULL
        AND w."finishedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}
    `,

    computeStreak(userId, tz),
  ])

  res.json({
    workouts: workoutResult[0].count,
    tonnageKg: Math.round(tonnageResult[0].tonnage),
    streak,
  })
}

/**
 * GET /api/v1/stats/year
 *
 * Годовой прогресс: сколько тренировок сделано / цель.
 */
export async function getYear(req, res) {
  const userId = req.user.id
  const tz = getUserTimezone(req)

  const result = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS done
    FROM "Workout"
    WHERE "userId" = ${userId}
      AND "finishedAt" IS NOT NULL
      AND "finishedAt" >= DATE_TRUNC('year', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}
  `

  // Get year in user's timezone
  const yearResult = await prisma.$queryRaw`
    SELECT EXTRACT(YEAR FROM NOW() AT TIME ZONE ${tz})::int AS year
  `

  res.json({
    year: yearResult[0].year,
    done: result[0].done,
    target: ANNUAL_WORKOUT_TARGET,
  })
}

/**
 * Считает streak — последовательные дни (назад от сегодня),
 * в которые была хотя бы одна завершённая тренировка.
 * Использует AT TIME ZONE для корректных date boundaries.
 */
async function computeStreak(userId, tz) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT DATE("finishedAt" AT TIME ZONE ${tz}) AS d
    FROM "Workout"
    WHERE "userId" = ${userId}
      AND "finishedAt" IS NOT NULL
    ORDER BY d DESC
  `

  if (rows.length === 0) return 0

  // "Сегодня" в TZ юзера — из PostgreSQL для consistency
  const todayResult = await prisma.$queryRaw`
    SELECT DATE(NOW() AT TIME ZONE ${tz}) AS today
  `
  const today = todayResult[0].today

  const dateSet = new Set(rows.map(r => r.d.toISOString().slice(0, 10)))
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
