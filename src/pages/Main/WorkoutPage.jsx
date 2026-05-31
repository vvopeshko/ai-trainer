/**
 * Workout Page — glass_v3 redesign (BRD §12.2).
 *
 * Single scrollable screen:
 *   WorkoutTopBar (timer + progress + ГОТОВО)
 *   → Collapsed done exercises
 *   → Active exercise card (header + done sets + stepper/rest)
 *   → Upcoming exercises list
 *
 * ExercisePicker shown only for no-plan flow or "добавить другое".
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/api.js'
import TopBar from '../../components/ui/TopBar.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { RestCard } from '../../components/ui/RestCard.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { BodyMap } from '../../components/ui/BodyMap.jsx'
import { ExerciseDetailSheet } from '../../components/ui/ExerciseDetailSheet.jsx'
import { getExerciseSettings } from '../../utils/weightUnit.js'
import { SwipeRow } from '../../components/ui/SwipeRow.jsx'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'
import { WorkoutTopBar } from './workout/WorkoutTopBar.jsx'
import { CollapsedExercise } from './workout/CollapsedExercise.jsx'
import { DoneSetRow } from './workout/DoneSetRow.jsx'
import { ActiveSetInput } from './workout/ActiveSetInput.jsx'
import { UpcomingExerciseItem } from './workout/UpcomingExerciseItem.jsx'
import { ExpandedUpcomingCard } from './workout/ExpandedUpcomingCard.jsx'
import { WorkoutSkeleton } from './workout/WorkoutSkeleton.jsx'
import { ExercisePicker } from './workout/ExercisePicker.jsx'

// ─── Main WorkoutPage ───────────────────────────────────────────────────

export default function WorkoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeWorkout: cachedWorkout, activePlanExercises: cachedPlan, activePlanDayTitle: cachedPlanTitle } = useHomeData()

  const [workoutId, setWorkoutId] = useState(null)
  const [currentExercise, setCurrentExercise] = useState(null)
  const [doneSets, setDoneSets] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [pendingSwap, setPendingSwap] = useState(null) // alt object awaiting confirm
  const [elapsedSec, setElapsedSec] = useState(0)
  const [startedAt, setStartedAt] = useState(null)
  const [resting, setResting] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [totalPausedMs, setTotalPausedMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedExerciseId, setExpandedExerciseId] = useState(null)
  const [expandedDoneIndex, setExpandedDoneIndex] = useState(null)
  const [lastResultsCache, setLastResultsCache] = useState({})
  const [partialSets, setPartialSets] = useState({}) // { exerciseId: [...sets] }
  const [exerciseSettings, setExerciseSettingsState] = useState(() => getExerciseSettings(null))
  const [detailExerciseId, setDetailExerciseId] = useState(null)

  // Plan state
  const [planExercises, setPlanExercises] = useState(null)
  const [planDayTitle, setPlanDayTitle] = useState(null)
  const [planIndex, setPlanIndex] = useState(0)

  const hasPlan = planExercises && planExercises.length > 0

  // ── Drag reorder state ──
  const [draggingId, setDraggingId] = useState(null)
  const [dragDelta, setDragDelta] = useState(0)
  const dragInfo = useRef({ startY: 0, lastSwapDelta: 0, itemHeight: 62 })
  const planExRef = useRef(planExercises)
  planExRef.current = planExercises
  const currentExRef = useRef(currentExercise)
  currentExRef.current = currentExercise
  const doneExIdsRef = useRef(new Set())

  useEffect(() => {
    doneExIdsRef.current = new Set(allExercises.map(e => e.exercise.id))
  }, [allExercises])

  // ── Exercise settings (unit, step, weight range) ──
  useEffect(() => {
    if (currentExercise?.slug) {
      setExerciseSettingsState(getExerciseSettings(currentExercise.slug))
    }
  }, [currentExercise?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExerciseSettingsChange = (newSettings) => {
    setExerciseSettingsState(newSettings)
  }

  const handleDragStart = (e, exerciseId) => {
    const touch = e.touches[0]
    const itemEl = e.currentTarget.closest('[data-drag-item]')
    const h = itemEl?.getBoundingClientRect().height ?? 55
    dragInfo.current = { startY: touch.clientY, lastSwapDelta: 0, itemHeight: h + 6 }
    setDraggingId(exerciseId)
    setDragDelta(0)
    setExpandedExerciseId(null)
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium') } catch {}
  }

  useEffect(() => {
    if (!draggingId) return

    const onMove = (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      const delta = touch.clientY - dragInfo.current.startY
      setDragDelta(delta)

      const { itemHeight, lastSwapDelta } = dragInfo.current
      const netDelta = delta - lastSwapDelta

      if (Math.abs(netDelta) > itemHeight * 0.5) {
        const direction = netDelta > 0 ? 'down' : 'up'
        const plan = planExRef.current
        const curEx = currentExRef.current
        const doneIds = doneExIdsRef.current
        const upcoming = plan.filter(pe => pe.exerciseId !== curEx?.id && !doneIds.has(pe.exerciseId))
        const idx = upcoming.findIndex(pe => pe.exerciseId === draggingId)
        const swapIdx = direction === 'down' ? idx + 1 : idx - 1

        if (idx >= 0 && swapIdx >= 0 && swapIdx < upcoming.length) {
          const idxA = plan.findIndex(pe => pe.exerciseId === upcoming[idx].exerciseId)
          const idxB = plan.findIndex(pe => pe.exerciseId === upcoming[swapIdx].exerciseId)
          const next = [...plan]
          ;[next[idxA], next[idxB]] = [next[idxB], next[idxA]]
          setPlanExercises(next)
          planExRef.current = next
          dragInfo.current.lastSwapDelta += direction === 'down' ? itemHeight : -itemHeight
          try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {}
        }
      }
    }

    const onEnd = () => {
      setDraggingId(null)
      setDragDelta(0)
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [draggingId])

  // ── Timer (accounts for pause) ──
  useEffect(() => {
    if (!startedAt || pausedAt) return
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt - totalPausedMs) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt, pausedAt, totalPausedMs])

  // ── Mount: check active workout ──
  useEffect(() => {
    let cancelled = false

    function applyData(data) {
      if (!data.workout) { setPicking(true); return }

      const workout = data.workout
      setWorkoutId(workout.id)
      setStartedAt(new Date(workout.startedAt).getTime())
      setTotalPausedMs(workout.totalPausedMs || 0)
      if (workout.pausedAt) setPausedAt(new Date(workout.pausedAt).getTime())

      if (data.planExercises) {
        setPlanExercises(data.planExercises)
        setPlanDayTitle(data.planDayTitle)

        // Batch-fetch last results for all plan exercises
        const ids = data.planExercises.map(pe => pe.exerciseId)
        apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: ids })
          .then(r => { if (!cancelled) setLastResultsCache(r.results) })
          .catch(() => {})
      }

      if (workout.sets?.length > 0) {
        const grouped = {}
        const order = []
        for (const s of workout.sets) {
          if (!grouped[s.exerciseId]) {
            grouped[s.exerciseId] = { exercise: s.exercise, sets: [] }
            order.push(s.exerciseId)
          }
          grouped[s.exerciseId].sets.push(s)
        }
        setAllExercises(order.map(id => grouped[id]))

        if (data.planExercises) {
          const doneIds = new Set(order)
          const nextIdx = data.planExercises.findIndex(pe => !doneIds.has(pe.exerciseId))
          if (nextIdx >= 0) {
            setPlanIndex(nextIdx)
            setCurrentExercise({ id: data.planExercises[nextIdx].exerciseId, nameRu: data.planExercises[nextIdx].nameRu, slug: data.planExercises[nextIdx].slug })
          } else {
            setPlanIndex(data.planExercises.length)
          }
        }
      } else if (data.planExercises) {
        // Fresh start with plan — auto-select first exercise
        const first = data.planExercises[0]
        setPlanIndex(0)
        setCurrentExercise({ id: first.exerciseId, nameRu: first.nameRu, slug: first.slug })
      } else {
        setPicking(true)
      }
    }

    // Use cached data from HomeDataProvider if available (skips network call)
    const source = cachedWorkout
      ? Promise.resolve({ workout: cachedWorkout, planExercises: cachedPlan, planDayTitle: cachedPlanTitle })
      : apiGet('/api/v1/workouts/active')

    source
      .then(data => { if (!cancelled) { applyData(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setPicking(true); setLoading(false) } })

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ensure workout exists ──
  const ensureWorkout = async () => {
    if (workoutId) return workoutId
    const { workout } = await apiPost('/api/v1/workouts', {})
    setWorkoutId(workout.id)
    setStartedAt(new Date(workout.startedAt).getTime())
    return workout.id
  }

  // ── Computed ──
  const doneExerciseIds = new Set(allExercises.map(e => e.exercise.id))
  const partialSetCount = Object.values(partialSets).reduce((s, sets) => s + sets.length, 0)
  const hasAnySets = allExercises.length > 0 || doneSets.length > 0 || partialSetCount > 0
  const totalDoneSets = allExercises.reduce((s, e) => s + e.sets.length, 0) + doneSets.length + partialSetCount
  const totalPlannedSets = hasPlan ? planExercises.reduce((s, e) => s + e.sets, 0) : 0
  const currentExerciseNum = allExercises.length + (currentExercise ? 1 : 0)
  const currentPlanExercise = hasPlan && planIndex < planExercises.length ? planExercises[planIndex] : null

  // Build muscles data for BodyMap (done=low, current=high, upcoming=medium)
  const workoutMuscles = useMemo(() => {
    if (!hasPlan) return []
    const muscleState = {} // muscle → max level: 'done' | 'current' | 'upcoming'
    const SETS = { done: 3, current: 10, upcoming: 5 }
    const PRIORITY = { upcoming: 0, done: 1, current: 2 }

    const addMuscles = (muscles, state) => {
      for (const m of muscles || []) {
        const prev = muscleState[m]
        if (!prev || PRIORITY[state] > PRIORITY[prev]) muscleState[m] = state
      }
    }

    const doneIds = new Set(allExercises.map(e => e.exercise.id))
    for (const ex of allExercises) addMuscles(ex.exercise.primaryMuscles, 'done')
    if (currentExercise) {
      const curPlan = planExercises?.find(pe => pe.exerciseId === currentExercise.id)
      addMuscles(curPlan?.primaryMuscles || currentExercise.primaryMuscles, 'current')
    }
    const curId = currentExercise?.id
    for (const pe of planExercises) {
      if (pe.exerciseId !== curId && !doneIds.has(pe.exerciseId)) {
        addMuscles(pe.primaryMuscles, 'upcoming')
      }
    }

    return Object.entries(muscleState).map(([muscle, state]) => ({
      muscle, setsActual: SETS[state],
    }))
  }, [hasPlan, allExercises, currentExercise, planExercises])

  // ── Handlers ──

  const saveCurrentExercise = () => {
    if (!currentExercise || doneSets.length === 0) return
    const curPlan = planExercises?.find(pe => pe.exerciseId === currentExercise.id)
    if (curPlan && doneSets.length < curPlan.sets) {
      // Partial — keep in upcoming so user can return
      setPartialSets(prev => ({ ...prev, [currentExercise.id]: [...doneSets] }))
    } else {
      // Complete or no plan — move to done
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }
  }

  const handleSelectFromPlan = (planEx) => {
    saveCurrentExercise()

    const idx = planExercises.findIndex(pe => pe.exerciseId === planEx.exerciseId)
    if (idx >= 0) setPlanIndex(idx)
    setCurrentExercise({ id: planEx.exerciseId, nameRu: planEx.nameRu, slug: planEx.slug })

    // Restore partial progress if any
    const partial = partialSets[planEx.exerciseId]
    if (partial) {
      setDoneSets(partial)
      setPartialSets(prev => { const next = { ...prev }; delete next[planEx.exerciseId]; return next })
    } else {
      setDoneSets([])
    }
    setResting(false)
    setPicking(false)
  }

  const handleSelectExercise = async (exercise) => {
    try { await ensureWorkout() } catch (err) {
      console.error('Failed to create workout:', err); return
    }
    saveCurrentExercise()
    setCurrentExercise(exercise)
    setDoneSets([])
    setResting(false)
    setPicking(false)

    // Fetch last results for this exercise (for weight pre-fill)
    if (!lastResultsCache[exercise.id]) {
      apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: [exercise.id] })
        .then(r => setLastResultsCache(prev => ({ ...prev, ...r.results })))
        .catch(() => {})
    }
  }

  const handleSetDone = async ({ weight, reps }) => {
    if (!workoutId || !currentExercise) return

    const newSet = { weightKg: weight, reps, exerciseId: currentExercise.id }
    const updatedSets = [...doneSets, newSet]
    setDoneSets(updatedSets)

    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}

    // Always show rest timer (including after last set)
    setResting(true)

    // API call in background — save set.id for potential deletion
    try {
      const { set } = await apiPost(`/api/v1/workouts/${workoutId}/sets`, {
        exerciseId: currentExercise.id,
        exerciseOrder: allExercises.length,
        setOrder: doneSets.length,
        weightKg: weight || null,
        reps,
      })
      // Patch the optimistic entry with server id
      setDoneSets(prev => prev.map((s, i) =>
        i === prev.length - 1 && !s.id ? { ...s, id: set.id } : s
      ))
    } catch (err) {
      console.error('Failed to log set:', err)
    }
  }

  const handleRestComplete = () => {
    setResting(false)
    // Auto-advance to next exercise if all planned sets done
    const plannedSets = currentPlanExercise?.sets
    if (plannedSets && doneSets.length >= plannedSets) {
      handleNextExercise()
    }
  }

  // ── Delete handlers ──

  const handleDeleteDoneSet = (exerciseIndex, setIndex) => {
    const item = allExercises[exerciseIndex]
    const set = item.sets[setIndex]
    if (set?.id && workoutId) {
      apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
    }
    setAllExercises(prev => {
      const updated = [...prev]
      const newSets = [...updated[exerciseIndex].sets]
      newSets.splice(setIndex, 1)
      if (newSets.length === 0) {
        updated.splice(exerciseIndex, 1)
        setExpandedDoneIndex(null)
      } else {
        updated[exerciseIndex] = { ...updated[exerciseIndex], sets: newSets }
      }
      return updated
    })
  }

  const handleCancelExercise = (exerciseIndex) => {
    const item = allExercises[exerciseIndex]
    // Delete all sets in background
    if (workoutId) {
      for (const set of item.sets) {
        if (set?.id) apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
      }
    }
    setAllExercises(prev => prev.filter((_, i) => i !== exerciseIndex))
    setExpandedDoneIndex(null)
  }

  const handleAddSetToDone = (exerciseIndex) => {
    const item = allExercises[exerciseIndex]
    saveCurrentExercise()
    setAllExercises(prev => prev.filter((_, i) => i !== exerciseIndex))
    setCurrentExercise(item.exercise)
    setDoneSets([...item.sets])
    setResting(false)
    setExpandedDoneIndex(null)
    if (hasPlan) {
      const idx = planExercises.findIndex(pe => pe.exerciseId === item.exercise.id)
      if (idx >= 0) setPlanIndex(idx)
    }
  }

  const handleUndoLastSet = () => {
    const lastSet = doneSets[doneSets.length - 1]
    if (lastSet?.id && workoutId) {
      apiDelete(`/api/v1/workouts/${workoutId}/sets/${lastSet.id}`).catch(() => {})
    }
    setDoneSets(prev => prev.slice(0, -1))
    setResting(false)
  }

  const handleDeleteCurrentSet = (setIndex) => {
    const set = doneSets[setIndex]
    if (set?.id && workoutId) {
      apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
    }
    setDoneSets(prev => prev.filter((_, i) => i !== setIndex))
  }

  const handleAddPlannedSet = () => {
    if (!currentPlanExercise) return
    setPlanExercises(prev => prev.map(pe =>
      pe.exerciseId === currentExercise.id ? { ...pe, sets: pe.sets + 1 } : pe
    ))
  }

  const handleRemovePlannedSet = () => {
    if (!currentPlanExercise || currentPlanExercise.sets <= doneSets.length + 1) return
    setPlanExercises(prev => prev.map(pe =>
      pe.exerciseId === currentExercise.id ? { ...pe, sets: pe.sets - 1 } : pe
    ))
  }

  const handleDeletePartialSet = (exerciseId, setIndex) => {
    const sets = partialSets[exerciseId]
    if (!sets) return
    const set = sets[setIndex]
    if (set?.id && workoutId) {
      apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
    }
    setPartialSets(prev => {
      const newSets = prev[exerciseId].filter((_, i) => i !== setIndex)
      if (newSets.length === 0) {
        const next = { ...prev }
        delete next[exerciseId]
        return next
      }
      return { ...prev, [exerciseId]: newSets }
    })
  }

  const handleNextExercise = (setsOverride) => {
    const sets = setsOverride || doneSets
    if (currentExercise && sets.length > 0) {
      // Explicit advance — always move to done, clear partial if any
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...sets] }])
      setPartialSets(prev => {
        if (!prev[currentExercise.id]) return prev
        const next = { ...prev }; delete next[currentExercise.id]; return next
      })
    }
    setCurrentExercise(null)
    setDoneSets([])
    setResting(false)

    if (hasPlan) {
      const updatedDoneIds = new Set([...doneExerciseIds])
      if (currentExercise) updatedDoneIds.add(currentExercise.id)

      const nextIdx = planExercises.findIndex(pe =>
        !updatedDoneIds.has(pe.exerciseId) && !partialSets[pe.exerciseId]
      )
      if (nextIdx >= 0) {
        const next = planExercises[nextIdx]
        setPlanIndex(nextIdx)
        setCurrentExercise({ id: next.exerciseId, nameRu: next.nameRu, slug: next.slug })
        return
      }
      // Check if there are only partial exercises left
      const hasOnlyPartial = planExercises.some(pe =>
        !updatedDoneIds.has(pe.exerciseId) && partialSets[pe.exerciseId]
      )
      if (hasOnlyPartial) {
        // Pick first partial to continue
        const nextPartial = planExercises.find(pe =>
          !updatedDoneIds.has(pe.exerciseId) && partialSets[pe.exerciseId]
        )
        const idx = planExercises.indexOf(nextPartial)
        setPlanIndex(idx)
        setCurrentExercise({ id: nextPartial.exerciseId, nameRu: nextPartial.nameRu, slug: nextPartial.slug })
        const restored = partialSets[nextPartial.exerciseId]
        setDoneSets(restored)
        setPartialSets(prev => { const n = { ...prev }; delete n[nextPartial.exerciseId]; return n })
        return
      }
      setPlanIndex(planExercises.length)
    } else {
      setPicking(true)
    }
  }

  const handlePause = async () => {
    if (!workoutId || pausedAt) return
    const now = Date.now()
    setPausedAt(now)
    setElapsedSec(Math.max(0, Math.floor((now - startedAt - totalPausedMs) / 1000)))
    apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'pause' })
      .catch(err => console.error('Failed to pause workout:', err))
  }

  const handleResume = async () => {
    if (!workoutId || !pausedAt) return
    const pauseDuration = Date.now() - pausedAt
    setTotalPausedMs(prev => prev + pauseDuration)
    setPausedAt(null)
    try { await apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'resume' }) }
    catch { /* optimistic update already applied */ }
  }

  const handleFinish = async () => {
    if (!workoutId) return
    setFinishing(true)

    // Save current exercise sets if any
    if (currentExercise && doneSets.length > 0) {
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }

    const totalSets = allExercises.reduce((sum, ex) => sum + ex.sets.length, 0) + doneSets.length + partialSetCount
    const totalExercises = allExercises.length + (doneSets.length > 0 ? 1 : 0) + Object.keys(partialSets).length

    try {
      const result = await apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'finish' })
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}

      if (result.deleted) { navigate('/'); return }

      navigate(`/summary/${workoutId}`, {
        state: { totalSets, totalExercises, elapsedSec },
      })
    } catch (err) {
      console.error('Failed to finish workout:', err)
      setFinishing(false)
    }
  }

  const handleCancel = async () => {
    if (workoutId) {
      try { await apiPatch(`/api/v1/workouts/${workoutId}`, {}) } catch {}
    }
    navigate('/')
  }

  const handleCancelWorkout = async () => {
    setConfirmCancel(false)
    if (workoutId) {
      try { await apiDelete(`/api/v1/workouts/${workoutId}`) } catch {}
    }
    navigate('/')
  }

  const handleBack = () => {
    navigate('/')
  }

  // ── Swap alternative ──

  const handleSwapAlternative = (alt) => {
    if (doneSets.length > 0) {
      setPendingSwap(alt)
      return
    }
    executeSwap(alt)
  }

  const executeSwap = (alt) => {
    // Delete any logged sets for current exercise from backend
    for (const s of doneSets) {
      if (s?.id && workoutId) apiDelete(`/api/v1/workouts/${workoutId}/sets/${s.id}`).catch(() => {})
    }

    // Swap in planExercises: current ↔ alternative
    if (hasPlan && currentExercise) {
      setPlanExercises(prev => prev.map(pe => {
        if (pe.exerciseId !== currentExercise.id) return pe
        const oldAlternatives = (pe.alternatives || []).filter(a => a.exerciseId !== alt.exerciseId)
        return {
          ...pe,
          exerciseId: alt.exerciseId,
          nameRu: alt.nameRu,
          slug: alt.slug,
          alternatives: [...oldAlternatives, { exerciseId: pe.exerciseId, nameRu: pe.nameRu, slug: pe.slug }],
        }
      }))
    }

    setCurrentExercise({ id: alt.exerciseId, nameRu: alt.nameRu, slug: alt.slug })
    setDoneSets([])
    setResting(false)
    setShowAlternatives(false)
    setPendingSwap(null)

    // Fetch last results for the new exercise
    if (!lastResultsCache[alt.exerciseId]) {
      apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: [alt.exerciseId] })
        .then(r => setLastResultsCache(prev => ({ ...prev, ...r.results })))
        .catch(() => {})
    }
  }

  const confirmSwap = () => {
    if (pendingSwap) executeSwap(pendingSwap)
  }

  const handleSwapUpcoming = (planEx, alt) => {
    // For upcoming exercises: swap directly in plan, handle partial sets if any
    const partial = partialSets[planEx.exerciseId]
    if (partial?.length > 0) {
      // Delete partial sets from backend
      for (const s of partial) {
        if (s?.id && workoutId) apiDelete(`/api/v1/workouts/${workoutId}/sets/${s.id}`).catch(() => {})
      }
      setPartialSets(prev => { const next = { ...prev }; delete next[planEx.exerciseId]; return next })
    }

    setPlanExercises(prev => prev.map(pe => {
      if (pe.exerciseId !== planEx.exerciseId) return pe
      const oldAlts = (pe.alternatives || []).filter(a => a.exerciseId !== alt.exerciseId)
      return {
        ...pe,
        exerciseId: alt.exerciseId,
        nameRu: alt.nameRu,
        slug: alt.slug,
        alternatives: [...oldAlts, { exerciseId: pe.exerciseId, nameRu: pe.nameRu, slug: pe.slug }],
      }
    }))
    setExpandedExerciseId(null)

    // Fetch last results for the new exercise
    if (!lastResultsCache[alt.exerciseId]) {
      apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: [alt.exerciseId] })
        .then(r => setLastResultsCache(prev => ({ ...prev, ...r.results })))
        .catch(() => {})
    }
  }

  // ── Helper ──
  function exerciseScheme(pe) {
    return pe.repsMin === pe.repsMax
      ? `${pe.sets}×${pe.repsMin}`
      : `${pe.sets}×${pe.repsMin}-${pe.repsMax}`
  }

  function exerciseSummary(sets) {
    if (sets.length === 0) return ''
    const count = sets.length
    const reps = sets.map(s => s.reps)
    const allSame = reps.every(r => r === reps[0])
    return allSame ? `${count}×${reps[0]}` : sets.map(s => `${s.weightKg ?? 0}×${s.reps}`).join(' ')
  }

  // ── Render: Loading skeleton ──
  if (loading) return <WorkoutSkeleton />

  // ── Render: ExercisePicker (full-screen) ──
  if (picking) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
        <TopBar
          title={t('workout.selectExercise')}
          onBack={hasPlan ? () => setPicking(false) : handleBack}
          rightLabel={hasAnySets ? t('workout.finish') : workoutId ? t('workout.cancel') : undefined}
          onRight={hasAnySets ? handleFinish : workoutId ? handleCancel : undefined}
        />
        <ExercisePicker onSelect={handleSelectExercise} />
      </div>
    )
  }

  // ── Render: Main workout screen ──
  const upcomingExercises = hasPlan
    ? planExercises.filter((pe) => pe.exerciseId !== currentExercise?.id && !doneExerciseIds.has(pe.exerciseId))
    : []

  return (
    <div style={{ background: '#08080B', minHeight: '100vh' }}>
      {/* WorkoutTopBar */}
      <WorkoutTopBar
        elapsed={elapsedSec}
        exerciseNum={currentExerciseNum}
        totalExercises={hasPlan ? planExercises.length : 0}
        doneSetCount={totalDoneSets}
        totalSetCount={totalPlannedSets}
        onBack={handleBack}
        onFinish={handleFinish}
        onCancel={() => setConfirmCancel(true)}
        hasAnySets={hasAnySets}
        paused={!!pausedAt}
        onPause={handlePause}
        onResume={handleResume}
      />

      <div style={{ position: 'relative', zIndex: 1, overflow: 'auto', padding: '4px 12px 22px' }}>

        {/* ── Collapsed done exercises ── */}
        {allExercises.length > 0 && (
          <>
            <div style={{ padding: '2px 4px 6px' }}>
              <div style={{
                fontSize: 10, fontWeight: 500, color: 'rgba(236,234,239,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('workout.doneLabel')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
              {allExercises.map((item, i) => {
                const isExpanded = expandedDoneIndex === i
                return (
                  <div key={i}>
                    <CollapsedExercise
                      name={item.exercise.nameRu}
                      summary={exerciseSummary(item.sets)}
                      expanded={isExpanded}
                      onClick={() => setExpandedDoneIndex(isExpanded ? null : i)}
                    />
                    {isExpanded && (
                      <Glass padding="0" radius="0 0 10px 10px" style={{ borderTop: 'none', marginTop: -1 }}>
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {item.sets.map((s, si) => (
                            <DoneSetRow
                              key={si}
                              index={si}
                              weight={s.weightKg ?? 0}
                              reps={s.reps}
                              onDelete={() => handleDeleteDoneSet(i, si)}
                            />
                          ))}
                        </div>
                        <div style={{ padding: '6px 10px 10px' }}>
                          <button onClick={() => handleCancelExercise(i)} style={{
                            width: '100%', height: 34, borderRadius: 8, border: 'none',
                            background: 'rgba(255,80,80,0.08)',
                            color: 'var(--danger, #f87171)', fontSize: 11.5, fontWeight: 600,
                            cursor: 'pointer',
                          }}>
                            {t('workout.cancelExercise')}
                          </button>
                        </div>
                      </Glass>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Active exercise card ── */}
        {currentExercise && (
          <Glass radius={16} style={{ overflow: 'hidden', padding: 0 }}>
            {/* Header */}
            <div style={{ padding: '14px 14px 12px' }}>
              <div style={{
                fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: 'hsl(var(--accent-h,158),55%,75%)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'hsl(var(--accent-h,158),65%,60%)',
                  boxShadow: '0 0 6px hsla(var(--accent-h,158),65%,60%,0.7)',
                }} />
                {t('workout.now')} · {hasPlan
                  ? t('workout.exerciseOf', { n: planIndex + 1, total: planExercises.length })
                  : `упр ${currentExerciseNum}`
                }
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
              }}>
                <div style={{
                  fontSize: 20, fontWeight: 600, lineHeight: 1.15,
                  color: '#fff', fontFamily: 'var(--font-display)', flex: 1,
                }}>
                  {currentExercise.nameRu}
                </div>
                <button
                  onClick={() => setDetailExerciseId(currentExercise.id)}
                  style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: 'rgba(255,255,255,0.06)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(236,234,239,0.5)',
                  }}
                >
                  <Icon name="info" size={14} />
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'rgba(236,234,239,0.55)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentPlanExercise && <span>{exerciseScheme(currentPlanExercise)}</span>}
                {currentPlanExercise?.alternatives?.length > 0 && (
                  <button onClick={() => setShowAlternatives(true)} style={{
                    padding: '2px 8px', borderRadius: 6, border: 'none',
                    background: 'hsla(var(--accent-h,158),55%,55%,0.15)',
                    color: 'hsl(var(--accent-h,158),55%,70%)',
                    fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Icon name="swap" size={11} />
                    {t('workout.alternatives', { count: currentPlanExercise.alternatives.length })}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <span style={{
                  fontSize: 10.5, fontWeight: 600,
                  color: 'rgba(236,234,239,0.4)',
                  letterSpacing: '0.02em',
                }}>
                  {exerciseSettings.unit === 'lbs' ? 'LBS' : 'КГ'}
                </span>
              </div>
            </div>

            {/* Done sets inline */}
            {doneSets.length > 0 && (
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {doneSets.map((s, i) => (
                  <DoneSetRow key={i} index={i} weight={s.weightKg ?? 0} reps={s.reps}
                    onDelete={() => handleDeleteCurrentSet(i)} />
                ))}
                <button onClick={handleUndoLastSet} style={{
                  background: 'none', border: 'none', padding: '2px 0',
                  color: 'rgba(236,234,239,0.35)', fontSize: 10.5, cursor: 'pointer',
                  textAlign: 'right', alignSelf: 'flex-end',
                }}>
                  {t('workout.undoSet')}
                </button>
              </div>
            )}

            {/* Pause overlay */}
            {pausedAt && (
              <div
                onClick={handleResume}
                style={{
                  margin: '0 12px 8px',
                  padding: '20px 14px',
                  borderRadius: 13,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="pause" size={24} style={{ color: 'var(--warning, hsl(45,80%,60%))', marginBottom: 8 }} />
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)',
                  marginBottom: 4,
                }}>
                  {t('workout.paused')}
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--fg-tertiary)',
                }}>
                  {t('workout.tapToResume')}
                </div>
              </div>
            )}

            {/* Active set input OR rest timer */}
            <div style={{ padding: '12px 12px 14px', ...(pausedAt && { opacity: 0.25, pointerEvents: 'none' }) }}>
              {resting ? (
                <>
                  <RestCard
                    seconds={currentPlanExercise?.restSec || 90}
                    onSkip={handleRestComplete}
                  />
                  {/* Next set preview */}
                  {currentPlanExercise && doneSets.length < currentPlanExercise.sets && (
                    <div style={{
                      marginTop: 9, padding: '9px 12px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.45)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {t('workout.upcoming')} · {t('workout.set', { n: doneSets.length + 1 })}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1,
                        fontWeight: 600, color: 'rgba(236,234,239,0.7)', textAlign: 'right',
                      }}>
                        {doneSets.length > 0 ? `${doneSets[doneSets.length - 1].weightKg ?? 0} × ${doneSets[doneSets.length - 1].reps}` : ''}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <ActiveSetInput
                  exercise={currentExercise}
                  unit={exerciseSettings.unit}
                  step={exerciseSettings.step}
                  minWeight={exerciseSettings.minWeight}
                  maxWeight={exerciseSettings.maxWeight}
                  setOrder={doneSets.length}
                  plannedSets={currentPlanExercise?.sets || null}
                  lastWeight={doneSets.length > 0
                    ? doneSets[doneSets.length - 1].weightKg
                    : lastResultsCache[currentExercise.id]?.lastSets?.[0]?.weightKg ?? null}
                  lastReps={doneSets.length > 0
                    ? doneSets[doneSets.length - 1].reps
                    : lastResultsCache[currentExercise.id]?.lastSets?.[0]?.reps ?? null}
                  plannedReps={currentPlanExercise?.repsMin || null}
                  onDone={handleSetDone}
                />
              )}

              {/* Pending sets preview (swipe to remove) */}
              {currentPlanExercise && doneSets.length + 1 < currentPlanExercise.sets && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {Array.from({ length: currentPlanExercise.sets - doneSets.length - 1 }, (_, i) => {
                    const setNum = doneSets.length + 2 + i
                    const setIdx = doneSets.length + 1 + i
                    const lastSets = lastResultsCache[currentExercise.id]?.lastSets
                    const lastSet = lastSets?.[setIdx] || lastSets?.slice(-1)[0] || (doneSets.length > 0 ? doneSets[doneSets.length - 1] : null)
                    const repsLabel = currentPlanExercise.repsMin === currentPlanExercise.repsMax
                      ? `${currentPlanExercise.repsMin}`
                      : `${currentPlanExercise.repsMin}–${currentPlanExercise.repsMax}`
                    return (
                      <SwipeRow key={i} deleteWidth={56} onDelete={handleRemovePlannedSet}>
                        <div style={{
                          padding: '9px 12px', borderRadius: 10,
                          border: '1px dashed rgba(255,255,255,0.07)',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: '1.5px dashed rgba(255,255,255,0.10)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 600, color: 'rgba(236,234,239,0.25)',
                          }}>
                            {setNum}
                          </div>
                          <div style={{
                            fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.25)',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {t('workout.set', { n: setNum })}
                          </div>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1,
                            color: 'rgba(236,234,239,0.2)', textAlign: 'right',
                          }}>
                            {lastSet
                              ? `${lastSet.weightKg ?? 0} кг × ${lastSet.reps}`
                              : `${repsLabel} ${t('workout.reps').toLowerCase()}`
                            }
                          </span>
                        </div>
                      </SwipeRow>
                    )
                  })}
                </div>
              )}

              {/* + добавить подход */}
              {!resting && currentPlanExercise && (
                <button onClick={handleAddPlannedSet} style={{
                  marginTop: 8, width: '100%', height: 36,
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)',
                  borderRadius: 10, color: 'rgba(236,234,239,0.5)', fontSize: 11.5, cursor: 'pointer',
                }}>
                  {t('workout.addSetExtra')}
                </button>
              )}
            </div>

            {/* Next exercise button (when sets done but user hasn't auto-advanced) */}
            {doneSets.length > 0 && !resting && (
              <div style={{ padding: '0 12px 14px' }}>
                <button onClick={() => handleNextExercise()} style={{
                  width: '100%', height: 40, borderRadius: 10, border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(236,234,239,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name="arrowRight" size={14} />
                  {t('workout.nextExercise')}
                </button>
              </div>
            )}
          </Glass>
        )}

        {/* ── No current exercise: all done or waiting ── */}
        {!currentExercise && hasPlan && upcomingExercises.length === 0 && (
          <Glass padding="20px" radius={16} style={{ textAlign: 'center' }}>
            <Icon name="check" size={32} style={{ color: 'hsl(var(--accent-h,158),55%,55%)' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 8 }}>
              {t('workout.completed')}
            </div>
            <Button variant="primary" block size="lg" loading={finishing} onClick={handleFinish} style={{ marginTop: 16 }}>
              {t('workout.finishWorkout')}
            </Button>
            <button onClick={() => setPicking(true)} style={{
              marginTop: 8, width: '100%', height: 36, background: 'none', border: 'none',
              color: 'rgba(236,234,239,0.5)', fontSize: 12, cursor: 'pointer',
            }}>
              {t('workout.addOther')}
            </button>
          </Glass>
        )}

        {/* ── Workout muscle map ── */}
        {workoutMuscles.length > 0 && upcomingExercises.length > 0 && (
          <div style={{ marginTop: 14, marginBottom: 4 }}>
            <BodyMap muscles={workoutMuscles} height={160} />
          </div>
        )}

        {/* ── Upcoming exercises ── */}
        {upcomingExercises.length > 0 && (
          <>
            <div style={{ marginTop: 18, marginBottom: 6, padding: '0 4px' }}>
              <div style={{
                fontSize: 10, fontWeight: 500, color: 'rgba(236,234,239,0.45)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('workout.upcoming')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingExercises.map((pe) => {
                const isExpanded = expandedExerciseId === pe.exerciseId
                const peIndex = planExercises.indexOf(pe) + 1
                const isDragging = draggingId === pe.exerciseId
                const canDrag = upcomingExercises.length > 1
                const partial = partialSets[pe.exerciseId]
                const scheme = partial
                  ? t('workout.setsProgress', { done: partial.length, total: pe.sets })
                  : exerciseScheme(pe)
                return (
                  <div key={pe.exerciseId} data-drag-item>
                    {isExpanded && !draggingId ? (
                      <ExpandedUpcomingCard
                        planExercise={pe}
                        index={peIndex}
                        totalExercises={planExercises.length}
                        lastResults={lastResultsCache[pe.exerciseId]}
                        partialSets={partial}
                        onCollapse={() => setExpandedExerciseId(null)}
                        onStart={() => {
                          setExpandedExerciseId(null)
                          handleSelectFromPlan(pe)
                        }}
                        onDeletePartialSet={partial ? (setIdx) => handleDeletePartialSet(pe.exerciseId, setIdx) : null}
                        onSwapAlternative={handleSwapUpcoming}
                        onInfo={setDetailExerciseId}
                      />
                    ) : (
                      <UpcomingExerciseItem
                        index={peIndex}
                        name={pe.nameRu}
                        scheme={scheme}
                        expanded={false}
                        hasPartial={!!partial}
                        hasAlternatives={pe.alternatives?.length > 0}
                        onClick={() => setExpandedExerciseId(pe.exerciseId)}
                        onDragStart={canDrag ? (e) => handleDragStart(e, pe.exerciseId) : null}
                        isDragging={isDragging}
                        dragOffset={isDragging ? dragDelta - dragInfo.current.lastSwapDelta : 0}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Add other exercise button ── */}
        {hasPlan && currentExercise && (
          <button onClick={() => setPicking(true)} style={{
            marginTop: 14, width: '100%', height: 36,
            background: 'none', border: 'none',
            color: 'rgba(236,234,239,0.5)', fontSize: 11.5, cursor: 'pointer',
          }}>
            {t('workout.addOther')}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={t('workout.cancelWorkoutTitle')}
        message={hasAnySets ? t('workout.cancelWorkoutMessage') : t('workout.cancelWorkoutMessageEmpty')}
        confirmLabel={t('workout.cancelWorkoutConfirm')}
        variant="danger"
        onConfirm={handleCancelWorkout}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={!!pendingSwap}
        title={t('workout.swapConfirmTitle')}
        message={t('workout.swapConfirmMessage', { count: doneSets.length })}
        confirmLabel={t('workout.swapConfirmBtn')}
        variant="danger"
        onConfirm={confirmSwap}
        onCancel={() => setPendingSwap(null)}
      />

      {/* Alternatives bottom-sheet */}
      <BottomSheet open={showAlternatives} onClose={() => setShowAlternatives(false)}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--fg-primary)' }}>
            {t('workout.alternativesTitle')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {/* Current exercise (locked) */}
          {currentExercise && (
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'hsla(var(--accent-h,158),55%,55%,0.10)',
              border: '1px solid hsla(var(--accent-h,158),55%,55%,0.25)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="check" size={11} strokeWidth={3} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                  {currentExercise.nameRu}
                </div>
                <div style={{ fontSize: 10, color: 'hsl(var(--accent-h,158),55%,70%)', marginTop: 2 }}>
                  {t('workout.currentExercise')}
                </div>
              </div>
            </div>
          )}

          {/* Alternative exercises */}
          {currentPlanExercise?.alternatives?.map(alt => (
            <button key={alt.exerciseId} onClick={() => handleSwapAlternative(alt)} style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              fontFamily: 'var(--font-sans)',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="swap" size={11} style={{ color: 'rgba(236,234,239,0.5)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                  {alt.nameRu}
                </div>
              </div>
              <Icon name="chevronRight" size={14} style={{ color: 'rgba(236,234,239,0.35)' }} />
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Exercise Detail Sheet */}
      <ExerciseDetailSheet
        exerciseId={detailExerciseId}
        open={!!detailExerciseId}
        onClose={() => setDetailExerciseId(null)}
        onSettingsChange={handleExerciseSettingsChange}
      />
    </div>
  )
}
