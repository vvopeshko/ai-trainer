// UI state is device-local; recorded sets and pause state always come from the server.
const STORAGE_KEY = 'active-workout-ui-v1'

export function writeWorkoutState(snapshot) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)) } catch { /* storage unavailable */ }
}

export function readWorkoutState(workoutId) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.workoutId !== workoutId || !Array.isArray(saved.allExercises)
      || saved.allExercises.some(ex => !ex?.exercise?.id)
      || (saved.planExercises != null && (!Array.isArray(saved.planExercises)
        || saved.planExercises.some(ex => !ex?.exerciseId)))) return null
    return saved
  } catch { return null }
}

export function clearWorkoutStateStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage unavailable */ }
}

export function restoreWorkoutSnapshot(data, saved) {
  const { workout } = data
  const planExercises = saved?.planExercises ?? data.planExercises ?? null
  const grouped = new Map()
  for (const set of workout.sets ?? []) {
    if (!grouped.has(set.exerciseId)) grouped.set(set.exerciseId, { exercise: set.exercise, sets: [] })
    grouped.get(set.exerciseId).sets.push(set)
  }
  const completedIds = new Set(saved?.allExercises.map(ex => ex.exercise.id) ?? [])
  const allExercises = []
  const partialSets = {}
  let currentExercise = saved?.currentExercise ?? null
  let doneSets = grouped.get(currentExercise?.id)?.sets ?? []
  for (const [id, entry] of grouped) {
    if (id === currentExercise?.id) continue
    const planned = planExercises?.find(pe => pe.exerciseId === id)
    if (!completedIds.has(id) && planned && entry.sets.length < planned.sets) {
      partialSets[id] = entry.sets
    } else {
      allExercises.push(entry)
    }
  }
  if (!saved && planExercises?.length) {
    const doneIds = new Set(allExercises.map(ex => ex.exercise.id))
    const next = planExercises.find(pe => !doneIds.has(pe.exerciseId) && !partialSets[pe.exerciseId])
      ?? planExercises.find(pe => partialSets[pe.exerciseId])
    if (next) {
      currentExercise = { id: next.exerciseId, nameRu: next.nameRu, slug: next.slug }
      doneSets = partialSets[next.exerciseId] ?? []
      delete partialSets[next.exerciseId]
    }
  }
  // Rest starts on the workout's net-time axis so pauses (including ones made
  // from Home) are excluded without having to rewrite its timestamp on resume.
  const resting = currentExercise && doneSets.length && typeof saved?.resting === 'number'
    ? saved.resting : false
  return {
    currentExercise, doneSets, allExercises, partialSets, planExercises, resting,
    planIndex: currentExercise ? Math.max(0, planExercises?.findIndex(pe => pe.exerciseId === currentExercise.id) ?? 0) : (planExercises?.length ?? 0),
    picking: saved?.picking ?? (!currentExercise && !planExercises?.length),
  }
}

export function restElapsedSeconds(startedAt, pausedAt, now = Date.now()) {
  return Math.max(0, Math.floor(((pausedAt ?? now) - startedAt) / 1000))
}
