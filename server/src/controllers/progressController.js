import { getUserTimezone } from '../utils/dateUtils.js'
import {
  getWorkoutState,
  getPlanAdherence,
  getMuscleVolume,
  getRecords,
} from '../services/statsService.js'
import { getInsights } from '../services/insightsService.js'

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

/**
 * GET /api/v1/progress/insights
 *
 * Детекция плато/регрессии/роста/дисбалансов — чипы + карточки (без LLM).
 * Числа и тексты считает insightsService (принцип «числа — кодом»).
 */
export async function getProgressInsights(req, res) {
  const userId = req.user.id
  const tz = getUserTimezone(req)

  const { facts, counts } = await getInsights(userId, tz)

  // Чипы — компактные счётчики по типам (порядок: рост → плато → просадка).
  const chips = [
    { type: 'growth', count: counts.growth },
    { type: 'plateau', count: counts.plateau },
    { type: 'regression', count: counts.regression },
  ].filter((c) => c.count > 0)

  // Карточки — топ-факты с готовым русским текстом.
  const cards = facts.slice(0, 6).map((f) => ({
    type: f.type,
    title: f.title,
    detail: f.detail,
    exerciseId: f.exerciseId ?? null,
  }))

  res.json({ chips, cards })
}
