/**
 * One-time LLM pass: which catalog exercises are the core — what a coach puts
 * into ordinary gym programs (~300 of 880), as opposed to strongman, olympic
 * variations, partner stretches and rare variants. Core exercises come first
 * in browsing and are what program generation chooses from.
 *
 * Writes `core: true|false` into data/enriched-exercises.json (resumable via
 * data/exercise-core.json). Exercises people already do (popularity) are added
 * on top of the LLM's choice by the seed's caller, not here.
 *
 *   cd server && node --env-file=.env scripts/classifyCoreExercises.js
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { chat } from '../src/utils/llm.js'
import { parseJsonFromLLM } from '../src/utils/parseJsonFromLLM.js'

const DATA = new URL('../data/enriched-exercises.json', import.meta.url)
const OUT = new URL('../data/exercise-core.json', import.meta.url)
const BATCH = 60
const PARALLEL = 4

const SYSTEM = `Ты — тренер в обычном фитнес-зале. Отметь core: true для упражнений, которые реально ставят в программы
для зала (новичкам и продолжающим): базовые жимы, тяги, приседы, выпады, становые, тренажёры и блоки, изоляция на все
мышцы, распространённые варианты с гантелями/штангой/гирей, подтягивания, отжимания, брусья, основные упражнения на пресс,
кардиотренажёры. core: false — стронгмен (покрышки, сани, камни), олимпийские и их редкие вариации, упражнения с партнёром,
экзотические и редкие вариации одного и того же, специальные упражнения пауэрлифтинга (цепи, резины, доски), растяжки и МФР.
Ориентир: примерно треть списка — core. Ответ — только JSON {"slug": true|false, ...} для всех slug.`

const catalog = JSON.parse(readFileSync(DATA, 'utf8'))
const result = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const save = () => writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n')
const line = e => [e.slug, e.nameRu, e.nameEn, e.equipment, e.category, e.movementPattern].join(' | ')

for (let attempt = 0; attempt < 2; attempt++) {
  const todo = catalog.filter(e => typeof result[e.slug] !== 'boolean')
  console.log(`${catalog.length} exercises, ${todo.length} to classify`)
  const batches = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(batches.slice(i, i + PARALLEL).map(async batch => {
      const { text } = await chat([{ role: 'user', content: 'slug | nameRu | nameEn | equipment | category | pattern\n' + batch.map(line).join('\n') }],
        { system: SYSTEM, maxTokens: 4000 })
      const answer = parseJsonFromLLM(text) ?? {}
      for (const e of batch) if (typeof answer[e.slug] === 'boolean') result[e.slug] = answer[e.slug]
      save()
    }).map(p => p.catch(e => console.log('  batch failed:', e.message))))
    console.log(`  ${Math.min((i + PARALLEL) * BATCH, todo.length)}/${todo.length}`)
  }
}

const missing = catalog.filter(e => typeof result[e.slug] !== 'boolean')
if (missing.length) {
  console.log(`unclassified: ${missing.map(e => e.slug).join(', ')} — re-run`)
} else {
  for (const e of catalog) e.core = result[e.slug]
  writeFileSync(DATA, JSON.stringify(catalog, null, 2))
  unlinkSync(OUT)
  console.log(`core: ${catalog.filter(e => e.core).length}/${catalog.length}, written to the catalog`)
}
