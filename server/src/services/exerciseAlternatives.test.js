import { expect, it, vi, beforeEach } from 'vitest'
const mock = vi.hoisted(() => ({
  exercise: { findUnique: vi.fn(), findMany: vi.fn() },
  workoutSet: { groupBy: vi.fn() },
  program: { findFirst: vi.fn(), update: vi.fn() },
  workout: { findMany: vi.fn() },
  userProfile: { findUnique: vi.fn() },
}))
vi.mock('../utils/prisma.js', () => ({ default: mock }))
vi.mock('./exerciseCatalog.js', () => ({ exercisePopularity: async () => new Map() }))
import { rankAlternatives, findAlternatives, updateSlot, fillProgramAlternatives, makeMainHints } from './exerciseAlternatives.js'
beforeEach(() => {
  vi.resetAllMocks()
})

const ex = (id, nameRu, primaryMuscles, equipment, source = 'seed') => ({ id, nameRu, slug: id, primaryMuscles, equipment, category: 'isolation', source, targetMuscle: 'biceps' })
const curlMachine = ex('machine', 'Сгибания в тренажёре', ['biceps'], ['machine'])
const pool = [
  ex('db', 'Сгибания с гантелями', ['biceps'], ['dumbbell']),
  ex('cable', 'Сгибания на блоке', ['biceps'], ['cable']),
  ex('machine2', 'Сгибания в другом тренажёре', ['biceps'], ['machine']),
  ex('hammer', 'Молотки', ['biceps', 'forearms'], ['dumbbell']),
  ex('ai', 'Сгибания AI', ['biceps'], ['band'], 'ai_generated'),
]

it('ranks used exercises first among the same movement, then another gym tool', () => {
  const ranked = rankAlternatives(curlMachine, [curlMachine, ...pool], new Map([['hammer', 4], ['machine2', 1]]))
  // «Молотки» are done but not a «Сгибания» movement: history orders, never admits.
  expect(ranked.map(e => e.id)).toEqual(['machine2', 'cable', 'db', 'ai'])
  expect(ranked[0].usedCount).toBe(1)
})

it('queries exercises with the same target muscle and category and counts the user’s working sets', async () => {
  mock.exercise.findUnique.mockResolvedValue(curlMachine)
  mock.exercise.findMany.mockResolvedValue(pool)
  mock.workoutSet.groupBy.mockResolvedValue([{ exerciseId: 'cable', _count: { workoutId: 9 } }])
  const list = await findAlternatives('u1', 'machine', { limit: 2 })
  expect(mock.exercise.findMany.mock.calls[0][0].where).toEqual({
    id: { not: 'machine' }, category: 'isolation', targetMuscle: 'biceps',
    OR: [{ source: { not: 'user_created' } }, { createdByUserId: 'u1' }],
  })
  expect(mock.workoutSet.groupBy.mock.calls[0][0].where).toMatchObject({ isWarmup: false, workout: { userId: 'u1', finishedAt: { not: null } } })
  expect(list.map(e => e.id)).toEqual(['cable', 'db'])
})

it('returns nothing when the target muscle is unknown: better none than a wrong one', async () => {
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, targetMuscle: null })
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
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, id: 'press', slug: 'press' })
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

it('refreshes listed auto-filled slots, marks them, and a user choice clears the mark', async () => {
  const plan = program()
  plan.planJson.days[0].exercises[1].alternatives = ['old1', 'old2']
  mock.program.findFirst.mockResolvedValue(plan)
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, id: 'press', slug: 'press' })
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

it('refreshes every auto-filled slot with refreshAuto, leaving hand-picked ones', async () => {
  const plan = program()
  plan.planJson.days[0].exercises[0].alternativesAuto = false
  plan.planJson.days[0].exercises[1] = { ...plan.planJson.days[0].exercises[1], alternatives: ['old'], alternativesAuto: true }
  mock.program.findFirst.mockResolvedValue(plan)
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, id: 'press', slug: 'press' })
  mock.exercise.findMany.mockResolvedValue(pool)
  mock.workoutSet.groupBy.mockResolvedValue([])
  expect(await fillProgramAlternatives('u1', { perSlot: 1, refreshAuto: true })).toEqual({ filled: 1, slots: 2 })
  const saved = mock.program.update.mock.calls[0][0].data.planJson.days[0].exercises
  expect(saved[0].alternatives).toEqual(['db'])
  expect(saved[1].alternatives).toEqual(['cable'])
})

it('keeps the same movement within a target muscle, whatever else the user does', () => {
  const press = { ...ex('lp', 'Жим ногами', ['quadriceps'], ['machine']), category: 'compound' }
  const list = rankAlternatives(press, [
    { ...ex('lp2', 'Жим ногами в тренажёре Смита', ['quadriceps'], ['machine']), category: 'compound' },
    { ...ex('lunge', 'Болгарские выпады', ['quadriceps'], ['dumbbell']), category: 'compound' },
    { ...ex('goblet', 'Гоблет-приседания', ['quadriceps'], ['kettlebells']), category: 'compound' },
  ], new Map([['goblet', 2]]))
  expect(list.map(e => e.id)).toEqual(['lp2'])
  // Tool words are not the movement.
  const thrust = { ...ex('t', 'Ягодичный мостик со штангой', ['glutes'], ['barbell']), category: 'compound' }
  expect(rankAlternatives(thrust, [
    { ...ex('sq', 'Коленный присед со штангой', ['glutes'], ['barbell']), category: 'compound' },
    { ...ex('ball', 'Ягодичный мостик на фитболе', ['glutes'], ['exercise ball']), category: 'compound' },
  ]).map(e => e.id)).toEqual(['ball'])
  // Nothing with the same movement: the whole target group stays.
  const curl = ex('c', 'Сгибания в тренажёре', ['biceps'], ['machine'])
  expect(rankAlternatives(curl, [ex('h', 'Молотки', ['biceps'], ['dumbbell'])]).map(e => e.id)).toEqual(['h'])
})

