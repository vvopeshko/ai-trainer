/**
 * llmUsage — fire-and-forget запись расхода токенов LLM в таблицу LlmUsage.
 *
 * Вызывается из utils/llm.js при каждом chat()/vision() с options.meta.
 * Семантика как у track(): ошибки логируются, но НЕ пробрасываются — учёт
 * расхода не должен ронять ответ пользователю.
 *
 * costUsd считается снимком по прайсу на момент вызова (utils/llmCost.js).
 * Отчёт — services/aiTrainer/usageReport.js (команда /cost).
 */
import prisma from './prisma.js'
import { estimateCostUsd } from './llmCost.js'

/**
 * @param {object} args
 * @param {string|null} [args.userId]  — кто инициировал (null для системных джобов без юзера)
 * @param {string} args.feature        — 'chat' | 'program_generate' | ...
 * @param {string} args.model
 * @param {{ input_tokens?: number, output_tokens?: number }} [args.usage]
 */
export function recordLlmUsage({ userId = null, feature, model, usage } = {}) {
  if (!feature || !model) return // неполные данные — нечего писать

  const tokensInput = usage?.input_tokens ?? 0
  const tokensOutput = usage?.output_tokens ?? 0
  const costUsd = estimateCostUsd(model, usage ?? {})

  prisma.llmUsage
    .create({
      data: { userId: userId ?? null, feature, model, tokensInput, tokensOutput, costUsd },
    })
    .catch((err) => {
      console.error('[llmUsage] failed to record', feature, err.message)
    })
}

export default { recordLlmUsage }
