/**
 * Merging duplicate catalog exercises into one canonical exercise
 * (data/exercise-merges.json, applied by scripts/mergeExercises.js).
 * Pure parts: the merge map and rewriting program days.
 */

/** { fromSlug: toSlug } without comment keys; rejects chains and self-merges. */
export function loadMerges(json) {
  const merges = Object.fromEntries(Object.entries(json).filter(([from]) => !from.startsWith('_')))
  for (const [from, to] of Object.entries(merges)) {
    if (from === to) throw new Error(`Merge into itself: ${from}`)
    if (merges[to]) throw new Error(`Merge chain: ${from} → ${to} → ${merges[to]}`)
  }
  return merges
}

/**
 * Rewrites one day's exercise list: merged exercises point to the canonical
 * one (id, slug, name), alternatives too. When a merge leaves the same
 * exercise twice in a day (left and right side), the first entry stays.
 *
 * @param {Array} exercises — [{ exerciseId, slug, nameRu, alternatives? }]
 * @param {Map<string, {id, slug, nameRu}>} byOldId — merged id → canonical exercise
 * @returns {{ exercises: Array, changed: boolean }}
 */
export function rewriteDayExercises(exercises, byOldId) {
  if (!Array.isArray(exercises)) return { exercises, changed: false }
  let changed = false
  const out = []
  const merged = new Set()
  for (const item of exercises) {
    const target = byOldId.get(item.exerciseId)
    let next = item
    if (target) {
      next = { ...item, exerciseId: target.id, slug: target.slug, nameRu: target.nameRu }
      changed = true
    }
    if (Array.isArray(next.alternatives)) {
      const alternatives = [...new Set(next.alternatives.map(id => byOldId.get(id)?.id ?? id))]
        .filter(id => id !== next.exerciseId)
      if (alternatives.join() !== next.alternatives.join()) {
        next = { ...next, alternatives }
        changed = true
      }
    }
    const duplicate = out.some(o => o.exerciseId === next.exerciseId)
    if (duplicate && (target || merged.has(next.exerciseId))) continue
    if (target) merged.add(next.exerciseId)
    out.push(next)
  }
  return { exercises: changed ? out : exercises, changed }
}

/** Rewrites every day of a program plan ({ days: [{ exercises }] }). */
export function rewritePlan(plan, byOldId) {
  if (!Array.isArray(plan?.days)) return { plan, changed: false }
  let changed = false
  const days = plan.days.map(day => {
    const result = rewriteDayExercises(day.exercises, byOldId)
    if (!result.changed) return day
    changed = true
    return { ...day, exercises: result.exercises }
  })
  return { plan: changed ? { ...plan, days } : plan, changed }
}

/** Canonical aliases plus everything a merged exercise was known by. */
export function mergedAliases(canonical, merged) {
  const seen = new Set()
  const out = []
  for (const alias of [...canonical.aliases, ...merged.flatMap(m => [m.slug, m.nameRu, m.nameEn, ...m.aliases])]) {
    const key = alias?.trim().toLowerCase().replace(/ё/g, 'е')
    if (!key || seen.has(key) || key === canonical.nameRu.toLowerCase().replace(/ё/g, 'е')) continue
    seen.add(key)
    out.push(alias.trim())
  }
  return out
}

/**
 * Drops alternatives that point to exercises no longer in the catalog (left by
 * earlier merges). Main exercises are not touched — a missing one is reported.
 * @param {Set<string>} knownIds
 * @returns {{ plan, removed: number, missingMain: string[] }}
 */
export function dropUnknownAlternatives(plan, knownIds) {
  if (!Array.isArray(plan?.days)) return { plan, removed: 0, missingMain: [] }
  let removed = 0
  const missingMain = []
  const days = plan.days.map(day => {
    if (!Array.isArray(day.exercises)) return day
    let changed = false
    const exercises = day.exercises.map(ex => {
      if (!knownIds.has(ex.exerciseId)) missingMain.push(ex.slug ?? ex.exerciseId)
      if (!Array.isArray(ex.alternatives)) return ex
      const kept = ex.alternatives.filter(id => knownIds.has(id))
      if (kept.length === ex.alternatives.length) return ex
      removed += ex.alternatives.length - kept.length
      changed = true
      return { ...ex, alternatives: kept }
    })
    return changed ? { ...day, exercises } : day
  })
  return { plan: removed ? { ...plan, days } : plan, removed, missingMain }
}
