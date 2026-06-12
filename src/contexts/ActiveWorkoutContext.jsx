import { createContext, useContext, useCallback, useRef } from 'react'

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

  // WorkoutPage calls save() before unmount to snapshot ephemeral state
  const save = useCallback((snapshot) => {
    stateRef.current = { ...EMPTY, ...snapshot }
  }, [])

  // WorkoutPage calls restore() on mount — returns snapshot if workoutId matches
  const restore = useCallback((workoutId) => {
    const s = stateRef.current
    if (s.workoutId === workoutId) return s
    return null
  }, [])

  // Called on finish / cancel to discard saved state
  const clear = useCallback(() => {
    stateRef.current = EMPTY
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
