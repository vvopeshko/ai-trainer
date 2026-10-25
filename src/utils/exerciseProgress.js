const sameWeights = (a, b) => a.length === b.length
  && a.every((s, i) => (s.weightKg ?? 0) === (b[i].weightKg ?? 0))

// Compare the complete ordered weight pattern, never tonnage or just top weight.
// History is newest first and limited to eight completed workouts.
export function exerciseProgress(workouts, plan) {
  const latest = workouts[0]
  if (!latest?.sets.length) return null
  let streak = 1
  while (streak < workouts.length && sameWeights(latest.sets, workouts[streak].sets)) streak++
  const days = Math.max(0, Math.floor(
    (new Date(latest.startedAt) - new Date(workouts[streak - 1].startedAt)) / 86400000,
  ))
  const previous = workouts[1]
  const comparable = previous && sameWeights(latest.sets, previous.sets)
  const delta = comparable
    ? latest.sets.reduce((n, s, i) => n + s.reps - previous.sets[i].reps, 0) : null
  let unchanged = 1
  while (unchanged < workouts.length
    && sameWeights(latest.sets, workouts[unchanged].sets)
    && latest.sets.every((s, i) => s.reps === workouts[unchanged].sets[i].reps)) unchanged++
  const unchangedDays = Math.max(0, Math.floor(
    (new Date(latest.startedAt) - new Date(workouts[unchanged - 1].startedAt)) / 86400000,
  ))
  let trend = !previous ? 'first' : 'changed'
  let reason = trend
  if (previous && latest.sets.length === previous.sets.length) {
    const notLower = latest.sets.every((s, i) => (s.weightKg ?? 0) >= (previous.sets[i].weightKg ?? 0) && s.reps >= previous.sets[i].reps)
    const notHigher = latest.sets.every((s, i) => (s.weightKg ?? 0) <= (previous.sets[i].weightKg ?? 0) && s.reps <= previous.sets[i].reps)
    if (unchanged >= 4 && unchangedDays >= 21) { trend = 'plateau'; reason = 'plateau' }
    else if (notLower && notHigher) { trend = 'same'; reason = 'same' }
    else if (notLower) { trend = 'up'; reason = comparable ? 'repsUp' : 'weightUp' }
    else if (notHigher) { trend = 'down'; reason = comparable ? 'repsDown' : 'weightDown' }
    else { reason = 'mixed' }
  }
  const hasTarget = plan?.repsMax > 0 && latest.sets.length === plan.sets
  // One attainable step inside the plan: +1 rep on the lowest-rep set.
  // No invented load increase when the range is already complete or unknown.
  const candidates = hasTarget ? latest.sets
    .map((set, index) => ({ ...set, index }))
    .filter(set => set.reps < plan.repsMax)
    .sort((a, b) => a.reps - b.reps || a.index - b.index) : []
  const next = candidates[0]
  const goal = next ? { set: next.index + 1, from: next.reps, to: next.reps + 1, weightKg: next.weightKg ?? 0 } : null
  return { streak, days, delta, trend, reason, unchanged, unchangedDays, goal,
    latestSets: latest.sets,
  }
}
