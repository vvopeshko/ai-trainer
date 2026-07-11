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

/** Первый текстовый блок из ответа (с tools текст может быть не в [0]). */
function extractText(res) {
  return res.content?.find((b) => b.type === 'text')?.text ?? ''
}

/** Записать расход токенов, если передан meta { userId, feature }. No-op без meta. */
function maybeRecordUsage(meta, model, usage) {
  if (!meta?.feature) return
  recordLlmUsage({ userId: meta.userId ?? null, feature: meta.feature, model, usage })
}

/**
 * Один вызов messages.create. Таймаут и ретраи — средствами SDK:
 * SDK сам ретраит 429/5xx/сетевые ошибки с backoff и по таймауту АБОРТИТ
 * HTTP-запрос (самодельная обёртка Promise.race оставляла запрос жить —
 * токены тратились после «таймаута», а usage не записывался).
 */
function createRequest(params, { timeout, maxRetries }) {
  return client().messages.create(params, { timeout, maxRetries })
}

/**
 * Текстовый чат. Опционально — с tool-use (agentic-петля): модель запрашивает
 * инструмент → executeTool выполняет → tool_result возвращается → продолжаем,
 * лимит maxToolRounds раундов. На последнем раунде ставится
 * tool_choice: none — модель обязана ответить текстом. Сам параметр tools
 * при этом остаётся: API отклоняет запросы с tool_use/tool_result блоками
 * в истории, если tools не переданы.
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
    const res = await createRequest(
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
  let totalCacheWrite = 0
  let totalCacheRead = 0
  let lastModel = model
  let lastText = ''
  const totalUsage = () => ({
    input_tokens: totalIn,
    output_tokens: totalOut,
    cache_creation_input_tokens: totalCacheWrite,
    cache_read_input_tokens: totalCacheRead,
  })

  try {
    for (let round = 0; round <= maxRounds; round++) {
      const lastRound = round === maxRounds // на последнем раунде форсируем текст
      const res = await createRequest(
        {
          model,
          max_tokens: maxTokens,
          system: options.system,
          messages: convo,
          tools: options.tools,
          ...(lastRound ? { tool_choice: { type: 'none' } } : {}),
        },
        retryOpts,
      )

      totalIn += res.usage?.input_tokens ?? 0
      totalOut += res.usage?.output_tokens ?? 0
      totalCacheWrite += res.usage?.cache_creation_input_tokens ?? 0
      totalCacheRead += res.usage?.cache_read_input_tokens ?? 0
      lastModel = res.model
      lastText = extractText(res)

      if (res.stop_reason !== 'tool_use') {
        return { text: lastText, model: lastModel, usage: totalUsage() }
      }

      // Выполняем все запрошенные инструменты, собираем tool_result.
      const toolUses = res.content.filter((b) => b.type === 'tool_use')
      convo.push({ role: 'assistant', content: res.content })
      const toolResults = []
      for (const tu of toolUses) {
        let resultStr
        let isError = false
        try {
          const out = await options.executeTool(tu.name, tu.input)
          resultStr = typeof out === 'string' ? out : JSON.stringify(out)
        } catch (err) {
          console.error(`[llm] tool "${tu.name}" failed:`, err.message)
          resultStr = `Ошибка получения данных: ${err.message}`
          isError = true // флаг API: модель явно видит, что инструмент упал
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: resultStr,
          ...(isError ? { is_error: true } : {}),
        })
      }
      convo.push({ role: 'user', content: toolResults })
    }

    // Петля исчерпана — отдаём последний текст (мог быть пустым).
    return { text: lastText, model: lastModel, usage: totalUsage() }
  } finally {
    // Записываем usage и при исключении посреди петли: многораундовые вызовы —
    // самые дорогие, без finally /cost систематически их недоучитывал.
    if (totalIn > 0 || totalOut > 0 || totalCacheWrite > 0 || totalCacheRead > 0) {
      maybeRecordUsage(options.meta, lastModel, totalUsage())
    }
  }
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
  const res = await createRequest(
    {
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
    },
    { timeout: options.timeout ?? DEFAULT_TIMEOUT_MS, maxRetries: options.retries ?? 2 },
  )
  maybeRecordUsage(options.meta, res.model, res.usage)
  return {
    text: extractText(res),
    model: res.model,
    usage: res.usage,
  }
}

export const llm = { chat, vision }
export default llm
