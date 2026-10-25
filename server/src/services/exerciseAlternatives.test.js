import { expect, it, vi, beforeEach } from 'vitest'
const mock = vi.hoisted(() => ({
  exercise: { findUnique: vi.fn(), findMany: vi.fn() },
  workoutSet: { groupBy: vi.fn() },
  program: { findFirst: vi.fn(), update: vi.fn() },
  workout: { findMany: vi.fn() },
}))
vi.mock('../utils/prisma.js', () => ({ default: mock }))
import { rankAlternatives, findAlternatives, updateSlot, fillProgramAlternatives, makeMainHints } from './exerciseAlternatives.js'
beforeEach(() => vi.resetAllMocks())

const ex = (id, nameRu, primaryMuscles, equipment, source = 'seed') => ({ id, nameRu, slug: id, primaryMuscles, equipment, category: 'isolation', source })
const curlMachine = ex('machine', 'Сгибания в тренажёре', ['biceps'], ['machine'])
const pool = [
  ex('db', 'Сгибания с гантелями', ['biceps'], ['dumbbell']),
  ex('cable', 'Сгибания на блоке', ['biceps'], ['cable']),
  ex('machine2', 'Сгибания в другом тренажёре', ['biceps'], ['machine']),
  ex('hammer', 'Молотки', ['biceps', 'forearms'], ['dumbbell']),
  ex('ai', 'Сгибания AI', ['biceps'], ['band'], 'ai_generated'),
]

it('ranks used exercises first, then the same movement with another gym tool', () => {
  const ranked = rankAlternatives(curlMachine, [curlMachine, ...pool], new Map([['hammer', 4]]))
  // Same "Сгибания" movement and muscles: cable/dumbbells (another tool) > another machine > a band.
  expect(ranked.map(e => e.id)).toEqual(['hammer', 'cable', 'db', 'machine2', 'ai'])
  expect(ranked[0].usedCount).toBe(4)
})

it('queries the same main muscle and category and counts the user’s finished working sets', async () => {
  mock.exercise.findUnique.mockResolvedValue(curlMachine)
  mock.exercise.findMany.mockResolvedValue(pool)
  mock.workoutSet.groupBy.mockResolvedValue([{ exerciseId: 'cable', _count: { workoutId: 9 } }])
  const list = await findAlternatives('u1', 'machine', { limit: 2 })
  expect(mock.exercise.findMany.mock.calls[0][0].where).toEqual({ id: { not: 'machine' }, category: 'isolation', primaryMuscles: { has: 'biceps' } })
  expect(mock.workoutSet.groupBy.mock.calls[0][0].where).toMatchObject({ isWarmup: false, workout: { userId: 'u1', finishedAt: { not: null } } })
  expect(list.map(e => e.id)).toEqual(['cable', 'db'])
})

it('returns nothing for an exercise without muscles', async () => {
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, primaryMuscles: [] })
  expect(await findAlternatives('u1', 'machine')).toEqual([])
  expect(mock.exercise.findMany).not.toHaveBeenCalled()
})

const program = () => ({ id: 'p1', planJson: { days: [{ title: 'A', exercises: [
  { exerciseId: 'machine', nameRu: 'Сгибания в тренажёре', slug: 'machine', alternatives: ['db'] },
  { exerciseId: 'press', nameRu: 'Жим', slug: 'press', alternatives: [] },
] }] } })

it('remembers a chosen alternative without changing the main exercise', async () => {
  mock.program.findFirst.mockResolvedValue(program())
  const slot = await updateSlot('u1', { dayIndex: 0, mainExerciseId: 'machine', exerciseId: 'cable', makeMain: false })
  expect(slot).toMatchObject({ exerciseId: 'machine', alternatives: ['db', 'cable'] })
  expect(mock.program.update.mock.calls[0][0].data.planJson.days[0].exercises[0].alternatives).toEqual(['db', 'cable'])
})

it('makes an alternative main and keeps the old main as the first alternative', async () => {
  mock.program.findFirst.mockResolvedValue(program())
  mock.exercise.findUnique.mockResolvedValue({ id: 'db', nameRu: 'Сгибания с гантелями', slug: 'db' })
  const slot = await updateSlot('u1', { dayIndex: 0, mainExerciseId: 'machine', exerciseId: 'db', makeMain: true })
  expect(slot).toMatchObject({ exerciseId: 'db', nameRu: 'Сгибания с гантелями', slug: 'db', alternatives: ['machine'] })
})

it('returns null for an unknown slot and does not save', async () => {
  mock.program.findFirst.mockResolvedValue(program())
  expect(await updateSlot('u1', { dayIndex: 0, mainExerciseId: 'missing', exerciseId: 'db' })).toBeNull()
  expect(await updateSlot('u1', { dayIndex: 3, mainExerciseId: 'machine', exerciseId: 'db' })).toBeNull()
  expect(mock.program.update).not.toHaveBeenCalled()
})

it('fills only slots without alternatives, once per exercise', async () => {
  mock.program.findFirst.mockResolvedValue(program())
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, id: 'press' })
  mock.exercise.findMany.mockResolvedValue(pool)
  mock.workoutSet.groupBy.mockResolvedValue([])
  expect(await fillProgramAlternatives('u1', { perSlot: 2 })).toEqual({ filled: 1, slots: 2 })
  const saved = mock.program.update.mock.calls[0][0].data.planJson.days[0].exercises
  expect(saved[0].alternatives).toEqual(['db'])
  expect(saved[1].alternatives).toHaveLength(2)
})

