import { describe, it, expect } from 'vitest'
import { getUserTimezone } from './dateUtils.js'

describe('getUserTimezone', () => {
  it('returns X-Timezone header if present', () => {
    const req = {
      header: (name) => name === 'X-Timezone' ? 'Europe/Moscow' : null,
      user: { timezone: 'Asia/Tokyo' },
    }
    expect(getUserTimezone(req)).toBe('Europe/Moscow')
  })

  it('falls back to user.timezone', () => {
    const req = {
      header: () => null,
      user: { timezone: 'Asia/Tokyo' },
    }
    expect(getUserTimezone(req)).toBe('Asia/Tokyo')
  })

  it('returns UTC as ultimate fallback', () => {
    const req = { header: () => null, user: {} }
    expect(getUserTimezone(req)).toBe('UTC')
  })

  it('returns UTC when user is undefined', () => {
    const req = { header: () => null }
    expect(getUserTimezone(req)).toBe('UTC')
  })

  it('prefers header over user.timezone', () => {
    const req = {
      header: (name) => name === 'X-Timezone' ? 'America/New_York' : null,
      user: { timezone: 'Europe/Berlin' },
    }
    expect(getUserTimezone(req)).toBe('America/New_York')
  })
})
