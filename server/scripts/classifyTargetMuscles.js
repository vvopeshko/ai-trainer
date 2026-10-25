/**
 * Target muscle of every catalog exercise: the one muscle (region) it mainly
 * works — finer than primaryMuscles ("верх груди", not "грудь"). Powers close
 * alternatives (same target only) and the target shown in the exercise sheet.
 *
 * One-time LLM classification, resumable: slugs already in the output file are
 * skipped. Result is committed as data/exercise-targets.json and shipped with
 * the code (no schema change, no seeding).
 *
 *   cd server && node --env-file=.env scripts/classifyTargetMuscles.js
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { chat } from '../src/utils/llm.js'
import { parseJsonFromLLM } from '../src/utils/parseJsonFromLLM.js'
import { TARGET_MUSCLES } from '../src/services/exerciseTargets.js'

const DATA = new URL('../data/enriched-exercises.json', import.meta.url)
const OUT = new URL('../data/exercise-targets.json', import.meta.url)
const BATCH = 50

// Exercises created outside the seed (production catalog, no nameEn/muscles).
const EXTRA = [
  { slug: 'giperekstenzii-pod-45', nameRu: 'Гиперэкстензии под 45°' },
  { slug: 'makhi-v-storony-na-bloke-odnoj-rukoj', nameRu: 'Махи в стороны на блоке одной рукой' },
  { slug: 'palof-press-v-bloke', nameRu: 'Палоф-пресс в блоке' },
  { slug: 'tyaga-v-trenazhere-s-uporom', nameRu: 'Тяга в тренажёре с упором' },
]

const SYSTEM = `Ты — эксперт по силовым тренировкам. Для каждого упражнения определи ОДНУ целевую мышцу — ту, на которую оно работает в основном (как классифицирует тренер), из списка:
${TARGET_MUSCLES.join(', ')}, none.
Правила:
- Грудь: наклонные жимы/разведения головой вверх → upper_chest; горизонтальные жимы, сведения, отжимания, кроссовер → mid_chest; жимы под отрицательным углом, отжимания на брусьях с наклоном вперёд → lower_chest.
- Дельты: жимы над головой, подъёмы вперёд → front_delt; махи в стороны, тяга к подбородку → side_delt; обратные разведения, фейс-пул, тяга к лицу → rear_delt.
- Спина: вертикальные тяги, подтягивания, пуловеры → lats; горизонтальные тяги (к поясу/груди) → middle back; шраги → traps; гиперэкстензии, наклоны → lower back (если не явно ягодицы/бицепс бедра).
- Сгибания рук, «молотки» → biceps; разгибания, французский жим, жим узким хватом → triceps.
- Растяжки, МФР, кардио, разминка, броски, прыжки без целевой мышцы, олимпийские движения всего тела → none.
Ответ — только JSON-объект {"slug": "target", ...} для всех переданных slug-ов, без пояснений.`

const line = e => [e.slug, e.nameEn ?? '', e.nameRu, (e.primaryMuscles ?? []).join('+'), (e.secondaryMuscles ?? []).join('+'),
  e.mechanic ?? '', e.category ?? '', e.equipment ?? ''].join(' | ')

const seed = JSON.parse(readFileSync(DATA, 'utf8'))
const all = [...seed, ...EXTRA]
const targets = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const allowed = new Set([...TARGET_MUSCLES, 'none'])
let todo = all.filter(e => !targets[e.slug])
console.log(`${all.length} exercises, ${todo.length} to classify`)

for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH)
    const { text } = await chat([{ role: 'user', content:
      'slug | nameEn | nameRu | primary | secondary | mechanic | category | equipment\n' + batch.map(line).join('\n') }],
    { system: SYSTEM, maxTokens: 4000 })
    const result = parseJsonFromLLM(text) ?? {}
    for (const e of batch) if (allowed.has(result[e.slug])) targets[e.slug] = result[e.slug]
    writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(targets).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n')
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`)
  }
  todo = all.filter(e => !targets[e.slug])
}
console.log(todo.length ? `unclassified: ${todo.map(e => e.slug).join(', ')}` : 'all classified')
