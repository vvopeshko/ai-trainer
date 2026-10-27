import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ workoutSet: { findMany: vi.fn() }, userExerciseSettings: { findMany: vi.fn() } }))
vi.mock('../utils/prisma.js', () => ({ default: prisma }))
import { buildExerciseResults, getWorkoutResults } from './workoutResults.js'

const start = new Date('2026-10-27T10:00:00Z')
const set = (weightKg, reps, extra = {}) => ({ exerciseId: 'press', weightKg, reps,
  exercise: { slug: 'press', nameRu: 'Жим', trackingType: 'weight_reps' }, ...extra })
const workout = sets => ({ id: 'today', startedAt: start, sets })
const past = (sets, day = '2026-10-20', id = day) => sets.map(s => ({ ...s, workoutId: id,
  workout: { startedAt: `${day}T10:00:00Z`, finishedAt: `${day}T11:00:00Z` } }))
const result = (today, history) => buildExerciseResults(workout(today), history)[0]

beforeEach(() => {
  vi.resetAllMocks()
  prisma.workoutSet.findMany.mockResolvedValue([])
  prisma.userExerciseSettings.findMany.mockResolvedValue([])
})

describe('completed workout comparisons', () => {
  it('recognizes more reps at the same load, against the real historical best', () => {
    const r = result([set(24, 10)], past([set(24, 8), set(24, 7)]))
    expect(r.status).toBe('up')
    expect(r.comparison).toEqual({ metric: 'reps', delta: 2 })
    expect(r.records).toEqual([{ current: { weightKg: 24, reps: 10 }, previous: { weightKg: 24, reps: 8 }, comparison: { metric: 'reps', delta: 2 } }])
  })
  it('does not call returning to an old level a record, even after a long break', () => {
    const r = result([set(55, 10)], [...past([set(50, 10)]), ...past([set(60, 10)], '2025-01-01')])
    expect(r.status).toBe('up')
    expect(r.comparison).toEqual({ metric: 'weight', delta: 5 })
    expect(r.records).toEqual([])
  })
  it('compares the last session of this exercise, independent of program or incoming order', () => {
    const r = result([set(40, 8)], [...past([set(40, 6)], '2026-10-01'), ...past([set(40, 10)])])
    expect(r.status).toBe('down')
    expect(r.comparison.delta).toBe(-2)
    expect(r.previous.reps).toBe(10)
    expect(r.records).toEqual([])
  })
  it('marks heavier weight with fewer reps as a different scheme, not growth or decline', () => {
    const r = result([set(85, 8)], past([set(80, 10)]))
    expect(r.status).toBe('changed')
    expect(r.comparison.metric).toBeNull()
    expect(r.records).toHaveLength(1)
    expect(r.records[0].previous).toBeNull()
  })
  it('never counts the first session as a record', () => {
    expect(result([set(80, 10)], [])).toMatchObject({ status: 'first', records: [] })
  })
  it('does not turn fewer sets into a decline; ignores warmups in both sessions', () => {
    const r = result([set(50, 10), set(100, 10, { isWarmup: true })],
      past([set(50, 10), set(50, 9), set(120, 10, { isWarmup: true })]))
    expect(r).toMatchObject({ status: 'same', records: [], current: { weightKg: 50, reps: 10 } })
  })
  it('deduplicates and removes dominated record sets', () => {
    const r = result([set(24, 9), set(24, 10), set(24, 10)], past([set(24, 8)]))
    expect(r.records).toHaveLength(1)
    expect(r.records[0].current.reps).toBe(10)
  })
  it('does not award a record if a heavier historical set already covered these reps', () => {
    const r = result([set(24, 10)], [...past([set(24, 8)]), ...past([set(26, 12)], '2026-08-01')])
    expect(r.status).toBe('up')
    expect(r.records).toEqual([])
  })
  it('ignores this workout, future sessions and unfinished history', () => {
    const history = [...past([set(24, 8)]), ...past([set(100, 10)], '2026-10-28'),
      ...past([set(100, 10)], '2026-10-19', 'today'),
      { ...past([set(100, 10)])[0], workout: { startedAt: '2026-10-22', finishedAt: null } }]
    expect(result([set(24, 10)], history).records).toHaveLength(1)
  })
  it('uses fewer kilograms of assistance as progress, more as decline', () => {
    const assisted = (w, r) => set(w, r, { exercise: { slug: 'assisted', trackingType: 'assisted_bodyweight' } })
    const up = result([assisted(25, 10)], past([assisted(30, 10)]))
    expect(up).toMatchObject({ status: 'up', comparison: { metric: 'weight', delta: -5 } })
    expect(up.records).toHaveLength(1)
    expect(result([assisted(35, 10)], past([assisted(30, 10)]))).toMatchObject({ status: 'down', records: [] })
  })
  it('compares timed exercises in seconds and bodyweight exercises in reps', () => {
    const timed = (reps) => set(0, reps, { exercise: { trackingType: 'duration' } })
    expect(result([timed(60)], past([timed(45)]))).toMatchObject({ status: 'up', comparison: { metric: 'duration', delta: 15 } })
    expect(result([set(null, 12)], past([set(null, 10)]))).toMatchObject({ status: 'up', comparison: { metric: 'reps', delta: 2 } })
  })
  it('keeps warmup-only, distance and overridden timer exercises out of record claims', () => {
    expect(result([set(10, 10, { isWarmup: true })], [])).toMatchObject({ status: 'warmup', current: null, records: [] })
    for (const exercise of [{ trackingType: 'distance' }, { trackingType: 'weight_reps', timerOverride: true }]) {
      expect(result([set(10, 10, { exercise })], past([set(10, 8)]))).toMatchObject({ status: 'untracked', records: [] })
    }
  })
})

it('reads only the owner’s completed prior history, all time, in one batch', async () => {
  await getWorkoutResults('owner', workout([set(24, 10)]))
  const query = prisma.workoutSet.findMany.mock.calls[0][0]
  expect(query.where.workout).toEqual({ userId: 'owner', id: { not: 'today' },
    startedAt: { lt: start }, finishedAt: { not: null, lte: start } })
  expect(query.where.exerciseId.in).toEqual(['press'])
  expect(query.where.isWarmup).toBe(false)
  expect(query.take).toBeUndefined()
})

it('honors timer overrides without comparing seconds against old reps', async () => {
  prisma.userExerciseSettings.findMany.mockResolvedValue([{ exerciseSlug: 'press' }])
  prisma.workoutSet.findMany.mockResolvedValue(past([set(0, 10)]))
  const r = await getWorkoutResults('owner', workout([set(0, 60)]))
  expect(r.exercises[0]).toMatchObject({ trackingType: 'duration', status: 'untracked', records: [] })
})
