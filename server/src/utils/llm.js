import Anthropic from '@anthropic-ai/sdk'
import { recordLlmUsage } from './llmUsage.js'

// Тонкая абстракция над Anthropic SDK. Все вызовы LLM/Vision — через chat() и vision().
// НЕ импортируем @anthropic-ai/sdk напрямую в контроллерах/сервисах.
//
// Здесь же — место для retry, timeout, логирования, смены провайдера.
// На MVP-этапе оставляем максимально просто, расширяем по необходимости.

const DEFAULT_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 1024
const DEFAULT_TIMEOUT_MS = 60_000

let _client = null
function client() {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — see server/.env.example')
  }
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

/**
 * Оборачивает промис в таймаут. При превышении — AbortError.
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM request timed out after ${ms}ms`)), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

/** Первый текстовый блок из ответа (с tools текст может быть не в [0]). */
function extractText(res) {
  return res.content?.find((b) => b.type === 'text')?.text ?? ''
}

/** Записать расход токенов, если передан meta { userId, feature }. No-op без meta. */
function maybeRecordUsage(meta, model, usage) {
  if (!meta?.feature) return
  recordLlmUsage({ userId: meta.userId ?? null, feature: meta.feature, model, usage })
}

/** Один вызов messages.create с таймаутом и retry на сетевых ошибках. */
async function createWithRetry(params, { timeout, maxRetries }) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(client().messages.create(params), timeout)
    } catch (err) {
      lastError = err
      const isRetryable =
        err.message?.includes('Connection error') || err.message?.includes('ECONNRESET')
      if (!isRetryable || attempt === maxRetries) throw err
      const delay = 1000 * (attempt + 1)
      console.warn(`[llm] retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.message}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

/**
 * Текстовый чат. Опционально — с tool-use (agentic-петля): модель запрашивает
 * инструмент → executeTool выполняет → tool_result возвращается → продолжаем,
 * лимит maxToolRounds раундов. На последнем раунде tools убираются, чтобы
 * заставить модель ответить текстом.
 *
 * @param {Array<{role: 'user'|'assistant', content: any}>} messages
 * @param {object} [options]
 * @param {string}   [options.system]
 * @param {string}   [options.model]
 * @param {number}   [options.maxTokens]
 * @param {number}   [options.retries=2]
 * @param {number}   [options.timeout]
 * @param {Array}    [options.tools]       — Anthropic tool-схемы
 * @param {(name: string, input: object) => Promise<any>} [options.executeTool]
 * @param {number}   [options.maxToolRounds=3]
 * @param {{ userId?: string|null, feature?: string }} [options.meta] — учёт расхода (utils/llmUsage)
 * @returns {Promise<{ text: string, model: string, usage: { input_tokens: number, output_tokens: number } }>}
 */
export async function chat(messages, options = {}) {
  const model = options.model ?? DEFAULT_MODEL
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const retryOpts = { timeout: options.timeout ?? DEFAULT_TIMEOUT_MS, maxRetries: options.retries ?? 2 }

  // ─── Простой путь: без инструментов (прежнее поведение) ───
  if (!options.tools?.length || typeof options.executeTool !== 'function') {
    const res = await createWithRetry(
      { model, max_tokens: maxTokens, system: options.system, messages },
      retryOpts,
    )
    maybeRecordUsage(options.meta, res.model, res.usage)
    return { text: extractText(res), model: res.model, usage: res.usage }
  }

  // ─── Tool-use: agentic-петля ───
  const maxRounds = options.maxToolRounds ?? 3
  const convo = [...messages] // не мутируем входной массив
  let totalIn = 0
  let totalOut = 0
  let lastModel = model
  let lastText = ''

  for (let round = 0; round <= maxRounds; round++) {
    const useTools = round < maxRounds // последний раунд — без tools, форсируем текст
    const res = await createWithRetry(
      {
        model,
        max_tokens: maxTokens,
        system: options.system,
        messages: convo,
        ...(useTools ? { tools: options.tools } : {}),
      },
      retryOpts,
    )

    totalIn += res.usage?.input_tokens ?? 0
    totalOut += res.usage?.output_tokens ?? 0
    lastModel = res.model
    lastText = extractText(res)

    if (res.stop_reason !== 'tool_use') {
      const usage = { input_tokens: totalIn, output_tokens: totalOut }
      maybeRecordUsage(options.meta, lastModel, usage)
      return { text: lastText, model: lastModel, usage }
    }

    // Выполняем все запрошенные инструменты, собираем tool_result.
    const toolUses = res.content.filter((b) => b.type === 'tool_use')
    convo.push({ role: 'assistant', content: res.content })
    const toolResults = []
    for (const tu of toolUses) {
      let resultStr
      try {
        const out = await options.executeTool(tu.name, tu.input)
        resultStr = typeof out === 'string' ? out : JSON.stringify(out)
      } catch (err) {
        console.error(`[llm] tool "${tu.name}" failed:`, err.message)
        resultStr = `Ошибка получения данных: ${err.message}`
      }
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultStr })
    }
    convo.push({ role: 'user', content: toolResults })
  }

  // Петля исчерпана — отдаём последний текст (мог быть пустым).
  const usage = { input_tokens: totalIn, output_tokens: totalOut }
  maybeRecordUsage(options.meta, lastModel, usage)
  return { text: lastText, model: lastModel, usage }
}

/**
 * Vision: фото + промпт → текстовый ответ или JSON-структура.
 * Изображение передаётся как base64.
 *
 * @param {string} imageBase64       — без data:URL префикса
 * @param {string} prompt
 * @param {{ mediaType?: string, model?: string, maxTokens?: number, meta?: { userId?: string|null, feature?: string } }} [options]
 */
export async function vision(imageBase64, prompt, options = {}) {
  const model = options.model ?? DEFAULT_MODEL
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  const res = await withTimeout(
    client().messages.create({
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: options.mediaType ?? 'image/jpeg',
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
    timeout,
  )
  maybeRecordUsage(options.meta, res.model, res.usage)
  return {
    text: res.content?.[0]?.text ?? '',
    model: res.model,
    usage: res.usage,
  }
}

export const llm = { chat, vision }
export default llm
