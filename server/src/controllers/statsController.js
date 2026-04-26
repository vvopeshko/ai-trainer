import prisma from '../utils/prisma.js'

/**
 * GET /api/v1/stats/month
 *
 * Статистика за текущий месяц: тренировки, тоннаж, серия (streak).
 */
export async function getMonth(req, res) {
  const userId = req.user.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [workouts, tonnageResult, streak] = await Promise.all([
    // Количество завершённых тренировок за месяц
    prisma.workout.count({
      where: {
        userId,
        finishedAt: { not: null, gte: startOfMonth },
      },
    }),

    // Суммарный тоннаж: SUM(weightKg * reps) по сетам завершённых тренировок месяца
    prisma.$queryRaw`
      SELECT COALESCE(SUM(ws."weightKg" * ws.reps), 0)::float AS tonnage
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON ws."workoutId" = w.id
      WHERE w."userId" = ${userId}
        AND w."finishedAt" IS NOT NULL
        AND w."finishedAt" >= ${startOfMonth}
    `,

    // Серия: последовательные дни с хотя бы 1 завершённой тренировкой
    computeStreak(userId),
  ])

  res.json({
    workouts,
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
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const done = await prisma.workout.count({
    where: {
      userId,
      finishedAt: { not: null, gte: startOfYear },
    },
  })

  res.json({
    year: now.getFullYear(),
    done,
    target: 208, // 4 тренировки/неделю × 52
  })
}

/**
 * Считает streak — последовательные дни (назад от сегодня),
 * в которые была хотя бы одна завершённая тренировка.
 */
async function computeStreak(userId) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT DATE("finishedAt") AS d
    FROM "Workout"
    WHERE "userId" = ${userId}
      AND "finishedAt" IS NOT NULL
    ORDER BY d DESC
  `

  if (rows.length === 0) return 0

  const dates = rows.map(r => {
    const d = new Date(r.d)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Серия начинается с сегодня или вчера
  let streak = 0
  let check = new Date(today)

  // Если сегодня нет тренировки, начинаем со вчера
  if (dates[0] !== todayStr) {
    check.setDate(check.getDate() - 1)
  }

  const dateSet = new Set(dates)

  for (let i = 0; i < 365; i++) {
    const key = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`
    if (dateSet.has(key)) {
      streak++
      check.setDate(check.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}
