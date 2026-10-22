import { describe, expect, it } from 'vitest'
import { calculateAnnualGoal, localDate, parseAnnualGoal } from './annualGoal.js'

const goal = { year: 2026, target: 200, baselineDate: '2026-07-24', baselineCount: 134, timezone: 'Asia/Yekaterinburg' }
const calculate = (overrides = {}) => calculateAnnualGoal({ today: '2026-10-22', goal, workoutDates: [], ...overrides })

describe('annual workout goal', () => {
  it('includes the baseline day only in the historical total; counts workouts, not unique days', () => {
    const result = calculate({ workoutDates: ['2026-01-01', '2026-07-24', ...Array(25).fill('2026-10-22'), '2026-10-23'] })
    expect(result.done).toBe(159)
    expect(result.remaining).toBe(41)
    expect(result.daysRemaining).toBe(71)
    expect(result.yearPace).toBeCloseTo(159 * 7 / 295)
    expect(result.requiredPace).toBeCloseTo(41 * 7 / 71)
  })
  it('uses exactly 30 local calendar days including today', () => {
    const result = calculate({ workoutDates: ['2026-09-22', '2026-09-23', '2026-10-22'] })
    expect(result.monthStart).toBe('2026-09-23')
    expect(result.monthDone).toBe(2)
    expect(result.monthPace).toBeCloseTo(2 * 7 / 30)
  })
  it('increments on a new completion and decrements on deletion', () => {
    const a = calculate({ workoutDates: ['2026-08-01'] })
    const b = calculate({ workoutDates: ['2026-08-01', '2026-10-22'] })
    expect(b.done - a.done).toBe(1)
    expect(a.remaining - b.remaining).toBe(1)
  })
  it('does not fabricate a monthly pace from undated historical workouts', () => {
    expect(calculate({ today: '2026-08-01' }).monthPace).toBeNull()
  })
  it('resets in January and includes December workouts only in rolling pace', () => {
    const result = calculate({ today: '2027-01-01', workoutDates: ['2026-12-31', '2027-01-01'] })
    expect(result.done).toBe(1)
    expect(result.baselineCount).toBe(0)
    expect(result.monthDone).toBe(2)
    expect(result.daysRemaining).toBe(365)
  })
  it('handles leap years, the deadline and an exceeded goal', () => {
    expect(calculate({ today: '2028-12-31', goal: null, workoutDates: [] }).daysRemaining).toBe(1)
    expect(calculate({ workoutDates: Array(70).fill('2026-08-01') }).requiredPace).toBe(0)
    expect(calculate({ today: '2026-12-31' }).requiredPace).toBe(66 * 7)
  })
  it('uses local midnight and validates stored settings', () => {
    expect(localDate(new Date('2026-07-24T19:00:00Z'), goal.timezone)).toBe('2026-07-25')
    expect(parseAnnualGoal(goal)).toEqual(goal)
    expect(parseAnnualGoal({ ...goal, baselineDate: '2026-02-30' })).toBeNull()
    expect(parseAnnualGoal({ ...goal, year: 2025 })).toBeNull()
    expect(parseAnnualGoal({ ...goal, timezone: 'invalid' })).toBeNull()
    expect(parseAnnualGoal(null)).toBeNull()
  })
})
