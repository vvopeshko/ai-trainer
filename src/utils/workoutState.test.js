import { afterEach, describe, expect, it, vi } from 'vitest'
import { readWorkoutState, writeWorkoutState, clearWorkoutStateStorage, restoreWorkoutSnapshot, restElapsedSeconds } from './workoutState.js'
import { summarizeWorkout } from './workoutSummary.js'

const exercise = id => ({ id, nameRu: id })
const set = (id, exerciseId) => ({ id, exerciseId, exercise: exercise(exerciseId), weightKg: 20, reps: 10 })
const plan = [{ exerciseId: 'a', sets: 3 }, { exerciseId: 'b', sets: 2 }]
const data = sets => ({ workout: { id: 'w', sets }, planExercises: plan })

afterEach(() => vi.unstubAllGlobals())

describe('workout reload', () => {
  it('persists a snapshot through serialization, isolates workouts and clears it', () => {
    const values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    })
    const snapshot = { workoutId: 'w', allExercises: [], planExercises: plan, currentExercise: exercise('a'), resting: 1000 }
    writeWorkoutState(snapshot)
    expect(readWorkoutState('w')).toEqual(snapshot)
    expect(readWorkoutState('other')).toBeNull()
    clearWorkoutStateStorage()
    expect(readWorkoutState('w')).toBeNull()
  })

  it('tolerates unavailable or corrupt storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{', setItem: () => { throw Error() }, removeItem: () => { throw Error() } })
    expect(readWorkoutState('w')).toBeNull()
    expect(() => writeWorkoutState({})).not.toThrow()
    expect(() => clearWorkoutStateStorage()).not.toThrow()
  })

  it('keeps swaps, order, planned counts, current exercise and rest, but uses only server sets', () => {
    const changedPlan = [{ exerciseId: 'c', sets: 4 }, { exerciseId: 'a', sets: 5 }]
    const saved = {
      planExercises: changedPlan, currentExercise: exercise('c'), allExercises: [],
      doneSets: [{ tempId: 'unconfirmed' }], partialSets: {}, resting: 1000,
    }
    const restored = restoreWorkoutSnapshot(data([set('s1', 'c'), set('s2', 'a')]), saved)
    expect(restored.planExercises).toEqual(changedPlan)
    expect(restored.currentExercise.id).toBe('c')
    expect(restored.doneSets.map(s => s.id)).toEqual(['s1'])
    expect(restored.partialSets.a.map(s => s.id)).toEqual(['s2'])
    expect(restored.resting).toBe(1000)
  })

  it('preserves explicit early completion and picker state without duplicating sets', () => {
    const restored = restoreWorkoutSnapshot(data([set('s1', 'a'), set('s2', 'b')]), {
      allExercises: [{ exercise: exercise('a') }], currentExercise: exercise('b'), picking: true,
    })
    expect(restored.allExercises.map(e => e.exercise.id)).toEqual(['a'])
    expect(restored.doneSets.map(s => s.id)).toEqual(['s2'])
    expect(restored.partialSets).toEqual({})
    expect(restored.picking).toBe(true)
  })

  it('does not restore a failed optimistic approach as recorded or keep its rest timer', () => {
    const restored = restoreWorkoutSnapshot(data([]), {
      allExercises: [], currentExercise: exercise('a'), doneSets: [{ tempId: 'lost' }], resting: 1000,
    })
    expect(restored.doneSets).toEqual([])
    expect(restored.resting).toBe(false)
  })

  it('restores partial progress without a local snapshot and handles an empty plan', () => {
    const restored = restoreWorkoutSnapshot(data([set('s1', 'a')]), null)
    expect(restored.currentExercise.id).toBe('b')
    expect(restored.partialSets.a).toHaveLength(1)
    expect(restoreWorkoutSnapshot({ ...data([]), planExercises: [] }, null).picking).toBe(true)
  })
})

describe('rest clock', () => {
  it('survives remount, freezes on pause and excludes accumulated pause time on resume', () => {
    const startOnNetClock = 10000
    expect(restElapsedSeconds(startOnNetClock, null, 40000)).toBe(30)
    expect(restElapsedSeconds(startOnNetClock, 40000, 90000)).toBe(30)
    expect(restElapsedSeconds(startOnNetClock + 50000, null, 95000)).toBe(35)
  })
})

