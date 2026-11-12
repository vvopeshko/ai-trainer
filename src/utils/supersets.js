// A superset is exactly two slots. Invalid/orphaned groups behave as normal exercises.
export function supersetPair(exercises, exerciseId) {
  const current = exercises?.find(ex => ex.exerciseId === exerciseId)
  if (!current?.supersetId) return null
  const pair = exercises.filter(ex => ex.supersetId === current.supersetId)
  return pair.length === 2 && pair[0].exerciseId !== pair[1].exerciseId ? pair : null
}

export function linkSuperset(exercises, exerciseId, partnerId, groupId) {
  const oldGroup = exercises.find(ex => ex.exerciseId === exerciseId)?.supersetId
  const cleared = exercises.map(ex => {
    if (ex.exerciseId === exerciseId || (oldGroup && ex.supersetId === oldGroup)) {
      const { supersetId: _group, ...rest } = ex
      return rest
    }
    return { ...ex }
  })
  if (!partnerId) return cleared
  const first = cleared.find(ex => ex.exerciseId === exerciseId)
  const second = cleared.find(ex => ex.exerciseId === partnerId)
  if (!first || !second || first === second || second.supersetId) return cleared
  first.supersetId = groupId
  second.supersetId = groupId
  // Keep the pair adjacent; the selected exercise is A.
  const result = cleared.filter(ex => ex !== second)
  result.splice(result.indexOf(first) + 1, 0, second)
  return result
}

// Counts include the just-recorded set. Handles unequal prescriptions and manual jumps.
export function supersetTransition(exercises, exerciseId, counts) {
  const pair = supersetPair(exercises, exerciseId)
  if (!pair) return null
  const [a, b] = pair
  const remaining = pair.filter(ex => (counts[ex.exerciseId] ?? 0) < ex.sets)
  const next = remaining.find(ex => ex.exerciseId !== exerciseId) ?? remaining[0] ?? null
  const rest = exerciseId === b.exerciseId || !next || next.exerciseId === a.exerciseId || next.exerciseId === exerciseId
  return { next, rest, restSec: b.restSec ?? 90, pair }
}

export function supersetRows(pair, counts) {
  return Array.from({ length: Math.max(...pair.map(ex => Math.max(ex.sets, counts[ex.exerciseId] ?? 0))) }, (_, round) =>
    pair.flatMap((exercise, side) => round < Math.max(exercise.sets, counts[exercise.exerciseId] ?? 0)
      ? [{ exercise, side, setIndex: round }] : [])).flat()
}

// Move a linked pair together, preserving A/B order.
export function movePlanExercise(exercises, from, to) {
  const moved = exercises[from]
  const target = exercises[to]
  if (!moved || !target || from === to) return exercises
  const group = supersetPair(exercises, moved.exerciseId) ?? [moved]
  const targetGroup = supersetPair(exercises, target.exerciseId) ?? [target]
  if (group.includes(target)) return exercises
  const rest = exercises.filter(ex => !group.includes(ex))
  const anchor = from < to ? targetGroup.at(-1) : targetGroup[0]
  const index = rest.indexOf(anchor) + (from < to ? 1 : 0)
  return [...rest.slice(0, index), ...group, ...rest.slice(index)]
}
