import { describe, it, expect } from 'vitest'
import { formatDuration, formatDateLine, WEEKDAYS_RU } from './formatters.js'

// Mock t() function — returns key with interpolated params
const t = (key, params) => {
  const templates = {
    'home.durationMin': `${params?.n} мин`,
    'home.today': 'Сегодня',
    'home.yesterday': 'Вчера',
    'home.daysAgo': `${params?.n} дн. назад`,
  }
  return templates[key] || key
}

describe('formatDuration', () => {
  it('returns null for null input', () => {
    expect(formatDuration(null, t)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatDuration(undefined, t)).toBeNull()
  })

  it('returns "< 1 мин" for very short durations', () => {
    expect(formatDuration(10, t)).toBe('< 1 мин')
    expect(formatDuration(29, t)).toBe('< 1 мин')
  })

  it('formats 60 seconds as 1 мин', () => {
    expect(formatDuration(60, t)).toBe('1 мин')
  })

  it('formats 3600 seconds as 60 мин', () => {
    expect(formatDuration(3600, t)).toBe('60 мин')
  })

  it('rounds to nearest minute', () => {
    expect(formatDuration(90, t)).toBe('2 мин')
    expect(formatDuration(150, t)).toBe('3 мин')  // 2.5 rounds to 3
  })
})

describe('formatDateLine', () => {
  it('formats today correctly', () => {
    const today = new Date().toISOString()
    const result = formatDateLine(today, t, WEEKDAYS_RU)
    expect(result).toContain('сегодня')
  })

  it('formats yesterday correctly', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const result = formatDateLine(yesterday, t, WEEKDAYS_RU)
    expect(result).toContain('вчера')
  })

  it('formats 3 days ago correctly', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
    const result = formatDateLine(threeDaysAgo, t, WEEKDAYS_RU)
    expect(result).toContain('3 дн. назад')
  })

  it('includes weekday name', () => {
    const today = new Date()
    const result = formatDateLine(today.toISOString(), t, WEEKDAYS_RU)
    const expectedWeekday = WEEKDAYS_RU[today.getDay()]
    expect(result).toContain(expectedWeekday)
  })
})

describe('WEEKDAYS_RU', () => {
  it('has 7 days', () => {
    expect(WEEKDAYS_RU).toHaveLength(7)
  })

  it('starts with Sunday', () => {
    expect(WEEKDAYS_RU[0]).toBe('Вс')
  })
})
