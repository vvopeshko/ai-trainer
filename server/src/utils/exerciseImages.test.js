import { expect, it } from 'vitest'
import { exerciseImages } from './exerciseImages.js'

it('turns a catalog path into both frames on the pinned CDN', () => {
  const [start, end] = exerciseImages('Leg_Press/0.jpg')
  expect(start).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[0-9a-f]{40}\/exercises\/Leg_Press\/0\.jpg$/)
  expect(end).toBe(start.replace('0.jpg', '1.jpg'))
})

it('keeps absolute URLs and single frames as they are', () => {
  expect(exerciseImages('https://example.com/a.png')).toEqual(['https://example.com/a.png'])
  expect(exerciseImages('Odd/cover.jpg')).toHaveLength(1)
})

it('has nothing without a picture', () => {
  expect(exerciseImages(null)).toEqual([])
  expect(exerciseImages('')).toEqual([])
})
