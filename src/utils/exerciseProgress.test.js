import { expect, it } from 'vitest'
import { exerciseProgress, newRecords } from './exerciseProgress.js'
const row = (date, weights, reps) => ({ startedAt: date, sets: weights.map((weightKg, i) => ({ weightKg, reps: reps[i] })) })
const history = (reps, weights = reps.map(() => 60), spacing = 7) => reps.map((n, i) => row(new Date(Date.UTC(2026, 6, 1 + i * spacing)).toISOString(), [weights[i], weights[i]], [n, n]))
const plan = { sets: 3, repsMax: 12 }
it('separates confirmed Smith performance, stable volume, and the latest session', () => {
  const result = exerciseProgress([
    row('2026-10-19', [80,85,85,85], [10,10,10,6]),
    row('2026-10-12', [85,85,85,80], [10,8,8,8]),
    row('2026-09-28', [80,80,80,80], [10,10,10,10]),
    row('2026-09-15', [80,80,80,80], [10,10,10,10]),
    row('2026-08-31', [80,85,85,85], [10,8,8,8]),
    row('2026-08-17', [80,80,80,80], [10,10,10,10]),
    row('2026-08-10', [80,80,80,80], [10,10,10,8]),
    row('2026-08-05', [80,80,80,80], [10,10,10,10]),
  ], { sets: 4, repsMax: 10 })
  expect(result).toMatchObject({ trend: 'up', band: { low: 80, high: 85, days: 75 }, evidence: { kind: 'weight', anchor: 10, from: 80, to: 85 }, volume: { status: 'same', from: 3070, to: 3065, size: 4, latest: { delta: 160, repDelta: 2, setDelta: 0 } }, goal: { set: 4, from: 6, to: 7 } })
})
it('recognizes plateau despite fluctuations and ignores the order of sets', () => {
  const data = history([10,9,11,10,9,10])
  expect(exerciseProgress(data).trend).toBe('plateau')
  const shuffled = data.map(w => ({ ...w, sets: [...w.sets, { weightKg: 20, reps: 12 }].reverse() }))
  expect(exerciseProgress(shuffled).trend).toBe('plateau')
  expect(exerciseProgress(shuffled).points).toEqual(exerciseProgress(data).points)
})
it('requires four separate dates and 21 elapsed days', () => {
  expect(exerciseProgress(history([10,10,10])).trend).toBe('first')
  expect(exerciseProgress(history([10,10,10,10], undefined, 6)).trend).toBe('first')
  expect(exerciseProgress(history([10,10,10,10])).trend).toBe('plateau')
  const data = history([10,10])
  expect(exerciseProgress([...data,...data]).count).toBe(2)
})
it('detects sustained repetitions growth, including bodyweight', () => {
  for (const weight of [0,60]) expect(exerciseProgress(history([8,9,10,11], [weight,weight,weight,weight])).trend).toBe('up')
})
it('detects sustained load growth and decline but not a weight/reps tradeoff', () => {
  expect(exerciseProgress(history([10,10,10,10], [60,62.5,65,67.5])).trend).toBe('up')
  expect(exerciseProgress(history([10,10,10,10], [67.5,65,62.5,60])).trend).toBe('down')
  expect(exerciseProgress(history([12,10,8,6], [60,62.5,65,67.5])).trend).toBe('changed')
  expect(exerciseProgress(history([12,11,10,9])).trend).toBe('down')
})
it('does not turn an isolated record or deload into a sustained trend', () => {
  expect(exerciseProgress(history([10,10,10,10,12]))).toMatchObject({ trend: 'plateau', volume: { latest: { delta: 240, repDelta: 4 } } })
  expect(exerciseProgress(history([10,10,10,10,8])).trend).toBe('plateau')
  expect(exerciseProgress(history([10,10,10,10,10], [60,60,60,80,60])).trend).toBe('plateau')
})
it('finds a recent plateau after earlier growth', () => {
  expect(exerciseProgress(history([6,7,8,9,10,10,10,10]))).toMatchObject({ trend: 'plateau', plateauDays: 21, plateauCount: 4 })
})
it('starts again after a long break and ignores invalid rows', () => {
  const data = [...history([10,10,10,10]), row('2026-10-25', [60], [10])]
  expect(exerciseProgress(data)).toMatchObject({ trend: 'first', count: 1, days: 0 })
  expect(exerciseProgress([row('invalid', [60], [10]), { startedAt: '2026-10-25', sets: [] }])).toBeNull()
  expect(exerciseProgress([])).toBeNull()
})
it('offers only one extra rep within the plan and never raises weight automatically', () => {
  expect(exerciseProgress([row('2026-10-25', [60,60,60], [10,10,8])], plan).goal).toEqual({ set: 3, from: 8, to: 9, weightKg: 60 })
  expect(exerciseProgress([row('2026-10-25', [60,60,60], [12,12,12])], plan).goal).toBeNull()
  expect(exerciseProgress([row('2026-10-25', [60], [8])], plan).goal).toBeNull()
})

