import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock prisma ────────────────────────────────────────────────────────────
const mockPrisma = {
  workout: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  workoutSet: {
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  workoutPlanOverride: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  program: {
    findFirst: vi.fn(),
  },
  exercise: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('../utils/prisma.js', () => ({ default: mockPrisma }))

// track() is fire-and-forget — no-op so it never touches prisma in tests
vi.mock('../utils/analytics.js', () => ({ track: vi.fn() }))

// post-workout summary is fire-and-forget on finish — no-op
vi.mock('../services/aiTrainer/postWorkoutSummary.js', () => ({
  sendPostWorkoutSummary: vi.fn().mockResolvedValue(undefined),
}))

const { create, update, logSet, deleteSet, destroy } = await import('./workoutController.js')

// ── Helpers ─────────────────────────────────────────────────────────────────
const USER_ID = 'user-1'
const WORKOUT_ID = '11111111-1111-1111-1111-111111111111'
const PROGRAM_ID = '22222222-2222-2222-2222-222222222222'
const EXERCISE_ID = '33333333-3333-3333-3333-333333333333'
const SET_ID = '44444444-4444-4444-4444-444444444444'

function mockReq({ user = { id: USER_ID }, body = {}, params = {}, query = {} } = {}) {
  return { user, body, params, query }
}

function mockRes() {
  const res = { statusCode: 200, body: undefined }
  res.status = vi.fn(function (code) {
    res.statusCode = code
    return res
  })
  res.json = vi.fn(function (payload) {
    res.body = payload
    return res
  })
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: $transaction just runs the callback with mockPrisma as `tx`
  mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma))
})

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────
describe('create', () => {
  it('deletes an existing EMPTY active workout and creates a fresh one', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: 'old-w', sets: [] })
    mockPrisma.workout.delete.mockResolvedValue({})
    const created = { id: 'new-w', sets: [] }
    mockPrisma.workout.create.mockResolvedValue(created)

    const req = mockReq({ body: {} })
    const res = mockRes()
    await create(req, res)

    expect(mockPrisma.workout.delete).toHaveBeenCalledWith({ where: { id: 'old-w' } })
    expect(mockPrisma.workout.create).toHaveBeenCalled()
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ workout: created, resumed: false })
  })

  it('resumes an existing active workout that already has sets (no delete/create)', async () => {
    const existing = { id: 'w-with-sets', sets: [{ id: 's1' }] }
    mockPrisma.workout.findFirst.mockResolvedValue(existing)

    const req = mockReq({ body: {} })
    const res = mockRes()
    await create(req, res)

    expect(mockPrisma.workout.delete).not.toHaveBeenCalled()
    expect(mockPrisma.workout.create).not.toHaveBeenCalled()
    expect(res.body).toEqual({ workout: existing, resumed: true })
  })

  it('retries the transaction once on a P2034 serialization failure', async () => {
    let calls = 0
    mockPrisma.$transaction.mockImplementation(async (cb) => {
      calls++
      if (calls === 1) {
        const err = new Error('could not serialize access')
        err.code = 'P2034'
        throw err
      }
      return cb(mockPrisma)
    })
    mockPrisma.workout.findFirst.mockResolvedValue(null)
    const created = { id: 'new-w', sets: [] }
    mockPrisma.workout.create.mockResolvedValue(created)

    const req = mockReq({ body: {} })
    const res = mockRes()
    await create(req, res)

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ workout: created, resumed: false })
  })

  it('gives up after retries exhausted and rethrows persistent P2034', async () => {
    mockPrisma.$transaction.mockImplementation(async () => {
      const err = new Error('serialization failure')
      err.code = 'P2034'
      throw err
    })

    const req = mockReq({ body: {} })
    const res = mockRes()
    await expect(create(req, res)).rejects.toMatchObject({ code: 'P2034' })
    // attempt 0,1 continue → 2 rethrows: 3 total attempts
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3)
  })

  it('rethrows non-P2034 errors immediately (no retry)', async () => {
    mockPrisma.$transaction.mockImplementation(async () => {
      const err = new Error('boom')
      err.code = 'P2002'
      throw err
    })

    const req = mockReq({ body: {} })
    const res = mockRes()
    await expect(create(req, res)).rejects.toMatchObject({ code: 'P2002' })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it("returns 404 when the programId belongs to another user (not found)", async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)
    mockPrisma.program.findFirst.mockResolvedValue(null) // IDOR: scoped by userId → miss

    const req = mockReq({ body: { programId: PROGRAM_ID } })
    const res = mockRes()
    await create(req, res)

    expect(mockPrisma.program.findFirst).toHaveBeenCalledWith({
      where: { id: PROGRAM_ID, userId: USER_ID },
      select: { id: true, planJson: true },
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Program not found' })
    expect(mockPrisma.workout.create).not.toHaveBeenCalled()
  })

  it('returns 400 when programDayIndex is out of range', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)
    mockPrisma.program.findFirst.mockResolvedValue({
      id: PROGRAM_ID,
      planJson: { days: [{ title: 'A' }, { title: 'B' }] }, // length 2
    })

    const req = mockReq({ body: { programId: PROGRAM_ID, programDayIndex: 5 } })
    const res = mockRes()
    await create(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'programDayIndex is out of range' })
    expect(mockPrisma.workout.create).not.toHaveBeenCalled()
  })

  it('creates a program-bound workout when programDayIndex is in range', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)
    mockPrisma.program.findFirst.mockResolvedValue({
      id: PROGRAM_ID,
      planJson: { days: [{ title: 'A' }, { title: 'B' }] },
    })
    const created = { id: 'new-w', programId: PROGRAM_ID, programDayIndex: 1, sets: [] }
    mockPrisma.workout.create.mockResolvedValue(created)

    const req = mockReq({ body: { programId: PROGRAM_ID, programDayIndex: 1 } })
    const res = mockRes()
    await create(req, res)

    expect(mockPrisma.workout.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, programId: PROGRAM_ID, programDayIndex: 1 },
      include: { sets: true },
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ workout: created, resumed: false })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// update (pause / resume / finish)
// ─────────────────────────────────────────────────────────────────────────────
describe('update — finish', () => {
  it('deletes an empty workout (0 sets) instead of finishing → { deleted: true }', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    })
    mockPrisma.workout.deleteMany.mockResolvedValue({ count: 1 })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } })
    const res = mockRes()
    await update(req, res)

    expect(mockPrisma.workout.deleteMany).toHaveBeenCalledWith({
      where: { id: WORKOUT_ID, sets: { none: {} } },
    })
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
    expect(res.body).toEqual({ workout: null, deleted: true })
  })

  it('finishes a workout with sets: sets finishedAt and returns the workout', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      feltRating: null,
      notes: null,
    })
    mockPrisma.workout.deleteMany.mockResolvedValue({ count: 0 })
    const updated = {
      id: WORKOUT_ID,
      programId: null,
      programDayIndex: null,
      startedAt: new Date('2026-07-11T10:00:00Z'),
      finishedAt: new Date('2026-07-11T11:00:00Z'),
      sets: [{ id: 's1' }, { id: 's2' }],
    }
    mockPrisma.workout.update.mockResolvedValue(updated)

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } })
    const res = mockRes()
    await update(req, res)

    expect(mockPrisma.workout.update).toHaveBeenCalledTimes(1)
    const arg = mockPrisma.workout.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: WORKOUT_ID })
    expect(arg.data.finishedAt).toBeInstanceOf(Date)
    expect(arg.data.pausedAt).toBeNull()
    expect(res.body).toEqual({ workout: updated })
  })

  it('does NOT overwrite feltRating when it is absent from the body', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      feltRating: 4, // previously saved
      notes: 'prev',
    })
    mockPrisma.workout.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.workout.update.mockResolvedValue({
      id: WORKOUT_ID,
      programId: null,
      programDayIndex: null,
      startedAt: new Date(),
      finishedAt: new Date(),
      sets: [{ id: 's1' }],
    })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } }) // no feltRating
    const res = mockRes()
    await update(req, res)

    const arg = mockPrisma.workout.update.mock.calls[0][0]
    expect(arg.data.feltRating).toBe(4) // preserved, not nulled
    expect(arg.data.notes).toBe('prev')
  })

  it('consumes the WorkoutPlanOverride for the day after a program-bound finish', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      feltRating: null,
      notes: null,
    })
    mockPrisma.workout.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.workout.update.mockResolvedValue({
      id: WORKOUT_ID,
      programId: PROGRAM_ID,
      programDayIndex: 2,
      startedAt: new Date(),
      finishedAt: new Date(),
      sets: [{ id: 's1' }],
    })
    mockPrisma.workoutPlanOverride.delete.mockResolvedValue({})

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } })
    const res = mockRes()
    await update(req, res)

    expect(mockPrisma.workoutPlanOverride.delete).toHaveBeenCalledWith({
      where: {
        userId_programId_dayIndex: { userId: USER_ID, programId: PROGRAM_ID, dayIndex: 2 },
      },
    })
  })

  it('swallows a missing-override error on consume (delete rejects → still responds)', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      feltRating: null,
      notes: null,
    })
    mockPrisma.workout.deleteMany.mockResolvedValue({ count: 0 })
    const updated = {
      id: WORKOUT_ID,
      programId: PROGRAM_ID,
      programDayIndex: 0,
      startedAt: new Date(),
      finishedAt: new Date(),
      sets: [{ id: 's1' }],
    }
    mockPrisma.workout.update.mockResolvedValue(updated)
    mockPrisma.workoutPlanOverride.delete.mockRejectedValue(new Error('record not found'))

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } })
    const res = mockRes()
    await update(req, res)

    expect(res.body).toEqual({ workout: updated }) // no throw
  })

  it('returns 404 when there is no active workout for the user', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } })
    const res = mockRes()
    await update(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Active workout not found' })
  })
})

