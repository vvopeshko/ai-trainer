import { describe, it, expect } from 'vitest'
import { summarizePlan, planExerciseIds } from './programSummary.js'

const plan = { days: [
  { exercises: [{ exerciseId: 'a', sets: 4 }, { exerciseId: 'b', sets: 3 }] },
  { exercises: [{ exerciseId: 'a', sets: 3 }, { exerciseId: 'c', sets: 2 }] },
] }

describe('summarizePlan', () => {
  it('counts days, exercises, sets and sets per primary muscle', () => {
    expect(summarizePlan(plan, { a: ['chest'], b: ['lats', 'biceps'] })).toEqual({
      daysCount: 2, exercisesCount: 4, setsCount: 12,
      muscleSets: { chest: 7, lats: 3, biceps: 3 },
    })
  })

  it('survives an empty or malformed plan', () => {
    expect(summarizePlan(null)).toEqual({ daysCount: 0, exercisesCount: 0, setsCount: 0, muscleSets: {} })
    expect(summarizePlan({ days: [{}] })).toEqual({ daysCount: 1, exercisesCount: 0, setsCount: 0, muscleSets: {} })
  })
})

describe('planExerciseIds', () => {
  it('returns unique exercise ids across programs', () => {
    expect(planExerciseIds([plan, { days: [{ exercises: [{ exerciseId: 'c' }, {}] }] }, null])).toEqual(['a', 'b', 'c'])
  })
})