it('recognizes two confirmed new levels after a long flat baseline', () => {
  expect(exerciseProgress(history([10,10,10,10,10,10,12,12])).trend).toBe('up')
  expect(exerciseProgress(history([10,10,10,10,10,10,8,8])).trend).toBe('down')
})

it('does not mistake added sets for improved performance', () => {
  const data = history([10,10,10,10])
  data[2].sets.push({ weightKg: 60, reps: 10 })
  data[3].sets.push({ weightKg: 60, reps: 10 })
  const result = exerciseProgress(data)
  expect(result.trend).not.toBe('up')
  expect(result.trend).not.toBe('plateau')
  expect(result.volume).toMatchObject({ status: 'changed', from: 1200, to: 1800 })
})
it('reports removed or added sets in the last session', () => {
  const data = history([10,10,10,10])
  data.at(-1).sets.pop()
  expect(exerciseProgress(data).volume).toMatchObject({ status: 'changed', latest: { setDelta: -1, delta: -600 } })
})
it('does not turn missing exact benchmarks into zero performance', () => {
  const result = exerciseProgress(history([12,10,8,6], [60,65,70,75]))
  expect(result.trend).toBe('changed')
  expect(result.evidence).toBeNull()
})
it('keeps long term progress separate from a weaker last training', () => {
  const result = exerciseProgress(history([8,8,8,12,11]))
  expect(result).toMatchObject({ trend: 'up', volume: { latest: { delta: -120, repDelta: -2 } } })
})
it('uses reps for bodyweight and refuses misleading partial tonnage', () => {
  expect(exerciseProgress(history([8,9,10,11], [0,0,0,0])).volume).toMatchObject({ metric: 'reps', from: 17, to: 21, status: 'up' })
  expect(exerciseProgress(history([10,10,10,10], [0,0,5,5])).volume).toMatchObject({ metric: null, status: 'unknown' })
})
it('does not diagnose plateau from wide fluctuations', () => {
  expect(exerciseProgress(history([6,16,6,16,6,16])).trend).toBe('same')
})
it('uses equal disjoint windows and leaves small samples unclassified', () => {
  expect(exerciseProgress(history([8,9,10])).volume.status).toBe('unknown')
  expect(exerciseProgress(history([8,8,20,10,10])).volume).toMatchObject({ from: 960, to: 1200, size: 2 })
})
it('reports opposed direct benchmarks as mixed', () => {
  const data = [0,1,2,3].map(i => row(new Date(Date.UTC(2026,6,1+i*7)).toISOString(), [60,80], [8+i,12-i]))
  expect(exerciseProgress(data).trend).toBe('mixed')
})
it('keeps confirmed evidence independent of set order', () => {
  const data = history([8,9,10,11]).map(w => ({ ...w, sets: [...w.sets, { weightKg: 20, reps: 12 }] }))
  expect(exerciseProgress(data).evidence).toEqual(exerciseProgress(data.map(w => ({ ...w, sets: w.sets.toReversed() }))).evidence)
})

it('charts the exact confirmed benchmark rather than the second heaviest set', () => {
  const result = exerciseProgress(history([10,10,10,10,10,10,10,10], [60,60,60,60,60,60,65,65]))
  expect(result.charts[0]).toMatchObject({ kind: 'weight', anchor: 10, fit: 'step', trend: 'up' })
  expect(result.charts[0].line.map(p => p.value)).toEqual([60,60,65,65])
  expect(result.charts[0].points).toHaveLength(8)
})
it('draws a flat robust trend through stable load fluctuations', () => {
  const result = exerciseProgress(history([10,10,10,10,10,10,10,10], [80,85,80,80,85,80,80,80]))
  expect(result.trend).toBe('plateau')
  const chart = result.charts[0]
  expect(chart).toMatchObject({ kind: 'weight', anchor: 10, fit: 'robust' })
  expect(chart.line[0].value).toBe(chart.line.at(-1).value)
  expect(new Set(chart.points.map(p => p.value)).size).toBe(2)
})
it('charts only the recent plateau period after earlier growth', () => {
  const result = exerciseProgress(history([6,7,8,9,10,10,10,10]))
  expect(result.trend).toBe('plateau')
  expect(result.charts[0].points).toHaveLength(result.plateauCount)
  expect(result.charts[0].line.every(p => p.value === result.charts[0].line[0].value)).toBe(true)
})
it('shows repetitions for bodyweight and no fitted line for insufficient data', () => {
  const result = exerciseProgress(history([10,10,10,10], [0,0,0,0]))
  expect(result.charts[0]).toMatchObject({ kind: 'reps', anchor: 0 })
  expect(exerciseProgress(history([8,9,10])).charts[0].line).toEqual([])
})
it('shows both opposing benchmarks rather than an arbitrary combined trend', () => {
  const data = [0,1,2,3].map(i => row(new Date(Date.UTC(2026,6,1+i*7)).toISOString(), [60,80], [8+i,12-i]))
  const result = exerciseProgress(data)
  expect(result.trend).toBe('mixed')
  expect(result.charts.map(c => c.trend)).toEqual(['up','down'])
})

