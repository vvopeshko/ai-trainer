import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockPrisma = {
  exercise: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
}

vi.mock('../utils/prisma.js', () => ({ default: mockPrisma }))

const { resolveExercise } = await import('./exerciseResolver.js')

describe('exerciseResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('slug path', () => {
    it('resolves exercise by slug', async () => {
      const exercise = { id: 'uuid-1', slug: 'bench-press', nameRu: 'Жим лёжа' }
      mockPrisma.exercise.findUnique.mockResolvedValue(exercise)

      const result = await resolveExercise({ slug: 'bench-press' })

      expect(result).toEqual({
        exerciseId: 'uuid-1',
        exercise,
        resolvedBy: 'slug',
      })
      expect(mockPrisma.exercise.findUnique).toHaveBeenCalledWith({
        where: { slug: 'bench-press' },
      })
    })

    it('generates slug from nameEn when slug not provided', async () => {
      const exercise = { id: 'uuid-2', slug: 'dumbbell-curl', nameRu: 'Подъём гантелей' }
      mockPrisma.exercise.findUnique.mockResolvedValue(exercise)

      const result = await resolveExercise({ nameEn: 'Dumbbell Curl' })

      expect(result.resolvedBy).toBe('slug')
      expect(mockPrisma.exercise.findUnique).toHaveBeenCalledWith({
        where: { slug: 'dumbbell-curl' },
      })
    })
  })

  describe('alias path', () => {
    it('resolves exercise by alias when slug misses', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null) // slug miss
      const exercise = { id: 'uuid-3', slug: 'lat-pulldown', nameRu: 'Тяга верхнего блока' }
      mockPrisma.$queryRaw.mockResolvedValue([exercise])

      const result = await resolveExercise({ slug: 'wrong-slug', nameRu: 'Тяга верхнего блока' })

      expect(result).toEqual({
        exerciseId: 'uuid-3',
        exercise,
        resolvedBy: 'alias',
      })
    })
  })

  describe('auto-create path', () => {
    it('creates exercise when not found by slug or alias', async () => {
      // First findUnique (slug lookup) → null
      mockPrisma.exercise.findUnique
        .mockResolvedValueOnce(null)  // slug miss
        .mockResolvedValueOnce(null)  // slug re-check before create
      mockPrisma.$queryRaw.mockResolvedValue([]) // alias miss

      const created = {
        id: 'uuid-new',
        slug: 'new-exercise',
        nameRu: 'New Exercise',
        source: 'ai_generated',
      }
      mockPrisma.exercise.create.mockResolvedValue(created)

      const result = await resolveExercise({ slug: 'new-exercise', nameRu: 'New Exercise' })

      expect(result).toEqual({
        exerciseId: 'uuid-new',
        exercise: created,
        resolvedBy: 'auto-create',
      })
      expect(mockPrisma.exercise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'new-exercise',
          nameRu: 'New Exercise',
          source: 'ai_generated',
        }),
      })
    })

    it('returns existing exercise if slug taken during auto-create', async () => {
      const existing = { id: 'uuid-existing', slug: 'existing-ex', nameRu: 'Existing' }
      mockPrisma.exercise.findUnique
        .mockResolvedValueOnce(null)     // first slug miss
        .mockResolvedValueOnce(existing) // slug re-check before create → found
      mockPrisma.$queryRaw.mockResolvedValue([]) // alias miss

      const result = await resolveExercise({ slug: 'existing-ex', nameRu: 'Test' })

      expect(result.resolvedBy).toBe('slug')
      expect(result.exerciseId).toBe('uuid-existing')
      expect(mockPrisma.exercise.create).not.toHaveBeenCalled()
    })
  })
})
