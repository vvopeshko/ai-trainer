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
// LLM matching is its own module (exerciseMatcher.test.js); here it answers nothing by default.
const matcher = vi.hoisted(() => ({ matchUnknownExercises: vi.fn(async () => new Map()), forgetCatalog: vi.fn() }))
vi.mock('./exerciseMatcher.js', () => matcher)

const { resolveExercise, resolveExercisesBatch } = await import('./exerciseResolver.js')

describe('exerciseResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matcher.matchUnknownExercises.mockImplementation(async () => new Map())
    mockPrisma.exercise.update = vi.fn(async ({ data }) => ({ id: 'seed-1', slug: 'incline-bench-db', aliases: data.aliases.push }))
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

    it('matches ignoring case and ё, with a fixed order for shared aliases', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null)
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'uuid-4', slug: 'bench-press' }])

      await resolveExercise({ nameRu: '  Жим Лёжа ' })

      const [strings, ...values] = mockPrisma.$queryRaw.mock.calls[0]
      expect(values.every(v => v === 'жим лежа')).toBe(true)
      expect(strings.join('?')).toMatch(/ORDER BY[\s\S]*source = 'seed'[\s\S]*"createdAt", id\s+LIMIT 1/)
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

  describe('LLM match before creating', () => {
    it('takes the catalog exercise the matcher recognised and remembers the name as an alias', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null)
      mockPrisma.$queryRaw.mockResolvedValue([])
      const known = { id: 'seed-1', slug: 'incline-bench-db', nameRu: 'Жим гантелей на наклонной', nameEn: null, aliases: ['жим на наклонной'] }
      matcher.matchUnknownExercises.mockResolvedValue(new Map([['1', { match: known }]]))

      const result = await resolveExercise({ slug: 'incline-db-press', nameRu: 'Жим гантелей под углом' })

      expect(result).toMatchObject({ exerciseId: 'seed-1', resolvedBy: 'match' })
      expect(mockPrisma.exercise.update).toHaveBeenCalledWith({
        where: { id: 'seed-1' }, data: { aliases: { push: ['жим гантелей под углом', 'incline-db-press'] } },
      })
      expect(mockPrisma.exercise.upsert).not.toHaveBeenCalled()
    })

    it('creates a new exercise classified by the matcher', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null)
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.exercise.upsert.mockImplementation(async ({ create }) => ({ id: 'new', ...create }))
      matcher.matchUnknownExercises.mockResolvedValue(new Map([['1', { fields: {
        nameRu: 'Пулловер в тренажёре', nameEn: 'Machine Pullover', primaryMuscles: ['lats'], secondaryMuscles: ['chest'],
        equipment: 'machine', category: 'isolation', targetMuscle: 'lats', force: 'pull', unilateral: false,
      } }]]))

      const result = await resolveExercise({ nameRu: 'пуловер на тренажере' })

      expect(result.resolvedBy).toBe('auto-create')
      expect(mockPrisma.exercise.upsert.mock.calls[0][0].create).toMatchObject({
        slug: 'machine-pullover', nameRu: 'Пулловер в тренажёре', nameEn: 'Machine Pullover',
        primaryMuscles: ['lats'], equipment: ['machine'], category: 'isolation', targetMuscle: 'lats',
        force: 'pull', unilateral: false, aliases: ['пуловер на тренажере'], source: 'ai_generated',
      })
    })

    it('asks the matcher once per batch, only for what was not found exactly', async () => {
      mockPrisma.exercise.findUnique.mockImplementation(async ({ where }) => (where.slug === 'known' ? { id: 'k', slug: 'known' } : null))
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.exercise.upsert.mockImplementation(async ({ create }) => ({ id: create.slug, ...create }))

      const results = await resolveExercisesBatch([{ slug: 'known' }, { slug: 'new-a' }, { slug: 'new-b' }])

      expect(matcher.matchUnknownExercises).toHaveBeenCalledTimes(1)
      expect(matcher.matchUnknownExercises.mock.calls[0][0].map(([key]) => key)).toEqual(['new-a', 'new-b'])
      expect(results.get('known').resolvedBy).toBe('slug')
      expect(results.get('new-a').resolvedBy).toBe('auto-create')
    })

    it('does not create anything when the lookup itself failed', async () => {
      mockPrisma.exercise.findUnique.mockRejectedValue(new Error('db down'))

      const results = await resolveExercisesBatch([{ slug: 'whatever' }])

      expect(results.get('whatever')).toBeNull()
      expect(matcher.matchUnknownExercises.mock.calls[0][0]).toEqual([])
      expect(mockPrisma.exercise.upsert).not.toHaveBeenCalled()
    })
  })
})
