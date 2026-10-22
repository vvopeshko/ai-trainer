import prisma from '../utils/prisma.js'
import { calculateAnnualGoal, localDate, parseAnnualGoal } from './annualGoal.js'

export async function getAnnualGoalStats(user, timezone, now = new Date()) {
  const goal = parseAnnualGoal(user.annualWorkoutGoal)
  // Keep the historical cutoff stable even when the user travels.
  const tz = goal?.timezone ?? timezone
  const today = localDate(now, tz)
  const yearStart = `${today.slice(0, 4)}-01-01`
  const rows = await prisma.$queryRaw`
    SELECT TO_CHAR(w."finishedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS date
    FROM "Workout" w
    WHERE w."userId" = ${user.id}
      AND w."finishedAt" IS NOT NULL
      AND w."finishedAt" <= ${now}
      AND w."finishedAt" >= LEAST(
        ${yearStart}::date, ${today}::date - 29
      )::timestamp AT TIME ZONE ${tz} AT TIME ZONE 'UTC'
  `
  const configuredTarget = Number(process.env.ANNUAL_WORKOUT_TARGET)
  const defaultTarget = Number.isInteger(configuredTarget) && configuredTarget > 0 ? configuredTarget : 200
  return { ...calculateAnnualGoal({ today, workoutDates: rows.map(r => r.date), goal, defaultTarget }), timezone: tz }
}
