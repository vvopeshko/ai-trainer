const DAY = 86400000
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / DAY))

// Theil–Sen: the median pairwise slope tolerates isolated spikes/deloads.
// A direction also needs confirmation in BOTH latest observations, against
// the median of earlier observations. These are product thresholds, not a
// physiological diagnosis or an estimated one-rep maximum. Two confirmed
// new levels can establish a step change even after a long flat baseline.
export function seriesTrend(points, threshold) {
  if (points.length < 4 || daysBetween(points[0].time, points.at(-1).time) < 21) return 'unknown'
  const slopes = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const days = (points[j].time - points[i].time) / DAY
      if (days > 0) slopes.push((points[j].value - points[i].value) / days)
    }
  }
  if (!slopes.length) return 'unknown'
  const shift = median(slopes) * ((points.at(-1).time - points[0].time) / DAY)
  const baseline = median(points.slice(0, -2).map(p => p.value))
  const recent = points.slice(-2)
  const prior = points.slice(0, -2).map(p => p.value)
  const stepUp = recent.every(p => p.value >= Math.max(...prior) + threshold)
  const stepDown = recent.every(p => p.value <= Math.min(...prior) - threshold)
  if ((shift >= threshold || stepUp) && recent.every(p => p.value >= baseline + threshold)) return 'up'
  if ((shift <= -threshold || stepDown) && recent.every(p => p.value <= baseline - threshold)) return 'down'
  return 'stable'
}

function profile(workout) {
  const byWeight = new Map()
  for (const set of workout.sets) {
    const weight = set.weightKg ?? 0
    if (!byWeight.has(weight)) byWeight.set(weight, [])
    byWeight.get(weight).push(set.reps)
  }
  const weights = workout.sets.map(s => s.weightKg ?? 0).sort((a, b) => b - a)
  return { workout, time: new Date(workout.startedAt).getTime(),
    // Lower weight of the two heaviest sets, or the only set's load.
    // Extra light sets and a single heavy attempt do not raise this metric.
    value: weights[Math.min(1, weights.length - 1)],
    topReps: median([...workout.sets].sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || b.reps - a.reps).slice(0, 2).map(s => s.reps)),
    reps: new Map([...byWeight].map(([weight, reps]) => [weight, median(reps)])),
  }
}

function evaluate(points) {
  const loads = new Map()
  for (const p of points) for (const [weight, value] of p.reps) {
    if (!loads.has(weight)) loads.set(weight, [])
    loads.get(weight).push({ time: p.time, value })
  }
  const reps = [...loads].map(([weight, observations]) => ({ weight, observations,
    trend: observations.at(-1).time === points.at(-1).time ? seriesTrend(observations, 1) : 'unknown',
  }))
  const loadTrend = seriesTrend(points, Math.max(0.5, median(points.map(p => p.value)) * 0.01))
  // Do not call a fresh personal improvement a plateau before confirmation.
  const pending = reps.some(r => {
    const last = r.observations.at(-1)
    return r.observations.length > 1 && last.time === points.at(-1).time
      && last.value >= Math.max(...r.observations.slice(0, -1).map(p => p.value)) + 1
  }) || (points.length > 1 && points.at(-1).value > Math.max(...points.slice(0, -1).map(p => p.value)))
  const recentReps = median(points.slice(-2).map(p => p.topReps))
  const priorReps = median(points.slice(0, -2).map(p => p.topReps))
  const tradeoff = (loadTrend === 'up' && recentReps < priorReps - 0.5)
    || (loadTrend === 'down' && recentReps > priorReps + 0.5)
  const up = tradeoff || loadTrend === 'up' || reps.some(r => r.trend === 'up')
  const down = tradeoff || loadTrend === 'down' || reps.some(r => r.trend === 'down')
  const comparable = loadTrend !== 'unknown' && reps.some(r => r.trend !== 'unknown')
  return { loadTrend, reps, pending, up, down, comparable }
}

