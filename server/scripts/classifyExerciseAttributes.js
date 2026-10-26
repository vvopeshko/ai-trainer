/**
 * One-time LLM classification of catalog attributes (services/exerciseAttributes.js):
 * trackingType, movementPattern, jointStress, stable. Resumable: writes
 * data/exercise-attributes.json, slugs already there are skipped; the result is
 * folded into enriched-exercises.json and the seed carries it to Exercise.
 *
 *   cd server && node --env-file=.env scripts/classifyExerciseAttributes.js
 * Строгая переразметка только суставов (первый проход метил слишком много):
 *   cd server && node --env-file=.env scripts/classifyExerciseAttributes.js --joints
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { chat } from '../src/utils/llm.js'
import { parseJsonFromLLM } from '../src/utils/parseJsonFromLLM.js'
import { TRACKING_TYPES, MOVEMENT_PATTERNS, JOINTS } from '../src/services/exerciseAttributes.js'

const DATA = new URL('../data/enriched-exercises.json', import.meta.url)
const OUT = new URL('../data/exercise-attributes.json', import.meta.url)
const BATCH = 40
const PARALLEL = 4

const SYSTEM = `Ты — тренер по силовым тренировкам. Для каждого упражнения определи:
- trackingType — что записывается в подходе:
  weight_reps — вес снаряда × повторы (штанга, гантели, блок, тренажёр, гиря);
  bodyweight_reps — повторы с весом тела, можно с доп. весом (подтягивания, отжимания, брусья, выпады без веса, скручивания);
  assisted_bodyweight — вес тела с помощью: гравитрон, подтягивания с резинкой (вес = помощь);
  duration — время (планка, вис, растяжки, удержания, кардио по времени);
  distance — дистанция (бег, гребля, прогулка фермера, толкание саней).
- movementPattern — один из: ${MOVEMENT_PATTERNS.join(', ')}.
  Ориентиры: жимы лёжа и отжимания → horizontal_push; жимы над головой → vertical_push; тяги к поясу → horizontal_pull;
  подтягивания и вертикальные тяги → vertical_pull; разведения/сведения/кроссовер/бабочка → chest_fly; махи в стороны → shoulder_abduction;
  подъёмы вперёд → shoulder_flexion; обратные разведения, фейс-пул → rear_delt; становые, румынская, гуд монинг, гиперэкстензия → hinge;
  ягодичный мост, хип-траст, отведение ноги назад → hip_extension; разгибание/сгибание ног → knee_extension/knee_flexion;
  сгибания на бицепс → elbow_flexion; разгибания на трицепс, французский жим → elbow_extension; скручивания, подъёмы ног → core_flexion;
  планки, антиротация → core_stability; рывки, толчки, взятия → olympic; прыжки → plyometric; растяжки и МФР → stretch.
- jointStress — суставы, которые упражнение заметно нагружает (важно для людей с травмами), из: ${JOINTS.join(', ')}. Пустой массив, если щадящее.
  Например: присед со штангой → [knee, lower_back]; становая → [lower_back]; жим над головой → [shoulder]; брусья → [shoulder, elbow];
  разгибание ног в тренажёре → [knee]; жим ногами → [knee]; тяга в наклоне со штангой → [lower_back]; сгибания на бицепс → [] (или [elbow] при тяжёлых вариантах).
- stable — true, если траектория задана или есть опора (тренажёр, блок, Смит, упор грудью/спиной в скамью): мало нагрузки на стабилизацию.
Ответ — только JSON {"slug": {"trackingType": "...", "movementPattern": "...", "jointStress": [...], "stable": true|false}, ...} для всех slug.`

// Joints only, strictly: what a coach removes for a client with that injury.
const JOINTS_SYSTEM = `Ты — тренер, работающий с клиентами после травм. Для каждого упражнения укажи jointStress —
суставы, при травме которых ты ИСКЛЮЧИЛ бы это упражнение из программы (а не просто «сустав участвует»), из: ${JOINTS.join(', ')}.
Критерии: lower_back — осевая нагрузка на позвоночник или наклон с весом (присед и становая со штангой, тяга в наклоне, гуд монинг, рывки);
knee — глубокое сгибание колена под большим весом или ударная нагрузка (присед, выпады, жим ногами глубоко, разгибание ног, прыжки);
shoulder — руки над головой с весом, глубокое растяжение плеча под весом, нестабильное положение (жим над головой, брусья, жим штанги лёжа широким хватом, пуловер, тяга за голову, висы с весом);
elbow, wrist, hip, neck — только если сустав — явное слабое место упражнения (французский жим → elbow; фронтальный присед → wrist).
Тренажёры с фиксированной траекторией, блоки и лёгкие изолирующие обычно щадящие → пустой массив. Будь строг: пустой массив — норма.
Ответ — только JSON {"slug": ["knee", ...], ...} для всех slug.`

const line = e => [e.slug, e.nameRu, e.nameEn, e.equipment, e.category, e.mechanic, e.primaryMuscles.join('+')].join(' | ')

const catalog = JSON.parse(readFileSync(DATA, 'utf8'))
const result = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const save = () => writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n')

const valid = a => a && TRACKING_TYPES.includes(a.trackingType) && MOVEMENT_PATTERNS.includes(a.movementPattern)
  && Array.isArray(a.jointStress) && a.jointStress.every(j => JOINTS.includes(j)) && typeof a.stable === 'boolean'

async function classify(batch) {
  const { text } = await chat([{ role: 'user', content: 'slug | nameRu | nameEn | equipment | category | mechanic | primary\n' + batch.map(line).join('\n') }],
    { system: SYSTEM, maxTokens: 6000 })
  const answer = parseJsonFromLLM(text) ?? {}
  for (const e of batch) if (valid(answer[e.slug])) result[e.slug] = answer[e.slug]
  save()
}

if (process.argv.includes('--joints')) {
  const done = new Set()
  for (let attempt = 0; attempt < 2; attempt++) {
    const todo = catalog.filter(e => result[e.slug] && !done.has(e.slug))
    console.log(`joints: ${todo.length} to re-classify`)
    const batches = []
    for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
    for (let i = 0; i < batches.length; i += PARALLEL) {
      await Promise.all(batches.slice(i, i + PARALLEL).map(async batch => {
        const { text } = await chat([{ role: 'user', content: 'slug | nameRu | nameEn | equipment | category | mechanic | primary\n' + batch.map(line).join('\n') }],
          { system: JOINTS_SYSTEM, maxTokens: 4000 })
        const answer = parseJsonFromLLM(text) ?? {}
        for (const e of batch) {
          const joints = answer[e.slug]
          if (Array.isArray(joints) && joints.every(j => JOINTS.includes(j))) { result[e.slug].jointStress = joints; done.add(e.slug) }
        }
        save()
      }).map(p => p.catch(e => console.log('  batch failed:', e.message))))
      console.log(`  ${Math.min((i + PARALLEL) * BATCH, todo.length)}/${todo.length}`)
    }
  }
  console.log(`joints re-classified ${done.size}`)
  process.exit(0)
}

for (let attempt = 0; attempt < 2; attempt++) {
  const todo = catalog.filter(e => !result[e.slug])
  console.log(`${catalog.length} exercises, ${todo.length} to classify`)
  const batches = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(batches.slice(i, i + PARALLEL).map(b => classify(b).catch(e => console.log('  batch failed:', e.message))))
    console.log(`  ${Math.min((i + PARALLEL) * BATCH, todo.length)}/${todo.length}`)
  }
}
console.log(`classified ${Object.keys(result).length}/${catalog.length}`)
