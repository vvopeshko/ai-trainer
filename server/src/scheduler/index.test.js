import { describe, it, expect, vi, beforeEach } from 'vitest'

// prisma мокаем на уровне модуля (claimNotification дёргает notificationLog.create)
vi.mock('../utils/prisma.js', () => ({
  default: { notificationLog: { create: vi.fn() } },
}))

import prisma from '../utils/prisma.js'
import { getLocalTime, isoWeekKey, claimNotification } from './index.js'

describe('getLocalTime', () => {
  it('переводит UTC-дату в локальные часы TZ юзера', () => {
    const date = new Date('2026-01-01T00:30:00Z')

    const msk = getLocalTime(date, 'Europe/Moscow') // UTC+3
    expect(msk.hour).toBe(3)
    expect(msk.dayKey).toBe('2026-01-01')
    expect(msk.monthKey).toBe('2026-01')
    expect(msk.weekKey).toBe('2026-W01')
    expect(msk.weekday).toBe(4) // 2026-01-01 — четверг

    const utc = getLocalTime(date, 'UTC')
    expect(utc.hour).toBe(0)
    expect(utc.dayKey).toBe('2026-01-01')
  })

  it('сдвигает день/дату при переходе через полночь (23:00 UTC → 02:00 след. дня в Москве)', () => {
    const date = new Date('2026-01-01T23:00:00Z')

    const msk = getLocalTime(date, 'Europe/Moscow')
    expect(msk.hour).toBe(2) // 23 + 3 = 26 → 02:00
    expect(msk.dayKey).toBe('2026-01-02') // уже следующий день
    expect(msk.weekday).toBe(5) // пятница
  })

  it('в полночь час равен 0, а не 24', () => {
    const midnight = getLocalTime(new Date('2026-06-13T00:00:00Z'), 'UTC')
    expect(midnight.hour).toBe(0)
    expect(midnight.hour).not.toBe(24)
    expect(midnight.dayKey).toBe('2026-06-13')
  })
})

describe('isoWeekKey', () => {
  it('строит ключ формата YYYY-Www', () => {
    expect(isoWeekKey(2026, 6, 13)).toBe('2026-W24')
  })

  it('ISO-неделя принадлежит году её четверга: 2025-12-29..31 → 2026-W01', () => {
    // Понедельник 2025-12-29 и его неделя содержат четверг 2026-01-01 → неделя 1 2026 года
    expect(isoWeekKey(2025, 12, 29)).toBe('2026-W01')
    expect(isoWeekKey(2025, 12, 31)).toBe('2026-W01')
    expect(isoWeekKey(2026, 1, 1)).toBe('2026-W01')
  })

  it('соседние дни одной ISO-недели дают одинаковый ключ', () => {
    // 2025-12-29 (Пн) и 2026-01-01 (Чт) — одна ISO-неделя
    expect(isoWeekKey(2025, 12, 29)).toBe(isoWeekKey(2026, 1, 1))
    // а 2025-12-28 (Вс) — уже предыдущая неделя (2025-W52)
    expect(isoWeekKey(2025, 12, 28)).toBe('2025-W52')
    expect(isoWeekKey(2025, 12, 28)).not.toBe(isoWeekKey(2025, 12, 29))
  })

  it('эталон ISO 8601: 2021-01-01 (пятница) относится к 2020-W53', () => {
    expect(isoWeekKey(2021, 1, 1)).toBe('2020-W53')
  })
})

describe('claimNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('первый вызов (create успешен) → true (claimed)', async () => {
    prisma.notificationLog.create.mockResolvedValueOnce({ id: 'x' })

    const result = await claimNotification(1, 'weekly', '2026-W01')

    expect(result).toBe(true)
    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: { userId: 1, kind: 'weekly', periodKey: '2026-W01' },
    })
  })

  it('повтор (unique violation P2002) → false (уже отправляли)', async () => {
    const err = new Error('Unique constraint failed')
    err.code = 'P2002'
    prisma.notificationLog.create.mockRejectedValueOnce(err)

    const result = await claimNotification(1, 'weekly', '2026-W01')

    expect(result).toBe(false)
  })

  it('прочая ошибка БД → залогировано и false', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('connection lost')
    err.code = 'P1001'
    prisma.notificationLog.create.mockRejectedValueOnce(err)

    const result = await claimNotification(2, 'reminder', '2026-06-13')

    expect(result).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})
