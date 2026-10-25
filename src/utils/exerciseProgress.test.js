import { expect, it } from 'vitest'
import { exerciseProgress } from './exerciseProgress.js'
const row = (date, weights, reps) => ({ startedAt: date, sets: weights.map((weightKg, i) => ({ weightKg, reps: reps[i] })) })
const plan = { sets: 3, repsMin: 8, repsMax: 12 }
it('reports repetitions at an unchanged ordered weight pattern and bounds the streak', () => {
  const result = exerciseProgress([
    row('2026-10-25', [20, 60, 40], [12, 10, 12]),
    row('2026-10-18', [20, 60, 40], [10, 8, 12]),
    row('2026-10-11', [20, 60, 35], [10, 8, 12]),
  ], plan)
  expect(result).toMatchObject({ streak: 2, days: 7, delta: 4, trend: 'up', goal: { set: 2, from: 10, to: 11, weightKg: 60 } })
})
it('does not label added sets or a changed pyramid as progress', () => {
  const current = row('2026-10-25', [20, 60, 40], [12, 10, 12])
  for (const previous of [row('2026-10-18', [20, 60], [12, 10]), row('2026-10-18', [40, 60, 20], [12, 10, 12])]) {
    expect(exerciseProgress([current, previous], plan)).toMatchObject({ streak: 1, trend: 'changed', delta: null })
  }
})
it('handles empty, first and bodyweight histories without inventing a trend', () => {
  expect(exerciseProgress([], plan)).toBeNull()
  expect(exerciseProgress([row('2026-10-25', [null], [8])], plan)).toMatchObject({ trend: 'first', goal: null })
  expect(exerciseProgress([row('2026-10-25', [null], [8]), row('2026-10-18', [0], [8])])).toMatchObject({ trend: 'same', delta: 0 })
})
it('reports a decrease without diagnosing a plateau or automatically increasing weight', () => {
  expect(exerciseProgress([row('2026-10-25', [60], [8]), row('2026-10-18', [60], [10])])).toMatchObject({ trend: 'down', delta: -2 })
  expect(exerciseProgress([row('2026-10-25', [20, 60, 40], [12, 12, 12])], plan)).toMatchObject({ goal: null })
})
it('requires at least four identical results spanning at least 21 days', () => {
  const history = ['2026-10-25', '2026-10-18', '2026-10-11', '2026-10-04'].map(date => row(date, [20, 60], [12, 8]))
  expect(exerciseProgress(history.slice(0, 2))).toMatchObject({ trend: 'same', unchanged: 2 })
  expect(exerciseProgress(history.slice(0, 3))).toMatchObject({ trend: 'same' })
  expect(exerciseProgress(history)).toMatchObject({ trend: 'plateau', unchanged: 4, unchangedDays: 21 })
})
it('recognizes higher weights without lost reps and refuses mixed tradeoffs', () => {
  expect(exerciseProgress([row('2026-10-25', [65], [10]), row('2026-10-18', [60], [10])])).toMatchObject({ trend: 'up', reason: 'weightUp' })
  expect(exerciseProgress([row('2026-10-25', [65], [8]), row('2026-10-18', [60], [10])])).toMatchObject({ trend: 'changed', reason: 'mixed' })
  expect(exerciseProgress([row('2026-10-25', [20, 60], [15, 7]), row('2026-10-18', [20, 60], [10, 8])])).toMatchObject({ trend: 'changed', reason: 'mixed' })
})
it('does not call a long run at the same weight a plateau when reps are growing', () => {
  expect(exerciseProgress([row('2026-10-25', [60], [12]), row('2026-10-18', [60], [10]), row('2026-10-11', [60], [8])])).toMatchObject({ trend: 'up', streak: 3, unchanged: 1 })
})

it('does not call frequent repeats or three widely spaced sessions a plateau', () => {
  const history = ['2026-10-25', '2026-10-20', '2026-10-15', '2026-10-05'].map(d => row(d, [60], [10]))
  expect(exerciseProgress(history)).toMatchObject({ trend: 'same', unchangedDays: 20 })
  expect(exerciseProgress([history[0], history[1], row('2026-09-01', [60], [10])])).toMatchObject({ trend: 'same' })
})
it('offers only one extra rep within the plan for the weakest set', () => {
  expect(exerciseProgress([row('2026-10-25', [60, 60, 60], [10, 10, 8])], plan).goal)
    .toEqual({ set: 3, from: 8, to: 9, weightKg: 60 })
  expect(exerciseProgress([row('2026-10-25', [60, 60, 60], [12, 12, 11])], plan).goal.to).toBe(12)
})
