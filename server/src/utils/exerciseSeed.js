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
 * overwriting. An empty seed value never erases anything.
 */
export function seedUpdate(existing, data, only = null) {
  const update = {}
  for (const [field, value] of Object.entries(data)) {
    if (KEEP.has(field) || isEmpty(value)) continue
    if (JSON.stringify(existing[field]) === JSON.stringify(value)) continue
    if (only ? only.includes(field) : isEmpty(existing[field])) update[field] = value
  }
  return update
}
