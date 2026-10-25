import { describe, expect, it } from 'vitest'
import { getExerciseMuscle } from './exerciseMuscle.js'

describe('getExerciseMuscle', () => {
  it('uses the selected alternative instead of stale slot metadata', () => {
    const catalog = new Map([['alt', { primaryMuscles: ['triceps'] }]])
    expect(getExerciseMuscle({ exerciseId: 'alt', primaryMuscles: ['chest'] }, catalog)).toBe('triceps')
  })
  it('uses embedded metadata when an exercise is outside the cached catalog', () => {
    expect(getExerciseMuscle({ id: 'custom', primaryMuscles: ['shoulders'] }, new Map())).toBe('shoulders')
  })
  it('restores missing active exercise metadata from its own plan slot only', () => {
    const slot = { exerciseId: 'planned', primaryMuscles: ['biceps'] }
    expect(getExerciseMuscle({ id: 'planned' }, new Map(), slot)).toBe('biceps')
    expect(getExerciseMuscle({ id: 'other' }, new Map(), slot)).toBeUndefined()
  })
  it('handles unavailable muscle metadata without guessing from a name', () => {
    expect(getExerciseMuscle({ nameRu: 'Жим' })).toBeUndefined()
    expect(getExerciseMuscle(null)).toBeUndefined()
  })
})
