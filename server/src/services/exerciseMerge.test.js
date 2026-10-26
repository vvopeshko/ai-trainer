import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadMerges, rewriteDayExercises, rewritePlan, mergedAliases, dropUnknownAlternatives } from './exerciseMerge.js'

const split = { id: 'split', slug: 'split-squat-with-dumbbells', nameRu: 'Болгарские выпады' }
const row = { id: 'row', slug: 'one-arm-dumbbell-row', nameRu: 'Тяга гантели одной рукой' }
const byOldId = new Map([['rfess-l', split], ['rfess-r', split], ['row-l', row]])

describe('loadMerges', () => {
  it('drops comment keys and accepts the real merge file', () => {
    const merges = loadMerges(JSON.parse(readFileSync(new URL('../../data/exercise-merges.json', import.meta.url))))
    expect(merges['rfess-l-db']).toBe('split-squat-with-dumbbells')
    expect(Object.keys(merges).some(k => k.startsWith('_'))).toBe(false)
  })

  it('rejects chains and self-merges', () => {
    expect(() => loadMerges({ a: 'b', b: 'c' })).toThrow(/chain/)
    expect(() => loadMerges({ a: 'a' })).toThrow(/itself/)
  })
})

describe('rewriteDayExercises', () => {
  it('points merged exercises to the canonical one and keeps one of left/right', () => {
    const { exercises, changed } = rewriteDayExercises([
      { exerciseId: 'rfess-l', slug: 'rfess-l-db', nameRu: 'Болгарские (левая)', sets: 3 },
      { exerciseId: 'rfess-r', slug: 'rfess-r-db', nameRu: 'Болгарские (правая)', sets: 3 },
      { exerciseId: 'press', slug: 'press', nameRu: 'Жим', alternatives: ['row-l', 'row-l', 'press'] },
    ], byOldId)
    expect(changed).toBe(true)
    expect(exercises).toEqual([
      { exerciseId: 'split', slug: 'split-squat-with-dumbbells', nameRu: 'Болгарские выпады', sets: 3 },
      { exerciseId: 'press', slug: 'press', nameRu: 'Жим', alternatives: ['row'] },
    ])
  })

  it('keeps an exercise the user put twice on purpose', () => {
    const day = [{ exerciseId: 'press', slug: 'press' }, { exerciseId: 'press', slug: 'press' }]
    expect(rewriteDayExercises(day, byOldId)).toEqual({ exercises: day, changed: false })
  })

  it('drops an alternative that became the exercise itself', () => {
    const { exercises } = rewriteDayExercises([{ exerciseId: 'split', alternatives: ['rfess-l', 'row'] }], byOldId)
    expect(exercises[0].alternatives).toEqual(['row'])
  })
})

describe('rewritePlan', () => {
  it('leaves untouched plans as the same object', () => {
    const plan = { days: [{ exercises: [{ exerciseId: 'press' }] }] }
    expect(rewritePlan(plan, byOldId)).toEqual({ plan, changed: false })
    expect(rewritePlan(null, byOldId).changed).toBe(false)
  })

  it('rewrites only the days that change', () => {
    const untouched = { title: 'B', exercises: [{ exerciseId: 'press' }] }
    const { plan, changed } = rewritePlan({ days: [{ title: 'A', exercises: [{ exerciseId: 'row-l' }] }, untouched] }, byOldId)
    expect(changed).toBe(true)
    expect(plan.days[0].exercises[0].exerciseId).toBe('row')
    expect(plan.days[1]).toBe(untouched)
  })
})

describe('mergedAliases', () => {
  it('adds old slugs and names without repeats or the canonical name', () => {
    expect(mergedAliases(
      { nameRu: 'Жим лёжа', aliases: ['жим штанги'] },
      [{ slug: 'old-press', nameRu: 'Жим лежа', nameEn: 'Bench Press', aliases: ['Жим штанги', 'классика'] }],
    )).toEqual(['жим штанги', 'old-press', 'Bench Press', 'классика'])
  })
})

describe('dropUnknownAlternatives', () => {
  it('removes alternatives of exercises that no longer exist and reports a missing main one', () => {
    const plan = { days: [
      { exercises: [{ exerciseId: 'a', alternatives: ['b', 'gone', 'gone2'] }, { exerciseId: 'lost', slug: 'lost-slug' }] },
      { exercises: [{ exerciseId: 'b', alternatives: ['a'] }] },
    ] }
    const { plan: out, removed, missingMain } = dropUnknownAlternatives(plan, new Set(['a', 'b']))
    expect(removed).toBe(2)
    expect(out.days[0].exercises[0].alternatives).toEqual(['b'])
    expect(out.days[1]).toBe(plan.days[1])
    expect(missingMain).toEqual(['lost-slug'])
  })

  it('returns the same plan when nothing is dangling', () => {
    const plan = { days: [{ exercises: [{ exerciseId: 'a', alternatives: ['b'] }] }] }
    expect(dropUnknownAlternatives(plan, new Set(['a', 'b'])).plan).toBe(plan)
  })
})
