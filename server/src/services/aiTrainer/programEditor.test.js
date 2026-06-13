import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем зависимости с побочными эффектами (БД, резолв). Тестируем чистую
// логику editDayExercises на образце дня программы.
const findUnique = vi.fn()
vi.mock('../../utils/prisma.js', () => ({
  default: { exercise: { findUnique: (...a) => findUnique(...a) } },
}))

const resolveExerciseReadonly = vi.fn()
vi.mock('./chatTools.js', () => ({
  resolveExerciseReadonly: (...a) => resolveExerciseReadonly(...a),
}))

const { editDayExercises } = await import('./programEditor.js')

const ID_BENCH = '11111111-1111-1111-1111-111111111111'
const ID_FLY = '22222222-2222-2222-2222-222222222222'
const ID_CROSS = '33333333-3333-3333-3333-333333333333'
const ID_PUSHUP = '44444444-4444-4444-4444-444444444444'

function sampleDay() {
  return [
    { exerciseId: ID_BENCH, slug: 'bench-press-db', nameRu: 'Жим гантелей лёжа', sets: 4, repsMin: 8, repsMax: 10, restSec: 120 },
    { exerciseId: ID_FLY, slug: 'pec-fly', nameRu: 'Сведение в бабочке', sets: 3, repsMin: 12, repsMax: 15, restSec: 60 },
  ]
}

beforeEach(() => {
  findUnique.mockReset()
  resolveExerciseReadonly.mockReset()
})

describe('editDayExercises', () => {
  it('replace: меняет упражнение, сохраняя подходы/повторы/отдых', async () => {
    findUnique.mockResolvedValue({ id: ID_CROSS, slug: 'standing-cable-crossover', nameRu: 'Кроссовер стоя' })

    const { exercises, summary } = await editDayExercises(sampleDay(), 'replace', {
      fromExercise: 'Сведение в бабочке',
      toExerciseId: ID_CROSS,
    })

    expect(exercises).toHaveLength(2)
    const replaced = exercises[1]
    expect(replaced.exerciseId).toBe(ID_CROSS)
    expect(replaced.nameRu).toBe('Кроссовер стоя')
    // подходы/повторы/отдых унаследованы от старого
    expect(replaced.sets).toBe(3)
    expect(replaced.repsMin).toBe(12)
    expect(replaced.repsMax).toBe(15)
    expect(replaced.restSec).toBe(60)
    expect(replaced.alternatives).toEqual([])
    expect(summary).toContain('Кроссовер стоя')
    // первое упражнение не тронуто
    expect(exercises[0].exerciseId).toBe(ID_BENCH)
  })

  it('replace: резолвит по имени через resolveExerciseReadonly если нет toExerciseId', async () => {
    resolveExerciseReadonly.mockResolvedValue({ id: ID_CROSS, slug: 'standing-cable-crossover', nameRu: 'Кроссовер стоя' })

    const { exercises } = await editDayExercises(sampleDay(), 'replace', {
      fromExercise: 'pec-fly',
      toExercise: 'кроссовер',
    })

    expect(resolveExerciseReadonly).toHaveBeenCalledWith('кроссовер')
    expect(exercises[1].exerciseId).toBe(ID_CROSS)
  })

  it('adjust: меняет только переданные поля', async () => {
    const { exercises, summary } = await editDayExercises(sampleDay(), 'adjust', {
      exercise: 'Жим гантелей лёжа',
      sets: 5,
      restSec: 90,
    })

    expect(exercises[0].sets).toBe(5)
    expect(exercises[0].restSec).toBe(90)
    // не переданные — без изменений
    expect(exercises[0].repsMin).toBe(8)
    expect(exercises[0].repsMax).toBe(10)
    expect(summary).toContain('Жим гантелей лёжа')
  })

  it('add: добавляет новое упражнение с дефолтами', async () => {
    findUnique.mockResolvedValue({ id: ID_PUSHUP, slug: 'push-up', nameRu: 'Отжимания' })

    const { exercises } = await editDayExercises(sampleDay(), 'add', {
      toExerciseId: ID_PUSHUP,
      sets: 3,
      repsMin: 10,
      repsMax: 15,
    })

    expect(exercises).toHaveLength(3)
    const added = exercises[2]
    expect(added.exerciseId).toBe(ID_PUSHUP)
    expect(added.restSec).toBe(90) // дефолт
    expect(added.alternatives).toEqual([])
  })

  it('remove: убирает упражнение из дня', async () => {
    const { exercises, summary } = await editDayExercises(sampleDay(), 'remove', {
      exercise: 'pec-fly',
    })

    expect(exercises).toHaveLength(1)
    expect(exercises[0].exerciseId).toBe(ID_BENCH)
    expect(summary).toContain('Сведение в бабочке')
  })

  it('не находит целевое упражнение → ошибка', async () => {
    await expect(
      editDayExercises(sampleDay(), 'remove', { exercise: 'присед' }),
    ).rejects.toThrow(/не найдено/)
  })

  it('new упражнение не в каталоге (по id) → ошибка, без auto-create', async () => {
    findUnique.mockResolvedValue(null)

    await expect(
      editDayExercises(sampleDay(), 'replace', {
        fromExercise: 'pec-fly',
        toExerciseId: 'missing-id',
      }),
    ).rejects.toThrow(/не найдено в каталоге/)
  })

  it('new упражнение не резолвится по имени → ошибка с подсказкой искать', async () => {
    resolveExerciseReadonly.mockResolvedValue(null)

    await expect(
      editDayExercises(sampleDay(), 'add', {
        toExercise: 'несуществующее',
        sets: 3,
        repsMin: 8,
        repsMax: 12,
      }),
    ).rejects.toThrow(/search_exercises/)
  })

  it('не мутирует входной массив', async () => {
    const input = sampleDay()
    await editDayExercises(input, 'remove', { exercise: 'pec-fly' })
    expect(input).toHaveLength(2)
  })
})