it('suggests making an alternative main after two workouts with it and without the main', async () => {
  const plan = [{ exerciseId: 'machine', alternatives: ['db', 'cable'] }, { exerciseId: 'press', alternatives: ['dbpress'] }]
  mock.workout.findMany.mockResolvedValue([
    { sets: [{ exerciseId: 'cable' }, { exerciseId: 'press' }] },
    { sets: [{ exerciseId: 'cable' }, { exerciseId: 'dbpress' }] },
  ])
  const hints = await makeMainHints('u1', 'p1', 0, plan)
  expect([...hints]).toEqual([['machine', 'cable']])
  expect(mock.workout.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'u1', programId: 'p1', programDayIndex: 0, finishedAt: { not: null } }, take: 2 })
  mock.workout.findMany.mockResolvedValue([{ sets: [{ exerciseId: 'cable' }] }])
  expect((await makeMainHints('u1', 'p1', 0, plan)).size).toBe(0)
})

it('drops stretches and duplicate names, and varies tools at the top', () => {
  const target = ex('t', 'Разгибание рук на блоке', ['triceps'], ['cable'])
  const list = rankAlternatives(target, [
    ex('c1', 'Разгибание рук на блоке с канатом', ['triceps'], ['cable']),
    ex('c2', 'Разгибание рук на верхнем блоке', ['triceps'], ['cable']),
    ex('c3', 'Разгибание рук на блоке обратным хватом', ['triceps'], ['cable']),
    ex('d1', 'Разгибание рук с гантелью', ['triceps'], ['dumbbell']),
    ex('d2', 'Разгибание рук с гантелью', ['triceps'], ['dumbbell']),
    ex('s', 'Растяжка трицепса', ['triceps'], ['body only']),
  ])
  expect(list.map(e => e.id)).toEqual(['c3', 'c1', 'd1', 'c2'])
})

it('drops foam-roll release, partner drills and the other side of a unilateral exercise', () => {
  const target = ex('row', 'Тяга гантели одной рукой в наклоне', ['middle back'], ['dumbbell'])
  const list = rankAlternatives({ ...target, category: 'compound' }, [
    { ...ex('l', 'Тяга гантели в наклоне (левая)', ['middle back'], ['dumbbell']), category: 'compound' },
    { ...ex('r', 'Тяга гантели в наклоне (правая)', ['middle back'], ['dumbbell']), category: 'compound' },
    { ...ex('mfr', 'МФР широчайших мышц спины', ['middle back'], ['foam roll']), category: 'compound' },
    { ...ex('p', 'Тяга с партнёром', ['middle back'], ['body only']), category: 'compound' },
  ])
  expect(list.map(e => e.id)).toEqual(['l'])
})

it('keeps the movement for compound swaps; tool words do not count as movement', () => {
  const press = { ...ex('press', 'Жим гантелей сидя', ['shoulders'], ['dumbbell']), category: 'compound' }
  const pressList = rankAlternatives(press, [
    { ...ex('stand', 'Жим гантелей стоя', ['shoulders'], ['dumbbell']), category: 'compound' },
    { ...ex('face', 'Тяга к лицу (фейс-пул)', ['shoulders'], ['cable']), category: 'compound' },
  ])
  expect(pressList.map(e => e.id)).toEqual(['stand'])
  const thrust = { ...ex('thrust', 'Ягодичный мостик со штангой', ['glutes'], ['barbell']), category: 'compound' }
  const thrustList = rankAlternatives(thrust, [
    { ...ex('squat', 'Коленный присед со штангой', ['glutes'], ['barbell']), category: 'compound' },
    { ...ex('ball', 'Ягодичный мостик на фитболе', ['glutes'], ['exercise ball']), category: 'compound' },
  ])
  expect(thrustList.map(e => e.id)).toEqual(['ball'])
})

it('refreshes listed auto-filled slots, marks them, and a user choice clears the mark', async () => {
  const plan = program()
  plan.planJson.days[0].exercises[1].alternatives = ['old1', 'old2']
  mock.program.findFirst.mockResolvedValue(plan)
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, id: 'press' })
  mock.exercise.findMany.mockResolvedValue(pool)
  mock.workoutSet.groupBy.mockResolvedValue([])
  expect(await fillProgramAlternatives('u1', { perSlot: 2, replace: [{ dayIndex: 0, exerciseId: 'press' }] })).toEqual({ filled: 1, slots: 2 })
  const saved = mock.program.update.mock.calls[0][0].data.planJson.days[0].exercises
  expect(saved[0]).toMatchObject({ alternatives: ['db'] })
  expect(saved[0].alternativesAuto).toBeUndefined()
  expect(saved[1]).toMatchObject({ alternatives: ['cable', 'db'], alternativesAuto: true })

  mock.program.findFirst.mockResolvedValue({ id: 'p1', planJson: { days: [{ exercises: [{ ...saved[1] }] }] } })
  const slot = await updateSlot('u1', { dayIndex: 0, mainExerciseId: 'press', exerciseId: 'x' })
  expect(slot.alternativesAuto).toBe(false)
})
