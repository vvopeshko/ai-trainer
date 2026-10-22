import { z } from 'zod'

const goalSchema = z.object({
  year: z.number().int().min(2000).max(9999),
  target: z.number().int().positive(),
  baselineDate: z.string().date(),
  baselineCount: z.number().int().nonnegative(),
  timezone: z.string().refine(tz => {
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false }
  }),
}).refine(g => g.baselineDate.startsWith(`${g.year}-`))

export function parseAnnualGoal(value) {
  const parsed = goalSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function localDate(now, timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

const dayNumber = date => Date.parse(`${date}T00:00:00Z`) / 86_400_000
const dateFromDay = day => new Date(day * 86_400_000).toISOString().slice(0, 10)

// Dates are local completion dates, one per finished workout (not unique days).
export function calculateAnnualGoal({ today, workoutDates, goal, defaultTarget = 200 }) {
  const year = Number(today.slice(0, 4))
  const start = `${year}-01-01`
  const deadline = `${year}-12-31`
  const baseline = goal?.year === year && goal.baselineDate <= today ? goal : null
  const dates = workoutDates.filter(d => d <= today)
  const added = dates.filter(d => d >= start && (!baseline || d > baseline.baselineDate)).length
  const done = (baseline?.baselineCount ?? 0) + added
  const target = goal?.year === year ? goal.target : defaultTarget
  const elapsedDays = dayNumber(today) - dayNumber(start) + 1
  // Today is included both in the observed period and in remaining available days.
  const daysRemaining = dayNumber(deadline) - dayNumber(today) + 1
  const monthStart = dateFromDay(dayNumber(today) - 29)
  const monthComplete = !baseline || baseline.baselineDate < monthStart
  const monthDone = monthComplete ? dates.filter(d => d >= monthStart).length : null
  const remaining = Math.max(0, target - done)
  return {
    year, done, target, deadline, remaining, daysRemaining,
    monthDone, monthDays: 30, monthStart,
    monthPace: monthDone === null ? null : monthDone * 7 / 30,
    yearPace: done * 7 / elapsedDays,
    requiredPace: remaining * 7 / daysRemaining,
    baselineDate: baseline?.baselineDate ?? null,
    baselineCount: baseline?.baselineCount ?? 0,
    added,
  }
}
