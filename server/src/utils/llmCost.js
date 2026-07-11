/**
 * llmCost — денежная оценка расхода токенов LLM.
 *
 * Прайс задаётся в USD за 1M токенов (Mtok), отдельно вход/выход. Матчим модель
 * по префиксу: API возвращает датированные id вроде 'claude-sonnet-4-6-20260514',
 * нам важно семейство ('claude-sonnet-4'). Неизвестная модель → фолбэк на Sonnet
 * + warn (чтобы не потерять расход и заметить новую модель).
 *
 * ⚠️ Цены — ориентир. Сверить с актуальным прайсом Anthropic:
 *    https://www.anthropic.com/pricing — править только PRICING ниже.
 *
 * Промпт-кэширование: cache write = 1.25× входной цены, cache read = 0.1×.
 * usage от API кладёт кэш-токены в отдельные поля (cache_creation_input_tokens /
 * cache_read_input_tokens), input_tokens их НЕ включает.
 */

const MTOK = 1_000_000

// model-префикс → { in, out } в USD за 1M токенов.
// Порядок важен: матчим первый подошедший префикс, специфичные — выше общих.
const PRICING = {
  'claude-opus-4-0': { in: 15, out: 75 }, // legacy-прайс Opus ≤4.5
  'claude-opus-4-1': { in: 15, out: 75 },
  'claude-opus-4-5': { in: 15, out: 75 },
  'claude-opus-4': { in: 5, out: 25 }, // Opus 4.6+
  'claude-sonnet-4': { in: 3, out: 15 },
  'claude-haiku-4': { in: 1, out: 5 },
  'claude-3-5-haiku': { in: 0.8, out: 4 },
  'claude-3-haiku': { in: 0.25, out: 1.25 },
}

const FALLBACK_KEY = 'claude-sonnet-4'

/** Найти прайс по префиксу модели. Неизвестная → фолбэк + warn. */
export function getPricing(model) {
  const id = String(model || '')
  for (const key of Object.keys(PRICING)) {
    if (id.startsWith(key)) return PRICING[key]
  }
  console.warn(`[llmCost] unknown model "${model}" — using ${FALLBACK_KEY} pricing`)
  return PRICING[FALLBACK_KEY]
}

/**
 * Оценка стоимости вызова в USD (с учётом prompt caching).
 * @param {string} model
 * @param {{ input_tokens?: number, output_tokens?: number,
 *           cache_creation_input_tokens?: number, cache_read_input_tokens?: number }} [usage]
 * @returns {number} стоимость в USD (может быть дробью цента)
 */
export function estimateCostUsd(model, usage = {}) {
  const inTok = usage.input_tokens ?? 0
  const outTok = usage.output_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const price = getPricing(model)
  return (
    (inTok * price.in + cacheWrite * price.in * 1.25 + cacheRead * price.in * 0.1 + outTok * price.out) /
    MTOK
  )
}

export default { getPricing, estimateCostUsd }
