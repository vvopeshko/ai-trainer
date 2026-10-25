import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseDetailSheet } from './ExerciseDetailSheet.jsx'
import { useExerciseDetail } from '../../hooks/queries.js'

vi.mock('../../hooks/queries.js', () => ({ useExerciseDetail: vi.fn() }))
vi.mock('../../i18n/useTranslation.js', () => ({ useTranslation: () => ({ t: key => key }) }))
vi.mock('../TelegramProvider.jsx', () => ({ useTelegram: () => ({ webApp: null }) }))

function renderExercise(content) {
  useExerciseDetail.mockReturnValue({
    data: { id: 'test', nameRu: 'Упражнение', primaryMuscles: [], ...content },
    isLoading: false,
  })
  return renderToStaticMarkup(createElement(ExerciseDetailSheet, {
    exerciseId: 'test', open: true, onClose: () => {},
  }))
}

describe('exercise detail content from the API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the database description and typical mistakes', () => {
    const html = renderExercise({ description: 'Описание из БД', typicalMistakes: 'Типичная ошибка' })
    expect(html).toContain('Описание из БД')
    expect(html).toContain('Типичная ошибка')
    expect(html).not.toContain('library.noResults')
  })

  it('shows description-only content instead of the empty state', () => {
    const html = renderExercise({ description: 'Описание без ошибок', typicalMistakes: null })
    expect(html).toContain('Описание без ошибок')
    expect(html).not.toContain('library.mistakes')
    expect(html).not.toContain('library.noResults')
  })

  it('keeps the empty state for exercises without content', () => {
    const html = renderExercise({ description: null, typicalMistakes: null })
    expect(html).toContain('library.noResults')
    expect(html).not.toContain('library.description')
  })
})
