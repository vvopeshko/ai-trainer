import { expect, it } from 'vitest'
import { summarizeWorkout } from './workoutSummary.js'

it('counts tonnage without assistance weight and timed sets', () => {
  const set = (exerciseId, weightKg, reps, trackingType) => ({ exerciseId, weightKg, reps, exercise: { trackingType, primaryMuscles: [] } })
  const summary = summarizeWorkout({ sets: [
    set('press', 80, 10, 'weight_reps'),
    set('gravitron', 30, 8, 'assisted_bodyweight'),
    set('plank', 10, 60, 'duration'),
    set('dip', 10, 10, 'bodyweight_reps'),
  ] })
  expect(summary.tonnageKg).toBe(900)
  expect(summary.totalSets).toBe(4)
})
