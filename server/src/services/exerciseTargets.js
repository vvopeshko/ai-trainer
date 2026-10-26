import { existsSync, readFileSync } from 'node:fs'

/**
 * Target muscle = the one muscle region an exercise mainly works, finer than
 * Exercise.primaryMuscles. Keys match the app's sub-muscle IDs (statsService,
 * src/utils/muscleMapping.js). Classified once by LLM over the catalog
 * (scripts/classifyTargetMuscles.js) into data/exercise-targets.json, keyed by
 * slug; 'none' = stretches, cardio, drills — not a strength swap. The seed
 * copies it into Exercise.targetMuscle, which the app reads.
 */
export const TARGET_MUSCLES = [
  'upper_chest', 'mid_chest', 'lower_chest',
  'front_delt', 'side_delt', 'rear_delt',
  'lats', 'middle back', 'traps', 'lower back',
  'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors',
  'abdominals', 'obliques', 'neck',
]

const FILE = new URL('../../data/exercise-targets.json', import.meta.url)
const targets = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}

/** Target muscle of a catalog slug, or null when unknown / not a strength exercise. */
export function targetMuscle(slug) {
  const target = targets[slug]
  return target && target !== 'none' ? target : null
}
