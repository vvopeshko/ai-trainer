/**
 * dailyInsight — «замечание тренера» на Home (AI_TRAINER_PLAN фаза 4.2).
 *
 * Детекцию делает insightsService (код, §1). Здесь — упаковка топ-факта в живую
 * реплику тренера одним llm.chat() (тон _tone.md, промпт dailyInsight.md).
 *
 * Кэш в модели Insight — в insightsController (лениво, раз в день). Тут только
 * генерация. При фейле LLM — деградация до шаблонного detail из insightsService.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import llm from '../../utils/llm.js'
import { getInsights } from '../insightsService.js'
import { buildUserContext } from './buildUserContext.js'

const DEFAULT_TZ = 'Europe/Moscow'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TONE = readFileSync(join(__dirname, 'prompts', '_tone.md'), 'utf-8')
const TASK = readFileSync(join(__dirname, 'prompts', 'dailyInsight.md'), 'utf-8')
const SYSTEM_BASE = `${TONE}\n\n---\n\n${TASK}`

const FACT_LABELS = {
  plateau: 'Плато',
  regression: 'Просадка рабочего веса',
  growth: 'Рост',
  imbalance: 'Дисбаланс объёма',
}

function buildFact(top) {
  const lines = [`Замеченный факт: ${FACT_LABELS[top.type] || top.type}`]
  if (top.exerciseNameRu) lines.push(`Упражнение: ${top.exerciseNameRu}`)
  lines.push(`Данные: ${JSON.stringify(top.data)}`)
  lines.push(`Краткое описание (для опоры, перефразируй своими словами): ${top.detail}`)
  return lines.join('\n')
}

/**
 * Подготовить дневной инсайт. Без кэша (его держит контроллер).
 *
 * Детекция (SQL) — сразу; LLM-реплика — отдельным шагом generate(), чтобы
 * контроллер мог не держать ответ на LLM: fallback — шаблонный текст детектора
 * (он уже человекочитаемый), им же деградирует generate() при фейле LLM.
 *
 * @param {string} userId
 * @param {string} [tz]
 * @returns {Promise<{ fallback: { text: string|null, factType?: string },
 *   generate: null | (() => Promise<{ text: string, factType: string }>) }>}
 */
export async function prepareDailyInsight(userId, tz = DEFAULT_TZ) {
  const { facts } = await getInsights(userId, tz)
  if (!facts.length) return { fallback: { text: null }, generate: null }

  const top = facts[0]
  const fallback = { text: top.detail, factType: top.type }

  async function generate() {
    try {
      const userContext = await buildUserContext(userId, {
        recentWorkouts: false,
        records: false,
      })
      const system = userContext
        ? `${SYSTEM_BASE}\n\n---\n\n# Контекст пользователя\n${userContext}`
        : SYSTEM_BASE
      const res = await llm.chat([{ role: 'user', content: buildFact(top) }], {
        system,
        maxTokens: 400,
        // Фоновая генерация: шаблон уже показан, долгие ретраи не нужны
        timeout: 20_000,
        retries: 0,
        meta: { userId, feature: 'daily_insight' },
      })
      const text = res.text?.trim()
      if (text) return { text, factType: top.type }
    } catch (err) {
      console.error('[dailyInsight] LLM failed, degrading to templated detail:', err.message)
    }
    return fallback
  }

  return { fallback, generate }
}
