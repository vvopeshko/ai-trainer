import { getUserTimezone } from '../utils/dateUtils.js'
import {
  getWorkoutState,
  getPlanAdherence,
  getMuscleVolume,
  getRecords,
} from '../services/statsService.js'

/**
 * GET /api/v1/progress
 *
 * Единый эндпоинт прогресса: planAdherence + muscleVolume (с sub-muscles) + records.
 * Вся аналитика — в statsService (переиспользуется сводками/инсайтами).
 */
export async function getProgress(req, res) {
  const userId = req.user.id
  const tz = getUserTimezone(req)

  const [{ state }, planAdherence, muscleVolume, records] = await Promise.all([
    getWorkoutState(userId),
    getPlanAdherence(userId, tz),
    getMuscleVolume(userId, tz),
    getRecords(userId, tz, 'month'),
  ])

  res.json({ state, planAdherence, muscleVolume, records })
}
