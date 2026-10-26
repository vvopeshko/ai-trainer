import { exerciseSeedContent } from './exerciseSeedContent.js'
import { targetMuscle } from '../services/exerciseTargets.js'

/**
 * Enriched catalog JSON → Exercise rows, and the rules for re-seeding over a
 * live database: the seed only creates missing rows and fills empty fields, so
 * GIFs found later (enrichProgramMedia writes them to the DB only) and manual
 * fixes made in production survive a re-run. Deliberate overwrites go through
 * an explicit field list (`--only=category`).
 */

/** Free Exercise DB level → Prisma ExerciseDifficulty */
export function mapDifficulty(level) {
  if (level === 'expert') return 'advanced'
  if (['beginner', 'intermediate', 'advanced'].includes(level)) return level
  return 'beginner'
}

/**
 * Free Exercise DB category + mechanic → Prisma ExerciseCategory. Stretches and
 * cardio keep their own kind; everything else (strength, powerlifting,
 * plyometrics…) is compound or isolation by mechanic.
 */
export function mapCategory(ex) {
  if (ex.category === 'stretching') return 'stretch'
  if (ex.category === 'cardio') return 'cardio'
  if (['compound', 'isolation'].includes(ex.mechanic)) return ex.mechanic
  return 'compound'
}

const FORCES = ['push', 'pull', 'static']

/** Technique steps: Russian when translated, the source English otherwise. */
function instructions(ex) {
  const steps = ex.instructionsRu?.length ? ex.instructionsRu : ex.instructions
  return Array.isArray(steps) ? steps.join('\n\n') : steps || null
}

export function mapExercise(ex) {
  return {
    slug: ex.slug,
    nameRu: ex.nameRu,
    nameEn: ex.nameEn,
    ...exerciseSeedContent(ex),
    instructions: instructions(ex),
    primaryMuscles: ex.primaryMuscles || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    equipment: ex.equipment ? [ex.equipment] : [],
    difficulty: mapDifficulty(ex.level),
    category: mapCategory(ex),
    targetMuscle: targetMuscle(ex.slug),
    force: FORCES.includes(ex.force) ? ex.force : null,
    unilateral: typeof ex.unilateral === 'boolean' ? ex.unilateral : null,
    trackingType: ex.trackingType ?? null,
    movementPattern: ex.movementPattern ?? null,
    jointStress: ex.jointStress ?? [],
    stable: typeof ex.stable === 'boolean' ? ex.stable : null,
    imageUrl: ex.images?.[0] || null,
    gifUrl: ex.gifUrl || null,
    aliases: ex.aliases || [],
    source: 'seed',
  }
}

const isEmpty = value => value == null
  || (typeof value === 'string' && !value.trim())
  || (Array.isArray(value) && value.length === 0)

// Never touched on an existing row. `source` is never empty, so only an
// explicit --only=source promotes an auto-created exercise into the catalog.
const KEEP = new Set(['slug'])

/**
 * Update for an existing row. Without `only`: seed values for fields that are
 * empty in the database. With `only`: seed values for exactly those fields,
 * overwriting. An empty seed value never erases anything — unless `clear`
 * (--clear), and then only in the listed fields.
 */
export function seedUpdate(existing, data, only = null, { clear = false } = {}) {
  const update = {}
  for (const [field, value] of Object.entries(data)) {
    if (KEEP.has(field)) continue
    if (isEmpty(value) && !(clear && only?.includes(field))) continue
    if (JSON.stringify(existing[field] ?? null) === JSON.stringify(value ?? null)) continue
    if (only ? only.includes(field) : isEmpty(existing[field])) update[field] = value
  }
  return update
}

const aliasKey = a => a.trim().toLowerCase().replace(/ё/g, 'е')

/**
 * Aliases an update would remove from the database: ones the catalog does not
 * have — learned by the resolver in production, or deleted from the catalog on
 * purpose. scripts/pullAliases.js copies them into the catalog first.
 */
export function droppedAliases(existing, update) {
  if (!Array.isArray(update.aliases)) return []
  const kept = new Set(update.aliases.map(aliasKey))
  return (existing.aliases ?? []).filter(a => !kept.has(aliasKey(a)))
}