it('does not trust the default kind of exercises created outside the catalog', async () => {
  mock.exercise.findUnique.mockResolvedValue({ ...curlMachine, source: 'ai_generated' })
  mock.exercise.findMany.mockResolvedValue([])
  await findAlternatives('u1', 'machine')
  expect(mock.exercise.findMany.mock.calls[0][0].where.category).toEqual({ in: ['compound', 'isolation'] })
})

it('keeps the same movement pattern when the catalog knows it', () => {
  const press = { ...ex('machine-press', 'Жим от груди в тренажёре', ['chest'], ['machine']), movementPattern: 'horizontal_push' }
  const pool = [
    { ...ex('db-press', 'Жим гантелей лёжа', ['chest'], ['dumbbell']), movementPattern: 'horizontal_push' },
    { ...ex('fly', 'Сведение рук в тренажёре', ['chest'], ['machine']), movementPattern: 'chest_fly' },
    { ...ex('pushup', 'Отжимания', ['chest'], ['body only']), movementPattern: 'horizontal_push' },
  ]
  expect(rankAlternatives(press, pool).map(e => e.id).sort()).toEqual(['db-press', 'pushup'])
})

it('does not offer alternatives that load the user’s injured joints', async () => {
  mock.exercise.findUnique.mockResolvedValue(curlMachine)
  mock.exercise.findMany.mockResolvedValue([
    { ...pool[0], jointStress: ['elbow'] },
    { ...pool[1], jointStress: [] },
  ])
  mock.workoutSet.groupBy.mockResolvedValue([])
  mock.userProfile.findUnique.mockResolvedValue({ constraints: ['elbow'] })
  expect((await findAlternatives('u1', 'machine')).map(e => e.id)).toEqual(['cable'])
})

const swap = (id, nameRu, extra = {}) => ({ id, nameRu, slug: id, primaryMuscles: ['lats'], equipment: ['cable'], category: 'compound', source: 'seed',
  targetMuscle: 'lats', movementPattern: 'vertical_pull', trackingType: 'weight_reps', difficulty: 'beginner', isCore: true, ...extra })

it('puts the catalog core above rare variations and keeps swaps not much harder', () => {
  const gravitron = swap('gravitron', 'Подтягивания в гравитроне', { equipment: ['machine'], trackingType: 'assisted_bodyweight' })
  const ranked = rankAlternatives(gravitron, [
    swap('one-arm', 'Подтягивание на одной руке', { equipment: ['body only'], trackingType: 'bodyweight_reps', difficulty: 'advanced', isCore: false }),
    swap('pulldown', 'Тяга верхнего блока широким хватом'),
    swap('pullup', 'Подтягивания', { equipment: ['body only'], trackingType: 'bodyweight_reps', difficulty: 'intermediate' }),
  ])
  expect(ranked.map(e => e.id).at(-1)).toBe('one-arm')
})

it('does not offer timed holds for rep exercises ahead of rep ones', () => {
  const plank = swap('plank', 'Планка', { primaryMuscles: ['abdominals'], equipment: ['body only'], movementPattern: 'core_stability', trackingType: 'duration', targetMuscle: 'abdominals' })
  const ranked = rankAlternatives(plank, [
    swap('deadbug', 'Мёртвый жук', { primaryMuscles: ['abdominals'], equipment: ['body only'], movementPattern: 'core_stability', trackingType: 'bodyweight_reps', targetMuscle: 'abdominals' }),
    swap('hollow', 'Удержание лодочки', { primaryMuscles: ['abdominals'], equipment: ['body only'], movementPattern: 'core_stability', trackingType: 'duration', targetMuscle: 'abdominals' }),
  ])
  expect(ranked[0].id).toBe('hollow')
})

it('queries by target muscle and movement pattern, not by compound/isolation', async () => {
  mock.exercise.findUnique.mockResolvedValue(swap('thrust', 'Хип-траст со штангой', { targetMuscle: 'glutes', movementPattern: 'hip_extension' }))
  mock.exercise.findMany.mockResolvedValue([])
  await findAlternatives('u1', 'thrust')
  expect(mock.exercise.findMany.mock.calls[0][0].where).toEqual({
    id: { not: 'thrust' }, targetMuscle: 'glutes', movementPattern: 'hip_extension',
    OR: [{ source: { not: 'user_created' } }, { createdByUserId: 'u1' }],
  })
})

it('prefers what more people do among otherwise equal swaps', () => {
  const pullup = swap('pullup', 'Подтягивания', { equipment: ['body only'], trackingType: 'bodyweight_reps' })
  const ranked = rankAlternatives(pullup, [
    swap('one-arm-pd', 'Тяга верхнего блока одной рукой'),
    swap('reverse-pd', 'Тяга верхнего блока обратным хватом'),
    swap('wide-pd', 'Тяга верхнего блока широким хватом', { popularity: 3 }),
  ])
  expect(ranked[0].id).toBe('wide-pd')
})
