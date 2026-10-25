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
  const strongest = list => list.toSorted((a, b) =>
    (a.kind === 'weight' ? 0 : 1) - (b.kind === 'weight' ? 0 : 1) || b.anchor - a.anchor)[0] ?? null
  return { benchmarks, up: up.length > 0, down: down.length > 0, evidence: { up: strongest(up), down: strongest(down) } }
}

// The chart uses the SAME direct benchmark and period as the conclusion.
// Raw observations stay visible as dots; the fitted line is deliberately separate.
export function progressChart(benchmark) {
  const points = benchmark.observations
  if (points.length < 2) return null
  let line = []
  let fit = 'none'
  if (benchmark.trend !== 'unknown') {
    const first = points[0].time, last = points.at(-1).time
    const slopes = points.flatMap((a, i) => points.slice(i + 1)
      .filter(b => b.time > a.time).map(b => (b.value - a.value) / ((b.time - a.time) / DAY)))
    const slope = median(slopes)
    const intercept = median(points.map(p => p.value - slope * ((p.time - first) / DAY)))
    line = [{ time: first, value: intercept }, { time: last, value: intercept + slope * ((last - first) / DAY) }]
    fit = 'robust'
    // seriesTrend also recognizes a repeated new level after a long baseline.
    // Render that as a step, not a falsely flat regression or gradual ramp.
    if ((benchmark.trend === 'up' && line[1].value - line[0].value < benchmark.threshold)
      || (benchmark.trend === 'down' && line[0].value - line[1].value < benchmark.threshold)) {
      const baseline = median(points.slice(0, -2).map(p => p.value))
      const level = median(points.slice(-2).map(p => p.value))
      line = [{ time: first, value: baseline }, { time: points.at(-2).time, value: baseline },
        { time: points.at(-2).time, value: level }, { time: last, value: level }]
      fit = 'step'
    }
  }
  return { kind: benchmark.kind, anchor: benchmark.anchor, points, line, fit, trend: benchmark.trend }
}

function volumeProgress(points) {
  const allSets = points.flatMap(p => p.workout.sets)
  const metric = allSets.every(s => (s.weightKg ?? 0) > 0) ? 'tonnage'
    : allSets.every(s => (s.weightKg ?? 0) === 0) ? 'reps' : null
  const last = points.at(-1), previous = points.at(-2)
  const latest = previous ? {
    from: metric ? previous[metric] : null, to: metric ? last[metric] : null,
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
    fromPeriod: [points[0].time, points[size - 1].time], toPeriod: [points[points.length - size].time, last.time],
    status: !sameSets ? 'changed' : Math.abs(percent) < tolerance ? 'same' : percent > 0 ? 'up' : 'down',
  }
}

// Record front: a set is a record when no earlier set had at least the same
// weight AND at least the same reps. No e1RM, so 85×8 after 80×10 counts only
// as the first set at 85 kg, not as "stronger". Without prior sets there is
// nothing to beat. Returns the session's undominated records, deduplicated.
export function newRecords(sets, priorSets) {
  if (!priorSets.length) return []
  const covers = (a, b) => (a.weightKg ?? 0) >= (b.weightKg ?? 0) && a.reps >= b.reps
  const fresh = sets.filter(s => !priorSets.some(p => covers(p, s)))
    .map(s => ({ weightKg: s.weightKg ?? 0, reps: s.reps }))
    .filter((s, i, all) => all.findIndex(o => o.weightKg === s.weightKg && o.reps === s.reps) === i)
  return fresh.filter(s => !fresh.some(o => o !== s && covers(o, s)))
}

// Records over the whole loaded history (not reset by a long break: coming
// back to an old level is not a new record). Sets of one UTC day are merged.
function recordHistory(valid) {
  const days = new Map()
  for (const w of valid) {
    const day = new Date(w.startedAt).toISOString().slice(0, 10)
    const entry = days.get(day) ?? { time: new Date(w.startedAt).getTime(), sets: [] }
    entry.sets.push(...w.sets)
    days.set(day, entry)
  }
  const prior = []
  const sessions = [...days.values()].map(day => {
    const records = newRecords(day.sets, prior)
    // Improvement: a record that covers an earlier set (80×10 → 80×11 or 85×10).
    // A first heavier set with fewer reps (85×8 after 80×10) is a record, not growth.
    const improved = records.some(r => prior.some(p => r.weightKg >= (p.weightKg ?? 0) && r.reps >= p.reps))
    prior.push(...day.sets)
    return { time: day.time, sets: day.sets, records, improved }
  })
  const lastIndex = sessions.findLastIndex(s => s.records.length)
  const improvedIndex = sessions.findLastIndex(s => s.improved)
  return {
    latest: sessions.at(-1).records,
    last: lastIndex >= 0 ? sessions[lastIndex] : null,
    // Sessions after the last record; null when no record was ever set.
    since: lastIndex >= 0 ? sessions.length - 1 - lastIndex : null,
    lastImproved: improvedIndex >= 0 ? sessions[improvedIndex] : null,
    sinceImproved: improvedIndex >= 0 ? sessions.length - 1 - improvedIndex : null,
    sessions, // logbook: every day with its sets and the records set that day
  }
}

