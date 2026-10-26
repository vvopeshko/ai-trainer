/**
 * Exercise matcher — the step of exerciseResolver before creating a new
 * exercise: is an unknown name ("жим гантелей на скамье под углом",
 * 'incline-db-press') really new, or an existing catalog exercise under another
 * name? Similar catalog exercises are picked by shared name stems, then one LLM
 * call decides for the whole batch: a candidate, or a new exercise — already
 * classified (muscles, equipment, target muscle…) instead of an empty record.
 */
import { z } from 'zod'
import prisma from '../utils/prisma.js'
import { chat } from '../utils/llm.js'
import { parseJsonFromLLM } from '../utils/parseJsonFromLLM.js'
import { TARGET_MUSCLES } from './exerciseTargets.js'
import { TRACKING_TYPES, MOVEMENT_PATTERNS, JOINTS } from './exerciseAttributes.js'

const MAX_CANDIDATES = 8
const LLM_BATCH = 15
const CATALOG_TTL_MS = 10 * 60_000

// ─── Candidates (pure) ──────────────────────────────────────────────────

const STOP = new Set(['для', 'при', 'или', 'the', 'and', 'with', 'from', 'одной', 'двумя', 'хватом'])
const norm = s => (s ?? '').toLowerCase().replace(/ё/g, 'е')

/** Word stems of a text: ≥3 letters, first 5 chars — «гантелей»/«гантели» meet. */
export function stems(text) {
  return new Set(norm(text).split(/[^a-zа-я0-9]+/)
    .filter(w => w.length >= 3 && !STOP.has(w)).map(w => w.slice(0, 5)))
}

const inputText = input => [input.nameRu, input.nameEn, input.slug?.replace(/-/g, ' ')].filter(Boolean).join(' ')

/**
 * Up to `limit` catalog exercises sharing the most name stems with the input
 * (Russian and English names, aliases). Ties: catalog before auto-created.
 */
export function rankCandidates(input, catalog, limit = MAX_CANDIDATES) {
  const own = stems(inputText(input))
  if (!own.size) return []
  return catalog
    .map(ex => {
      const theirs = stems([ex.nameRu, ex.nameEn, ...(ex.aliases ?? [])].join(' '))
      const shared = [...own].filter(s => theirs.has(s)).length
      return { ex, score: shared / own.size }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || (a.ex.source === 'seed' ? -1 : 0) - (b.ex.source === 'seed' ? -1 : 0))
    .slice(0, limit)
    .map(c => c.ex)
}

// ─── LLM decision ───────────────────────────────────────────────────────

const MUSCLES = ['abdominals', 'obliques', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes',
  'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps']
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'bands', 'body only', 'e-z curl bar',
  'medicine ball', 'exercise ball', 'foam roll', 'other']

const SYSTEM = `Ты сопоставляешь названия упражнений из программ тренировок с каталогом приложения для зала.
Для каждого пункта даны название(я) и кандидаты из каталога (slug — русское / английское название — оборудование (также: другие названия)).
- Если это то же упражнение, что один из кандидатов (то же движение и тот же снаряд; разница только в формулировке, языке, сокращении) — ответ {"match": "<slug кандидата>"}.
- Иначе (другой снаряд, другое движение, другой угол скамьи или хват, меняющий упражнение) — новое упражнение: {"new": {...}} с полями:
  nameRu (устоявшееся зальное название), nameEn,
  primaryMuscles и secondaryMuscles — из: ${MUSCLES.join(', ')},
  equipment — одно из: ${EQUIPMENT.join(', ')},
  category — compound | isolation | stretch | cardio,
  targetMuscle — одна из: ${TARGET_MUSCLES.join(', ')} или none,
  force — push | pull | static,
  unilateral — true, если одной рукой/ногой за раз,
  trackingType — ${TRACKING_TYPES.join(' | ')} (вес×повторы; свой вес; гравитрон/резинка; время; дистанция),
  movementPattern — один из: ${MOVEMENT_PATTERNS.join(', ')},
  jointStress — суставы, при травме которых тренер исключил бы упражнение, из: ${JOINTS.join(', ')} (тренажёры обычно []),
  stable — true, если тренажёр/блок/опора.
Не выдумывай совпадение: если сомневаешься — new.
Ответ — только JSON {"<id пункта>": {"match": "..."} | {"new": {...}}, ...} для всех пунктов.`

