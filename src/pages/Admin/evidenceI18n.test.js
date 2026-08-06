import { describe, expect, test } from 'vitest'
import { evidenceContent, evidenceUiText } from './evidenceI18n.jsx'

describe('Evidence Console localization', () => {
  test('renders UI copy in both languages with interpolation', () => {
    expect(evidenceUiText('claimCount', 'ru', { count: 3 })).toBe('3 тезисов')
    expect(evidenceUiText('claimCount', 'en', { count: 3 })).toBe('3 claims')
  })

  test('localizes pilot content and preserves canonical English', () => {
    const claim = { id: 'ECV-RIR-HYP-v1', statement: 'Exact momentary failure is not required.' }
    expect(evidenceContent(claim, 'statement', 'ru')).toContain('не обязательно')
    expect(evidenceContent(claim, 'statement', 'en')).toBe(claim.statement)
  })

  test('falls back to canonical content for unknown entities', () => {
    const entity = { id: 'FUTURE-ID', guidance: 'Canonical guidance.', population: 'Specific population.' }
    expect(evidenceContent(entity, 'guidance', 'ru')).toBe('Canonical guidance.')
    expect(evidenceContent(entity, 'population', 'ru')).toBe('Specific population.')
  })
})