it('treats a set as a record only when no earlier set covers both weight and reps', () => {
  const prior = [{ weightKg: 80, reps: 10 }, { weightKg: 85, reps: 8 }]
  expect(newRecords([{ weightKg: 80, reps: 10 }, { weightKg: 85, reps: 7 }], prior)).toEqual([])
  expect(newRecords([{ weightKg: 80, reps: 11 }], prior)).toEqual([{ weightKg: 80, reps: 11 }])
  expect(newRecords([{ weightKg: 87.5, reps: 5 }], prior)).toEqual([{ weightKg: 87.5, reps: 5 }])
  // The session keeps only its best undominated sets, once each.
  expect(newRecords([{ weightKg: 85, reps: 9 }, { weightKg: 85, reps: 10 }, { weightKg: 85, reps: 10 }], prior)).toEqual([{ weightKg: 85, reps: 10 }])
  expect(newRecords([{ weightKg: 0, reps: 12 }], [{ weightKg: 0, reps: 10 }])).toEqual([{ weightKg: 0, reps: 12 }])
  expect(newRecords([{ weightKg: 80, reps: 10 }], [])).toEqual([])
})
it('tracks records across the Smith history', () => {
  const result = exerciseProgress([
    row('2026-10-19', [80,85,85,85], [10,10,10,6]),
    row('2026-10-12', [85,85,85,80], [10,8,8,8]),
    row('2026-09-28', [80,80,80,80], [10,10,10,10]),
    row('2026-08-31', [80,85,85,85], [10,8,8,8]),
    row('2026-08-05', [80,80,80,80], [10,10,10,10]),
  ], { sets: 4, repsMax: 10 })
  expect(result.records).toMatchObject({ latest: [], since: 1, last: { time: Date.parse('2026-10-12'), records: [{ weightKg: 85, reps: 10 }] } })
  expect(exerciseProgress([row('2026-10-12', [80], [10])]).records).toEqual({ latest: [], last: null, since: null })
})
it('does not call a return to an old level after a long break a record', () => {
  const data = [...history([10,10,10,10]), row('2026-10-25', [60,60], [10,10])]
  expect(exerciseProgress(data)).toMatchObject({ count: 1, records: { latest: [] } })
})
it('merges split logs of one day before looking for records', () => {
  const data = [...history([10,10]), row('2026-07-08T18:00:00Z', [60], [12])]
  expect(exerciseProgress(data).records.latest).toEqual([{ weightKg: 60, reps: 12 }])
})
it('signals readiness for more weight when every planned set reaches the top of the range', () => {
  const data = history([10,12,12], [60,60,60])
  expect(exerciseProgress(data, { sets: 2, repsMax: 12 }).ready).toEqual({ weightKg: 60, reps: 12, sessions: 2 })
  expect(exerciseProgress(data, { sets: 2, repsMax: 12 }).goal).toBeNull()
  // Bodyweight works too; the UI turns it into "make it harder".
  expect(exerciseProgress(history([12,12], [0,0]), { sets: 2, repsMax: 12 }).ready).toMatchObject({ weightKg: 0, sessions: 2 })
  // A raised weight restarts the count.
  expect(exerciseProgress(history([12,12], [60,62.5]), { sets: 2, repsMax: 12 }).ready.sessions).toBe(1)
})
it('does not signal readiness for an incomplete, mixed-load or plan-less session', () => {
  expect(exerciseProgress(history([12,11]), { sets: 2, repsMax: 12 }).ready).toBeNull()
  expect(exerciseProgress([row('2026-10-25', [60,60], [12,12])], { sets: 3, repsMax: 12 }).ready).toBeNull()
  expect(exerciseProgress([row('2026-10-25', [60,65], [12,12])], { sets: 2, repsMax: 12 }).ready).toBeNull()
  expect(exerciseProgress(history([12,12])).ready).toBeNull()
})
