import prisma from '../utils/prisma.js'

const validSet = s => !s.isWarmup && Number.isFinite(s.reps) && s.reps > 0
  && Number.isFinite(s.weightKg ?? 0) && (s.weightKg ?? 0) >= 0
const clean = s => ({ weightKg: s.weightKg ?? 0, reps: s.reps })

// Compare actual sets, never estimated 1RM or tonnage: changing the number of
// sets must not turn a heavier session into a decline. Assistance runs backwards.
function covers(a, b, assisted) {
  return (assisted ? a.weightKg <= b.weightKg : a.weightKg >= b.weightKg) && a.reps >= b.reps
}

function best(sets, assisted) {
  return [...sets].sort((a, b) => (assisted ? a.weightKg - b.weightKg : b.weightKg - a.weightKg)
    || b.reps - a.reps)[0]
}

function comparison(current, previous, type) {
  if (!previous) return null
  if (current.weightKg === previous.weightKg) {
    return { metric: type === 'duration' ? 'duration' : 'reps', delta: current.reps - previous.reps }
  }
  if (current.reps === previous.reps) {
    return { metric: 'weight', delta: Math.round((current.weightKg - previous.weightKg) * 100) / 100 }
  }
  return { metric: null, delta: null }
}

/** One result per exercise; history contains completed sessions before this one. */
export function buildExerciseResults(workout, history) {
  const grouped = new Map()
  for (const s of workout.sets) {
    const entry = grouped.get(s.exerciseId) ?? { exercise: s.exercise, sets: [] }
    if (validSet(s)) entry.sets.push(clean(s))
    grouped.set(s.exerciseId, entry)
  }
  const priorByExercise = new Map()
  for (const s of history) {
    if (!validSet(s) || s.workoutId === workout.id || !s.workout?.finishedAt
      || new Date(s.workout.finishedAt) > new Date(workout.startedAt)
      || new Date(s.workout.startedAt) >= new Date(workout.startedAt)) continue
    const sessions = priorByExercise.get(s.exerciseId) ?? new Map()
    const session = sessions.get(s.workoutId) ?? { startedAt: s.workout.startedAt, sets: [] }
    session.sets.push(clean(s))
    sessions.set(s.workoutId, session)
    priorByExercise.set(s.exerciseId, sessions)
  }
  return [...grouped].map(([exerciseId, { exercise, sets }]) => {
    const type = exercise.trackingType ?? 'weight_reps'
    const assisted = type === 'assisted_bodyweight'
    const sessions = [...(priorByExercise.get(exerciseId)?.values() ?? [])]
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    const prior = sessions.flatMap(s => s.sets)
    const current = best(sets, assisted) ?? null
    const previous = best(sessions[0]?.sets ?? [], assisted) ?? null
    const result = { exerciseId, name: exercise.nameRu || exercise.nameEn, slug: exercise.slug,
      trackingType: exercise.timerOverride ? 'duration' : type, current, previous, previousAt: sessions[0]?.startedAt ?? null,
      status: 'same', comparison: null, records: [] }
    if (!sets.length) return { ...result, previous: null, previousAt: null, status: 'warmup' }
    // Distance has no dedicated input yet. Do not label metres as repetitions.
    if (type === 'distance' || exercise.timerOverride) return { ...result, status: 'untracked' }
    if (!prior.length) return { ...result, status: 'first' }
    result.comparison = comparison(current, previous, type)
    const equal = current.weightKg === previous.weightKg && current.reps === previous.reps
    result.status = equal ? 'same' : covers(current, previous, assisted) ? 'up'
      : covers(previous, current, assisted) ? 'down' : 'changed'
    // Pareto records: no earlier working set matches/exceeds both dimensions.
    // A new heavier weight with fewer reps is a record, not proven improvement.
    result.records = sets.filter(s => !prior.some(p => covers(p, s, assisted)))
      .filter((s, i, all) => all.findIndex(p => p.weightKg === s.weightKg && p.reps === s.reps) === i)
      .filter(s => !sets.some(p => covers(p, s, assisted)
        && (p.weightKg !== s.weightKg || p.reps !== s.reps)))
      .sort((a, b) => (assisted ? a.weightKg - b.weightKg : b.weightKg - a.weightKg) || b.reps - a.reps)
      .map(s => {
        // Prefer a real benchmark at the same load, then the same reps. Never
        // manufacture a baseline by combining weight/reps from different sets.
        const atWeight = prior.filter(p => p.weightKg === s.weightKg)
        const atReps = prior.filter(p => p.reps === s.reps)
        const baseline = atWeight.length ? best(atWeight, assisted) : best(atReps, assisted) ?? null
        return { current: s, previous: baseline, comparison: comparison(s, baseline, type) }
      })
    return result
  })
}

export async function getWorkoutResults(userId, workout) {
  const exerciseIds = [...new Set(workout.sets.map(s => s.exerciseId))]
  if (!exerciseIds.length) return { exercises: [] }
  // One narrow batched history read, not an exercise-by-exercise request or a
  // limited history window incorrectly presented as an all-time record.
  const [history, settings] = await Promise.all([
    prisma.workoutSet.findMany({
      where: { exerciseId: { in: exerciseIds }, isWarmup: false,
        workout: { userId, id: { not: workout.id }, startedAt: { lt: workout.startedAt },
          finishedAt: { not: null, lte: workout.startedAt } } },
      select: { exerciseId: true, workoutId: true, weightKg: true, reps: true,
        workout: { select: { startedAt: true, finishedAt: true } } },
      orderBy: [{ workout: { startedAt: 'desc' } }, { workoutId: 'desc' }],
    }),
    prisma.userExerciseSettings.findMany({
      where: { userId, exerciseSlug: { in: workout.sets.map(s => s.exercise.slug) }, type: 'timer' },
      select: { exerciseSlug: true },
    }),
  ])
  const timers = new Set(settings.map(s => s.exerciseSlug))
  const sets = workout.sets.map(s => ({ ...s, exercise: { ...s.exercise,
    // Sets have no historical measurement-type snapshot. An override of a
    // reps exercise to seconds is not safely comparable to the old history.
    timerOverride: timers.has(s.exercise.slug) && s.exercise.trackingType !== 'duration' } }))
  return { exercises: buildExerciseResults({ ...workout, sets }, history) }
}
