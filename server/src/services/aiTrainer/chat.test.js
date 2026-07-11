import { describe, it, expect, vi, beforeEach } from 'vitest'

// Промпты (chatTrainer.md, _tone.md) читаются реальным readFileSync при импорте —
// файлы существуют, мокать fs не нужно. Мокаем только внешние зависимости.
const h = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockPrisma: {
    chatMessage: { create: vi.fn(), findMany: vi.fn() },
    workout: { findFirst: vi.fn() },
  },
  mockBuildUserContext: vi.fn(),
  mockBuildToolExecutor: vi.fn(),
  mockPeekPendingContext: vi.fn(),
  mockTrack: vi.fn(),
}))

vi.mock('../../utils/llm.js', () => ({ default: { chat: h.mockChat } }))
vi.mock('../../utils/prisma.js', () => ({ default: h.mockPrisma }))
vi.mock('./buildUserContext.js', () => ({
  buildUserContext: h.mockBuildUserContext,
  getRecentWorkouts: vi.fn(),
}))
vi.mock('./chatTools.js', () => ({
  CHAT_TOOLS: [],
  buildToolExecutor: h.mockBuildToolExecutor,
}))
vi.mock('./chatContext.js', () => ({ peekPendingContext: h.mockPeekPendingContext }))
vi.mock('../../utils/analytics.js', () => ({ track: h.mockTrack }))

const { handleChatMessage } = await import('./chat.js')

const USER = { id: 'user-1', firstName: 'Vik', timezone: 'Europe/Moscow' }

describe('handleChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Дефолты: нет активной тренировки, пустой контекст, история пустая.
    h.mockPrisma.chatMessage.create.mockResolvedValue({})
    h.mockPrisma.chatMessage.findMany.mockResolvedValue([])
    h.mockPrisma.workout.findFirst.mockResolvedValue(null)
    h.mockBuildUserContext.mockResolvedValue(null)
    h.mockPeekPendingContext.mockResolvedValue(null)
    // Дефолтный executor ничего не пишет в writeOps.
    h.mockBuildToolExecutor.mockImplementation(() => async () => ({}))
  })

  it('обрезает ведущие assistant-сообщения: первый элемент messages — role user', async () => {
    // findMany возвращает desc (новые сверху). chat.js reverse → хронология:
    // [assistant a0, user u1, assistant a2]. Ведущий assistant отбрасывается.
    h.mockPrisma.chatMessage.findMany.mockResolvedValue([
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a0' },
    ])
    h.mockChat.mockResolvedValue({
      text: 'ответ',
      model: 'm',
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    await handleChatMessage(USER, 'новое сообщение')

    const messagesArg = h.mockChat.mock.calls[0][0]
    expect(messagesArg[0].role).toBe('user')
    expect(messagesArg[0].content).toBe('u1')
    // Ведущий assistant 'a0' отброшен полностью.
    expect(messagesArg.some((m) => m.content === 'a0')).toBe(false)
  })

  it('успех: сохраняет assistant ChatMessage с usage, degraded=false, коммитит контекст', async () => {
    const commit = vi.fn().mockResolvedValue(true)
    h.mockPeekPendingContext.mockResolvedValue({
      type: 'exercise',
      block: 'блок',
      commit,
    })
    h.mockChat.mockResolvedValue({
      text: '  Держи ответ  ',
      model: 'claude-test',
      usage: { input_tokens: 42, output_tokens: 7 },
    })

    const res = await handleChatMessage(USER, 'как жим?')

    expect(res).toEqual({ reply: 'Держи ответ', degraded: false })

    // Первый create — входящее user; второй — assistant с usage.
    const assistantCreate = h.mockPrisma.chatMessage.create.mock.calls.find(
      (c) => c[0].data.role === 'assistant',
    )
    expect(assistantCreate[0].data).toMatchObject({
      userId: 'user-1',
      role: 'assistant',
      content: 'Держи ответ',
      model: 'claude-test',
      tokensInput: 42,
      tokensOutput: 7,
    })
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('degraded + writeOps: сохраняет след правки, когда LLM упал после write-инструмента', async () => {
    // Executor симулирует применённую правку: пишет в переданный writeOps-аккумулятор.
    h.mockBuildToolExecutor.mockImplementation((userId, tz, writeOps) => {
      writeOps.push({
        tool: 'replace_exercise',
        scope: 'next',
        dayIndex: 1,
        summary: 'Жим штанги → Отжимания',
      })
      return async () => ({})
    })
    h.mockChat.mockRejectedValue(new Error('LLM boom'))

    const res = await handleChatMessage(USER, 'замени жим')

    expect(res.degraded).toBe(true)

    const trailCreate = h.mockPrisma.chatMessage.create.mock.calls.find(
      (c) => typeof c[0].data.content === 'string' && c[0].data.content.startsWith('[Применил правку'),
    )
    expect(trailCreate).toBeTruthy()
    expect(trailCreate[0].data.role).toBe('assistant')
    // dayIndex+1 = 2, scope и summary попадают в след.
    expect(trailCreate[0].data.content).toContain('replace_exercise (день 2, scope: next)')
    expect(trailCreate[0].data.content).toContain('Жим штанги → Отжимания')
  })

  it('degraded: pendingCtx.commit НЕ вызывается (контекст переживает фейл)', async () => {
    const commit = vi.fn().mockResolvedValue(true)
    h.mockPeekPendingContext.mockResolvedValue({ type: 'program', block: 'блок', commit })
    h.mockChat.mockRejectedValue(new Error('LLM boom'))

    const res = await handleChatMessage(USER, 'обсудим программу')

    expect(res.degraded).toBe(true)
    expect(commit).not.toHaveBeenCalled()
  })
})
