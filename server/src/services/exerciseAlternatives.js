import prisma from '../utils/prisma.js'
import { targetMuscle, slugsWithTarget } from './exerciseTargets.js'

const SELECT = { id: true, nameRu: true, slug: true, equipment: true, primaryMuscles: true, category: true, source: true }
const MAX_ALTERNATIVES = 6

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))

// Gym tools first; foam rollers, medicine balls and "other" are rarely a swap.
const GYM = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'e-z curl bar', 'kettlebells', 'body only'])
const ODD = new Set(['foam roll', 'medicine ball', 'exercise ball', 'other'])
// The catalog labels some stretches/drills as compound/isolation.
const NOT_A_SWAP = /растяж|релиз|мфр|самомасс|разминк|мобилиз|бросок|броски|взгляд|вис\b|партн/i
// One side of a unilateral exercise is the same swap: «(левая нога)» / «(правая)».
const baseName = name => name.replace(/\s*\((лев|прав|left|right)[^)]*\)/gi, '').trim().toLowerCase()
const STOP = new Set(['рук', 'руки', 'ног', 'стоя', 'сидя', 'лежа', 'лёжа', 'для', 'при', 'одной', 'двумя', 'хватом', 'тренажере', 'тренажёре'])
// Name stems approximate the movement ("Сгибания…", "Разгибания ног…", "Тяга…").
// Tool words are not the movement: «…со штангой» must not pair a squat with a hip thrust.
const TOOL = /^(штанг|гантел|гир|блок|тренаж|кабел|канат|кроссовер|смит|фитбол|медбол|эспандер|петл|скамь)/
const stems = (name, { tools = true } = {}) => new Set(name.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я]+/)
  .filter(w => w.length >= 3 && !STOP.has(w) && (tools || !TOOL.test(w))).map(w => w.slice(0, 5)))

/**
 * Pure ranking of catalog candidates for one exercise ("суть одна"): the same
 * main muscle and category are required by the query; here the same movement
 * (shared name stems) and muscle set weigh most, then a gym tool different
 * from the original, catalog entries, and anything the user already trains.
 */
export function rankAlternatives(target, pool, usage = new Map()) {
  const own = stems(target.nameRu)
  const ownMovement = stems(target.nameRu, { tools: false })
  const sharedStems = ex => [...stems(ex.nameRu)].filter(w => own.has(w)).length
  const sameMovement = ex => [...stems(ex.nameRu, { tools: false })].some(w => ownMovement.has(w))
  const score = ex => {
    const shared = sharedStems(ex)
    return 2 * Math.min(shared, 2)
      + (sameSet(ex.primaryMuscles, target.primaryMuscles) ? 2 : 0)
      + (ex.equipment.some(e => GYM.has(e)) ? 1.5 : 0) - (ex.equipment.some(e => ODD.has(e)) ? 3 : 0)
      + (sameSet(ex.equipment, target.equipment) ? 0 : 1)
      + (ex.source === 'seed' ? 0.5 : 0)
  }
  const sorted = pool
    .filter(ex => ex.id !== target.id && baseName(ex.nameRu) !== baseName(target.nameRu) && !NOT_A_SWAP.test(ex.nameRu))
    .map(ex => ({ ...ex, usedCount: usage.get(ex.id) ?? 0, score: score(ex) }))
    .sort((a, b) => (b.usedCount > 0) - (a.usedCount > 0) || b.score - a.score
      || b.usedCount - a.usedCount || a.nameRu.localeCompare(b.nameRu, 'ru'))
    // Catalog duplicates under different slugs and left/right sides: one per name.
    .filter((ex, i, all) => all.findIndex(o => baseName(o.nameRu) === baseName(ex.nameRu)) === i)
  // Within one target muscle, keep the same movement (жим ногами ↔ жим ногами,
  // not lunges) and what the user already does — when there is any of those.
  const close = sorted.filter(ex => sameMovement(ex) || ex.usedCount > 0)
  const ranked = close.length ? close : sorted
  // Variety at the top: at most two of the same tool before the rest.
  const perTool = new Map(), head = [], tail = []
  for (const ex of ranked) {
    const tool = [...ex.equipment].sort().join('+')
    const n = perTool.get(tool) ?? 0
    perTool.set(tool, n + 1)
    ;(n < 2 || ex.usedCount > 0 ? head : tail).push(ex)
  }
  return [...head, ...tail]
}

/**
 * Close catalog alternatives for an exercise, ranked for this user: the SAME
 * target muscle ("верх груди", not just "грудь") and the same kind of exercise
 * (compound ↔ compound, isolation ↔ isolation). No known target — no
 * alternatives: better none than a wrong one.
 */
