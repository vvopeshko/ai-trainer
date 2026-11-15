import { getMuscleGroup } from '../../../utils/muscleMapping.js'

/**
 * Compute muscle volume grouped by muscle group.
 * Returns sorted array: [{ label, sets }, ...]
 */
export function computeMuscleVolume(days) {
  const volume = {}
  for (const day of days) {
    for (const ex of day.exercises || []) {
      for (const muscle of ex.primaryMuscles || []) {
        const group = getMuscleGroup(muscle)
        volume[group] = (volume[group] || 0) + (ex.sets || 0)
      }
    }
  }
  return Object.entries(volume)
    .sort((a, b) => b[1] - a[1])
    .map(([label, sets]) => ({ label, sets }))
}

/**
 * Compute sub-muscle volume (per individual muscle, not grouped).
 * Returns array: [{ muscle, setsActual }, ...]
 */
export function computeSubMuscleVolume(days) {
  const volume = {}
  for (const day of days) {
    for (const ex of day.exercises || []) {
      for (const muscle of ex.primaryMuscles || []) {
        volume[muscle] = (volume[muscle] || 0) + (ex.sets || 0)
      }
    }
  }
  return Object.entries(volume).map(([muscle, setsActual]) => ({ muscle, setsActual }))
}

/**
 * Estimate workout duration in minutes for a given exercise list.
 */
export function estimateDayMin(exercises) {
  return Math.round((exercises || []).reduce((sum, ex) => {
    const sets = ex.sets || 3
    return sum + sets * 1.5 + (sets - 1) * (ex.restSec || 90) / 60
  }, 0))
}

/**
 * Deep clone a plan object via JSON serialization.
 */
export function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan))
}

/**
 * Top muscle groups of a program for the «Мои программы» card.
 * muscleSets — sets per primaryMuscles key (server summary); folded into the
 * app's display groups. Returns [{ label, sets }], largest first.
 */
export function topMuscleGroups(muscleSets, limit = 3) {
  const volume = {}
  for (const [muscle, sets] of Object.entries(muscleSets ?? {})) {
    const group = getMuscleGroup(muscle)
    volume[group] = (volume[group] || 0) + sets
  }
  return Object.entries(volume)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, sets]) => ({ label, sets }))
}
