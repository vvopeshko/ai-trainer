import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем Anthropic SDK и учёт токенов. mockCreate — messages.create,
// mockRecordLlmUsage — recordLlmUsage из ./llmUsage.js.
const { mockCreate, mockRecordLlmUsage } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRecordLlmUsage: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  // Класс, а не стрелка: llm.js вызывает `new Anthropic(...)`, стрелку нельзя new-ить.
  default: class {
    constructor() {
      this.messages = { create: mockCreate }
    }
  },
}))

vi.mock('./llmUsage.js', () => ({
  recordLlmUsage: mockRecordLlmUsage,
  default: { recordLlmUsage: mockRecordLlmUsage },
}))

const { chat } = await import('./llm.js')

describe('llm.chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  describe('простой путь (без tools)', () => {
    it('возвращает text/model/usage и пишет usage через recordLlmUsage', async () => {
      const usage = { input_tokens: 5, output_tokens: 3 }
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Привет' }],
        model: 'claude-test',
        usage,
        stop_reason: 'end_turn',
      })

      const res = await chat([{ role: 'user', content: 'hi' }], {
        meta: { userId: 'u1', feature: 'chat' },
      })

      expect(res).toEqual({ text: 'Привет', model: 'claude-test', usage })
      expect(mockCreate).toHaveBeenCalledTimes(1)
      // Простой путь не передаёт tools.
      expect(mockCreate.mock.calls[0][0].tools).toBeUndefined()
      expect(mockRecordLlmUsage).toHaveBeenCalledWith({
        userId: 'u1',
        feature: 'chat',
        model: 'claude-test',
        usage,
      })
    })

    it('без meta.feature usage не пишется (no-op)', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        model: 'm',
        usage: { input_tokens: 1, output_tokens: 1 },
      })

      await chat([{ role: 'user', content: 'hi' }])

      expect(mockRecordLlmUsage).not.toHaveBeenCalled()
    })
  })

  describe('tool-use цикл', () => {
    const tools = [{ name: 'get_x', input_schema: { type: 'object', properties: {} } }]

    it('вызывает executeTool с (name, input) и кладёт tool_result в convo', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [{ type: 'tool_use', id: 'tu-1', name: 'get_x', input: { a: 1 } }],
          model: 'm',
          usage: { input_tokens: 10, output_tokens: 2 },
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Готово' }],
          model: 'm',
          usage: { input_tokens: 5, output_tokens: 4 },
          stop_reason: 'end_turn',
        })

      const executeTool = vi.fn().mockResolvedValue({ ok: true })

      const res = await chat([{ role: 'user', content: 'go' }], {
        tools,
        executeTool,
        meta: { userId: 'u1', feature: 'chat' },
      })

      expect(res.text).toBe('Готово')
      expect(executeTool).toHaveBeenCalledWith('get_x', { a: 1 })

      // Второй запрос должен содержать tool_result с нашим tool_use_id и
      // сериализованным результатом инструмента.
      const secondMessages = mockCreate.mock.calls[1][0].messages
      const toolResultMsg = secondMessages[secondMessages.length - 1]
      expect(toolResultMsg.role).toBe('user')
      expect(toolResultMsg.content[0]).toMatchObject({
        type: 'tool_result',
        tool_use_id: 'tu-1',
        content: JSON.stringify({ ok: true }),
      })
      // Успешный результат не помечается is_error.
      expect(toolResultMsg.content[0].is_error).toBeUndefined()
    })

    it('финальный раунд: tool_choice none, но tools остаются переданы', async () => {
      // Модель зовёт инструмент КАЖДЫЙ раунд → доходим до последнего.
      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'tu', name: 'get_x', input: {} }],
        model: 'm',
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'tool_use',
      })
      const executeTool = vi.fn().mockResolvedValue('data')

      await chat([{ role: 'user', content: 'go' }], {
        tools,
        executeTool,
        maxToolRounds: 1,
      })

      // round 0 (обычный) + round 1 (последний) = 2 запроса.
      expect(mockCreate).toHaveBeenCalledTimes(2)
      const first = mockCreate.mock.calls[0][0]
      const last = mockCreate.mock.calls[1][0]

      expect(first.tool_choice).toBeUndefined()
      expect(last.tool_choice).toEqual({ type: 'none' })
      // tools НЕ удаляются — API отклонил бы историю с tool_use/tool_result без них.
      expect(last.tools).toBe(tools)
    })

    it('is_error: при исключении в executeTool tool_result помечен ошибкой', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [{ type: 'tool_use', id: 'tu-err', name: 'get_x', input: {} }],
          model: 'm',
          usage: { input_tokens: 3, output_tokens: 1 },
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'ответ' }],
          model: 'm',
          usage: { input_tokens: 2, output_tokens: 1 },
          stop_reason: 'end_turn',
        })

      const executeTool = vi.fn().mockRejectedValue(new Error('db down'))

      await chat([{ role: 'user', content: 'go' }], { tools, executeTool })

      const secondMessages = mockCreate.mock.calls[1][0].messages
      const toolResult = secondMessages[secondMessages.length - 1].content[0]
      expect(toolResult.is_error).toBe(true)
      expect(toolResult.content).toContain('db down')
    })

    it('usage пишется в finally, если create падает на 2-м раунде', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [{ type: 'tool_use', id: 'tu', name: 'get_x', input: {} }],
          model: 'm-round0',
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: 'tool_use',
        })
        .mockRejectedValueOnce(new Error('boom'))

      const executeTool = vi.fn().mockResolvedValue('data')

      await expect(
        chat([{ role: 'user', content: 'go' }], {
          tools,
          executeTool,
          meta: { userId: 'u1', feature: 'chat' },
        }),
      ).rejects.toThrow('boom')

      // Накопленный usage 1-го раунда всё равно должен уйти в учёт.
      expect(mockRecordLlmUsage).toHaveBeenCalledTimes(1)
      const call = mockRecordLlmUsage.mock.calls[0][0]
      expect(call.model).toBe('m-round0')
      expect(call.usage.input_tokens).toBe(10)
      expect(call.usage.output_tokens).toBe(5)
    })

    it('суммирует кэш-токены (cache_creation/cache_read) по раундам', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [{ type: 'tool_use', id: 'tu', name: 'get_x', input: {} }],
          model: 'm',
          usage: {
            input_tokens: 10,
            output_tokens: 2,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 50,
          },
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'done' }],
          model: 'm',
          usage: {
            input_tokens: 5,
            output_tokens: 3,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 200,
          },
          stop_reason: 'end_turn',
        })

      const executeTool = vi.fn().mockResolvedValue('data')

      const res = await chat([{ role: 'user', content: 'go' }], {
        tools,
        executeTool,
        meta: { userId: 'u1', feature: 'chat' },
      })

      expect(res.usage).toEqual({
        input_tokens: 15,
        output_tokens: 5,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 250,
      })
      expect(mockRecordLlmUsage.mock.calls[0][0].usage).toEqual(res.usage)
    })
  })
})
