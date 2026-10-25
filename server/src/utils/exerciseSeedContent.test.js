import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { exerciseSeedContent } from './exerciseSeedContent.js'

describe('exercise seed content', () => {
  it('maps enriched text to the Prisma/API fields', () => {
    expect(exerciseSeedContent({
      descriptionRu: ' Описание упражнения ',
      typicalMistakes: ' Не раскачивайтесь. ',
      gifUrl: 'video.mp4',
    })).toEqual({ description: 'Описание упражнения', typicalMistakes: 'Не раскачивайтесь.' })
  })

  it('does not erase existing content when source text is absent or blank', () => {
    for (const value of [undefined, null, '', '  ', []]) {
      expect(exerciseSeedContent({ descriptionRu: value, typicalMistakes: value })).toEqual({})
    }
    expect(exerciseSeedContent({ typicalMistakes: 'Ошибка' })).toEqual({ typicalMistakes: 'Ошибка' })
  })

  it('preserves all available descriptions and mistakes in the real catalog', () => {
    const catalog = JSON.parse(readFileSync(new URL('../../data/enriched-exercises.json', import.meta.url)))
    const enriched = catalog.filter(ex => ex.descriptionRu || ex.typicalMistakes)
    expect(enriched.length).toBeGreaterThan(0)
    for (const ex of enriched) {
      const content = exerciseSeedContent(ex)
      if (ex.descriptionRu) expect(content.description).toBe(ex.descriptionRu.trim())
      if (ex.typicalMistakes) expect(content.typicalMistakes).toBe(ex.typicalMistakes.trim())
    }
  })
})
