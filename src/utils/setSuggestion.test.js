import { describe, expect, it } from 'vitest'
import { getSetSuggestion, getSetTarget } from './setSuggestion.js'
const historical = [
  { weightKg: 20, reps: 15 },
  { weightKg: 60, reps: 8 },
  { weightKg: 60, reps: 8 },
  { weightKg: 40, reps: 12 },
]

describe('set suggestions', () => {
  it('preserves a ramp-up and back-off series instead of repeating the previous set', () => {
    const doneSets = []
    for (let setIndex = 0; setIndex < historical.length; setIndex++) {
      const suggestion = getSetSuggestion({ setIndex, lastSets: historical, doneSets })
      expect(suggestion).toEqual({ ...historical[setIndex], source: 'history' })
      // A manual change to this set must not change the next set's prescription.
      doneSets.push({ weightKg: 25, reps: 20 })
    }
  })

  it('uses the current previous set for an extra set, not the old last set', () => {
    expect(getSetSuggestion({ setIndex: 4, lastSets: historical, doneSets: [{ weightKg: 35, reps: 10 }] }))
      .toEqual({ weightKg: 35, reps: 10, source: 'previous' })
  })

  it('does not replace a bodyweight set with the previous loaded set', () => {
    expect(getSetSuggestion({ setIndex: 0, lastSets: [{ weightKg: null, reps: 12 }], doneSets: [{ weightKg: 60, reps: 8 }] }))
      .toEqual({ weightKg: 0, reps: 12, source: 'history' })
  })

  it('falls back explicitly when history is missing', () => {
    expect(getSetSuggestion({ setIndex: 0, plannedReps: 6 }))
      .toEqual({ weightKg: 0, reps: 6, source: 'default' })
    expect(getSetSuggestion({ setIndex: 1, doneSets: [{ weightKg: 30, reps: 9 }] }))
      .toEqual({ weightKg: 30, reps: 9, source: 'previous' })
  })
})

describe('program start weight', () => {
  it('replaces the weights of the last session in every set', () => {
    for (let setIndex = 0; setIndex < historical.length; setIndex++) {
      expect(getSetSuggestion({ setIndex, lastSets: historical, plannedReps: 6, startWeightKg: 65 }))
        .toEqual({ weightKg: 65, reps: 6, source: 'start' })
    }
  })

  it('keeps the reps of the last session when the weight is unchanged', () => {
    expect(getSetSuggestion({ setIndex: 1, lastSets: historical, plannedReps: 6, startWeightKg: 60 }))
      .toEqual({ weightKg: 60, reps: 8, source: 'start' })
  })

  it('stays on the start weight after a set done with it, despite unit rounding', () => {
    expect(getSetSuggestion({ setIndex: 1, lastSets: historical, doneSets: [{ weightKg: 65.1, reps: 7 }], plannedReps: 6, startWeightKg: 65 }))
      .toEqual({ weightKg: 65, reps: 6, source: 'start' })
  })

  it('follows the weight the user chose instead in this workout', () => {
    expect(getSetSuggestion({ setIndex: 1, lastSets: historical, doneSets: [{ weightKg: 55, reps: 9 }], plannedReps: 6, startWeightKg: 65 }))
      .toEqual({ weightKg: 55, reps: 9, source: 'previous' })
  })

  it('works without history', () => {
    expect(getSetSuggestion({ setIndex: 0, plannedReps: 10, startWeightKg: 55 }))
      .toEqual({ weightKg: 55, reps: 10, source: 'start' })
  })
})

describe('set targets', () => {
  const plan = { sets: 4, repsMin: 8, repsMax: 10 }
  const lastSets = [{ weightKg: 80, reps: 10 }, { weightKg: 85, reps: 10 }, { weightKg: 85, reps: 10 }, { weightKg: 85, reps: 6 }]
  it('matches last session capped at the top, and adds one rep to the goal set', () => {
    const progress = { goal: { set: 4, from: 6, to: 7, weightKg: 85 } }
    expect([0, 1, 2, 3].map(setIndex => getSetTarget({ setIndex, lastSets, plan, progress }).reps)).toEqual([10, 10, 10, 7])
    expect(getSetTarget({ setIndex: 0, lastSets: [{ weightKg: 80, reps: 12 }], plan, progress: {} })).toEqual({ reps: 10 })
    expect(getSetTarget({ setIndex: 3, lastSets: [], plan, progress: {} })).toEqual({ reps: 8 })
  })
  it('targets the bottom of the range at the new weight when ready or consolidating', () => {
    expect(getSetTarget({ setIndex: 0, lastSets, plan, progress: { ready: { weightKg: 80 } }, readyWeightKg: 82.5 })).toEqual({ reps: 8, weightKg: 82.5 })
    expect(getSetTarget({ setIndex: 2, lastSets, plan, progress: { plateau: { kind: 'consolidate', weightKg: 85 }, goal: { set: 3, to: 9 } } })).toEqual({ reps: 8, weightKg: 85 })
  })
  it('has no target without a plan', () => {
    expect(getSetTarget({ setIndex: 0, lastSets, plan: null, progress: {} })).toBeNull()
  })
})
