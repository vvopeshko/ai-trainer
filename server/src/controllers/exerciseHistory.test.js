import { expect, it, vi, beforeEach } from 'vitest'
const mock = vi.hoisted(() => ({ workout: { findMany: vi.fn() }, userProfile: { findUnique: vi.fn() } }))
vi.mock('../utils/prisma.js', () => ({ default: mock }))
import { getHistory } from './exerciseController.js'
const id = '33333333-3333-4333-8333-333333333333'
beforeEach(() => vi.resetAllMocks())
it('restricts history to this user, finished workouts and this exercise; bounds results', async () => {
  const workouts = [{ id: 'w', startedAt: '2026-10-25', sets: [{ weightKg: 20, reps: 10 }] }]
  mock.workout.findMany.mockResolvedValue(workouts)
  const res = { json: vi.fn() }
  await getHistory({ params: { id }, user: { id: 'owner' } }, res)
  expect(mock.workout.findMany).toHaveBeenCalledWith({
    where: { userId: 'owner', finishedAt: { not: null }, startedAt: { gte: expect.any(Date) }, sets: { some: { exerciseId: id, isWarmup: false } } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 97,
    select: { id: true, startedAt: true, sets: {
      where: { exerciseId: id, isWarmup: false }, orderBy: [{ setOrder: 'asc' }, { id: 'asc' }],
      select: { weightKg: true, reps: true },
    } },
  })
  expect(res.json).toHaveBeenCalledWith({ workouts, hasMore: false, experienceLevel: null })
})
it('returns an empty history and rejects invalid exercise ids before querying', async () => {
  mock.workout.findMany.mockResolvedValue([])
  const res = { json: vi.fn() }
  await getHistory({ params: { id }, user: { id: 'owner' } }, res)
  expect(res.json).toHaveBeenCalledWith({ workouts: [], hasMore: false, experienceLevel: null })
  mock.workout.findMany.mockClear()
  await expect(getHistory({ params: { id: 'invalid' }, user: { id: 'owner' } }, res)).rejects.toThrow()
  expect(mock.workout.findMany).not.toHaveBeenCalled()
})
it('limits six-month history to 96 entries and exposes truncation', async () => {
  const workouts = Array.from({ length: 97 }, (_, id) => ({ id }))
  mock.workout.findMany.mockResolvedValue(workouts)
  const res = { json: vi.fn() }
  const before = Date.now()
  await getHistory({ params: { id }, user: { id: 'owner' } }, res)
  expect(res.json).toHaveBeenCalledWith({ workouts: workouts.slice(0, 96), hasMore: true, experienceLevel: null })
  const cutoff = mock.workout.findMany.mock.calls[0][0].where.startedAt.gte.getTime()
  expect(cutoff).toBeGreaterThanOrEqual(before - 183 * 86400000)
  expect(cutoff).toBeLessThanOrEqual(Date.now() - 183 * 86400000)
})
it('exposes the experience level for the plateau window', async () => {
  mock.workout.findMany.mockResolvedValue([])
  mock.userProfile.findUnique.mockResolvedValue({ experienceLevel: 'advanced' })
  const res = { json: vi.fn() }
  await getHistory({ params: { id }, user: { id: 'owner' } }, res)
  expect(mock.userProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'owner' }, select: { experienceLevel: true } })
  expect(res.json).toHaveBeenCalledWith({ workouts: [], hasMore: false, experienceLevel: 'advanced' })
})