// Double progression: every planned set reached the top of the rep range at
// one weight. A cue to try the next step, not a plateau; weight is never
// raised automatically. `sessions` counts consecutive such trainings.
function readyForWeight(points, plan) {
  if (!(plan?.repsMax > 0) || !plan.sets) return null
  const atTop = p => p.workout.sets.length === plan.sets && p.workout.sets.every(s => s.reps >= plan.repsMax)
    && p.workout.sets.every(s => (s.weightKg ?? 0) === (p.workout.sets[0].weightKg ?? 0))
  const last = points.at(-1)
  if (!atTop(last)) return null
  const weightKg = last.workout.sets[0].weightKg ?? 0
  let sessions = 0
  for (let i = points.length - 1; i >= 0 && atTop(points[i]) && (points[i].workout.sets[0].weightKg ?? 0) === weightKg; i--) sessions++
  return { weightKg, reps: plan.repsMax, sessions }
}

// Plateau window by experience: sessions without a record AND elapsed days.
// Product heuristic (EXERCISE_PROGRESS_SIGNALS.md §3.2), to be calibrated.
export const PLATEAU_WINDOW = {
  beginner: { sessions: 3, days: 14 },
  intermediate: { sessions: 4, days: 21 },
  advanced: { sessions: 6, days: 42 },
}
const dayOf = time => Math.floor(time / DAY)
const topWeight = p => Math.max(...p.workout.sets.map(s => s.weightKg ?? 0))

// Why the logbook stopped moving, because the action differs:
// consolidate — the heavier weight was reached in some sets but never in all
// of them (80↔85); stuck — the same top weight every session.
function plateauKind(stall) {
  const heavy = Math.max(...stall.map(topWeight))
  if (heavy > 0 && stall.some(p => topWeight(p) < heavy)
    && !stall.some(p => p.workout.sets.every(s => (s.weightKg ?? 0) === heavy))) return { kind: 'consolidate', weightKg: heavy }
  if (stall.every(p => topWeight(p) === heavy)) return { kind: 'stuck', weightKg: heavy }
  return null
}

export function exerciseProgress(workouts, plan, { experienceLevel } = {}) {
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
  const records = recordHistory(valid)
  const ready = readyForWeight(points, plan)
  // Stall: sessions of this period after the last improvement (or after its
  // first session, which is only a baseline). Days compare by UTC day.
  const anchor = Math.max(dayOf(records.lastImproved?.time ?? -Infinity), dayOf(points[0].time))
  const stallPoints = points.filter(p => dayOf(p.time) > anchor)
  const gaps = [anchor, ...stallPoints.map(p => dayOf(p.time))].slice(1).map((day, i, all) => day - (i ? all[i - 1] : anchor))
  const stall = { sessions: stallPoints.length, days: dayOf(points.at(-1).time) - anchor,
    // Rare training is not evidence of a plateau.
    rare: gaps.length > 0 && median(gaps) > 14 }
  const window = PLATEAU_WINDOW[experienceLevel] ?? PLATEAU_WINDOW.intermediate
  const recentGrowth = records.sinceImproved != null && records.sinceImproved <= 1 && records.lastImproved.time >= points[0].time
  // A recent stall outranks older growth. All planned sets at the top of the
  // range is not a plateau: the next weight step was simply not tried yet.
  const stalled = !ready && !stall.rare && stall.sessions >= window.sessions && stall.days >= window.days
  const trend = points.length < 3 ? 'first'
    : overall.down && !overall.up ? 'down'
      : stalled ? 'plateau'
        : (overall.up && !overall.down) || recentGrowth ? 'up'
          : 'steady'
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
  const choose = benchmarks => benchmarks.filter(b => b.kind === 'reps' || b.observations.some(p => p.value > 0)).sort((a, b) =>
    b.observations.length - a.observations.length
    || (a.kind === 'weight' ? 0 : 1) - (b.kind === 'weight' ? 0 : 1) || b.anchor - a.anchor)[0]
  const evidence = trend === 'up' || trend === 'down' ? overall.evidence[trend] : null
  const charts = [evidence ?? choose(overall.benchmarks)].filter(Boolean).map(progressChart).filter(Boolean)
  const candidates = plan?.repsMax > 0 && latest.sets.length === plan.sets ? latest.sets
    .map((s, index) => ({ ...s, index })).filter(s => s.reps < plan.repsMax)
    .sort((a, b) => a.reps - b.reps || a.index - b.index) : []
  const next = candidates[0]
  return { trend, band, charts, evidence, volume: volumeProgress(points),
    days: daysBetween(points[0].time, points.at(-1).time), count: points.length,
    stall, window, plateau: trend === 'plateau' ? plateauKind(stallPoints) : null,
    points: points.map(p => ({ time: p.time, value: p.value })), latestSets: latest.sets,
    goal: next ? { set: next.index + 1, from: next.reps, to: next.reps + 1, weightKg: next.weightKg ?? 0 } : null,
    ready, records,
  }
}
