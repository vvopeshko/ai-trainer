import { describe, it, expect } from 'vitest'
import {
  localDateTimeParts,
  dueSchedule,
  shiftDateKey,
  retryDelayMs,
  classifyDeliveryError,
  truncateError,
} from './notificationCore.js'

// Всё время — явным now: тесты не зависят от системных часов и зоны.

describe('localDateTimeParts', () => {
  it('разбирает локальное время в TZ', () => {
    // 2026-07-12 (вс) 16:30 UTC = 19:30 МСК
    const parts = localDateTimeParts(new Date('2026-07-12T16:30:00Z'), 'Europe/Moscow')
    expect(parts).toMatchObject({ hour: 19, minute: 30, weekday: 0, dayKey: '2026-07-12' })
    expect(parts.weekKey).toBe('2026-W28')
  })

  it('невалидная IANA-зона бросает RangeError (не подменяется молча)', () => {
    expect(() => localDateTimeParts(new Date(), 'Not/AZone')).toThrow(RangeError)
  })
})

describe('dueSchedule', () => {
  const local = (hour, minute, weekday, dayKey = '2026-07-12') => ({ hour, minute, weekday, dayKey })

  it('слот наступил в точный час', () => {
    expect(dueSchedule(local(19, 0, 0), { hour: 19, weekday: 0, windowHours: 24 })).toEqual({
      due: true,
      slotDayKey: '2026-07-12',
    })
  })

  it('catch-up: backend лежал, слот всё ещё due внутри окна', () => {
    expect(dueSchedule(local(23, 45, 0), { hour: 19, weekday: 0, windowHours: 6 }).due).toBe(true)
  })

  it('окно истекло → не due', () => {
    expect(dueSchedule(local(2, 0, 0), { hour: 19, weekday: 0, windowHours: 6 }).due).toBe(false)
  })

  it('до слота → не due', () => {
    expect(dueSchedule(local(18, 59, 0), { hour: 19, weekday: 0, windowHours: 6 }).due).toBe(false)
  })

  it('через локальную полночь: слот вс 19:00 due в пн 01:30 при окне 24ч, periodKey — вчерашний', () => {
    // Пн 2026-07-13 01:30, слот вс 19:00, окно 24ч
    const res = dueSchedule(local(1, 30, 1, '2026-07-13'), { hour: 19, weekday: 0, windowHours: 24 })
    expect(res.due).toBe(true)
    expect(res.slotDayKey).toBe('2026-07-12') // локальная дата слота, не текущая
  })

  it('чужой день недели → не due', () => {
    expect(dueSchedule(local(19, 30, 3), { hour: 19, weekday: 0, windowHours: 6 }).due).toBe(false)
  })

  it('weekday=null → ежедневно', () => {
    expect(dueSchedule(local(12, 5, 4), { hour: 12, windowHours: 6 }).due).toBe(true)
  })
})

describe('shiftDateKey', () => {
  it('сдвигает через границы месяца и года', () => {
    expect(shiftDateKey('2026-07-01', -1)).toBe('2026-06-30')
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('retryDelayMs', () => {
  it('backoff 1 → 5 → 15 → 60 → 180 мин, дальше плато', () => {
    expect(retryDelayMs(1)).toBe(60_000)
    expect(retryDelayMs(2)).toBe(5 * 60_000)
    expect(retryDelayMs(3)).toBe(15 * 60_000)
    expect(retryDelayMs(4)).toBe(60 * 60_000)
    expect(retryDelayMs(5)).toBe(180 * 60_000)
    expect(retryDelayMs(99)).toBe(180 * 60_000)
  })
})

describe('classifyDeliveryError', () => {
  it('telegram 403 → permanent', () => {
    const err = { response: { error_code: 403 }, message: 'Forbidden: bot was blocked' }
    expect(classifyDeliveryError(err, 'telegram')).toMatchObject({ permanent: true, code: 'tg_forbidden' })
  })

  it('telegram 429 → retry с retry_after', () => {
    const err = { response: { error_code: 429, parameters: { retry_after: 7 } } }
    expect(classifyDeliveryError(err, 'telegram')).toMatchObject({
      permanent: false,
      code: 'tg_rate_limited',
      retryAfterMs: 7000,
    })
  })

  it('web_push 410 → permanent', () => {
    expect(classifyDeliveryError({ statusCode: 410 }, 'web_push').permanent).toBe(true)
  })

  it('сетевые временные → retry', () => {
    expect(classifyDeliveryError(new Error('read ECONNRESET'), 'telegram').permanent).toBe(false)
    expect(classifyDeliveryError(new Error('fetch failed'), 'web_push').permanent).toBe(false)
  })

  it('неизвестное → retry (maxAttempts ограничит)', () => {
    expect(classifyDeliveryError(new Error('weird'), 'telegram')).toMatchObject({
      permanent: false,
      code: 'unknown',
    })
  })
})

describe('truncateError', () => {
  it('режет до 500 символов', () => {
    expect(truncateError('x'.repeat(600)).length).toBe(500)
    expect(truncateError(null)).toBe('')
  })
})
