import { describe, expect, it, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => ({
  prisma: { exercise: { findMany: vi.fn() } },
  chat: vi.fn(),
}))
vi.mock('../utils/prisma.js', () => ({ default: mock.prisma }))
vi.mock('../utils/llm.js', () => ({ chat: mock.chat }))

const { stems, rankCandidates, parseDecisions, matchUnknownExercises, forgetCatalog } = await import('./exerciseMatcher.js')

const ex = (slug, nameRu, extra = {}) => ({ id: slug, slug, nameRu, nameEn: null, aliases: [], equipment: [], source: 'seed', ...extra })
const catalog = [
  ex('incline-bench-db', 'Жим гантелей на наклонной', { aliases: ['жим гантелей под углом'], equipment: ['dumbbell'] }),
  ex('bench-press-db', 'Жим гантелей лёжа', { equipment: ['dumbbell'] }),
  ex('leg-press', 'Жим ногами', { nameEn: 'Leg Press', equipment: ['machine'] }),
  ex('hamstring-stretch', 'Растяжка бицепса бедра'),
]

describe('stems', () => {
  it('meets word forms and ё/е, drops short and stop words', () => {
    expect([...stems('Жим гантелей лёжа')]).toEqual(['жим', 'ганте', 'лежа'])
    expect(stems('гантели').has('ганте')).toBe(true)
    expect(stems('с для').size).toBe(0)
  })
})

describe('rankCandidates', () => {
  it('ranks by shared name stems, aliases and English names included', () => {
    expect(rankCandidates({ nameRu: 'жим гантелей под углом' }, catalog).map(c => c.slug))
      .toEqual(['incline-bench-db', 'bench-press-db', 'leg-press'])
    expect(rankCandidates({ slug: 'leg-press-machine' }, catalog)[0].slug).toBe('leg-press')
  })

  it('finds nothing for an empty or unrelated name', () => {
    expect(rankCandidates({ nameRu: '!!' }, catalog)).toEqual([])
    expect(rankCandidates({ nameRu: 'плавание' }, catalog)).toEqual([])
  })
})

describe('parseDecisions', () => {
  const items = [{ key: '1', candidates: [catalog[0]] }, { key: '2', candidates: [] }, { key: '3', candidates: [catalog[1]] }]

  it('accepts a match only among the item’s own candidates', () => {
    const d = parseDecisions({ 1: { match: 'incline-bench-db' }, 3: { match: 'leg-press' } }, items)
    expect(d.get('1')).toEqual({ match: catalog[0] })
    expect(d.has('3')).toBe(false)
  })

  it('keeps valid fields of a new exercise and drops invalid ones', () => {
    const d = parseDecisions({ 2: { new: {
      nameRu: 'Пулловер в тренажёре', primaryMuscles: ['lats', 'wings'], equipment: 'spaceship',
      category: 'isolation', targetMuscle: 'lats', force: 'pull', unilateral: false,
    } } }, items)
    expect(d.get('2').fields).toMatchObject({
      nameRu: 'Пулловер в тренажёре', primaryMuscles: [], equipment: undefined,
      category: 'isolation', targetMuscle: 'lats', force: 'pull', unilateral: false,
    })
    expect(parseDecisions({ 2: { new: { nameRu: 'X', targetMuscle: 'none' } } }, items).has('2')).toBe(false)
    expect(parseDecisions({ 2: { new: { nameRu: 'Новое', targetMuscle: 'none' } } }, items).get('2').fields.targetMuscle).toBeNull()
  })

  it('survives a missing or broken answer', () => {
    expect(parseDecisions(null, items).size).toBe(0)
  })
})

describe('matchUnknownExercises', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    forgetCatalog()
    mock.prisma.exercise.findMany.mockResolvedValue(catalog)
  })

  it('sends each name with its candidates in one call and maps answers back to keys', async () => {
    mock.chat.mockResolvedValue({ text: '{"1": {"match": "incline-bench-db"}, "2": {"new": {"nameRu": "Плавание"}}}' })
    const d = await matchUnknownExercises([['a', { nameRu: 'жим гантелей под углом' }], ['b', { nameRu: 'плавание' }]])
    expect(mock.chat).toHaveBeenCalledTimes(1)
    const prompt = mock.chat.mock.calls[0][0][0].content
    expect(prompt).toContain('[1] жим гантелей под углом')
    expect(prompt).toContain('incline-bench-db — Жим гантелей на наклонной — dumbbell')
    expect(prompt).toContain('(кандидатов нет)')
    expect(d.get('a')).toEqual({ match: catalog[0] })
    expect(d.get('b').fields.nameRu).toBe('Плавание')
  })

  it('returns no decisions when the LLM fails', async () => {
    mock.chat.mockRejectedValue(new Error('credit balance is too low'))
    const d = await matchUnknownExercises([['a', { nameRu: 'жим' }]])
    expect(d.size).toBe(0)
  })

  it('skips the LLM entirely when there is nothing to match', async () => {
    expect((await matchUnknownExercises([])).size).toBe(0)
    expect(mock.chat).not.toHaveBeenCalled()
  })
})
