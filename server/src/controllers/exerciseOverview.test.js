import { expect, it, vi, beforeEach } from 'vitest'
const mock = vi.hoisted(() => ({
  workout: { findMany: vi.fn() }, userProfile: { findUnique: vi.fn() },
  program: { findFirst: vi.fn() }, exercise: { findMany: vi.fn() },
}))
vi.mock('../utils/prisma.js', () => ({ default: mock }))
import { getProgressOverview } from './exerciseController.js'
const daysAgo = n => new Date(Date.now() - n * 86400000)
beforeEach(() => vi.resetAllMocks())

it('groups six months of history by exercise, keeps only exercises trained in six weeks, attaches plans', async () => {
  mock.workout.findMany.mockResolvedValue([
    { id: 'w2', startedAt: daysAgo(3), sets: [{ exerciseId: 'a', weightKg: 85, reps: 10 }, { exerciseId: 'a', weightKg: 85, reps: 8 }] },
    { id: 'w1', startedAt: daysAgo(10), sets: [{ exerciseId: 'a', weightKg: 80, reps: 10 }, { exerciseId: 'b', weightKg: 20, reps: 12 }] },
    { id: 'w0', startedAt: daysAgo(60), sets: [{ exerciseId: 'c', weightKg: 50, reps: 5 }] },
  ])
  mock.userProfile.findUnique.mockResolvedValue({ experienceLevel: 'beginner' })
  mock.program.findFirst.mockResolvedValue({ planJson: { days: [{ exercises: [{ exerciseId: 'a', sets: 4, repsMin: 8, repsMax: 10 }] }] } })
  mock.exercise.findMany.mockResolvedValue([{ id: 'a', nameRu: 'Жим', slug: 'press' }, { id: 'b', nameRu: 'Тяга', slug: 'row' }])
  const res = { json: vi.fn() }
  await getProgressOverview({ user: { id: 'owner' } }, res)
  expect(mock.workout.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'owner', finishedAt: { not: null } })
  expect(mock.workout.findMany.mock.calls[0][0].select.sets.where).toEqual({ isWarmup: false })
  expect(mock.exercise.findMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] } }, select: { id: true, nameRu: true, slug: true } })
  const body = res.json.mock.calls[0][0]
  expect(body.experienceLevel).toBe('beginner')
  expect(body.exercises.map(e => e.id)).toEqual(['a', 'b'])
  expect(body.exercises[0]).toMatchObject({ nameRu: 'Жим', plan: { sets: 4, repsMin: 8, repsMax: 10 } })
  expect(body.exercises[0].workouts.map(w => w.id)).toEqual(['w2', 'w1'])
  expect(body.exercises[0].workouts[0].sets).toEqual([{ weightKg: 85, reps: 10 }, { weightKg: 85, reps: 8 }])
  expect(body.exercises[1]).toMatchObject({ plan: null, workouts: [{ id: 'w1', sets: [{ weightKg: 20, reps: 12 }] }] })
})
it('returns an empty overview without querying exercise names', async () => {
  mock.workout.findMany.mockResolvedValue([])
  const res = { json: vi.fn() }
  await getProgressOverview({ user: { id: 'owner' } }, res)
  expect(mock.exercise.findMany).not.toHaveBeenCalled()
  expect(res.json).toHaveBeenCalledWith({ experienceLevel: null, exercises: [] })
})