describe('server summary', () => {
  it('counts confirmed sets once, deduplicates exercises and subtracts pauses', () => {
    const workout = {
      startedAt: '2026-10-25T10:00:00Z', finishedAt: '2026-10-25T10:10:00Z', totalPausedMs: 120000,
      sets: [set('1', 'a'), set('2', 'a'), { ...set('3', 'b'), weightKg: null }],
    }
    expect(summarizeWorkout(workout)).toMatchObject({ totalSets: 3, totalExercises: 2, tonnageKg: 400, elapsedSec: 480 })
  })
})


describe('superset reload', () => {
  const pairPlan = [{ exerciseId: 'a', sets: 3, supersetId: 'pair' }, { exerciseId: 'b', sets: 3, supersetId: 'pair' }, { exerciseId: 'c', sets: 3 }]
  it('continues B after A and returns to A after a completed round, before unrelated exercises', () => {
    const first = restoreWorkoutSnapshot({ workout: { sets: [set('a1', 'a')] }, planExercises: pairPlan }, null)
    expect(first.currentExercise.id).toBe('b')
    expect(first.partialSets.a).toHaveLength(1)
    const next = restoreWorkoutSnapshot({ workout: { sets: [set('a1', 'a'), set('b1', 'b')] }, planExercises: pairPlan }, null)
    expect(next.currentExercise.id).toBe('a')
    expect(next.doneSets).toHaveLength(1)
    expect(next.partialSets.b).toHaveLength(1)
  })
  it('retains pair metadata, per-exercise progress and rest when resuming on the same device', () => {
    const saved = { currentExercise: exercise('b'), planExercises: pairPlan, allExercises: [], resting: 5000 }
    const result = restoreWorkoutSnapshot({ workout: { sets: [set('a1', 'a'), set('b1', 'b')] }, planExercises: pairPlan }, saved)
    expect(result.currentExercise.id).toBe('b')
    expect(result.partialSets.a).toHaveLength(1)
    expect(result.doneSets).toHaveLength(1)
    expect(result.resting).toBe(5000)
  })
})

it('refreshes linked and unlinked groups while preserving local sets, variants and recorded progress', () => {
  const saved = { allExercises: [], currentExercise: exercise('alt'), planExercises: [
    { exerciseId: 'alt', mainExerciseId: 'a', sets: 5 }, { exerciseId: 'b', sets: 4 },
  ] }
  const linked = { ...data([set('s', 'alt')]), planExercises: plan.map(pe => ({ ...pe, supersetId: 'new' })) }
  const restored = restoreWorkoutSnapshot(linked, saved)
  expect(restored.planExercises.map(pe => pe.supersetId)).toEqual(['new', 'new'])
  expect(restored.planExercises[0]).toMatchObject({ exerciseId: 'alt', sets: 5 })
  expect(restored.doneSets).toHaveLength(1)
  const unlinked = restoreWorkoutSnapshot(data([]), { ...saved, planExercises: restored.planExercises })
  expect(unlinked.planExercises.every(pe => !pe.supersetId)).toBe(true)
})

it('restores the authoritative session plan instead of an obsolete local plan', () => {
  const exercises = [{ exerciseId: 'b', sets: 5 }]
  const result = restoreWorkoutSnapshot({ workout: { id: 'w', sets: [], planSnapshot: { revision: 'v2', exercises } }, planExercises: exercises }, {
    allExercises: [], currentExercise: exercise('b'), planExercises: plan,
  })
  expect(result.planExercises).toEqual(exercises)
})

it('keeps recorded sets after removing the current exercise and selects the next planned one', () => {
  const exercises = [{ exerciseId: 'b', sets: 3 }]
  const result = restoreWorkoutSnapshot({ workout: { sets: [set('a1', 'a')], planSnapshot: { exercises } }, planExercises: exercises }, {
    allExercises: [], currentExercise: exercise('a'), planExercises: plan, resting: 5000,
  })
  expect(result.currentExercise.id).toBe('b')
  expect(result.allExercises[0].sets).toHaveLength(1)
  expect(result.resting).toBe(false)
})

it('reopens a completed exercise when its planned count increased on another device', () => {
  const exercises = [{ exerciseId: 'a', sets: 4 }, { exerciseId: 'b', sets: 3 }]
  const sets = [set('a1', 'a'), set('a2', 'a'), set('a3', 'a')]
  const result = restoreWorkoutSnapshot({ workout: { sets, planSnapshot: { exercises } }, planExercises: exercises }, {
    allExercises: [{ exercise: exercise('a'), sets }], currentExercise: exercise('b'), planExercises: [{ exerciseId: 'a', sets: 3 }],
  })
  expect(result.partialSets.a).toHaveLength(3)
  expect(result.allExercises).toEqual([])
})
