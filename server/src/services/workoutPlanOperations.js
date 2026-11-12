import { AppError } from '../middleware/errorHandler.js'
const conflict = () => { throw new AppError(409, 'PLAN_CHANGED', 'Workout plan changed; reload before editing') }

export function applyPlanChange(input, change, { addedExercise, groupId = crypto.randomUUID() } = {}) {
  let plan = structuredClone(input)
  const slot = key => {
    const result = plan.find(pe => pe.exerciseId === key)
    if (!result) conflict()
    return result
  }
  const unlink = key => {
    const item = slot(key)
    const group = item.supersetId
    for (const pe of plan) if (pe === item || (group && pe.supersetId === group)) delete pe.supersetId
  }
  if (change.type === 'link') {
    const a = slot(change.exerciseId), b = slot(change.partnerId)
    if (a !== b && a.supersetId && a.supersetId === b.supersetId) return plan
    if (a === b || b.supersetId) conflict()
    unlink(a.exerciseId)
    a.supersetId = b.supersetId = groupId
    plan = plan.filter(pe => pe !== b)
    plan.splice(plan.indexOf(a) + 1, 0, b)
  } else if (change.type === 'unlink') unlink(change.exerciseId)
  else if (change.type === 'sets') for (const entry of change.counts) slot(entry.exerciseId).sets = entry.sets
  else if (change.type === 'deleteSet') {
    const pe = plan.find(pe => pe.exerciseId === change.exerciseId)
    if (pe) pe.sets = Math.max(1, pe.sets - 1)
  } else if (change.type === 'add') {
    if (plan.some(pe => pe.exerciseId === change.exerciseId) || !addedExercise) conflict()
    plan.push({ exerciseId: addedExercise.id, nameRu: addedExercise.nameRu, slug: addedExercise.slug, sets: 3, repsMin: 10, repsMax: 12, restSec: 90 })
  } else if (change.type === 'remove') {
    unlink(change.exerciseId)
    plan = plan.filter(pe => pe.exerciseId !== change.exerciseId)
  } else if (change.type === 'swap') {
    const pe = slot(change.exerciseId)
    if (!addedExercise || plan.some(ex => ex.exerciseId === change.partnerId)) conflict()
    const original = pe.exerciseId
    pe.mainExerciseId ??= original
    Object.assign(pe, { exerciseId: addedExercise.id, nameRu: addedExercise.nameRu, slug: addedExercise.slug })
    pe.alternatives = [...new Set([...(pe.alternatives ?? []).filter(id => id !== addedExercise.id), original])]
  } else if (change.type === 'move') {
    const moved = slot(change.exerciseId), target = slot(change.targetId)
    const group = moved.supersetId ? plan.filter(pe => pe.supersetId === moved.supersetId) : [moved]
    if (group.includes(target)) return plan
    const targetGroup = target.supersetId ? plan.filter(pe => pe.supersetId === target.supersetId) : [target]
    const after = plan.indexOf(moved) < plan.indexOf(target)
    const rest = plan.filter(pe => !group.includes(pe))
    const index = rest.indexOf(after ? targetGroup.at(-1) : targetGroup[0]) + (after ? 1 : 0)
    plan = [...rest.slice(0, index), ...group, ...rest.slice(index)]
  }
  return plan
}

