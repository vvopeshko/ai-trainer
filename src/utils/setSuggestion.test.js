import { describe, expect, it } from 'vitest'
import { getSetSuggestion } from './setSuggestion.js'
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