export function exerciseProgress(workouts, plan) {
  const valid = workouts.filter(w => Number.isFinite(new Date(w.startedAt).getTime())
    && w.sets?.length && w.sets.every(s => s.reps > 0 && (s.weightKg ?? 0) >= 0))
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
  if (!valid.length) return null
  // A long break is not evidence of stagnation. Start a new observation period.
  let start = 0
  for (let i = 1; i < valid.length; i++) {
    if (new Date(valid[i].startedAt) - new Date(valid[i - 1].startedAt) > 45 * DAY) start = i
  }
  // One observation per UTC day: two split logs must not confirm a trend.
  const daily = new Map()
  for (const w of valid.slice(start)) daily.set(new Date(w.startedAt).toISOString().slice(0, 10), profile(w))
  const points = [...daily.values()]
  const latest = valid.at(-1)
  const overall = evaluate(points)
  let plateau = null
  for (let i = 0; i <= points.length - 4; i++) {
    const window = points.slice(i)
    if (daysBetween(window[0].time, window.at(-1).time) < 21) break
    const state = evaluate(window)
    const baselineShift = Math.abs(median(window.slice(-3).map(p => p.value)) - window[0].value)
      >= Math.max(0.5, window[0].value * 0.01)
      || state.reps.some(r => r.observations.length >= 4
        && Math.abs(median(r.observations.slice(-3).map(p => p.value)) - r.observations[0].value) >= 1)
    if (state.comparable && !state.up && !state.down && !state.pending && !baselineShift) {
      plateau = window
      break
    }
  }
  const trend = plateau ? 'plateau' : overall.up && !overall.down ? 'up'
    : overall.down && !overall.up ? 'down' : overall.up && overall.down ? 'mixed'
      : overall.pending ? 'pending' : overall.comparable ? 'same' : 'first'
  // A repeated recent load band, not the global min/max: sustained load growth
  // shortens this span. One unprecedented heavy/light day does not widen it.
  const recent = points.slice(-3).map(p => p.value)
  const repeated = [...new Set(recent)].filter(v => points.filter(p => p.value === v).length >= 2)
  const bandValues = repeated.length ? repeated : recent
  const low = Math.min(...bandValues), high = Math.max(...bandValues)
  let bandStart = points.length - 1
  while (bandStart > 0 && points[bandStart - 1].value >= low && points[bandStart - 1].value <= high) bandStart--
  const band = points.at(-1).value >= low && points.at(-1).value <= high ? {
    low, high, days: daysBetween(points[bandStart].time, points.at(-1).time), count: points.length - bandStart,
  } : null
  // Show a concrete same-weight comparison even when it is not yet a trend.
  const repChange = overall.reps.filter(r => r.observations.length >= 2
    && r.observations.at(-1).time === points.at(-1).time)
    .map(r => ({ weight: r.weight, from: median(r.observations.slice(0, -1).map(p => p.value)),
      to: r.observations.at(-1).value, confirmed: ['up', 'down'].includes(r.trend) }))
    .filter(r => Math.abs(r.to - r.from) >= 1).sort((a, b) => b.weight - a.weight)[0] ?? null
  const candidates = plan?.repsMax > 0 && latest.sets.length === plan.sets ? latest.sets
    .map((s, index) => ({ ...s, index })).filter(s => s.reps < plan.repsMax)
    .sort((a, b) => a.reps - b.reps || a.index - b.index) : []
  const next = candidates[0]
  return { trend, band, repChange, loadTrend: overall.loadTrend,
    days: daysBetween(points[0].time, points.at(-1).time), count: points.length,
    plateauDays: plateau ? daysBetween(plateau[0].time, plateau.at(-1).time) : 0,
    plateauCount: plateau?.length ?? 0,
    points: points.map(p => ({ time: p.time, value: p.value })), latestSets: latest.sets,
    goal: next ? { set: next.index + 1, from: next.reps, to: next.reps + 1, weightKg: next.weightKg ?? 0 } : null,
  }
}
