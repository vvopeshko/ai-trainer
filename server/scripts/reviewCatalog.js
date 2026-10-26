/**
 * One-time LLM review of the exercise catalog: wrong Russian names, muscles,
 * equipment, compound/isolation, push/pull, one-sided exercises, junk aliases.
 * Writes suggestions to data/catalog-review.json (resumable: reviewed slugs are
 * skipped). Suggestions are curated by hand and folded into
 * enriched-exercises.json — the script never edits the catalog itself.
 *
 *   cd server && node --env-file=.env scripts/reviewCatalog.js
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { chat } from '../src/utils/llm.js'
import { parseJsonFromLLM } from '../src/utils/parseJsonFromLLM.js'

const DATA = new URL('../data/enriched-exercises.json', import.meta.url)
const OUT = new URL('../data/catalog-review.json', import.meta.url)
const BATCH = 20
const PARALLEL = 4

const MUSCLES = 'abdominals, obliques, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps'
const EQUIPMENT = 'barbell, dumbbell, cable, machine, kettlebells, bands, body only, e-z curl bar, medicine ball, exercise ball, foam roll, other'

const SYSTEM = `Ты — тренер и редактор русскоязычного каталога упражнений для приложения тренировок в зале.
Для каждого упражнения проверь данные и верни ТОЛЬКО исправления. Поля:
- nameRu: русское название, если текущее неверно передаёт упражнение (не тот снаряд, не то движение, не та мышца, калька, латиница без нужды, дубль названия другого упражнения в этой пачке). Устоявшиеся зальные названия («жим лёжа», «французский жим», «гоблет-присед», «бабочка»). Без пояснений в скобках, кроме уточнения варианта.
- primaryMuscles / secondaryMuscles: массивы из списка: ${MUSCLES}. Меняй только при явной ошибке.
- equipment: одно из: ${EQUIPMENT}. Брусья, турник, тумба, скамья без веса — body only; блин — other; Смит, рычажные тренажёры — machine.
- mechanic: compound | isolation (одно суставное движение — isolation: сгибания, разгибания, разведения, махи, скручивания, подъёмы ног).
- force: push | pull | static.
- unilateral: true, если упражнение выполняется одной рукой/ногой за раз (поочерёдные двумя руками — false). Указывай ВСЕГДА.
- removeAliases: алиасы из текущего списка, которые неверны (другое упражнение, мусор вроде «(ошибочно)», пометки, английские дубли названия).
- addAliases: 0–3 частых способа, как русскоязычный человек в зале назовёт это упражнение, если их нет.
Ответ — только JSON {"slug": {...только изменённые поля + unilateral}, ...} для всех slug из пачки.`

const line = e => [e.slug, e.nameEn, e.nameRu, e.primaryMuscles.join('+'), e.secondaryMuscles.join('+'),
  e.equipment, e.mechanic, e.force ?? '', e.category, e.aliases.join('; ')].join(' | ')

const catalog = JSON.parse(readFileSync(DATA, 'utf8'))
const review = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const save = () => writeFileSync(OUT, JSON.stringify(review, null, 1) + '\n')

async function reviewBatch(batch) {
  const { text } = await chat([{ role: 'user', content:
    'slug | nameEn | nameRu | primary | secondary | equipment | mechanic | force | category | aliases\n' + batch.map(line).join('\n') }],
  { system: SYSTEM, maxTokens: 6000 })
  const result = parseJsonFromLLM(text) ?? {}
  for (const e of batch) if (result[e.slug] && typeof result[e.slug] === 'object') review[e.slug] = result[e.slug]
  save()
}

for (let attempt = 0; attempt < 2; attempt++) {
  const todo = catalog.filter(e => !review[e.slug])
  console.log(`${catalog.length} exercises, ${todo.length} to review`)
  const batches = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(batches.slice(i, i + PARALLEL).map(b => reviewBatch(b).catch(e => console.log('  batch failed:', e.message))))
    console.log(`  ${Math.min((i + PARALLEL) * BATCH, todo.length)}/${todo.length}`)
  }
}
console.log(`reviewed ${Object.keys(review).length}/${catalog.length}`)
