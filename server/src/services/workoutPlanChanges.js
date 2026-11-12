import { applyPlanChange } from './workoutPlanOperations.js'
export { applyPlanChange } from './workoutPlanOperations.js'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler.js'

const id = z.string().uuid()
const count = z.number().int().min(1).max(100)
export const planSlotSchema = z.object({
  exerciseId: id, mainExerciseId: id.optional(), nameRu: z.string().max(300).optional(), slug: z.string().max(300).optional(),
  sets: count, repsMin: z.number().int().min(0).max(1000).default(10), repsMax: z.number().int().min(0).max(1000).default(12),
  restSec: z.number().int().min(0).max(3600).default(90), supersetId: z.string().max(100).optional(),
  alternatives: z.array(id).max(100).optional(), notes: z.string().max(2000).optional(),
})
export const planChangeSchema = z.object({
  scope: z.enum(['workout', 'program']), expectedRevision: z.string().nullable(),
  basePlan: z.array(planSlotSchema).max(100).optional(),
  change: z.discriminatedUnion('type', [
    z.object({ type: z.literal('link'), exerciseId: id, partnerId: id }),
    z.object({ type: z.literal('unlink'), exerciseId: id }),
    z.object({ type: z.literal('sets'), counts: z.array(z.object({ exerciseId: id, sets: count })).min(1).max(100) }),
    z.object({ type: z.literal('add'), exerciseId: id }),
    z.object({ type: z.literal('remove'), exerciseId: id }),
    z.object({ type: z.literal('move'), exerciseId: id, targetId: id }),
    z.object({ type: z.literal('swap'), exerciseId: id, partnerId: id }),
    z.object({ type: z.literal('deleteSet'), exerciseId: id, setId: id }),
  ]),
})
const conflict = () => { throw new AppError(409, 'PLAN_CHANGED', 'Workout plan changed; reload before editing') }

// Both scopes update the current session; only the chosen operation reaches the template.
// A workout snapshot isolates today's additions/counts from future program changes.
export async function changeWorkoutPlan(db, userId, workoutId, input) {
  const data = planChangeSchema.parse(input)
  return db.$transaction(async tx => {
    const workout = await tx.workout.findFirst({ where: { id: workoutId, userId, finishedAt: null } })
    if (!workout) throw new AppError(404, 'WORKOUT_NOT_FOUND', 'Active workout not found')
    if ((workout.planSnapshot?.revision ?? null) !== data.expectedRevision) conflict()
    const program = workout.programId && await tx.program.findFirst({ where: { id: workout.programId, userId } })
    const day = program?.planJson?.days?.[workout.programDayIndex]
    if (data.scope === 'program' && !day) throw new AppError(400, 'NO_PROGRAM', 'Workout has no program day')
    const override = day && await tx.workoutPlanOverride.findUnique({ where: { userId_programId_dayIndex: { userId, programId: program.id, dayIndex: workout.programDayIndex } } })
    const current = workout.planSnapshot?.exercises ?? data.basePlan ?? override?.exercises ?? day?.exercises ?? []
    if (new Set(current.map(pe => pe.exerciseId)).size !== current.length) conflict()
    const wantedId = data.change.type === 'swap' ? data.change.partnerId : data.change.type === 'add' ? data.change.exerciseId : null
    const ids = [...new Set([...current.map(pe => pe.exerciseId), ...(wantedId ? [wantedId] : [])])]
    const catalog = await tx.exercise.findMany({ where: { id: { in: ids }, OR: [{ source: { not: 'user_created' } }, { createdByUserId: userId }] }, select: { id: true, nameRu: true, slug: true } })
    if (catalog.length !== ids.length) throw new AppError(400, 'EXERCISE_NOT_FOUND', 'Exercise unavailable')
    const addedExercise = catalog.find(ex => ex.id === wantedId)
    const groupId = randomUUID()
    const exercises = applyPlanChange(current, data.change, { addedExercise, groupId })
    if (data.change.type === 'sets') {
      const recorded = await tx.workoutSet.findMany({ where: { workoutId }, select: { exerciseId: true } })
      for (const entry of data.change.counts) if (entry.sets < recorded.filter(s => s.exerciseId === entry.exerciseId).length) conflict()
    }
    let nextProgram
    if (data.scope === 'program') {
      // Map temporary variants back to their original slots. Never copy today's whole plan.
      const canonicalId = key => current.find(pe => pe.exerciseId === key)?.mainExerciseId ?? key
      const change = { ...data.change }
      if (change.exerciseId && change.type !== 'add') change.exerciseId = canonicalId(change.exerciseId)
      if (change.type === 'link') change.partnerId = canonicalId(change.partnerId)
      if (change.type === 'move') change.targetId = canonicalId(change.targetId)
      if (change.counts) change.counts = change.counts.map(e => ({ ...e, exerciseId: canonicalId(e.exerciseId) }))
      if (change.type === 'deleteSet' && !day.exercises.some(pe => pe.exerciseId === change.exerciseId)) conflict()
      nextProgram = structuredClone(program.planJson)
      // Re-adding an exercise removed only for today must not duplicate its template slot.
      if (!(change.type === 'add' && day.exercises.some(pe => pe.exerciseId === change.exerciseId))) {
        nextProgram.days[workout.programDayIndex].exercises = applyPlanChange(day.exercises, change, { addedExercise, groupId })
      }
    }
    if (data.change.type === 'deleteSet') {
      const deleted = await tx.workoutSet.deleteMany({ where: { id: data.change.setId, workoutId, exerciseId: data.change.exerciseId } })
      if (!deleted.count) conflict()
    }
    if (nextProgram && data.change.type === 'swap') exercises.find(pe => pe.exerciseId === data.change.partnerId).mainExerciseId = data.change.partnerId
    if (nextProgram) await tx.program.update({ where: { id: program.id }, data: { planJson: nextProgram } })
    const snapshot = { revision: randomUUID(), exercises }
    await tx.workout.update({ where: { id: workoutId }, data: { planSnapshot: snapshot } })
    return { planExercises: exercises, planRevision: snapshot.revision }
  }, { isolationLevel: 'Serializable' })
}
