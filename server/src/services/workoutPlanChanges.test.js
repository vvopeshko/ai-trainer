import { describe, it, expect, vi } from 'vitest'
import { applyPlanChange, changeWorkoutPlan } from './workoutPlanChanges.js'
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', c = '33333333-3333-4333-8333-333333333333'
const setId = '44444444-4444-4444-8444-444444444444'
const plan = () => [a, b].map(exerciseId => ({ exerciseId, sets: 3, repsMin: 10, repsMax: 12, restSec: 90 }))
function database({ snapshot, workout = {} } = {}) {
  const tx = {
    workout: { findFirst: vi.fn().mockResolvedValue({ id: 'w', programId: 'p', programDayIndex: 1, planSnapshot: snapshot, ...workout }), update: vi.fn().mockResolvedValue({}) },
    program: { findFirst: vi.fn().mockResolvedValue({ id: 'p', planJson: { days: [{ title: 'Other', exercises: [] }, { title: 'Legs', exercises: plan() }] } }), update: vi.fn().mockResolvedValue({}) },
    exercise: { findMany: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.map(id => ({ id, nameRu: id, slug: id })))) },
    workoutPlanOverride: { findUnique: vi.fn().mockResolvedValue(null) },
    workoutSet: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  return { ...tx, $transaction: fn => fn(tx) }
}
const request = (change, scope = 'workout', expectedRevision = null) => ({ scope, expectedRevision, change })
describe('workout plan changes', () => {
  it('links and unlinks adjacent pairs preserving prescriptions and original input', () => {
    const original = [...plan(), { exerciseId: c, sets: 4 }]
    const linked = applyPlanChange(original, { type: 'link', exerciseId: a, partnerId: c }, { groupId: 'pair' })
    expect(linked.map(e => e.exerciseId)).toEqual([a, c, b]); expect(linked[1].sets).toBe(4)
    expect(original[0].supersetId).toBeUndefined()
    expect(applyPlanChange(linked, { type: 'unlink', exerciseId: c }).every(e => !e.supersetId)).toBe(true)
    expect(applyPlanChange(linked, { type: 'remove', exerciseId: a })[0].supersetId).toBeUndefined()
  })
  it('persists once-only changes without program writes or deleting recorded work', async () => {
    const db = database()
    const result = await changeWorkoutPlan(db, 'u', 'w', request({ type: 'link', exerciseId: a, partnerId: b }))
    expect(result.planExercises[0].supersetId).toBe(result.planExercises[1].supersetId)
    expect(db.program.update).not.toHaveBeenCalled(); expect(db.workoutSet.deleteMany).not.toHaveBeenCalled()
    expect(db.workout.update.mock.calls[0][0].data.planSnapshot.exercises).toEqual(result.planExercises)
  })
  it('applies only the chosen edit to the correct program day, keeping unrelated once-only changes out', async () => {
    const db = database({ snapshot: { revision: 'v1', exercises: [...plan().map(pe => ({ ...pe, sets: 5 })), { exerciseId: c, sets: 2 }] } })
    await changeWorkoutPlan(db, 'u', 'w', request({ type: 'link', exerciseId: a, partnerId: b }, 'program', 'v1'))
    const days = db.program.update.mock.calls[0][0].data.planJson.days
    expect(days[0]).toEqual({ title: 'Other', exercises: [] })
    expect(days[1].exercises.map(pe => pe.sets)).toEqual([3, 3])
    expect(db.workout.update.mock.calls[0][0].data.planSnapshot.exercises).toHaveLength(3)
  })
  it('rejects stale revisions before any writes', async () => {
    const db = database({ snapshot: { revision: 'v2', exercises: plan() } })
    await expect(changeWorkoutPlan(db, 'u', 'w', request({ type: 'unlink', exerciseId: a }, 'program', 'v1'))).rejects.toMatchObject({ status: 409 })
    expect(db.program.update).not.toHaveBeenCalled(); expect(db.workout.update).not.toHaveBeenCalled()
  })
  it('checks ownership and active state', async () => {
    const db = database(); db.workout.findFirst.mockResolvedValue(null)
    await expect(changeWorkoutPlan(db, 'other', 'w', request({ type: 'remove', exerciseId: a }))).rejects.toMatchObject({ status: 404 })
    expect(db.workout.findFirst).toHaveBeenCalledWith({ where: { id: 'w', userId: 'other', finishedAt: null } })
  })
  it('refuses counts below recorded work', async () => {
    const db = database(); db.workoutSet.findMany.mockResolvedValue([{ exerciseId: a }, { exerciseId: a }])
    await expect(changeWorkoutPlan(db, 'u', 'w', request({ type: 'sets', counts: [{ exerciseId: a, sets: 1 }] }, 'program'))).rejects.toMatchObject({ status: 409 })
    expect(db.program.update).not.toHaveBeenCalled()
  })
  it('refuses inaccessible exercise ids', async () => {
    const db = database(); db.exercise.findMany.mockResolvedValue([])
    await expect(changeWorkoutPlan(db, 'u', 'w', request({ type: 'add', exerciseId: c }))).rejects.toMatchObject({ status: 400 })
    expect(db.workout.update).not.toHaveBeenCalled()
  })
  it('supports free sessions once-only and refuses future scope without a program', async () => {
    const db = database({ workout: { programId: null, programDayIndex: null } })
    expect((await changeWorkoutPlan(db, 'u', 'w', request({ type: 'add', exerciseId: a }))).planExercises).toHaveLength(1)
    await expect(changeWorkoutPlan(db, 'u', 'w', request({ type: 'add', exerciseId: b }, 'program'))).rejects.toMatchObject({ status: 400 })
  })
  it('deletes only the requested recorded set; future history is untouched', async () => {
    const db = database()
    await changeWorkoutPlan(db, 'u', 'w', request({ type: 'deleteSet', exerciseId: a, setId }, 'program'))
    expect(db.workoutSet.deleteMany).toHaveBeenCalledWith({ where: { id: setId, workoutId: 'w', exerciseId: a } })
    expect(db.program.update.mock.calls[0][0].data.planJson.days[1].exercises[0].sets).toBe(2)
  })
  it('maps temporary variants to original program slots without promoting the variant', async () => {
    const db = database({ snapshot: { revision: 'v1', exercises: [{ ...plan()[0], exerciseId: c, mainExerciseId: a }, plan()[1]] } })
    await changeWorkoutPlan(db, 'u', 'w', request({ type: 'sets', counts: [{ exerciseId: c, sets: 4 }] }, 'program', 'v1'))
    expect(db.program.update.mock.calls[0][0].data.planJson.days[1].exercises[0]).toMatchObject({ exerciseId: a, sets: 4 })
  })
})

it('re-adds a once-removed exercise without duplicating its existing future slot', async () => {
  const db = database({ snapshot: { revision: 'v1', exercises: [plan()[1]] } })
  const result = await changeWorkoutPlan(db, 'u', 'w', request({ type: 'add', exerciseId: a }, 'program', 'v1'))
  expect(result.planExercises).toHaveLength(2)
  expect(db.program.update.mock.calls[0][0].data.planJson.days[1].exercises).toEqual(plan())
})
