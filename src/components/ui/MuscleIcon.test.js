import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MuscleIcon } from './MuscleIcon.jsx'

const artwork = name => renderToStaticMarkup(createElement(MuscleIcon, { name }))
const targets = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'forearms',
  'front_delt', 'glutes', 'hamstrings', 'lats', 'lower back', 'lower_chest',
  'mid_chest', 'middle back', 'neck', 'obliques', 'quadriceps', 'rear_delt',
  'side_delt', 'traps', 'triceps', 'upper_chest',
]

describe('target muscle artwork coverage', () => {
  it('gives every catalog target its own image, never a generic icon or another target', () => {
    const rendered = targets.map(artwork)
    for (const html of rendered) expect(html).toContain('<img')
    expect(new Set(rendered).size).toBe(targets.length)
  })
  it.each([
    ['lower_back', 'lower back'], ['middle_back', 'middle back'],
    ['front_delts', 'front_delt'], ['side_delts', 'side_delt'], ['rear_delts', 'rear_delt'],
  ])('keeps legacy alias %s aligned with %s', (alias, canonical) => {
    expect(artwork(alias)).toBe(artwork(canonical))
  })
  it('keeps an unknown muscle usable without inventing an anatomical target', () => {
    expect(artwork('unknown-muscle')).not.toContain('<img')
  })
})
