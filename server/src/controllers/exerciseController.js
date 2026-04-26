import { z } from 'zod'
import prisma from '../utils/prisma.js'

/**
 * GET /api/v1/exercises
 *
 * Список упражнений. Опционально фильтрует по группе мышц.
 * Query params:
 *   muscle — фильтр по primaryMuscles (e.g. "chest")
 *   limit  — количество (default 100)
 */
export async function list(req, res) {
  const { muscle, limit } = z
    .object({
      muscle: z.string().optional(),
      limit: z.coerce.number().int().positive().max(500).default(100),
    })
    .parse(req.query)

  const where = {}
  if (muscle) {
    where.primaryMuscles = { has: muscle }
  }

  const exercises = await prisma.exercise.findMany({
    where,
    orderBy: { nameRu: 'asc' },
    take: limit,
  })

  res.json({ exercises })
}

/**
 * GET /api/v1/exercises/search?q=жим
 *
 * Текстовый поиск по nameRu, nameEn, aliases.
 * Используется при добавлении внепланового упражнения.
 */
export async function search(req, res) {
  const { q } = z
    .object({
      q: z.string().min(1).max(100),
    })
    .parse(req.query)

  const lower = q.toLowerCase()

  // Prisma не поддерживает полнотекстовый поиск по массивам из коробки.
  // Используем raw SQL: ищем по nameRu, nameEn и aliases (unnest).
  const exercises = await prisma.$queryRaw`
    SELECT * FROM "Exercise"
    WHERE
      lower("nameRu") LIKE '%' || ${lower} || '%'
      OR lower("nameEn") LIKE '%' || ${lower} || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(aliases) AS a
        WHERE lower(a) LIKE '%' || ${lower} || '%'
      )
    ORDER BY "nameRu"
    LIMIT 20
  `

  res.json({ exercises })
}
