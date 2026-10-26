import { describe, expect, it, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn(), exercise: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() } },
  match: vi.fn(),
}))
vi.mock('../utils/prisma.js', () => ({ default: mock.prisma }))
vi.mock('./exerciseMatcher.js', () => ({ matchUnknownExercises: mock.match, forgetCatalog: vi.fn() }))
vi.mock('./exerciseCatalog.js', () => ({ forgetCatalogResponse: vi.fn() }))

const { createCustomExercise } = await import('./customExercises.js')

describe('createCustomExercise', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.prisma.$queryRaw.mockResolvedValue([])
    mock.prisma.exercise.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }))
  })

  it('returns an exercise with the same name instead of a duplicate', async () => {
    mock.prisma.$queryRaw.mockResolvedValue([{ id: 'seed-1' }])
    mock.prisma.exercise.findUnique.mockResolvedValue({ id: 'seed-1', nameRu: 'Жим ногами' })
    expect(await createCustomExercise('u1', { nameRu: ' жим  ногами ' })).toEqual({ exercise: { id: 'seed-1', nameRu: 'Жим ногами' }, created: false })
    expect(mock.match).not.toHaveBeenCalled()
  })

  it('suggests the catalog exercise the matcher recognised', async () => {
    mock.match.mockResolvedValue(new Map([['1', { match: { id: 'seed-2' } }]]))
    mock.prisma.exercise.findUnique.mockResolvedValue({ id: 'seed-2', nameRu: 'Жим гантелей на наклонной' })
    expect(await createCustomExercise('u1', { nameRu: 'Жим гантелей под углом' })).toEqual({ suggestion: { id: 'seed-2', nameRu: 'Жим гантелей на наклонной' } })
    expect(mock.prisma.exercise.create).not.toHaveBeenCalled()
  })

  it('creates a private, classified exercise when the user insists', async () => {
    mock.match.mockResolvedValue(new Map([['1', { fields: {
      nameEn: 'Landmine Press', primaryMuscles: ['shoulders'], equipment: 'barbell', category: 'compound',
      trackingType: 'weight_reps', movementPattern: 'vertical_push', jointStress: ['shoulder'], stable: false, unilateral: true,
    } }]]))
    const result = await createCustomExercise('u1', { nameRu: 'Жим мины одной рукой', force: true })
    expect(mock.match.mock.calls[0][1]).toEqual({ classifyOnly: true })
    expect(result.created).toBe(true)
    const data = mock.prisma.exercise.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      nameRu: 'Жим мины одной рукой', source: 'user_created', createdByUserId: 'u1',
      equipment: ['barbell'], trackingType: 'weight_reps', movementPattern: 'vertical_push', jointStress: ['shoulder'],
    })
    expect(data.slug).toMatch(/^my-[0-9a-f]{6}-landmine-press$/)
  })

  it('still creates the exercise when the LLM is unavailable', async () => {
    mock.match.mockResolvedValue(new Map())
    const result = await createCustomExercise('u1', { nameRu: 'Моё упражнение' })
    expect(result.created).toBe(true)
    expect(mock.prisma.exercise.create.mock.calls[0][0].data).toMatchObject({ nameRu: 'Моё упражнение', primaryMuscles: [], equipment: [] })
  })
})
