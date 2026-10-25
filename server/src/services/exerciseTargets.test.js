import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { TARGET_MUSCLES, targetMuscle, slugsWithTarget } from './exerciseTargets.js'

const file = JSON.parse(readFileSync(new URL('../../data/exercise-targets.json', import.meta.url), 'utf8'))
const seed = JSON.parse(readFileSync(new URL('../../data/enriched-exercises.json', import.meta.url), 'utf8'))

it('classifies every seed exercise with a known target or none', () => {
  const allowed = new Set([...TARGET_MUSCLES, 'none'])
  expect(seed.filter(e => !file[e.slug]).map(e => e.slug)).toEqual([])
  expect(Object.values(file).filter(t => !allowed.has(t))).toEqual([])
})

it('separates chest and delt regions, and hides non-strength exercises', () => {
  expect(targetMuscle('smith-machine-incline-bench-press')).toBe('upper_chest')
  expect(targetMuscle('bench-press-db')).toBe('mid_chest')
  expect(targetMuscle('lateral-raise-machine')).toBe('side_delt')
  expect(targetMuscle('cable-face-pull')).toBe('rear_delt')
  expect(targetMuscle('standing-biceps-cable-curl')).toBe('biceps')
  expect(targetMuscle('hamstring-stretch')).toBeNull()
  expect(targetMuscle('no-such-slug')).toBeNull()
  expect(slugsWithTarget('upper_chest')).toContain('incline-bench-db')
})
