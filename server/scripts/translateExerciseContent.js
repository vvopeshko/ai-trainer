/**
 * One-time LLM pass for Russian exercise content: technique steps in Russian
 * for every catalog exercise, plus a description and typical mistakes where
 * the catalog has none. Writes data/exercise-ru-content.json (resumable),
 * which is folded into enriched-exercises.json as instructionsRu /
 * descriptionRu / typicalMistakes.
 *
 *   cd server && node --env-file=.env scripts/translateExerciseContent.js
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { chat } from '../src/utils/llm.js'
import { parseJsonFromLLM } from '../src/utils/parseJsonFromLLM.js'

const DATA = new URL('../data/enriched-exercises.json', import.meta.url)
const OUT = new URL('../data/exercise-ru-content.json', import.meta.url)
const BATCH = 6
const PARALLEL = 5

const SYSTEM = `Ты — тренер, пишешь технику упражнений для русскоязычного приложения тренировок в зале.
Для каждого упражнения верни:
- steps: 3–6 коротких шагов техники на русском (перевод английских шагов, если они даны, — по смыслу, без кальки; «вы» не используй, повелительное наклонение: «Сядьте…», «Опустите…»). Если английских шагов нет — напиши сам.
- description (только если запрошено): 1–2 предложения — что за упражнение и на что работает.
- mistakes (только если запрошено): 1–2 предложения о типичных ошибках.
Ориентируйся на русское название — оно точнее английского там, где они расходятся.
Ответ — только JSON {"slug": {"steps": [...], "description"?: "...", "mistakes"?: "..."}, ...}.`

const catalog = JSON.parse(readFileSync(DATA, 'utf8'))
const content = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const save = () => writeFileSync(OUT, JSON.stringify(content, null, 1) + '\n')

const needsText = e => !e.descriptionRu
const block = e => [
  `### ${e.slug} — ${e.nameRu} (${e.nameEn})${needsText(e) ? ' [нужны description и mistakes]' : ''}`,
  ...(Array.isArray(e.instructions) ? e.instructions : [e.instructions ?? '']).filter(Boolean).map(s => `- ${s}`),
].join('\n')

async function translateBatch(batch) {
  const { text } = await chat([{ role: 'user', content: batch.map(block).join('\n\n') }], { system: SYSTEM, maxTokens: 6000 })
  const result = parseJsonFromLLM(text) ?? {}
  for (const e of batch) {
    const r = result[e.slug]
    if (!Array.isArray(r?.steps) || !r.steps.length) continue
    if (needsText(e) && !(r.description && r.mistakes)) continue
    content[e.slug] = r
  }
  save()
}

for (let attempt = 0; attempt < 2; attempt++) {
  const todo = catalog.filter(e => !content[e.slug])
  console.log(`${catalog.length} exercises, ${todo.length} to translate`)
  const batches = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(batches.slice(i, i + PARALLEL).map(b => translateBatch(b).catch(e => console.log('  batch failed:', e.message))))
    console.log(`  ${Math.min((i + PARALLEL) * BATCH, todo.length)}/${todo.length}`)
  }
}
console.log(`translated ${Object.keys(content).length}/${catalog.length}`)
