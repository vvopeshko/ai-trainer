import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { TRACKING_TYPES, MOVEMENT_PATTERNS, JOINTS, countsTonnage, loadsInjured } from './exerciseAttributes.js'

it('counts tonnage only where the weight is lifted', () => {
  expect(countsTonnage('weight_reps')).toBe(true)
  expect(countsTonnage('bodyweight_reps')).toBe(true)
  expect(countsTonnage(null)).toBe(true)
  expect(countsTonnage('assisted_bodyweight')).toBe(false)
  expect(countsTonnage('duration')).toBe(false)
  expect(countsTonnage('distance')).toBe(false)
})

it('keeps exercises away from injured joints only', () => {
  const squat = { jointStress: ['knee', 'lower_back'] }
  expect(loadsInjured(squat, ['knee'])).toBe(true)
  expect(loadsInjured(squat, ['shoulder'])).toBe(false)
  expect(loadsInjured(squat, ['none'])).toBe(false)
  expect(loadsInjured(squat, [])).toBe(false)
  expect(loadsInjured({}, ['knee'])).toBe(false)
})

it('classifies every catalog exercise with known attribute values', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../data/enriched-exercises.json', import.meta.url), 'utf8'))
  const bad = catalog.filter(e => !TRACKING_TYPES.includes(e.trackingType) || !MOVEMENT_PATTERNS.includes(e.movementPattern)
    || !Array.isArray(e.jointStress) || !e.jointStress.every(j => JOINTS.includes(j)) || typeof e.stable !== 'boolean')
  expect(bad.map(e => e.slug)).toEqual([])
  const by = slug => catalog.find(e => e.slug === slug)
  expect(by('assisted-pull-up-machine').trackingType).toBe('assisted_bodyweight')
  expect(by('front-plank').trackingType).toBe('duration')
  expect(by('machine-chest-press').jointStress).toEqual([])
})
