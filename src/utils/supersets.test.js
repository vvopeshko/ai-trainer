import { describe, expect, it } from 'vitest'
import { linkSuperset, supersetPair, supersetTransition, supersetRows, movePlanExercise } from './supersets.js'
const ex = (id, sets = 3, group) => ({ exerciseId: id, sets, restSec: id === 'b' ? 90 : 120, ...(group ? { supersetId: group } : {}) })
const pair = [ex('a', 3, 'g'), ex('b', 3, 'g')]

describe('supersets', () => {
  it('links adjacent slots without changing their prescription or source objects', () => {
    const plan = [ex('a'), ex('x'), ex('b')]
    const linked = linkSuperset(plan, 'a', 'b', 'g')
    expect(linked.map(x => x.exerciseId)).toEqual(['a', 'b', 'x'])
    expect(supersetPair(linked, 'a')).toEqual(pair)
    expect(plan[0].supersetId).toBeUndefined()
    expect(linkSuperset(linked, 'b', null)).toEqual([ex('a'), ex('b'), ex('x')])
  })
  it('does not steal a member from an existing pair; ignores malformed groups', () => {
    expect(linkSuperset([...pair, ex('c')], 'c', 'b', 'other')).toEqual([...pair, ex('c')])
    expect(supersetPair([pair[0]], 'a')).toBeNull()
    expect(supersetPair([...pair, ex('c', 3, 'g')], 'a')).toBeNull()
  })
  it('runs A1 B1 rest A2 B2 rest and finishes only after both', () => {
    for (let n = 1; n <= 3; n++) {
      expect(supersetTransition(pair, 'a', { a: n, b: n - 1 })).toMatchObject({ next: pair[1], rest: false, restSec: 90 })
      expect(supersetTransition(pair, 'b', { a: n, b: n })).toMatchObject({ next: n === 3 ? null : pair[0], rest: true })
    }
  })
  it('supports an extra approach for A, B, or both without an infinite loop', () => {
    for (const [a, b] of [[4, 3], [3, 4], [4, 4]]) {
      const exercises = [ex('a', a, 'g'), ex('b', b, 'g')]
      const counts = { a: 0, b: 0 }; let id = 'a'; let attempts = 0
      while (id && attempts++ < 12) {
        counts[id]++
        const result = supersetTransition(exercises, id, counts)
        if (id === 'b' || result.next?.exerciseId === id) expect(result.rest).toBe(true)
        id = result.next?.exerciseId
      }
      expect(counts).toEqual({ a, b })
      expect(attempts).toBe(a + b)
    }
  })
  it('places rows in execution order, including recorded extras', () => {
    expect(supersetRows(pair, { a: 4, b: 3 }).map(r => r.exercise.exerciseId + r.setIndex)).toEqual(['a0', 'b0', 'a1', 'b1', 'a2', 'b2', 'a3'])
  })
  it('moves pairs as a unit in both directions', () => {
    const plan = [ex('x'), ...pair, ex('y')]
    expect(movePlanExercise(plan, 1, 3).map(ex => ex.exerciseId)).toEqual(['x', 'y', 'a', 'b'])
    expect(movePlanExercise(plan, 2, 0).map(ex => ex.exerciseId)).toEqual(['a', 'b', 'x', 'y'])
    expect(movePlanExercise(plan, 0, 2).map(ex => ex.exerciseId)).toEqual(['a', 'b', 'x', 'y'])
  })
})
