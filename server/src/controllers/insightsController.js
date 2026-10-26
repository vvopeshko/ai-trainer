/**
 * insightsController — дневной инсайт «замечание тренера» на Home (фаза 4.2).
 *
 * Лениво (не cron — юзер может не зайти): первый запрос дня генерит через LLM и
 * кэширует в модели Insight по (userId, дата в TZ). Остальные запросы дня — из кэша.
 *
 * LLM не держит ответ дольше LLM_BUDGET_MS: не успела — отдаём шаблонный текст
 * с pending: true (фронт переспросит), генерация дописывает кэш в фоне.
 * Одна генерация на (userId, дату) на процесс — параллельные запросы её делят.
 */
import { getUserTimezone } from '../utils/dateUtils.js'
import { getLocalTime } from '../scheduler/index.js'
import { prepareDailyInsight } from '../services/aiTrainer/dailyInsight.js'
import prisma from '../utils/prisma.js'

const DEFAULT_TZ = 'Europe/Moscow'
const LLM_BUDGET_MS = 4000

const inFlight = new Map() // `${userId}:${date}` → { prepared, done }

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

  const key = `${userId}:${date}`
  const entry = inFlight.get(key) ?? startGeneration(key, userId, tz, date)
  const { fallback } = await entry.prepared

  const payload = await Promise.race([
    entry.done.catch(() => fallback),
    new Promise((resolve) => setTimeout(resolve, LLM_BUDGET_MS, null)),
  ])
  res.json(payload ?? { ...fallback, pending: true })
}

// Регистрируется синхронно — параллельный запрос увидит её до первого await.
function startGeneration(key, userId, tz, date) {
  const prepared = prepareDailyInsight(userId, tz)
  const done = prepared
    .then(({ fallback, generate }) => (generate ? generate() : fallback))
    .then((payload) => saveInsight(userId, date, payload))
  const entry = { prepared, done }
  inFlight.set(key, entry)
  done.catch(() => {}).finally(() => inFlight.delete(key))
  return entry
}

// Кэшируем даже пустой ({ text: null }) — чтобы не пересчитывать весь день.
// Возвращает то, что реально лежит в кэше (при гонке — чужую запись).
async function saveInsight(userId, date, payload) {
  try {
    await prisma.insight.create({ data: { userId, date, payload } })
  } catch (err) {
    // Гонка параллельных запросов (другой процесс): уже создан — берём существующий.
    if (err?.code === 'P2002') {
      const row = await prisma.insight.findUnique({
        where: { userId_date: { userId, date } },
        select: { payload: true },
      })
      if (row) return row.payload
    } else {
      console.error('[insights] cache write failed:', err.message)
    }
  }
  return payload
}
