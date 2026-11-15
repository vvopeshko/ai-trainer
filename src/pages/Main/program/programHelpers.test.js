import { describe, it, expect } from 'vitest'
import { topMuscleGroups } from './programHelpers.js'

describe('topMuscleGroups', () => {
  it('folds muscles into display groups and keeps the largest', () => {
    expect(topMuscleGroups({ upper_chest: 4, mid_chest: 9, lats: 7, 'middle back': 8, side_delt: 9, biceps: 8 }))
      .toEqual([{ label: 'Спина', sets: 15 }, { label: 'Грудь', sets: 13 }, { label: 'Плечи', sets: 9 }])
  })

  it('handles a program without a summary', () => {
    expect(topMuscleGroups(undefined)).toEqual([])
  })
})
