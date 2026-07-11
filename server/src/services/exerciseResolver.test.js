import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockPrisma = {
  exercise: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  $queryRaw: vi.fn(),
}

vi.mock('../utils/prisma.js', () => ({ default: mockPrisma }))

const { resolveExercise, resolveExercisesBatch } = await import('./exerciseResolver.js')

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
    it('creates exercise via upsert when not found by slug or alias', async () => {
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
      mockPrisma.exercise.upsert.mockResolvedValue(created)

      const result = await resolveExercise({ slug: 'new-exercise', nameRu: 'New Exercise' })

      expect(result).toEqual({
        exerciseId: 'uuid-new',
        exercise: created,
        resolvedBy: 'auto-create',
      })
      // upsert по slug (не check-then-create): гонка параллельных резолвов
      // одного имени не роняет P2002, а возвращает существующую запись
      expect(mockPrisma.exercise.upsert).toHaveBeenCalledWith({
        where: { slug: 'new-exercise' },
        update: {},
        create: expect.objectContaining({
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
      expect(mockPrisma.exercise.upsert).not.toHaveBeenCalled()
    })

    it('transliterates cyrillic names into a slug (Жим лёжа → zhim-lezha)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null)
      mockPrisma.$queryRaw.mockResolvedValue([])
      const created = { id: 'uuid-ru', slug: 'zhim-lezha', nameRu: 'Жим лёжа' }
      mockPrisma.exercise.upsert.mockResolvedValue(created)

      const result = await resolveExercise({ nameRu: 'Жим лёжа' })

      expect(result.resolvedBy).toBe('auto-create')
      expect(mockPrisma.exercise.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'zhim-lezha' } }),
      )
    })

    it('returns null instead of creating exercise with empty slug', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null)
      mockPrisma.$queryRaw.mockResolvedValue([])

      // Только пунктуация/эмодзи → slugify даёт '' → защита каталога
      const result = await resolveExercise({ nameRu: '💪 !!!' })

      expect(result).toBeNull()
      expect(mockPrisma.exercise.upsert).not.toHaveBeenCalled()
    })
  })

  describe('resolveExercisesBatch', () => {
    it('deduplicates inputs and resolves each unique exercise once', async () => {
      const exercise = { id: 'uuid-1', slug: 'bench-press', nameRu: 'Жим лёжа' }
      mockPrisma.exercise.findUnique.mockResolvedValue(exercise)

      const results = await resolveExercisesBatch([
        { slug: 'bench-press', nameRu: 'Жим лёжа' },
        { slug: 'bench-press' }, // дубликат — не должен дать второй запрос
      ])

      expect(results.size).toBe(1)
      expect(results.get('bench-press').exerciseId).toBe('uuid-1')
      expect(mockPrisma.exercise.findUnique).toHaveBeenCalledTimes(1)
    })

    it('maps failed resolves to null without rejecting the whole batch', async () => {
      const exercise = { id: 'uuid-1', slug: 'bench-press', nameRu: 'Жим лёжа' }
      mockPrisma.exercise.findUnique
        .mockResolvedValueOnce(exercise)              // bench-press → ok
        .mockRejectedValueOnce(new Error('db down'))  // broken → упал
      mockPrisma.$queryRaw.mockResolvedValue([])

      const results = await resolveExercisesBatch([
        { slug: 'bench-press' },
        { slug: 'broken-slug' },
      ])

      expect(results.get('bench-press').exerciseId).toBe('uuid-1')
      expect(results.get('broken-slug')).toBeNull()
    })

    it('skips entries without any usable key', async () => {
      const results = await resolveExercisesBatch([{}, { slug: '' }])

      expect(results.size).toBe(0)
      expect(mockPrisma.exercise.findUnique).not.toHaveBeenCalled()
    })
  })
})
