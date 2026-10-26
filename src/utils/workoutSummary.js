// Как countsTonnage на сервере (services/exerciseAttributes.js): вес × повторы —
// тоннаж только там, где вес поднимают; не противовес гравитрона и не секунды/метры.
const NO_TONNAGE = new Set(['assisted_bodyweight', 'duration', 'distance'])

/** Считает сводку по данным GET /workouts/:id (workout.sets c include exercise). */
export function summarizeWorkout(workout) {
  if (!workout) return null

  const sets = workout.sets ?? []
  const exerciseIds = new Set()
  const muscleSet = new Set()
  let tonnageKg = 0

  for (const s of sets) {
    exerciseIds.add(s.exerciseId)
    if (s.weightKg && s.reps && !NO_TONNAGE.has(s.exercise?.trackingType)) tonnageKg += s.weightKg * s.reps
    for (const m of s.exercise?.primaryMuscles ?? []) muscleSet.add(m)
  }

  // Чистое время: finished − started − суммарные паузы
  let elapsedSec = 0
  if (workout.startedAt) {
    const end = workout.finishedAt ? new Date(workout.finishedAt) : new Date()
    const ms = end - new Date(workout.startedAt) - (workout.totalPausedMs ?? 0)
    elapsedSec = Math.max(0, Math.floor(ms / 1000))
  }

  tonnageKg = Math.round(tonnageKg)

  return {
    totalSets: sets.length,
    totalExercises: exerciseIds.size,
    elapsedSec,
    tonnageKg: tonnageKg || null,
    muscles: [...muscleSet],
  }
}

