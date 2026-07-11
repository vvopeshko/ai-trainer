import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем зависимости с побочными эффектами (БД, резолв). Тестируем чистую
// логику editDayExercises на образце дня программы + оркестратор applyProgramEdit
// (транзакция с оптимистичной блокировкой) и computeNextDayIndex на моке prisma.
const findUnique = vi.fn()
const programFindFirst = vi.fn()
const programUpdateMany = vi.fn()
const workoutFindFirst = vi.fn()
const overrideFindUnique = vi.fn()
const overrideUpsert = vi.fn()

// $transaction(fn) — interactive: отдаём fn тот же мок в роли tx.
const prismaMock = {
  exercise: { findUnique: (...a) => findUnique(...a) },
  program: {
    findFirst: (...a) => programFindFirst(...a),
    updateMany: (...a) => programUpdateMany(...a),
  },
  workout: { findFirst: (...a) => workoutFindFirst(...a) },
  workoutPlanOverride: {
    findUnique: (...a) => overrideFindUnique(...a),
    upsert: (...a) => overrideUpsert(...a),
  },
  $transaction: (fn) => fn(prismaMock),
}
vi.mock('../../utils/prisma.js', () => ({ default: prismaMock }))

const resolveExerciseReadonly = vi.fn()
vi.mock('./chatTools.js', () => ({
  resolveExerciseReadonly: (...a) => resolveExerciseReadonly(...a),
}))

