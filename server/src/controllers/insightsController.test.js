import { describe, it, expect, vi, beforeEach } from 'vitest'

// Дневной инсайт: LLM не держит ответ дольше бюджета, генерация одна на юзера/день.

vi.mock('../utils/prisma.js', () => ({
  default: {
    insight: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('../services/aiTrainer/dailyInsight.js', () => ({
  prepareDailyInsight: vi.fn(),
}))

const prisma = (await import('../utils/prisma.js')).default
const { prepareDailyInsight } = await import('../services/aiTrainer/dailyInsight.js')
const { getDailyInsight } = await import('./insightsController.js')

const FALLBACK = { text: 'Жим лёжа стоит третью неделю', factType: 'plateau' }

function mockReq(userId = 'u1') {
  return { user: { id: userId }, header: () => 'Europe/Moscow' }
}

function mockRes() {
  const res = { body: null, json(data) { res.body = data; return res } }
  return res
}

describe('getDailyInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    prisma.insight.findUnique.mockResolvedValue(null)
  })

  it('кэш дня — отдаёт как есть, без генерации', async () => {
    prisma.insight.findUnique.mockResolvedValue({ payload: { text: 'из кэша' } })
    const res = mockRes()
    await getDailyInsight(mockReq(), res)
    expect(res.body).toEqual({ text: 'из кэша' })
    expect(prepareDailyInsight).not.toHaveBeenCalled()
  })

  it('нет фактов — пустой ответ сохраняется в кэш', async () => {
    prepareDailyInsight.mockResolvedValue({ fallback: { text: null }, generate: null })
    const res = mockRes()
    await getDailyInsight(mockReq(), res)
    expect(res.body).toEqual({ text: null })
    expect(prisma.insight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', payload: { text: null } }),
    })
  })

  it('LLM успела в бюджет — отдаёт реплику тренера', async () => {
    const llmPayload = { text: 'Попробуй сменить диапазон повторов', factType: 'plateau' }
    prepareDailyInsight.mockResolvedValue({ fallback: FALLBACK, generate: async () => llmPayload })
    const res = mockRes()
    await getDailyInsight(mockReq('u-fast'), res)
    expect(res.body).toEqual(llmPayload)
  })

  it('LLM не успела — шаблон с pending, генерация дописывает кэш в фоне; параллельный запрос её делит', async () => {
    vi.useFakeTimers()
    let finish
    const generate = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    prepareDailyInsight.mockResolvedValue({ fallback: FALLBACK, generate })

    const res1 = mockRes()
    const res2 = mockRes()
    const p1 = getDailyInsight(mockReq('u-slow'), res1)
    const p2 = getDailyInsight(mockReq('u-slow'), res2)
    await vi.advanceTimersByTimeAsync(4000)
    await Promise.all([p1, p2])

    expect(res1.body).toEqual({ ...FALLBACK, pending: true })
    expect(res2.body).toEqual({ ...FALLBACK, pending: true })
    expect(prepareDailyInsight).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(prisma.insight.create).not.toHaveBeenCalled()

    finish({ text: 'Готово', factType: 'plateau' })
    await vi.advanceTimersByTimeAsync(0)
    expect(prisma.insight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u-slow', payload: { text: 'Готово', factType: 'plateau' } }),
    })
  })
})
