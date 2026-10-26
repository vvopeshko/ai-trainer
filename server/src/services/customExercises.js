/**
 * The user's own exercises (source: user_created, createdByUserId): created from
 * the workout's exercise picker when the catalog has nothing that fits. Private:
 * the shared catalog, search, alternatives, generation and the resolver skip
 * them; GET /exercises/custom returns them to their author only.
 *
 * Before creating, the catalog gets a chance: an exact name or an LLM match
 * («жим гантелей под углом» → «Жим гантелей на наклонной») comes back as a
 * suggestion; the user can still insist (force) — then it is created, already
 * classified by the LLM (muscles, equipment, tracking type…).
 */
import { randomBytes } from 'node:crypto'
import prisma from '../utils/prisma.js'
import { matchUnknownExercises, forgetCatalog } from './exerciseMatcher.js'
import { normKey, slugify } from './exerciseResolver.js'
import { forgetCatalogResponse } from './exerciseCatalog.js'

export const CUSTOM_SELECT = {
  id: true, slug: true, nameRu: true, nameEn: true,
  primaryMuscles: true, secondaryMuscles: true, equipment: true,
  difficulty: true, category: true, gifUrl: true, aliases: true,
  targetMuscle: true, unilateral: true, trackingType: true, source: true,
}

/** Own exercises of a user, newest first. */
export function listCustomExercises(userId) {
  return prisma.exercise.findMany({
    where: { source: 'user_created', createdByUserId: userId },
    orderBy: { createdAt: 'desc' },
    select: CUSTOM_SELECT,
  })
}

/** Exact catalog or own exercise with this name (ignoring case, ё/е). */
async function findByName(userId, key) {
  const [found] = await prisma.$queryRaw`
    SELECT id FROM "Exercise"
    WHERE (source <> 'user_created' OR "createdByUserId" = ${userId})
      AND (replace(lower("nameRu"), 'ё', 'е') = ${key}
        OR EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE replace(lower(a), 'ё', 'е') = ${key}))
    ORDER BY (replace(lower("nameRu"), 'ё', 'е') = ${key}) DESC, (source = 'seed') DESC, "createdAt"
    LIMIT 1
  `
  return found ? prisma.exercise.findUnique({ where: { id: found.id }, select: CUSTOM_SELECT }) : null
}

/**
 * @returns {Promise<{ exercise: object, created: boolean } | { suggestion: object }>}
 *   suggestion — the catalog probably has it; created: false — exact name exists.
 */
export async function createCustomExercise(userId, { nameRu, force = false }) {
  const name = nameRu.trim().replace(/\s+/g, ' ')
  const existing = await findByName(userId, normKey(name))
  if (existing) return { exercise: existing, created: false }

  const decision = (await matchUnknownExercises([['1', { nameRu: name }]], { classifyOnly: force })).get('1')
  if (decision?.match) {
    const suggestion = await prisma.exercise.findUnique({ where: { id: decision.match.id }, select: CUSTOM_SELECT })
    if (suggestion) return { suggestion }
  }
  const fields = decision?.fields ?? {}

  // Own slug space: never collides with the catalog or another user's exercise.
  const slug = `my-${randomBytes(3).toString('hex')}-${slugify(fields.nameEn || name).slice(0, 60) || 'exercise'}`
  const exercise = await prisma.exercise.create({
    data: {
      slug,
      nameRu: name,
      nameEn: fields.nameEn ?? null,
      primaryMuscles: fields.primaryMuscles ?? [],
      secondaryMuscles: fields.secondaryMuscles ?? [],
      equipment: fields.equipment ? [fields.equipment] : [],
      ...(fields.category && { category: fields.category }),
      targetMuscle: fields.targetMuscle ?? null,
      force: fields.force ?? null,
      unilateral: fields.unilateral ?? null,
      trackingType: fields.trackingType ?? null,
      movementPattern: fields.movementPattern ?? null,
      jointStress: fields.jointStress ?? [],
      stable: fields.stable ?? null,
      aliases: [],
      source: 'user_created',
      createdByUserId: userId,
    },
    select: CUSTOM_SELECT,
  })
  forgetCatalog()
  forgetCatalogResponse()
  return { exercise, created: true }
}