const newSchema = z.object({
  nameRu: z.string().min(2).max(120),
  nameEn: z.string().max(120).optional().nullable(),
  primaryMuscles: z.array(z.enum(MUSCLES)).max(3).catch([]),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(6).catch([]),
  equipment: z.enum(EQUIPMENT).optional().catch(undefined),
  category: z.enum(['compound', 'isolation', 'stretch', 'cardio']).optional().catch(undefined),
  targetMuscle: z.string().optional().nullable().transform(t => (TARGET_MUSCLES.includes(t) ? t : null)),
  force: z.enum(['push', 'pull', 'static']).optional().catch(undefined),
  unilateral: z.boolean().optional().catch(undefined),
  trackingType: z.enum(TRACKING_TYPES).optional().catch(undefined),
  movementPattern: z.enum(MOVEMENT_PATTERNS).optional().catch(undefined),
  jointStress: z.array(z.enum(JOINTS)).max(7).optional().catch(undefined),
  stable: z.boolean().optional().catch(undefined),
})

// Aliases matter: «Румынская тяга с гантелями» is only an alias of the catalog's
// «Становая тяга на прямых ногах с гантелями».
const line = (c, i) => `   ${i + 1}. ${c.slug} — ${c.nameRu}${c.nameEn ? ` / ${c.nameEn}` : ''}${c.equipment?.length ? ` — ${c.equipment.join(', ')}` : ''}`
  + (c.aliases?.length ? ` (также: ${c.aliases.slice(0, 3).join('; ')})` : '')

/**
 * Pure: turns the LLM answer into decisions. A match must be one of the
 * item's candidates; anything unparsable is left out (caller falls back).
 * @returns {Map<string, {match: object} | {fields: object}>}
 */
export function parseDecisions(answer, items) {
  const decisions = new Map()
  for (const { key, candidates } of items) {
    const d = answer?.[key]
    if (typeof d?.match === 'string') {
      const ex = candidates.find(c => c.slug === d.match)
      if (ex) decisions.set(key, { match: ex })
    } else if (d?.new) {
      const parsed = newSchema.safeParse(d.new)
      if (parsed.success) decisions.set(key, { fields: parsed.data })
    }
  }
  return decisions
}

// ─── Catalog cache ──────────────────────────────────────────────────────

let catalogCache = null
async function catalog() {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.list
  // Users' own exercises are private: never a candidate for someone else's name.
  const list = await prisma.exercise.findMany({
    where: { source: { not: 'user_created' } },
    select: { id: true, slug: true, nameRu: true, nameEn: true, aliases: true, equipment: true, source: true },
  })
  catalogCache = { at: Date.now(), list }
  return list
}

/** The catalog changed (an exercise created or renamed): next match reloads it. */
export function forgetCatalog() {
  catalogCache = null
}

/**
 * Decides for inputs the resolver did not find exactly. Never throws: on an
 * LLM or parse failure the affected inputs are simply absent from the result.
 * `classifyOnly` — no candidates: the user already said it is a new exercise,
 * only its fields are wanted.
 *
 * @param {Array<[string, {slug?, nameEn?, nameRu?}]>} entries — [key, input]
 * @returns {Promise<Map<string, {match: object} | {fields: object}>>}
 */
export async function matchUnknownExercises(entries, { classifyOnly = false } = {}) {
  const decisions = new Map()
  if (!entries.length) return decisions
  let list = []
  if (!classifyOnly) {
    try {
      list = await catalog()
    } catch (e) {
      console.warn('[exerciseMatcher] catalog load failed:', e.message)
      return decisions
    }
  }
  const items = entries.map(([key, input], i) => ({ key, id: String(i + 1), input, candidates: classifyOnly ? [] : rankCandidates(input, list) }))
  for (let i = 0; i < items.length; i += LLM_BATCH) {
    const batch = items.slice(i, i + LLM_BATCH)
    const prompt = batch.map(it => [
      `[${it.id}] ${[it.input.nameRu, it.input.nameEn, it.input.slug].filter(Boolean).join(' | ')}`,
      it.candidates.length ? it.candidates.map(line).join('\n') : '   (кандидатов нет)',
    ].join('\n')).join('\n\n')
    try {
      const { text } = await chat([{ role: 'user', content: prompt }],
        { system: SYSTEM, maxTokens: 4000, meta: { feature: 'exercise_resolve' } })
      const byId = parseDecisions(parseJsonFromLLM(text), batch.map(it => ({ key: it.id, candidates: it.candidates })))
      for (const it of batch) if (byId.has(it.id)) decisions.set(it.key, byId.get(it.id))
    } catch (e) {
      console.warn('[exerciseMatcher] LLM match failed:', e.message)
    }
  }
  return decisions
}
