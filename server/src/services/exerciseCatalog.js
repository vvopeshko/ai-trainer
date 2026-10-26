import prisma from '../utils/prisma.js'

// Кэш ответа GET /exercises: каталог общий для всех юзеров, а популярность —
// агрегат по подходам и программам ВСЕХ юзеров (растёт с данными платформы).
// Раньше оба запроса шли на каждый вызов. Резолвер сбрасывает кэш, когда
// создаёт упражнение или дописывает алиасы (forgetCatalogResponse).

const POPULARITY_TTL_MS = 60 * 60_000
const RESPONSE_TTL_MS = 10 * 60_000

let popularityCache = null // { at, promise }
const responses = new Map() // `${muscle}|${limit}` → { at, body }

/**
 * Популярность: сколько пользователей делают упражнение — записывали подходы
 * или держат его в программе (жим лёжа из программы считается, даже если его
 * ещё не записали). Поднимает обычные зальные упражнения над экзотикой в поиске.
 * Кэш на час, параллельные вызовы делят один запрос.
 * @returns {Promise<Map<string, number>>} exerciseId → число пользователей
 */
export function exercisePopularity() {
  if (popularityCache && Date.now() - popularityCache.at < POPULARITY_TTL_MS) {
    return popularityCache.promise
  }
  const promise = loadPopularity()
  popularityCache = { at: Date.now(), promise }
  promise.catch(() => { if (popularityCache?.promise === promise) popularityCache = null })
  return promise
}

async function loadPopularity() {
  const rows = await prisma.$queryRaw`
    WITH used AS (
      SELECT DISTINCT w."userId", s."exerciseId"
      FROM "WorkoutSet" s JOIN "Workout" w ON w.id = s."workoutId"
      UNION
      SELECT DISTINCT p."userId", ex->>'exerciseId'
      FROM "Program" p
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(p."planJson"->'days') = 'array' THEN p."planJson"->'days' ELSE '[]'::jsonb END) d
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d->'exercises') = 'array' THEN d->'exercises' ELSE '[]'::jsonb END) ex
    )
    SELECT "exerciseId" AS id, count(DISTINCT "userId")::int AS users FROM used GROUP BY 1
  `
  return new Map(rows.map(r => [r.id, r.users]))
}

/**
 * Сериализованный ответ списка упражнений (строка JSON) — отдаётся как есть,
 * Express по нему же считает ETag (повторный запрос → 304 без тела).
 */
export async function catalogResponse({ muscle, limit }) {
  const key = `${muscle ?? ''}|${limit}`
  const hit = responses.get(key)
  if (hit && Date.now() - hit.at < RESPONSE_TTL_MS) return hit.body

  const [exercises, popularity] = await Promise.all([
    prisma.exercise.findMany({
      // Shared by all users: their own exercises come separately (GET /exercises/custom).
      where: { source: { not: 'user_created' }, ...(muscle && { primaryMuscles: { has: muscle } }) },
      orderBy: { nameRu: 'asc' },
      take: limit,
      select: {
        id: true, slug: true, nameRu: true, nameEn: true,
        primaryMuscles: true, secondaryMuscles: true, equipment: true,
        difficulty: true, category: true, gifUrl: true, aliases: true,
        targetMuscle: true, unilateral: true, trackingType: true, isCore: true,
      },
    }),
    exercisePopularity(),
  ])
  const body = JSON.stringify({
    exercises: exercises.map(e => ({ ...e, popularity: popularity.get(e.id) ?? 0 })),
  })
  if (responses.size > 100) responses.clear() // ключей мало (muscle × limit), защита от мусора
  responses.set(key, { at: Date.now(), body })
  return body
}

/** Каталог изменился (новое упражнение, алиасы) — следующий запрос соберёт ответ заново. */
export function forgetCatalogResponse() {
  responses.clear()
}
