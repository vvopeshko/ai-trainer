import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  program: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  exercise: { findMany: vi.fn() },
  workout: { groupBy: vi.fn() },
}
vi.mock('../utils/prisma.js', () => ({ default: mockPrisma }))
vi.mock('../utils/analytics.js', () => ({ track: vi.fn() }))
vi.mock('../services/aiTrainer/importProgram.js', () => ({ importProgram: vi.fn() }))
vi.mock('../services/aiTrainer/programEditor.js', () => ({ computeNextDayIndex: vi.fn() }))
vi.mock('../services/exerciseAlternatives.js', () => ({ updateSlot: vi.fn(), fillProgramAlternatives: vi.fn() }))

const { listPrograms, duplicateProgram, deleteProgram } = await import('./programController.js')

const USER_ID = 'user-1'
const req = (extra = {}) => ({ user: { id: USER_ID }, params: {}, body: {}, ...extra })
const mockRes = () => {
  const res = { statusCode: 200 }
  res.status = vi.fn(code => { res.statusCode = code; return res })
  res.json = vi.fn(body => { res.body = body; return res })
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('listPrograms', () => {
  it('returns a plan summary and workout history instead of the plan itself', async () => {
    mockPrisma.program.findMany.mockResolvedValue([
      { id: 'p1', name: 'A', isActive: true, planJson: { days: [{ exercises: [{ exerciseId: 'e1', sets: 4 }] }] } },
      { id: 'p2', name: 'B', isActive: false, planJson: { days: [] } },
    ])
    mockPrisma.exercise.findMany.mockResolvedValue([{ id: 'e1', primaryMuscles: ['chest'] }])
    const last = new Date('2026-11-14')
    mockPrisma.workout.groupBy.mockResolvedValue([{ programId: 'p1', _count: { _all: 7 }, _max: { startedAt: last } }])
    const res = mockRes()
    await listPrograms(req(), res)
    expect(mockPrisma.workout.groupBy.mock.calls[0][0].where).toEqual({ userId: USER_ID, programId: { in: ['p1', 'p2'] }, finishedAt: { not: null } })
    expect(res.body.programs).toEqual([
      { id: 'p1', name: 'A', isActive: true, daysCount: 1, exercisesCount: 1, setsCount: 4, muscleSets: { chest: 4 }, workoutsCount: 7, lastWorkoutAt: last },
      { id: 'p2', name: 'B', isActive: false, daysCount: 0, exercisesCount: 0, setsCount: 0, muscleSets: {}, workoutsCount: 0, lastWorkoutAt: null },
    ])
  })
})

describe('duplicateProgram', () => {
  it('copies the plan and guidelines of an owned program as inactive', async () => {
    const planJson = { days: [{ exercises: [{ exerciseId: 'e1', sets: 3, startWeightKg: 32 }] }] }
    mockPrisma.program.findFirst.mockResolvedValue({ id: 'p1', name: 'A', description: 'd', durationWeeks: 4, isActive: true, planJson, guidelines: { deload: 'x' } })
    mockPrisma.program.create.mockResolvedValue({ id: 'p9', name: 'A (копия)' })
    const res = mockRes()
    await duplicateProgram(req({ params: { id: 'p1' }, body: { name: 'A (копия)' } }), res)
    expect(mockPrisma.program.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', userId: USER_ID })
    expect(mockPrisma.program.create.mock.calls[0][0].data).toEqual({
      userId: USER_ID, name: 'A (копия)', description: 'd', durationWeeks: 4, isActive: false, planJson, guidelines: { deload: 'x' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('rejects a program of another user', async () => {
    mockPrisma.program.findFirst.mockResolvedValue(null)
    await expect(duplicateProgram(req({ params: { id: 'p1' } }), mockRes())).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.program.create).not.toHaveBeenCalled()
  })
})

describe('deleteProgram', () => {
  it('deletes an inactive owned program', async () => {
    mockPrisma.program.findFirst.mockResolvedValue({ id: 'p2', isActive: false })
    const res = mockRes()
    await deleteProgram(req({ params: { id: 'p2' } }), res)
    expect(mockPrisma.program.delete).toHaveBeenCalledWith({ where: { id: 'p2' } })
    expect(res.body).toEqual({ ok: true })
  })

  it('refuses to delete the active program', async () => {
    mockPrisma.program.findFirst.mockResolvedValue({ id: 'p1', isActive: true })
    await expect(deleteProgram(req({ params: { id: 'p1' } }), mockRes())).rejects.toMatchObject({ status: 409, code: 'PROGRAM_ACTIVE' })
    expect(mockPrisma.program.delete).not.toHaveBeenCalled()
  })
})
