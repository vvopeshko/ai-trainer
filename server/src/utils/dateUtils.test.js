import { describe, it, expect } from 'vitest'
import { getUserTimezone, getPeriodBoundaries, localMidnightUtc } from './dateUtils.js'

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

describe('getPeriodBoundaries', () => {
  it('Moscow (UTC+3): неделя с понедельника, месяц с 1-го — локальная полночь', () => {
    // Среда 2026-10-28 01:00 MSK = вторник 22:00 UTC
    const b = getPeriodBoundaries('Europe/Moscow', new Date('2026-10-27T22:00:00Z'))
    expect(b.today.toISOString()).toBe('2026-10-28T00:00:00.000Z')
    expect(b.weekStart.toISOString()).toBe('2026-10-25T21:00:00.000Z') // пн 26.10 00:00 MSK
    expect(b.monthStart.toISOString()).toBe('2026-09-30T21:00:00.000Z') // 01.10 00:00 MSK
  })

  it('понедельник — начало недели сам понедельник, воскресенье — прошлый понедельник', () => {
    expect(getPeriodBoundaries('UTC', new Date('2026-10-26T10:00:00Z')).weekStart.toISOString())
      .toBe('2026-10-26T00:00:00.000Z')
    expect(getPeriodBoundaries('UTC', new Date('2026-11-01T23:59:00Z')).weekStart.toISOString())
      .toBe('2026-10-26T00:00:00.000Z')
  })

  it('DST: Berlin — неделя начинается до перевода часов (UTC+2), сегодня уже UTC+1', () => {
    // Переход 2026-10-25 03:00 CEST → 02:00 CET. Среда 28.10 12:00 CET
    const b = getPeriodBoundaries('Europe/Berlin', new Date('2026-10-28T11:00:00Z'))
    expect(b.weekStart.toISOString()).toBe('2026-10-25T23:00:00.000Z') // пн 26.10 00:00 CET
    expect(b.monthStart.toISOString()).toBe('2026-09-30T22:00:00.000Z') // 01.10 00:00 CEST
  })

  it('отрицательный offset: New York', () => {
    expect(localMidnightUtc(2026, 3, 8, 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(localMidnightUtc(2026, 3, 9, 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })
})
