import { describe, expect, it } from 'vitest'
import { normalizeSearch, searchRank, searchExercises, byPopularity, isStretchOrCardio } from './exerciseSearch.js'

const ex = (nameRu, extra = {}) => ({ nameRu, nameEn: null, aliases: [], ...extra })

describe('normalizeSearch', () => {
  it('ignores case, ё and extra spaces', () => {
    expect(normalizeSearch('  Жим  ЛЁЖА ')).toBe('жим лежа')
    expect(normalizeSearch(null)).toBe('')
  })
})

describe('searchRank', () => {
  it('treats ё and е as the same letter both ways', () => {
    expect(searchRank(ex('Жим гантелей лёжа'), 'лежа')).not.toBeNull()
    expect(searchRank(ex('Разведение гантелей лежа'), 'лёжа')).not.toBeNull()
  })

  it('needs every word, in any order and place', () => {
    expect(searchRank(ex('Жим гантелей лёжа'), 'жим лежа')).toBe(4)
    expect(searchRank(ex('Жим гантелей лёжа'), 'жим штанги')).toBeNull()
  })

  it('matches English names and aliases', () => {
    expect(searchRank(ex('Тяга к лицу', { nameEn: 'Face Pull' }), 'face')).toBe(5)
    expect(searchRank(ex('Жим штанги стоя', { aliases: ['армейский жим'] }), 'армейский жим')).toBe(0)
  })

  it('ranks exact, prefix, word start, substring', () => {
    expect(searchRank(ex('Планка'), 'планка')).toBe(0)
    expect(searchRank(ex('Планка боковая'), 'планка')).toBe(1)
    expect(searchRank(ex('Боковая планка'), 'планка')).toBe(2)
    expect(searchRank(ex('Суперпланка'), 'планка')).toBe(3)
  })

  it('does not match an empty query', () => {
    expect(searchRank(ex('Планка'), '  ')).toBeNull()
  })
})

describe('searchExercises', () => {
  it('puts the closest names first, shorter before longer', () => {
    const list = [
      ex('Отжимания на брусьях'),
      ex('Жим штанги стоя', { aliases: ['армейский жим'] }),
      ex('Французский жим'),
      ex('Жим гантелей лёжа'),
      ex('Жим лёжа'),
      ex('Становая тяга'),
    ]
    expect(searchExercises(list, 'жим').map(e => e.nameRu))
      .toEqual(['Жим лёжа', 'Жим штанги стоя', 'Жим гантелей лёжа', 'Французский жим', 'Отжимания на брусьях'])
    expect(searchExercises(list, 'армейский жим').map(e => e.nameRu)).toEqual(['Жим штанги стоя'])
  })
})

describe('popularity', () => {
  it('puts what people do above exotic names with the same rank', () => {
    const list = [ex('Жим JM'), ex('Жим Тейта'), ex('Жим штанги лёжа средним хватом', { popularity: 2 })]
    expect(searchExercises(list, 'жим').map(e => e.nameRu))
      .toEqual(['Жим штанги лёжа средним хватом', 'Жим JM', 'Жим Тейта'])
  })

  it('never lets popularity beat a closer match', () => {
    const list = [ex('Французский жим', { popularity: 4 }), ex('Жим Тейта')]
    expect(searchExercises(list, 'жим').map(e => e.nameRu)).toEqual(['Жим Тейта', 'Французский жим'])
  })

  it('browses popular first, then alphabetically', () => {
    const list = [ex('Ягодичный мост'), ex('Бабочка', { popularity: 1 }), ex('Армейский жим'), ex('Подтягивания', { popularity: 3 })]
    expect(byPopularity(list).map(e => e.nameRu)).toEqual(['Подтягивания', 'Бабочка', 'Армейский жим', 'Ягодичный мост'])
  })
})

describe('isStretchOrCardio', () => {
  it('separates stretches and cardio from strength work', () => {
    expect(isStretchOrCardio({ category: 'stretch' })).toBe(true)
    expect(isStretchOrCardio({ category: 'cardio' })).toBe(true)
    expect(isStretchOrCardio({ category: 'compound' })).toBe(false)
  })
})
