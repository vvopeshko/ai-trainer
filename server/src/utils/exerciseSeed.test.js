import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mapCategory, mapExercise, seedUpdate } from './exerciseSeed.js'

describe('mapCategory', () => {
  it('keeps stretches and cardio as their own kind', () => {
    expect(mapCategory({ category: 'stretching', mechanic: 'isolation' })).toBe('stretch')
    expect(mapCategory({ category: 'cardio', mechanic: 'compound' })).toBe('cardio')
  })

  it('maps strength-like categories by mechanic', () => {
    expect(mapCategory({ category: 'strength', mechanic: 'isolation' })).toBe('isolation')
    expect(mapCategory({ category: 'plyometrics', mechanic: 'compound' })).toBe('compound')
    expect(mapCategory({ category: 'strongman', mechanic: null })).toBe('compound')
  })

  it('gives every stretch in the real catalog the stretch kind', () => {
    const catalog = JSON.parse(readFileSync(new URL('../../data/enriched-exercises.json', import.meta.url)))
    const stretches = catalog.filter(ex => ex.category === 'stretching')
    expect(stretches.length).toBeGreaterThan(100)
    expect(stretches.every(ex => mapExercise(ex).category === 'stretch')).toBe(true)
  })
})

describe('seedUpdate', () => {
  const data = mapExercise({
    slug: 'leg-press', nameRu: 'Жим ногами', nameEn: 'Leg Press', equipment: 'machine',
    primaryMuscles: ['quadriceps'], mechanic: 'compound', category: 'strength',
    gifUrl: null, aliases: ['жим ногами'], descriptionRu: 'Описание',
  })

  it('keeps a GIF that exists only in the database', () => {
    const update = seedUpdate({ ...data, gifUrl: 'https://cdn/leg-press.gif' }, data)
    expect(update).not.toHaveProperty('gifUrl')
  })

  it('keeps manual fixes and fills only empty fields', () => {
    const existing = { ...data, nameRu: 'Жим ногами в тренажёре', aliases: ['жим платформы'], description: null, imageUrl: '' }
    expect(seedUpdate(existing, { ...data, imageUrl: 'Leg_Press/0.jpg' }))
      .toEqual({ description: 'Описание', imageUrl: 'Leg_Press/0.jpg' })
  })

  it('overwrites exactly the requested fields', () => {
    const existing = { ...data, category: 'isolation', nameRu: 'Своё название', difficulty: 'advanced' }
    expect(seedUpdate(existing, data, ['category'])).toEqual({ category: 'compound' })
  })

  it('never erases with an empty seed value nor touches identity', () => {
    const existing = { ...data, gifUrl: 'https://cdn/x.gif', source: 'ai_generated', slug: 'other' }
    expect(seedUpdate(existing, data, ['gifUrl', 'source', 'slug'])).toEqual({})
  })

  it('reports nothing when the row already matches', () => {
    expect(seedUpdate({ ...data }, data)).toEqual({})
    expect(seedUpdate({ ...data }, data, ['category', 'nameRu'])).toEqual({})
  })
})
