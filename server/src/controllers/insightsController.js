/**
 * insightsController — дневной инсайт «замечание тренера» на Home (фаза 4.2).
 *
 * Лениво (не cron — юзер может не зайти): первый запрос дня генерит через LLM и
 * кэширует в модели Insight по (userId, дата в TZ). Остальные запросы дня — из кэша.
 */
import { getUserTimezone } from '../utils/dateUtils.js'
import { getLocalTime } from '../scheduler/index.js'
import { buildDailyInsight } from '../services/aiTrainer/dailyInsight.js'
import prisma from '../utils/prisma.js'

const DEFAULT_TZ = 'Europe/Moscow'

/**
 * GET /api/v1/insights/today → { text: string|null, factType?: string }
 */
export async function getDailyInsight(req, res) {
  const userId = req.user.id
  const tz = getUserTimezone(req)

  let date
  try {
    date = getLocalTime(new Date(), tz).dayKey
  } catch {
    date = getLocalTime(new Date(), DEFAULT_TZ).dayKey
  }

  // Кэш дня.
  const cached = await prisma.insight.findUnique({
    where: { userId_date: { userId, date } },
    select: { payload: true },
  })
  if (cached) return res.json(cached.payload)

  const payload = await buildDailyInsight(userId, tz)

  // Кэшируем даже пустой ({ text: null }) — чтобы не пересчитывать весь день.
  try {
    await prisma.insight.create({ data: { userId, date, payload } })
  } catch (err) {
    // Гонка параллельных запросов: уже создан — берём существующий.
    if (err?.code === 'P2002') {
      const row = await prisma.insight.findUnique({
        where: { userId_date: { userId, date } },
        select: { payload: true },
      })
      if (row) return res.json(row.payload)
    } else {
      console.error('[insights] cache write failed:', err.message)
    }
  }

  res.json(payload)
}
