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

// Per-set target shown above the set input, consistent with the progress card:
// - ready for weight / consolidate: every set at that weight, bottom of the range;
// - the goal set (weakest one last time): +1 rep;
// - other sets: match last session, capped at the top of the range.
// Weight is part of the target only when it changes; inputs are never changed.
export function getSetTarget({ setIndex, lastSets, plan, progress, readyWeightKg }) {
  if (!plan?.repsMin) return null
  const top = plan.repsMax || plan.repsMin
  if (progress?.ready && readyWeightKg != null) return { reps: plan.repsMin, weightKg: readyWeightKg }
  if (progress?.plateau?.kind === 'consolidate') return { reps: plan.repsMin, weightKg: progress.plateau.weightKg }
  if (progress?.goal?.set === setIndex + 1) return { reps: progress.goal.to }
  const last = lastSets?.[setIndex]?.reps
  return { reps: last ? Math.min(last, top) : plan.repsMin }
}