const { editDayExercises, applyProgramEdit, computeNextDayIndex } = await import('./programEditor.js')

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
  programFindFirst.mockReset()
  programUpdateMany.mockReset()
  workoutFindFirst.mockReset()
  overrideFindUnique.mockReset()
  overrideUpsert.mockReset()
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

  it('add: упражнение уже есть в дне → ошибка-подсказка, без дубля', async () => {
    findUnique.mockResolvedValue({ id: ID_FLY, slug: 'pec-fly', nameRu: 'Сведение в бабочке' })

    await expect(
      editDayExercises(sampleDay(), 'add', {
        toExerciseId: ID_FLY,
        sets: 3,
        repsMin: 12,
        repsMax: 15,
      }),
    ).rejects.toThrow(/уже есть в этом дне/)
  })

  it('add: дубль ловится и по slug (другой id, тот же slug)', async () => {
    findUnique.mockResolvedValue({ id: ID_PUSHUP, slug: 'PEC-FLY', nameRu: 'Сведение в бабочке' })

    await expect(
      editDayExercises(sampleDay(), 'add', {
        toExerciseId: ID_PUSHUP,
        sets: 3,
        repsMin: 12,
        repsMax: 15,
      }),
    ).rejects.toThrow(/уже есть в этом дне/)
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

describe('applyProgramEdit', () => {
  const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const UPDATED_AT = new Date('2026-07-01T10:00:00Z')

  function sampleProgram() {
    return {
      id: PROGRAM_ID,
      updatedAt: UPDATED_AT,
      planJson: {
        name: 'PPL',
        days: [
          { title: 'Push', exercises: sampleDay() },
          { title: 'Pull', exercises: [] },
        ],
      },
    }
  }

  it('scope program: пишет условным updateMany по updatedAt (защита от lost update)', async () => {
    programFindFirst.mockResolvedValue(sampleProgram())
    programUpdateMany.mockResolvedValue({ count: 1 })

    const out = await applyProgramEdit({
      userId: USER_ID,
      scope: 'program',
      dayIndex: 0,
      op: 'remove',
      params: { exercise: 'pec-fly' },
    })

    expect(out).toMatchObject({ scope: 'program', dayIndex: 0, dayTitle: 'Push' })
    expect(out.summary).toContain('Сведение в бабочке')

    expect(programUpdateMany).toHaveBeenCalledTimes(1)
    const arg = programUpdateMany.mock.calls[0][0]
    // условие по updatedAt — параллельная правка не затрётся молча
    expect(arg.where).toEqual({ id: PROGRAM_ID, updatedAt: UPDATED_AT })
    expect(arg.data.planJson.days[0].exercises).toHaveLength(1)
    // соседний день не тронут
    expect(arg.data.planJson.days[1]).toEqual({ title: 'Pull', exercises: [] })
  })

  it('scope program: конфликт (count 0) → ошибка «повтори», не молчаливая потеря', async () => {
    programFindFirst.mockResolvedValue(sampleProgram())
    programUpdateMany.mockResolvedValue({ count: 0 })

    await expect(
      applyProgramEdit({
        userId: USER_ID,
        scope: 'program',
        dayIndex: 0,
        op: 'remove',
        params: { exercise: 'pec-fly' },
      }),
    ).rejects.toThrow(/параллельно/)
  })

  it('scope next: апсертит оверрайд, программу не трогает', async () => {
    programFindFirst.mockResolvedValue(sampleProgram())
    overrideFindUnique.mockResolvedValue(null)
    overrideUpsert.mockResolvedValue({})

    const out = await applyProgramEdit({
      userId: USER_ID,
      scope: 'next',
      dayIndex: 0,
      op: 'remove',
      params: { exercise: 'pec-fly' },
    })

    expect(out.scope).toBe('next')
    expect(programUpdateMany).not.toHaveBeenCalled()
    const arg = overrideUpsert.mock.calls[0][0]
    expect(arg.where).toEqual({
      userId_programId_dayIndex: { userId: USER_ID, programId: PROGRAM_ID, dayIndex: 0 },
    })
    expect(arg.create.exercises).toHaveLength(1)
  })

  it('scope next: базой служит существующий оверрайд, а не шаблон дня', async () => {
    programFindFirst.mockResolvedValue(sampleProgram())
    // В оверрайде уже убрали бабочку — остался один жим.
    overrideFindUnique.mockResolvedValue({ exercises: [sampleDay()[0]] })
    overrideUpsert.mockResolvedValue({})

    const out = await applyProgramEdit({
      userId: USER_ID,
      scope: 'next',
      dayIndex: 0,
      op: 'adjust',
      params: { exercise: 'bench-press-db', sets: 5 },
    })

    expect(out.summary).toContain('Жим гантелей лёжа')
    const arg = overrideUpsert.mock.calls[0][0]
    expect(arg.update.exercises).toHaveLength(1)
    expect(arg.update.exercises[0].sets).toBe(5)
  })

  it('нет активной программы → ошибка', async () => {
    programFindFirst.mockResolvedValue(null)

    await expect(
      applyProgramEdit({ userId: USER_ID, scope: 'program', dayIndex: 0, op: 'remove', params: {} }),
    ).rejects.toThrow(/нет активной программы/)
  })

  it('dayIndex вне диапазона → ошибка с подсказкой диапазона', async () => {
    programFindFirst.mockResolvedValue(sampleProgram())

    await expect(
      applyProgramEdit({ userId: USER_ID, scope: 'program', dayIndex: 5, op: 'remove', params: {} }),
    ).rejects.toThrow(/0\.\.1/)
  })

  it('некорректный scope → ошибка', async () => {
    await expect(
      applyProgramEdit({ userId: USER_ID, scope: 'all', dayIndex: 0, op: 'remove', params: {} }),
    ).rejects.toThrow(/scope/)
  })
})

describe('computeNextDayIndex', () => {
  const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  it('нет завершённых тренировок → день 0', async () => {
    workoutFindFirst.mockResolvedValue(null)
    expect(await computeNextDayIndex(USER_ID, PROGRAM_ID, 3)).toBe(0)
  })

  it('последняя тренировка +1', async () => {
    workoutFindFirst.mockResolvedValue({ programDayIndex: 1 })
    expect(await computeNextDayIndex(USER_ID, PROGRAM_ID, 3)).toBe(2)
  })

  it('после последнего дня цикл заворачивается на 0', async () => {
    workoutFindFirst.mockResolvedValue({ programDayIndex: 2 })
    expect(await computeNextDayIndex(USER_ID, PROGRAM_ID, 3)).toBe(0)
  })

  it('0 дней в программе → 0 без запроса в БД', async () => {
    expect(await computeNextDayIndex(USER_ID, PROGRAM_ID, 0)).toBe(0)
    expect(workoutFindFirst).not.toHaveBeenCalled()
  })
})
