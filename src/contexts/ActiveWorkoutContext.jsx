import { createContext, useContext, useCallback, useRef } from 'react'

import { readWorkoutState, writeWorkoutState, clearWorkoutStateStorage } from '../utils/workoutState.js'

const ActiveWorkoutContext = createContext(null)

const EMPTY = {
  workoutId: null,
  currentExercise: null,
  doneSets: [],
  partialSets: {},
  planExercises: null,
  planIndex: 0,
  allExercises: [],
  resting: false,
}

export function ActiveWorkoutProvider({ children }) {
  const stateRef = useRef(EMPTY)

  // Save after each state change, including before a browser reload.
  const save = useCallback((snapshot) => {
    stateRef.current = { ...EMPTY, ...snapshot }
    writeWorkoutState(stateRef.current)
  }, [])

  // WorkoutPage calls restore() on mount — returns snapshot if workoutId matches
  const restore = useCallback((workoutId) => {
    const s = stateRef.current
    if (s.workoutId === workoutId) return s
    return readWorkoutState(workoutId)
  }, [])

  // Called on finish / cancel to discard saved state
  const clear = useCallback(() => {
    stateRef.current = EMPTY
    clearWorkoutStateStorage()
  }, [])

  return (
    <ActiveWorkoutContext.Provider value={{ save, restore, clear }}>
      {children}
    </ActiveWorkoutContext.Provider>
  )
}

export function useActiveWorkout() {
  return useContext(ActiveWorkoutContext)
}