export async function findAlternatives(userId, exerciseId, { limit = 8 } = {}) {
  const target = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: SELECT })
  const muscle = target && targetMuscle(target.slug)
  if (!muscle) return []
  // The kind (compound/isolation) is reliable for catalog exercises only:
  // exercises created later get the default 'compound'.
  const pool = await prisma.exercise.findMany({
    where: {
      id: { not: target.id }, slug: { in: slugsWithTarget(muscle) },
      ...(target.source === 'seed' ? { category: target.category } : { category: { in: ['compound', 'isolation'] } }),
    },
    select: SELECT,
  })
  if (!pool.length) return []
  // Working sets per exercise: what the user actually does ranks first.
  const usage = await prisma.workoutSet.groupBy({
    by: ['exerciseId'],
    where: { exerciseId: { in: pool.map(e => e.id) }, isWarmup: false, workout: { userId, finishedAt: { not: null } } },
    _count: { workoutId: true },
  })
  const used = new Map(usage.map(u => [u.exerciseId, u._count.workoutId]))
  return rankAlternatives(target, pool, used).slice(0, limit)
}

async function activeProgram(userId) {
  return prisma.program.findFirst({ where: { userId, isActive: true }, select: { id: true, planJson: true } })
}

/**
 * Updates one slot of the active program: remembers a chosen alternative and,
 * with makeMain, makes it the main exercise (the old main becomes the first
 * alternative). The program and history of old exercises stay as they are.
 */
export async function updateSlot(userId, { dayIndex, mainExerciseId, exerciseId, makeMain }) {
  const program = await activeProgram(userId)
  const slot = program?.planJson?.days?.[dayIndex]?.exercises?.find(e => e.exerciseId === mainExerciseId)
  if (!slot) return null
  const alternatives = (slot.alternatives ?? []).filter(id => id !== exerciseId && id !== mainExerciseId)
  slot.alternativesAuto = false
  if (makeMain && exerciseId !== mainExerciseId) {
    const next = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { id: true, nameRu: true, slug: true } })
    if (!next) return null
    slot.exerciseId = next.id
    slot.nameRu = next.nameRu
    slot.slug = next.slug
    slot.alternatives = [mainExerciseId, ...alternatives].slice(0, MAX_ALTERNATIVES)
  } else if (exerciseId !== mainExerciseId) {
    slot.alternatives = [...alternatives, exerciseId].slice(-MAX_ALTERNATIVES)
  }
  await prisma.program.update({ where: { id: program.id }, data: { planJson: program.planJson } })
  return slot
}

/**
 * Fill: up to `perSlot` alternatives for every slot that has none, plus the
 * slots listed in `replace` ({ dayIndex, exerciseId }) and, with `refreshAuto`,
 * every slot still marked as auto-filled — to refresh after matching improved. Filled slots are marked
 * `alternativesAuto`; a choice made by the user clears the mark.
 */
export async function fillProgramAlternatives(userId, { perSlot = 3, replace = [], refreshAuto = false } = {}) {
  const program = await activeProgram(userId)
  if (!program) return { filled: 0, slots: 0 }
  const cache = new Map()
  let filled = 0, slots = 0
  for (const [dayIndex, day] of (program.planJson?.days ?? []).entries()) {
    for (const slot of day.exercises ?? []) {
      slots++
      const listed = replace.some(r => r.dayIndex === dayIndex && r.exerciseId === slot.exerciseId)
        || (refreshAuto && slot.alternativesAuto === true)
      if (!slot.exerciseId || (slot.alternatives?.length && !listed)) continue
      if (!cache.has(slot.exerciseId)) cache.set(slot.exerciseId, await findAlternatives(userId, slot.exerciseId, { limit: perSlot }))
      const ids = cache.get(slot.exerciseId).map(e => e.id)
      if (ids.length || listed) { slot.alternatives = ids; slot.alternativesAuto = true; filled++ }
    }
  }
  if (filled) await prisma.program.update({ where: { id: program.id }, data: { planJson: program.planJson } })
  return { filled, slots }
}

/**
 * "Make it main?" hint: an alternative done in the last two finished workouts
 * of this program day while the main exercise was not done in either.
 */
export async function makeMainHints(userId, programId, dayIndex, planExercises) {
  const recent = await prisma.workout.findMany({
    where: { userId, programId, programDayIndex: dayIndex, finishedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    take: 2,
    select: { sets: { where: { isWarmup: false }, select: { exerciseId: true } } },
  })
  if (recent.length < 2) return new Map()
  const done = recent.map(w => new Set(w.sets.map(s => s.exerciseId)))
  const hints = new Map()
  for (const pe of planExercises) {
    if (done.some(ids => ids.has(pe.exerciseId))) continue
    const alt = (pe.alternatives ?? []).find(id => done.every(ids => ids.has(id)))
    if (alt) hints.set(pe.exerciseId, alt)
  }
  return hints
}