describe('update — pause / resume', () => {
  it('pause sets pausedAt on an unpaused workout', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    })
    const updated = { id: WORKOUT_ID, pausedAt: new Date() }
    mockPrisma.workout.update.mockResolvedValue(updated)

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'pause' } })
    const res = mockRes()
    await update(req, res)

    const arg = mockPrisma.workout.update.mock.calls[0][0]
    expect(arg.data.pausedAt).toBeInstanceOf(Date)
    expect(res.body).toEqual({ workout: updated })
  })

  it('pause returns 400 when the workout is already paused', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: new Date(),
      totalPausedMs: 0,
    })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'pause' } })
    const res = mockRes()
    await update(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Workout is already paused' })
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('resume adds elapsed pause to totalPausedMs and clears pausedAt', async () => {
    const pausedAt = new Date(Date.now() - 5000) // paused 5s ago
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt,
      totalPausedMs: 1000,
    })
    mockPrisma.workout.update.mockResolvedValue({ id: WORKOUT_ID })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'resume' } })
    const res = mockRes()
    await update(req, res)

    const arg = mockPrisma.workout.update.mock.calls[0][0]
    expect(arg.data.pausedAt).toBeNull()
    // 1000 (prior) + ~5000 (this pause); allow small clock drift
    expect(arg.data.totalPausedMs).toBeGreaterThanOrEqual(6000)
    expect(arg.data.totalPausedMs).toBeLessThan(7000)
  })

  it('resume returns 400 when the workout is not paused', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'resume' } })
    const res = mockRes()
    await update(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Workout is not paused' })
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('finish auto-resumes a paused workout, folding the open pause into totalPausedMs', async () => {
    const pausedAt = new Date(Date.now() - 3000)
    mockPrisma.workout.findFirst.mockResolvedValue({
      id: WORKOUT_ID,
      userId: USER_ID,
      finishedAt: null,
      pausedAt,
      totalPausedMs: 2000,
      feltRating: null,
      notes: null,
    })
    mockPrisma.workout.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.workout.update.mockResolvedValue({
      id: WORKOUT_ID,
      programId: null,
      programDayIndex: null,
      startedAt: new Date(Date.now() - 60000),
      finishedAt: new Date(),
      sets: [{ id: 's1' }],
    })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: { action: 'finish' } })
    const res = mockRes()
    await update(req, res)

    const arg = mockPrisma.workout.update.mock.calls[0][0]
    expect(arg.data.totalPausedMs).toBeGreaterThanOrEqual(5000) // 2000 + ~3000
    expect(arg.data.totalPausedMs).toBeLessThan(6000)
    expect(arg.data.pausedAt).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// logSet
// ─────────────────────────────────────────────────────────────────────────────
describe('logSet', () => {
  const validBody = {
    exerciseId: EXERCISE_ID,
    exerciseOrder: 0,
    setOrder: 0,
    weightKg: 60,
    reps: 10,
  }

  it('logs a set on an active, non-paused workout → 201', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID, pausedAt: null })
    const set = { id: SET_ID, reps: 10, weightKg: 60, exercise: { nameRu: 'Жим' } }
    mockPrisma.workoutSet.create.mockResolvedValue(set)

    const req = mockReq({ params: { id: WORKOUT_ID }, body: validBody })
    const res = mockRes()
    await logSet(req, res)

    expect(mockPrisma.workoutSet.create).toHaveBeenCalledWith({
      data: {
        workoutId: WORKOUT_ID,
        exerciseId: EXERCISE_ID,
        exerciseOrder: 0,
        setOrder: 0,
        weightKg: 60,
        reps: 10,
        rpe: null,
        isWarmup: false,
      },
      include: { exercise: true },
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ set })
  })

  it('returns 404 when the workout is missing or belongs to another user', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)

    const req = mockReq({ params: { id: WORKOUT_ID }, body: validBody })
    const res = mockRes()
    await logSet(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Active workout not found' })
    expect(mockPrisma.workoutSet.create).not.toHaveBeenCalled()
  })

  it('returns 400 when the workout is paused', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID, pausedAt: new Date() })

    const req = mockReq({ params: { id: WORKOUT_ID }, body: validBody })
    const res = mockRes()
    await logSet(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Workout is paused' })
    expect(mockPrisma.workoutSet.create).not.toHaveBeenCalled()
  })

  it('propagates a P2003 FK error to the error handler (rejects, not caught)', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID, pausedAt: null })
    const err = new Error('foreign key constraint failed')
    err.code = 'P2003'
    mockPrisma.workoutSet.create.mockRejectedValue(err)

    const req = mockReq({ params: { id: WORKOUT_ID }, body: validBody })
    const res = mockRes()
    await expect(logSet(req, res)).rejects.toMatchObject({ code: 'P2003' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deleteSet
// ─────────────────────────────────────────────────────────────────────────────
describe('deleteSet', () => {
  it('deletes a set owned by an active workout → { deleted: true }', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID })
    mockPrisma.workoutSet.findFirst.mockResolvedValue({ id: SET_ID, workoutId: WORKOUT_ID })
    mockPrisma.workoutSet.delete.mockResolvedValue({})

    const req = mockReq({ params: { id: WORKOUT_ID, setId: SET_ID } })
    const res = mockRes()
    await deleteSet(req, res)

    expect(mockPrisma.workoutSet.delete).toHaveBeenCalledWith({ where: { id: SET_ID } })
    expect(res.body).toEqual({ deleted: true })
  })

  it('returns 404 when the active workout is not found (ownership check)', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)

    const req = mockReq({ params: { id: WORKOUT_ID, setId: SET_ID } })
    const res = mockRes()
    await deleteSet(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Active workout not found' })
    expect(mockPrisma.workoutSet.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when the set does not belong to the workout', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID })
    mockPrisma.workoutSet.findFirst.mockResolvedValue(null)

    const req = mockReq({ params: { id: WORKOUT_ID, setId: SET_ID } })
    const res = mockRes()
    await deleteSet(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Set not found' })
    expect(mockPrisma.workoutSet.delete).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// destroy
// ─────────────────────────────────────────────────────────────────────────────
describe('destroy', () => {
  it('deletes a workout owned by the user → { deleted: true }', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue({ id: WORKOUT_ID })
    mockPrisma.workout.delete.mockResolvedValue({})

    const req = mockReq({ params: { id: WORKOUT_ID } })
    const res = mockRes()
    await destroy(req, res)

    expect(mockPrisma.workout.findFirst).toHaveBeenCalledWith({
      where: { id: WORKOUT_ID, userId: USER_ID },
    })
    expect(mockPrisma.workout.delete).toHaveBeenCalledWith({ where: { id: WORKOUT_ID } })
    expect(res.body).toEqual({ deleted: true })
  })

  it('returns 404 when the workout is missing or owned by another user', async () => {
    mockPrisma.workout.findFirst.mockResolvedValue(null)

    const req = mockReq({ params: { id: WORKOUT_ID } })
    const res = mockRes()
    await destroy(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Workout not found' })
    expect(mockPrisma.workout.delete).not.toHaveBeenCalled()
  })
})
