/**
 * Сравнение 4 LLM-провайдеров на задаче обогащения упражнений.
 * Берёт 5 разных упражнений, отправляет один и тот же промпт, выводит результат + стоимость.
 *
 * API-ключи из env: ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, GROQ_API_KEY.
 * Доступные провайдеры тестируются, остальные скипаются.
 *
 * Запуск: node --env-file=.env server/scripts/testEnrichLLM.js
 * (или: cd server && node --env-file=.env scripts/testEnrichLLM.js)
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'data', 'free-exercise-db.json')

// ─── Промпт ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — фитнес-эксперт и переводчик. Переведи и обогати упражнение.
Ответ — ТОЛЬКО валидный JSON, без markdown-блоков, без пояснений.`

function makeUserPrompt(exercise) {
  const input = {
    name: exercise.name,
    primaryMuscles: exercise.primaryMuscles,
    equipment: exercise.equipment,
    instructions: exercise.instructions?.slice(0, 3), // первые 3 шага для экономии токенов
  }
  return `Вход: ${JSON.stringify(input)}

Выход (JSON):
{
  "nameRu": "русское название",
  "aliases": ["синоним1", "синоним2", "синоним3"],
  "typicalMistakes": "типичные ошибки на русском (2-3 предложения)",
  "descriptionRu": "краткое описание упражнения (1-2 предложения)"
}`
}

// ─── Провайдеры ────────────────────────────────────────────────────────

const providers = [
  {
    name: 'Claude Haiku 4.5',
    envKey: 'ANTHROPIC_API_KEY',
    inputCostPer1M: 1.00,
    outputCostPer1M: 5.00,
    call: async (exercise) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: makeUserPrompt(exercise) }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.content[0].text,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      }
    },
  },
  {
    name: 'Claude Sonnet 4',
    envKey: 'ANTHROPIC_API_KEY',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    call: async (exercise) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: makeUserPrompt(exercise) }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.content[0].text,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      }
    },
  },
  {
    name: 'GPT-4.1 mini',
    envKey: 'OPENAI_API_KEY',
    inputCostPer1M: 0.40,
    outputCostPer1M: 1.60,
    call: async (exercise) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: makeUserPrompt(exercise) },
          ],
          max_tokens: 512,
          temperature: 0.3,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.choices[0].message.content,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      }
    },
  },
  {
    name: 'GPT-4.1 nano',
    envKey: 'OPENAI_API_KEY',
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    call: async (exercise) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: makeUserPrompt(exercise) },
          ],
          max_tokens: 512,
          temperature: 0.3,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.choices[0].message.content,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      }
    },
  },
  {
    name: 'DeepSeek V4 Flash',
    envKey: 'DEEPSEEK_API_KEY',
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    call: async (exercise) => {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: makeUserPrompt(exercise) },
          ],
          max_tokens: 512,
          temperature: 0.3,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.choices[0].message.content,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      }
    },
  },
  {
    name: 'DeepSeek V4 Pro',
    envKey: 'DEEPSEEK_API_KEY',
    inputCostPer1M: 0.44,
    outputCostPer1M: 0.87,
    call: async (exercise) => {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-pro',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: makeUserPrompt(exercise) },
          ],
          max_tokens: 512,
          temperature: 0.3,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.choices[0].message.content,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      }
    },
  },
  {
    name: 'Groq Llama 4 Scout',
    envKey: 'GROQ_API_KEY',
    inputCostPer1M: 0.11,
    outputCostPer1M: 0.34,
    call: async (exercise) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: makeUserPrompt(exercise) },
          ],
          max_tokens: 512,
          temperature: 0.3,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      return {
        text: data.choices[0].message.content,
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      }
    },
  },
]

// ─── Выбор 5 разных упражнений ─────────────────────────────────────────

function pickSampleExercises(exercises) {
  // Выбираем по разным категориям оборудования для разнообразия
  const targets = ['barbell', 'dumbbell', 'machine', 'cable', 'body only']
  const picked = []

  for (const target of targets) {
    const match = exercises.find(
      (ex) => ex.equipment === target && !picked.includes(ex)
    )
    if (match) picked.push(match)
  }

  // Дополнить если не хватило
  while (picked.length < 5 && picked.length < exercises.length) {
    const ex = exercises[picked.length * 37 % exercises.length] // псевдо-random
    if (!picked.includes(ex)) picked.push(ex)
  }

  return picked.slice(0, 5)
}

// ─── Main ───────────────────────────────────────────────────────────────

function parseJSON(text) {
  // Убираем markdown code blocks если есть
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

async function main() {
  let exercises
  try {
    exercises = JSON.parse(readFileSync(DB_PATH, 'utf-8'))
  } catch {
    console.error(`Файл не найден: ${DB_PATH}`)
    console.error('Сначала запустите: node server/scripts/fetchFreeExerciseDB.js')
    process.exit(1)
  }

  const samples = pickSampleExercises(exercises)
  console.log(`Тестируем на ${samples.length} упражнениях:\n`)
  for (const ex of samples) {
    console.log(`  - ${ex.name} (${ex.equipment}, ${ex.primaryMuscles?.join(', ')})`)
  }

  const activeProviders = providers.filter((p) => {
    if (process.env[p.envKey]) return true
    console.log(`\n⏭  ${p.name} — пропущен (нет ${p.envKey})`)
    return false
  })

  if (activeProviders.length === 0) {
    console.error('\nНет ни одного API-ключа. Установите хотя бы один в server/.env')
    process.exit(1)
  }

  // Статистика для итогового сравнения
  const totals = {}
  // Сохраняем все результаты для сводной таблицы
  const allResults = {} // { providerName: { exerciseName: parsed } }
  for (const provider of activeProviders) {
    totals[provider.name] = { inputTokens: 0, outputTokens: 0, cost: 0, errors: 0 }
    allResults[provider.name] = {}
  }

  for (const exercise of samples) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`=== ${exercise.name} ===`)
    console.log('═'.repeat(60))

    for (const provider of activeProviders) {
      try {
        const result = await provider.call(exercise)
        const cost =
          (result.inputTokens / 1_000_000) * provider.inputCostPer1M +
          (result.outputTokens / 1_000_000) * provider.outputCostPer1M

        totals[provider.name].inputTokens += result.inputTokens
        totals[provider.name].outputTokens += result.outputTokens
        totals[provider.name].cost += cost

        const parsed = parseJSON(result.text)
        allResults[provider.name][exercise.name] = parsed

        console.log(`\n[${provider.name}]`)
        console.log(`  nameRu: ${parsed.nameRu}`)
        console.log(`  aliases: ${(parsed.aliases || []).join(', ')}`)
        console.log(`  typicalMistakes: ${(parsed.typicalMistakes || '').slice(0, 100)}...`)
        console.log(`  descriptionRu: ${parsed.descriptionRu}`)
        console.log(
          `  tokens: ${result.inputTokens}in / ${result.outputTokens}out, cost: $${cost.toFixed(6)}`
        )
      } catch (e) {
        console.log(`\n[${provider.name}] ОШИБКА: ${e.message}`)
        totals[provider.name].errors++
      }
    }
  }

  // ─── Сводная таблица ────────────────────────────────────────────────

  const totalExercises = exercises.length
  const pad = (s, n) => String(s).padEnd(n)
  const padL = (s, n) => String(s).padStart(n)

  console.log(`\n\n${'═'.repeat(100)}`)
  console.log('  СВОДНАЯ ТАБЛИЦА')
  console.log('═'.repeat(100))

  // Шапка
  const hdr = [
    pad('Провайдер', 22),
    padL('Ошибки', 6),
    padL('$/1M in', 8),
    padL('$/1M out', 9),
    padL('~$ за 873', 10),
    padL('Avg tok', 12),
  ].join(' │ ')
  console.log(`\n  ${hdr}`)
  console.log(`  ${'─'.repeat(hdr.length)}`)

  for (const provider of activeProviders) {
    const t = totals[provider.name]
    const successCount = samples.length - t.errors
    const avgIn = successCount > 0 ? Math.round(t.inputTokens / successCount) : 0
    const avgOut = successCount > 0 ? Math.round(t.outputTokens / successCount) : 0
    const estimatedCost = successCount > 0
      ? ((avgIn * totalExercises) / 1_000_000) * provider.inputCostPer1M +
        ((avgOut * totalExercises) / 1_000_000) * provider.outputCostPer1M
      : 0

    const row = [
      pad(provider.name, 22),
      padL(`${t.errors}/${samples.length}`, 6),
      padL(`$${provider.inputCostPer1M.toFixed(2)}`, 8),
      padL(`$${provider.outputCostPer1M.toFixed(2)}`, 9),
      padL(successCount > 0 ? `$${estimatedCost.toFixed(2)}` : '—', 10),
      padL(successCount > 0 ? `${avgIn}/${avgOut}` : '—', 12),
    ].join(' │ ')
    console.log(`  ${row}`)
  }

  // Сравнение переводов — по каждому упражнению
  console.log(`\n${'═'.repeat(100)}`)
  console.log('  СРАВНЕНИЕ ПЕРЕВОДОВ')
  console.log('═'.repeat(100))

  for (const exercise of samples) {
    console.log(`\n  ▸ ${exercise.name}`)
    console.log(`  ${'─'.repeat(70)}`)
    for (const provider of activeProviders) {
      const r = allResults[provider.name][exercise.name]
      if (!r) {
        console.log(`  ${pad(provider.name, 22)} │ ОШИБКА`)
        continue
      }
      console.log(`  ${pad(provider.name, 22)} │ ${r.nameRu}`)
      console.log(`  ${pad('', 22)} │   aliases: ${(r.aliases || []).join(', ')}`)
    }
  }

  console.log(`\n${'═'.repeat(100)}`)
}

main().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
