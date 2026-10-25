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

// Direct benchmarks: best weight at EXACTLY the same reps, or best reps at
// EXACTLY the same weight. No e1RM extrapolation or inferred set types.
function profile(workout) {
  const sets = workout.sets
  const weights = sets.map(s => s.weightKg ?? 0).sort((a, b) => b - a)
  return { workout, time: new Date(workout.startedAt).getTime(),
    value: weights[Math.min(1, weights.length - 1)],
    count: sets.length, reps: sets.reduce((sum, s) => sum + s.reps, 0),
    tonnage: sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * s.reps, 0),
  }
}

function evaluate(points) {
  const latest = points.at(-1)
  const benchmarks = []
  for (const kind of ['weight', 'reps']) {
    const anchors = [...new Set(latest.workout.sets.map(s => kind === 'weight' ? s.reps : (s.weightKg ?? 0)))]
    for (const anchor of anchors) {
      const observations = points.flatMap(p => {
        const sets = p.workout.sets.filter(s => (kind === 'weight' ? s.reps : (s.weightKg ?? 0)) === anchor)
        return sets.length ? [{ time: p.time, value: Math.max(...sets.map(s => kind === 'weight' ? (s.weightKg ?? 0) : s.reps)) }] : []
      })
      const values = observations.map(p => p.value)
      const threshold = kind === 'reps' ? 1 : Math.max(0.5, median(values) * 0.01)
      const trend = seriesTrend(observations, threshold)
      const prior = values.slice(0, -2)
      benchmarks.push({ kind, anchor, observations, threshold, trend,
        // Explain the trend with an actually recorded baseline, not e.g. 6.5 reps.
        from: prior.length ? [...prior].reverse().reduce((best, value) =>
          Math.abs(value - median(prior)) < Math.abs(best - median(prior)) ? value : best) : values[0],
        to: trend === 'up' ? Math.min(...values.slice(-2)) : Math.max(...values.slice(-2)),
      })
    }
  }
  const up = benchmarks.filter(b => b.trend === 'up')
  const down = benchmarks.filter(b => b.trend === 'down')
  const evidence = [...up, ...down].sort((a, b) =>
    (a.kind === 'weight' ? 0 : 1) - (b.kind === 'weight' ? 0 : 1) || b.anchor - a.anchor)[0] ?? null
  // A stable series must cover the whole window; sparse/changed schemes are
  // insufficient evidence of plateau. A change in set count also prevents it.
  const comparable = benchmarks.some(b => b.trend !== 'unknown' && b.observations.length === points.length)
    && points.every(p => p.count === latest.count)
  return { benchmarks, up: up.length > 0, down: down.length > 0, comparable, evidence }
}

function volumeProgress(points) {
  const allSets = points.flatMap(p => p.workout.sets)
  const metric = allSets.every(s => (s.weightKg ?? 0) > 0) ? 'tonnage'
    : allSets.every(s => (s.weightKg ?? 0) === 0) ? 'reps' : null
  const last = points.at(-1), previous = points.at(-2)
  const latest = previous ? {
    setDelta: last.count - previous.count, repDelta: last.reps - previous.reps,
    delta: metric ? last[metric] - previous[metric] : null,
    percent: metric && previous[metric] > 0 ? (last[metric] / previous[metric] - 1) * 100 : null,
  } : null
  const size = Math.floor(points.length / 2)
  if (!metric || size < 2) return { metric, status: 'unknown', latest }
  const mean = rows => rows.reduce((sum, p) => sum + p[metric], 0) / rows.length
  const from = mean(points.slice(0, size)), to = mean(points.slice(-size))
  const percent = (to / from - 1) * 100
  const values = points.map(p => p[metric]), center = median(values)
  // Product deadband, not a confidence interval: do not give noisy changes
  // false precision. The arithmetic comparison is still exposed in history.
  const tolerance = Math.max(2, 100 * median(values.map(v => Math.abs(v - center))) / center)
  const sameSets = points.every(p => p.count === last.count)
  return { metric, from, to, percent, size, tolerance, latest,
    status: !sameSets ? 'changed' : Math.abs(percent) < tolerance ? 'same' : percent > 0 ? 'up' : 'down',
  }
}

export function exerciseProgress(workouts, plan) {
  const valid = workouts.filter(w => Number.isFinite(new Date(w.startedAt).getTime())
    && w.sets?.length && w.sets.every(s => Number.isFinite(s.reps) && s.reps > 0 && Number.isFinite(s.weightKg ?? 0) && (s.weightKg ?? 0) >= 0))
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
    const baselineShift = state.benchmarks.some(b => b.observations.length >= 4
      && Math.abs(median(b.observations.slice(-3).map(p => p.value)) - b.observations[0].value) >= b.threshold)
    const noisy = state.benchmarks.some(b => {
      const values = b.observations.map(p => p.value).sort((a, b) => a - b)
      return values.length >= 4 && values[Math.floor((values.length - 1) * 0.75)]
        - values[Math.floor((values.length - 1) * 0.25)] > 4 * b.threshold
    })
    if (state.comparable && !state.up && !state.down && !baselineShift && !noisy) {
      plateau = window
      break
    }
  }
  const trend = plateau ? 'plateau' : overall.up && !overall.down ? 'up'
    : overall.down && !overall.up ? 'down' : overall.up && overall.down ? 'mixed'
      : overall.comparable ? 'same' : points.length >= 4 && daysBetween(points[0].time, points.at(-1).time) >= 21 ? 'changed' : 'first'
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
  const candidates = plan?.repsMax > 0 && latest.sets.length === plan.sets ? latest.sets
    .map((s, index) => ({ ...s, index })).filter(s => s.reps < plan.repsMax)
    .sort((a, b) => a.reps - b.reps || a.index - b.index) : []
  const next = candidates[0]
  return { trend, band, evidence: plateau ? null : overall.evidence, volume: volumeProgress(points),
    days: daysBetween(points[0].time, points.at(-1).time), count: points.length,
    plateauDays: plateau ? daysBetween(plateau[0].time, plateau.at(-1).time) : 0,
    plateauCount: plateau?.length ?? 0,
    points: points.map(p => ({ time: p.time, value: p.value })), latestSets: latest.sets,
    goal: next ? { set: next.index + 1, from: next.reps, to: next.reps + 1, weightKg: next.weightKg ?? 0 } : null,
  }
}
