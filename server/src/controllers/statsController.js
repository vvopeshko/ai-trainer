import { getUserTimezone } from '../utils/dateUtils.js'
import { getMonthStats } from '../services/statsService.js'
import { getAnnualGoalStats } from '../services/annualGoalService.js'

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
  res.json(await getAnnualGoalStats(req.user, getUserTimezone(req)))
}
