import { getUserTimezone } from '../utils/dateUtils.js'
import { getMonthStats, getYearStats } from '../services/statsService.js'

// 4 тренировки/неделю × 52 = 208. Переопределяется через env.
const ANNUAL_WORKOUT_TARGET = Number(process.env.ANNUAL_WORKOUT_TARGET) || 208

/**
 * GET /api/v1/stats/month
 *
 * Статистика за текущий месяц: тренировки, тоннаж, серия (streak).
 */
export async function getMonth(req, res) {
  const { workouts, tonnageKg, streak } = await getMonthStats(
    req.user.id,
    getUserTimezone(req),
  )
  res.json({ workouts, tonnageKg, streak })
}

/**
 * GET /api/v1/stats/year
 *
 * Годовой прогресс: сколько тренировок сделано / цель.
 */
export async function getYear(req, res) {
  const { year, done } = await getYearStats(req.user.id, getUserTimezone(req))
  res.json({ year, done, target: ANNUAL_WORKOUT_TARGET })
}
