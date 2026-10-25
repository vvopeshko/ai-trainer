// Match positions, not weights: a lighter set may be either a warm-up or a
// back-off set. Never infer its role or propagate a change across the series.
export function getSetSuggestion({ setIndex, lastSets, doneSets = [], plannedReps }) {
  const historical = lastSets?.[setIndex]
  if (historical) {
    return { weightKg: historical.weightKg ?? 0, reps: historical.reps, source: 'history' }
  }
  const previous = doneSets.at(-1)
  if (previous) {
    return { weightKg: previous.weightKg ?? 0, reps: previous.reps, source: 'previous' }
  }
  return { weightKg: 0, reps: plannedReps ?? 10, source: 'default' }
}
