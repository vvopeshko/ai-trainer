import { expect, it } from 'vitest'
import { exerciseProgress } from './exerciseProgress.js'
const row = (date, weights, reps) => ({ startedAt: date, sets: weights.map((weightKg, i) => ({ weightKg, reps: reps[i] })) })
const history = (reps, weights = reps.map(() => 60), spacing = 7) => reps.map((n, i) => row(new Date(Date.UTC(2026, 6, 1 + i * spacing)).toISOString(), [weights[i], weights[i]], [n, n]))
const plan = { sets: 3, repsMax: 12 }
it('shows the real screenshot: 75 days in the load band, with a new unconfirmed rep improvement', () => {
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
  expect(result).toMatchObject({ trend: 'pending', band: { low: 80, high: 85, days: 75 }, repChange: { weight: 85, from: 8, to: 10, confirmed: false }, goal: { set: 4, from: 6, to: 7 } })
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
  expect(exerciseProgress(history([12,10,8,6], [60,62.5,65,67.5])).trend).toBe('mixed')
  expect(exerciseProgress(history([12,11,10,9])).trend).toBe('down')
})
it('does not turn an isolated record or deload into a sustained trend', () => {
  expect(exerciseProgress(history([10,10,10,10,12])).trend).toBe('pending')
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
