// Match positions, not weights: a lighter set may be either a warm-up or a
// back-off set. Never infer its role or propagate a change across the series.
//
// startWeightKg — the program's start weight for an exercise not yet trained in
// this program (the server drops it afterwards). It replaces the weights of the
// last session; once the user picks another weight in this workout, follow that.
export function getSetSuggestion({ setIndex, lastSets, doneSets = [], plannedReps, startWeightKg }) {
  const historical = lastSets?.[setIndex]
  const previous = doneSets.at(-1)
  if (startWeightKg > 0) {
    const same = weightKg => Math.abs((weightKg ?? 0) - startWeightKg) < 0.25
    if (previous && !same(previous.weightKg)) return { weightKg: previous.weightKg ?? 0, reps: previous.reps, source: 'previous' }
    const reps = historical && same(historical.weightKg) ? historical.reps : plannedReps ?? historical?.reps ?? 10
    return { weightKg: startWeightKg, reps, source: 'start' }
  }
  if (historical) {
    return { weightKg: historical.weightKg ?? 0, reps: historical.reps, source: 'history' }
  }
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
