import Anthropic from '@anthropic-ai/sdk'

// Тонкая абстракция над Anthropic SDK. Все вызовы LLM/Vision — через chat() и vision().
// НЕ импортируем @anthropic-ai/sdk напрямую в контроллерах/сервисах.
//
// Здесь же — место для retry, timeout, логирования, смены провайдера.
// На MVP-этапе оставляем максимально просто, расширяем по необходимости.

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 1024

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
 * Текстовый чат.
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {{ system?: string, model?: string, maxTokens?: number }} [options]
 * @returns {Promise<{ text: string, model: string, usage: object }>}
 */
export async function chat(messages, options = {}) {
  const model = options.model ?? DEFAULT_MODEL
  const res = await client().messages.create({
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: options.system,
    messages,
  })
  return {
    text: res.content?.[0]?.text ?? '',
    model: res.model,
    usage: res.usage,
  }
}

/**
 * Vision: фото + промпт → текстовый ответ или JSON-структура.
 * Изображение передаётся как base64.
 *
 * @param {string} imageBase64       — без data:URL префикса
 * @param {string} prompt
 * @param {{ mediaType?: string, model?: string, maxTokens?: number }} [options]
 */
export async function vision(imageBase64, prompt, options = {}) {
  const model = options.model ?? DEFAULT_MODEL
  const res = await client().messages.create({
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
  })
  return {
    text: res.content?.[0]?.text ?? '',
    model: res.model,
    usage: res.usage,
  }
}

export const llm = { chat, vision }
export default llm
