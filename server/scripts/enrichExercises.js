/**
 * Полное обогащение упражнений из Free Exercise DB через выбранный LLM.
 *
 * - Читает server/data/free-exercise-db.json (сырые данные)
 * - Читает server/data/enriched-exercises.json (существующие — не перезатираем)
 * - Для новых упражнений: вызов LLM → русское название, алиасы, описание, ошибки
 * - Checkpoint каждые 50 упражнений
 * - На выходе: обновлённый enriched-exercises.json
 *
 * Запуск:
 *   cd server && node --env-file=.env scripts/enrichExercises.js --provider=haiku
 *
 * Провайдеры: haiku, gemini, openai, deepseek
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_PATH = join(__dirname, '..', 'data', 'free-exercise-db.json')
const ENRICHED_PATH = join(__dirname, '..', 'data', 'enriched-exercises.json')
const CHECKPOINT_PATH = join(__dirname, '..', 'data', 'enrichment-checkpoint.json')

const BATCH_SIZE = 50
const DELAY_MS = 100

// ─── Промпт ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — фитнес-эксперт и переводчик. Переведи и обогати упражнение.

Правила:
- equipment указывает тип оборудования. Сохрани его точно в переводе (штанга, гантели, тренажёр, кабельный тренажёр, кроссовер, гиря, и т.д.). Не подменяй один тип другим.
- nameRu — как это упражнение реально называют в русскоязычных залах
- aliases — популярные синонимы, которые используют тренеры и спортсмены

Ответ — ТОЛЬКО валидный JSON, без markdown-блоков, без пояснений.`

function makeUserPrompt(exercise) {
  const input = {
    name: exercise.name,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    instructions: exercise.instructions?.slice(0, 3),
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

function getProvider(name) {
  const providers = {
    haiku: {
      name: 'Claude Haiku 3.5',
      envKey: 'ANTHROPIC_API_KEY',
      call: async (exercise) => {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
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
    gemini: {
      name: 'Gemini 2.0 Flash',
      envKey: 'GOOGLE_AI_KEY',
      call: async (exercise) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_KEY}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: makeUserPrompt(exercise) }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        return {
          text: data.candidates[0].content.parts[0].text,
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        }
      },
    },
    openai: {
      name: 'GPT-4.1 nano',
      envKey: 'OPENAI_API_KEY',
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
    deepseek: {
      name: 'DeepSeek V3',
      envKey: 'DEEPSEEK_API_KEY',
      call: async (exercise) => {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
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
  }

  const provider = providers[name]
  if (!provider) {
    console.error(`Неизвестный провайдер: ${name}`)
    console.error(`Доступные: ${Object.keys(providers).join(', ')}`)
    process.exit(1)
  }
  if (!process.env[provider.envKey]) {
    console.error(`Не задан ${provider.envKey} в env`)
    process.exit(1)
  }
  return provider
}

// ─── Slug генерация ────────────────────────────────────────────────────

function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Парсинг JSON из LLM-ответа ────────────────────────────────────────

function parseJSON(text) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned)
}

// ─── Конвертация сырого упражнения → enriched формат ────────────────────

function rawToEnriched(raw, llmData) {
  return {
    slug: makeSlug(raw.name),
    nameEn: raw.name,
    nameRu: llmData.nameRu,
    bodyweight: raw.equipment === 'body only',
    primaryMuscles: raw.primaryMuscles || [],
    secondaryMuscles: raw.secondaryMuscles || [],
    equipment: raw.equipment || 'other',
    level: raw.level || 'beginner',
    mechanic: raw.mechanic || 'compound',
    force: raw.force || null,
    category: raw.category || 'strength',
    instructions: raw.instructions || [],
    images: raw.images || [],
    gifUrl: null,
    source: 'free-exercise-db',
    aliases: llmData.aliases || [],
    descriptionRu: llmData.descriptionRu || null,
    typicalMistakes: llmData.typicalMistakes || null,
  }
}

// ─── Delay ──────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Парсим аргумент --provider=<name>
  const providerArg = process.argv
    .find((a) => a.startsWith('--provider='))
    ?.split('=')[1]

  if (!providerArg) {
    console.error('Использование: node scripts/enrichExercises.js --provider=<haiku|gemini|openai|deepseek>')
    process.exit(1)
  }

  const provider = getProvider(providerArg)
  console.log(`Провайдер: ${provider.name}\n`)

  // Загружаем данные
  let rawExercises
  try {
    rawExercises = JSON.parse(readFileSync(RAW_PATH, 'utf-8'))
  } catch {
    console.error(`Файл не найден: ${RAW_PATH}`)
    console.error('Сначала запустите: node scripts/fetchFreeExerciseDB.js')
    process.exit(1)
  }

  // Загружаем существующие enriched (чтобы не перезатирать ручные данные)
  let existingEnriched = []
  try {
    existingEnriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf-8'))
  } catch {
    console.log('enriched-exercises.json не найден, создаём с нуля')
  }

  const existingBySlug = new Map(existingEnriched.map((ex) => [ex.slug, ex]))
  console.log(`Существующих: ${existingBySlug.size}`)

  // Загружаем checkpoint если есть
  let checkpoint = new Map()
  if (existsSync(CHECKPOINT_PATH)) {
    try {
      const cp = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf-8'))
      checkpoint = new Map(cp.map((ex) => [ex.slug, ex]))
      console.log(`Checkpoint найден: ${checkpoint.size} упражнений`)
    } catch {
      console.log('Checkpoint повреждён, начинаем с нуля')
    }
  }

  // Определяем что нужно обогатить
  const toEnrich = rawExercises.filter((raw) => {
    const slug = makeSlug(raw.name)
    return !existingBySlug.has(slug) && !checkpoint.has(slug)
  })

  console.log(`Всего в Free Exercise DB: ${rawExercises.length}`)
  console.log(`Уже обогащено: ${existingBySlug.size + checkpoint.size}`)
  console.log(`Осталось обогатить: ${toEnrich.length}\n`)

  if (toEnrich.length === 0) {
    console.log('Все упражнения уже обогащены!')
    mergeAndSave(existingBySlug, checkpoint)
    return
  }

  // Обогащаем
  let totalIn = 0
  let totalOut = 0
  let errors = 0
  const newEnriched = []

  for (let i = 0; i < toEnrich.length; i++) {
    const raw = toEnrich[i]
    const slug = makeSlug(raw.name)
    const progress = `[${i + 1}/${toEnrich.length}]`

    try {
      const result = await provider.call(raw)
      const parsed = parseJSON(result.text)
      const enriched = rawToEnriched(raw, parsed)

      newEnriched.push(enriched)
      checkpoint.set(slug, enriched)

      totalIn += result.inputTokens
      totalOut += result.outputTokens

      console.log(`${progress} ✓ ${slug} → ${parsed.nameRu}`)
    } catch (e) {
      errors++
      console.log(`${progress} ✗ ${slug}: ${e.message}`)

      // При ошибке всё равно добавляем с пустыми русскими полями
      const fallback = rawToEnriched(raw, {
        nameRu: raw.name,
        aliases: [],
        descriptionRu: null,
        typicalMistakes: null,
      })
      fallback.source = 'free-exercise-db-unenriched'
      newEnriched.push(fallback)
      checkpoint.set(slug, fallback)
    }

    // Checkpoint
    if ((i + 1) % BATCH_SIZE === 0) {
      saveCheckpoint(checkpoint)
      console.log(`  💾 Checkpoint: ${checkpoint.size} упражнений сохранено`)
    }

    // Rate limit
    if (i < toEnrich.length - 1) {
      await delay(DELAY_MS)
    }
  }

  // Финальное сохранение
  saveCheckpoint(checkpoint)
  mergeAndSave(existingBySlug, checkpoint)

  console.log(`\n${'═'.repeat(50)}`)
  console.log('=== ГОТОВО ===')
  console.log(`Обогащено: ${newEnriched.length - errors}`)
  console.log(`Ошибок (добавлены без перевода): ${errors}`)
  console.log(`Токены: ${totalIn}in / ${totalOut}out`)
  console.log(`Итого в enriched-exercises.json: ${existingBySlug.size + checkpoint.size}`)
}

function saveCheckpoint(checkpoint) {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify([...checkpoint.values()], null, 2))
}

function mergeAndSave(existingBySlug, checkpoint) {
  // Существующие (ручные) имеют приоритет
  const merged = new Map(checkpoint)
  for (const [slug, ex] of existingBySlug) {
    merged.set(slug, ex)
  }

  const result = [...merged.values()]
  writeFileSync(ENRICHED_PATH, JSON.stringify(result, null, 2))
  console.log(`\nСохранено: ${ENRICHED_PATH} (${result.length} упражнений)`)
}

main().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
