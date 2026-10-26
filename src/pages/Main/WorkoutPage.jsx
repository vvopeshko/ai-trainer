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
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { openTrainerChat } from '../../utils/askTrainer.js'
import { apiPost, apiDelete } from '../../utils/api.js'
import TopBar from '../../components/ui/TopBar.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { RestCard } from '../../components/ui/RestCard.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { BodyMap } from '../../components/ui/BodyMapLazy.jsx'
import { ExerciseDetailSheet } from '../../components/ui/ExerciseDetailSheetLazy.jsx'
import { getExerciseSettings } from '../../utils/weightUnit.js'
import { SwipeRow } from '../../components/ui/SwipeRow.jsx'
import { useQueryClient } from '@tanstack/react-query'
import { fetchActiveWorkout, patchActiveWorkoutSets, activeWorkoutSignature } from '../../lib/activeWorkoutQuery.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { useFinishWorkout, useCancelWorkout } from '../../hooks/mutations.js'
import { useActiveWorkout } from '../../contexts/ActiveWorkoutContext.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { WorkoutTopBar } from './workout/WorkoutTopBar.jsx'
import { CollapsedExercise } from './workout/CollapsedExercise.jsx'
import { DoneSetRow } from './workout/DoneSetRow.jsx'
import { ActiveSetInput } from './workout/ActiveSetInput.jsx'
import { UpcomingExerciseItem } from './workout/UpcomingExerciseItem.jsx'
import { ExpandedUpcomingCard } from './workout/ExpandedUpcomingCard.jsx'
import { WorkoutSkeleton } from './workout/WorkoutSkeleton.jsx'
import { getSetSuggestion, getSetTarget } from '../../utils/setSuggestion.js'
import { kgToLbs, lbsToKg, stepWeight } from '../../utils/weightUnit.js'
import { changeWorkoutPause } from '../../utils/workoutPause.js'
import { restoreWorkoutSnapshot } from '../../utils/workoutState.js'
import { ExerciseProgress } from './workout/ExerciseProgress.jsx'
import { newRecords, exerciseProgress } from '../../utils/exerciseProgress.js'
import { useExerciseHistory, useExerciseOverview, useExerciseCatalog } from '../../hooks/queries.js'
import { getExerciseMuscle } from '../../utils/exerciseMuscle.js'
import { ExerciseMuscleHeader } from './workout/ExerciseMuscleHeader.jsx'
import { ExercisePicker } from './workout/ExercisePicker.jsx'
import { AlternativesPanel } from './workout/AlternativesPanel.jsx'

// A program slot keeps its main exercise while today's variant changes; the
// previous variant stays selectable among the slot's alternatives.
function swapSlot(pe, alt) {
  const others = (pe.alternatives || []).filter(a => a.exerciseId !== alt.exerciseId)
  return {
    ...pe,
    mainExerciseId: pe.mainExerciseId ?? pe.exerciseId,
    mainNameRu: pe.mainNameRu ?? pe.nameRu,
    mainSlug: pe.mainSlug ?? pe.slug,
    exerciseId: alt.exerciseId, nameRu: alt.nameRu, slug: alt.slug,
    alternatives: others.some(a => a.exerciseId === pe.exerciseId) ? others
      : [...others, { exerciseId: pe.exerciseId, nameRu: pe.nameRu, slug: pe.slug }],
  }
}

// ─── Main WorkoutPage ───────────────────────────────────────────────────

export default function WorkoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const toast = useToast()
  const { webApp } = useTelegram()
  const { save: saveWorkoutState, restore: restoreWorkoutState, clear: clearWorkoutState } = useActiveWorkout()
  const [workoutId, setWorkoutId] = useState(null)
  const [askingTrainer, setAskingTrainer] = useState(false)
  const [currentExercise, setCurrentExercise] = useState(null)
  const [doneSets, setDoneSets] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [changingPause, setChangingPause] = useState(false)
  const operationRef = useRef(false)
  const closedRef = useRef(false)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [programDayIndex, setProgramDayIndex] = useState(null)
  const [previewAlt, setPreviewAlt] = useState(null) // alternative opened from the info sheet
  const [dismissedHints, setDismissedHints] = useState(() => new Set())
  const [startedAt, setStartedAt] = useState(null)
  const [resting, setResting] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [totalPausedMs, setTotalPausedMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedExerciseId, setExpandedExerciseId] = useState(null)
  const [expandedDoneIndex, setExpandedDoneIndex] = useState(null)
  // Прошлые результаты переживают уход с экрана: повторный вход не ждёт сеть
  // и не дёргает предзаполненный вес. Инвалидированные (финиш) — не берём.
  const [lastResultsCache, setLastResultsCache] = useState(() => {
    const cached = queryClient.getQueryState(queryKeys.exercises.lastResults)
    return cached && !cached.isInvalidated ? cached.data ?? {} : {}
  })
  useEffect(() => {
    if (Object.keys(lastResultsCache).length) queryClient.setQueryData(queryKeys.exercises.lastResults, lastResultsCache)
  }, [lastResultsCache, queryClient])
  const [partialSets, setPartialSets] = useState({}) // { exerciseId: [...sets] }
  const pendingDeletionsRef = useRef(new Set()) // tempId'ы сетов, удалённых до ответа POST
  const pendingSetPostsRef = useRef(new Set()) // in-flight POST'ы сетов (finish их дожидается)
  const finishWorkoutMutation = useFinishWorkout()
  const cancelWorkoutMutation = useCancelWorkout()
  const [exerciseSettings, setExerciseSettingsState] = useState(() => getExerciseSettings(null))
  // Тот же queryKey, что у карточки прогресса — без лишнего запроса.
  const { data: exerciseHistory } = useExerciseHistory(currentExercise?.id)
  // Statuses for the collapsed upcoming rows: one request for all exercises.
  const { data: overview } = useExerciseOverview()
  const { data: catalog } = useExerciseCatalog()
  const catalogById = useMemo(() => new Map((catalog ?? []).map(ex => [ex.id, ex])), [catalog])
  // Plan items and restored state carry only id/slug/name: the catalog knows the type.
  const trackingTypeOf = ex => ex?.trackingType ?? catalogById.get(ex?.id)?.trackingType ?? null
  const trendById = useMemo(() => new Map((overview?.exercises ?? []).map(ex => [ex.id,
    exerciseProgress(ex.workouts, ex.plan, { experienceLevel: overview.experienceLevel })?.trend])), [overview])
  const [detailExerciseId, setDetailExerciseId] = useState(null)

  // Plan state
  const [planExercises, setPlanExercises] = useState(null)
  const [planDayTitle, setPlanDayTitle] = useState(null)
  const [planIndex, setPlanIndex] = useState(0)

  const hasPlan = planExercises && planExercises.length > 0

  // ── Drag reorder state ──
  // Визуальное следование за пальцем пишется прямо в DOM (dragElRef), без
  // setState на каждый touchmove — иначе вся страница ре-рендерилась бы с
  // частотой тача. В state — только draggingId (старт/конец, редко) и свапы.
  const [draggingId, setDraggingId] = useState(null)
  const dragInfo = useRef({ startY: 0, lastSwapDelta: 0, itemHeight: 62 })
  const dragElRef = useRef(null) // DOM-узел перетаскиваемого элемента (wrapper)
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
      setExerciseSettingsState(getExerciseSettings(currentExercise.slug, trackingTypeOf(currentExercise)))
    }
  }, [currentExercise?.id, catalogById]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExerciseSettingsChange = (newSettings) => {
    setExerciseSettingsState(newSettings)
  }

  const handleDragStart = (e, exerciseId) => {
    const touch = e.touches[0]
    const itemEl = e.currentTarget.closest('[data-drag-item]')
    const h = itemEl?.getBoundingClientRect().height ?? 55
    dragInfo.current = { startY: touch.clientY, lastSwapDelta: 0, itemHeight: h + 6 }
    dragElRef.current = itemEl
    // Поднимаем узел над соседями императивно (wrapper без style-пропа —
    // React эти стили не сбрасывает при ре-рендере после свапа).
    if (itemEl) {
      itemEl.style.position = 'relative'
      itemEl.style.zIndex = '50'
      itemEl.style.willChange = 'transform'
    }
    setDraggingId(exerciseId)
    setExpandedExerciseId(null)
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium') } catch {}
  }

  useEffect(() => {
    if (!draggingId) return

    const applyTransform = (delta) => {
      const el = dragElRef.current
      if (el) el.style.transform = `translateY(${delta - dragInfo.current.lastSwapDelta}px)`
    }

    const onMove = (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      const delta = touch.clientY - dragInfo.current.startY
      // Прямо в DOM, без setState — плавно даже на слабом WebView.
      applyTransform(delta)

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
          // После свапа сразу подгоняем offset под новый lastSwapDelta —
          // элемент остаётся под пальцем без прыжка (узел тот же, key стабилен).
          applyTransform(delta)
          try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {}
        }
      }
    }

    const onEnd = () => {
      const el = dragElRef.current
      if (el) {
        el.style.transform = ''
        el.style.zIndex = ''
        el.style.position = ''
        el.style.willChange = ''
      }
      dragElRef.current = null
      setDraggingId(null)
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [draggingId])

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

      const saved = restoreWorkoutState(workout.id)
      const restored = restoreWorkoutSnapshot(data, saved)
      setCurrentExercise(restored.currentExercise)
      setDoneSets(restored.doneSets)
      setPartialSets(restored.partialSets)
      setPlanExercises(restored.planExercises)
      setPlanDayTitle(data.planDayTitle)
      setProgramDayIndex(workout.programDayIndex ?? null)
      setPlanIndex(restored.planIndex)
      setAllExercises(restored.allExercises)
      setResting(restored.resting)
      setPicking(restored.picking)
      const ids = [...new Set([
        ...(restored.planExercises ?? []).map(pe => pe.exerciseId),
        ...(restored.currentExercise ? [restored.currentExercise.id] : []),
      ])]
      const missing = ids.filter(id => !lastResultsCache[id])
      if (missing.length) {
        apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: missing })
          .then(r => { if (!cancelled) setLastResultsCache(prev => ({ ...prev, ...r.results })) })
          .catch(() => {})
      }
    }

    // Есть тренировка в кэше (Home, старт, прошлый визит, персист) — рисуем сразу,
    // без скелетона, и сверяемся с сервером фоном: кэш мог отстать (другое
    // устройство). Разошлось — применяем серверную правду.
    const cached = queryClient.getQueryData(queryKeys.workouts.active)
    const shownFromCache = !!cached?.workout
    if (shownFromCache) {
      applyData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setLoadError(false)
    fetchActiveWorkout(queryClient)
      .then(data => {
        if (cancelled) return
        if (!shownFromCache || activeWorkoutSignature(data) !== activeWorkoutSignature(cached)) applyData(data)
        setLoading(false)
      })
      .catch(error => {
        if (!cancelled) {
          // No tokens, response bodies or workout data in diagnostics.
          console.warn('[workout] active load failed', { name: error?.name, status: error?.status })
          // Показали кэш — оставляем его; ошибка только если показывать нечего
          if (!shownFromCache) setLoadError(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [loadAttempt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist only after loading server truth; clearing on finish must not be
  // undone by an unmount cleanup or a late save.
  useEffect(() => {
    if (workoutId && !loading && !loadError && !closedRef.current) {
      saveWorkoutState({ workoutId, currentExercise, doneSets, partialSets,
        planExercises, planIndex, allExercises, resting, picking })
    }
  }, [workoutId, currentExercise, doneSets, partialSets, planExercises, planIndex,
    allExercises, resting, picking, loading, loadError, saveWorkoutState])

  // ── Удаление сета на сервере ──
  // Молчаливый .catch(() => {}) оставлял сет в БД (портил статистику), а юзер
  // не узнавал. Теперь: toast + очередь неудавшихся, ретрай перед финишем.
  const failedDeletionsRef = useRef([]) // setId, которые не удалось удалить
  const pendingDeletesRef = useRef(new Set())
  const deleteSetOnServer = (setId) => {
    if (!setId || !workoutId) return
    const request = apiDelete(`/api/v1/workouts/${workoutId}/sets/${setId}`).then(() => {
      patchActiveWorkoutSets(queryClient, workoutId, sets => sets.filter(s => s.id !== setId))
    }, () => {
      failedDeletionsRef.current.push(setId)
      toast.show(t('errors.network'))
    })
    pendingDeletesRef.current.add(request)
    request.finally(() => pendingDeletesRef.current.delete(request))
  }

  // ── Ensure workout exists ──
  const ensureWorkout = async () => {
    if (workoutId) return workoutId
    const { workout, planExercises: plan, planDayTitle: title } = await apiPost('/api/v1/workouts', {})
    setWorkoutId(workout.id)
    setStartedAt(new Date(workout.startedAt).getTime())
    // Кэш активной тренировки устарел (там workout: null): ответ старта — та же
    // форма, что GET /active, кладём его вместо рефетча
    queryClient.setQueryData(queryKeys.workouts.active, { workout, planExercises: plan, planDayTitle: title })
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
  const currentMuscle = getExerciseMuscle(currentExercise, catalogById, currentPlanExercise)

  const suggestionFor = (setIndex) => getSetSuggestion({
    setIndex,
    lastSets: lastResultsCache[currentExercise?.id]?.lastSets,
    doneSets,
    plannedReps: currentPlanExercise?.repsMin,
  })
  const nextSet = suggestionFor(doneSets.length)
  // Same progress as the card (same history query) so the set target agrees with it.
  // Weight progression (targets, records) — not for timed sets nor for assisted
  // exercises, where the weight is assistance and less of it is progress.
  const assisted = trackingTypeOf(currentExercise) === 'assisted_bodyweight'
  const progress = useMemo(() => exerciseHistory?.workouts && exerciseSettings.type !== 'timer' && !assisted
    ? exerciseProgress(exerciseHistory.workouts, currentPlanExercise, { experienceLevel: exerciseHistory.experienceLevel })
    : null, [exerciseHistory, currentPlanExercise, exerciseSettings.type, assisted])
  const readyWeightKg = (() => {
    if (!progress?.ready?.weightKg || !exerciseSettings.step) return null
    const lbs = exerciseSettings.unit === 'lbs'
    const next = stepWeight(lbs ? kgToLbs(progress.ready.weightKg) : progress.ready.weightKg, 1, exerciseSettings.step, exerciseSettings.stepUnit ?? exerciseSettings.unit, exerciseSettings.unit)
    return lbs ? lbsToKg(next) : next
  })()
  const setTarget = getSetTarget({
    setIndex: doneSets.length, lastSets: lastResultsCache[currentExercise?.id]?.lastSets,
    plan: currentPlanExercise, progress, readyWeightKg,
  })
  // Weights of the last session, e.g. "80–85 кг", for the collapsed upcoming rows.
  const weightRange = (pe) => {
    const weights = (lastResultsCache[pe.exerciseId]?.lastSets ?? []).map(s => s.weightKg ?? 0).filter(w => w > 0)
    if (!weights.length) return null
    const unit = getExerciseSettings(pe.slug).unit
    const show = kg => unit === 'lbs' ? kgToLbs(kg) : kg
    const low = show(Math.min(...weights)), high = show(Math.max(...weights))
    return `${low === high ? low : `${low}–${high}`} ${t(unit === 'lbs' ? 'units.lbs' : 'units.kg')}`
  }
  const formatSuggestedSet = (set) => {
    const weight = exerciseSettings.unit === 'lbs' ? kgToLbs(set.weightKg) : set.weightKg
    return `${weight} ${t(exerciseSettings.unit === 'lbs' ? 'units.lbs' : 'units.kg')} × ${set.reps}`
  }

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

  const handleSetDone = ({ weight, reps }) => {
    if (!workoutId || !currentExercise || pausedAt || operationRef.current) return

    const tempId = crypto.randomUUID()
    const newSet = { weightKg: weight, reps, exerciseId: currentExercise.id, tempId }
    setDoneSets(prev => [...prev, newSet])

    // «Новый рекорд»: только против загруженной истории, иначе второй подход
    // «побил» бы первый. Подходы этой тренировки тоже считаются прошлыми.
    const pastWorkouts = exerciseHistory?.workouts ?? []
    if (pastWorkouts.length && exerciseSettings.type !== 'timer' && !assisted) {
      const prior = [...pastWorkouts.flatMap(w => w.sets), ...doneSets, ...(partialSets[currentExercise.id] ?? []),
        ...allExercises.filter(ex => ex.exercise.id === currentExercise.id).flatMap(ex => ex.sets)]
      const [record] = newRecords([newSet], prior)
      if (record) {
        const value = exerciseSettings.unit === 'lbs' ? kgToLbs(record.weightKg) : record.weightKg
        toast.show(record.weightKg > 0
          ? t('workout.newRecord', { weight: value, unit: t(exerciseSettings.unit === 'lbs' ? 'units.lbs' : 'units.kg'), reps: record.reps })
          : t('workout.newRecordReps', { reps: record.reps }), 'success')
      }
    }

    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
    // Event handler only: capture the actual time the approach was recorded.
    // eslint-disable-next-line react-hooks/purity
    setResting(Date.now() - totalPausedMs)

    const postSet = async () => {
      try {
        const { set } = await apiPost(`/api/v1/workouts/${workoutId}/sets`, {
          exerciseId: currentExercise.id,
          exerciseOrder: allExercises.length,
          setOrder: doneSets.length,
          weightKg: weight || null,
          reps,
        })

        // Сет удалили пока POST летел → сразу удаляем на сервере
        if (pendingDeletionsRef.current.has(tempId)) {
          pendingDeletionsRef.current.delete(tempId)
          deleteSetOnServer(set.id)
          return
        }

        patchActiveWorkoutSets(queryClient, workoutId, sets => [...sets, set])

        // Патчим id по tempId (не по позиции)
        setDoneSets(prev => prev.map(s =>
          s.tempId === tempId ? { ...s, id: set.id } : s
        ))
        setAllExercises(prev => prev.map(ex => ({
          ...ex,
          sets: ex.sets.map(s => s.tempId === tempId ? { ...s, id: set.id } : s),
        })))
        setPartialSets(prev => {
          let changed = false
          const result = {}
          for (const [exId, sets] of Object.entries(prev)) {
            result[exId] = sets.map(s => {
              if (s.tempId === tempId) { changed = true; return { ...s, id: set.id } }
              return s
            })
          }
          return changed ? result : prev
        })
      } catch (err) {
        console.error('Failed to log set:', err)
        // Откат оптимистичного сета: на сервере его нет — оставить в UI значит
        // молча потерять подход (выглядит записанным, после перезахода исчезнет).
        // К моменту ошибки сет мог переехать из doneSets в allExercises/partialSets
        // (saveCurrentExercise) — чистим по tempId во всех трёх местах.
        pendingDeletionsRef.current.delete(tempId)
        setDoneSets(prev => prev.filter(s => s.tempId !== tempId))
        setAllExercises(prev => prev
          .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.tempId !== tempId) }))
          .filter(ex => ex.sets.length > 0))
        setPartialSets(prev => {
          let changed = false
          const result = {}
          for (const [exId, sets] of Object.entries(prev)) {
            const filtered = sets.filter(s => s.tempId !== tempId)
            if (filtered.length !== sets.length) changed = true
            if (filtered.length > 0) result[exId] = filtered
          }
          return changed ? result : prev
        })
        setResting(false)
        toast.show(t('errors.network'))
      }
    }

    // Трекаем in-flight POST: handleFinish дожидается всех, чтобы PATCH finish
    // не обогнал запись последнего подхода.
    const postPromise = postSet()
    pendingSetPostsRef.current.add(postPromise)
    postPromise.finally(() => pendingSetPostsRef.current.delete(postPromise))
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
      deleteSetOnServer(set.id)
    } else if (set?.tempId && !set.id) {
      pendingDeletionsRef.current.add(set.tempId)
    }
    // setExpandedDoneIndex — вне updater'а: сайд-эффекты в pure-функции
    // в StrictMode выполняются дважды.
    if (item.sets.length === 1) setExpandedDoneIndex(null)
    setAllExercises(prev => {
      const updated = [...prev]
      const newSets = [...updated[exerciseIndex].sets]
      newSets.splice(setIndex, 1)
      if (newSets.length === 0) {
        updated.splice(exerciseIndex, 1)
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
        if (set?.id) {
          deleteSetOnServer(set.id)
        } else if (set?.tempId && !set.id) {
          pendingDeletionsRef.current.add(set.tempId)
        }
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
      deleteSetOnServer(lastSet.id)
    } else if (lastSet?.tempId && !lastSet.id) {
      pendingDeletionsRef.current.add(lastSet.tempId)
    }
    setDoneSets(prev => prev.slice(0, -1))
    setResting(false)
  }

  const handleDeleteCurrentSet = (setIndex) => {
    const set = doneSets[setIndex]
    if (set?.id && workoutId) {
      deleteSetOnServer(set.id)
    } else if (set?.tempId && !set.id) {
      pendingDeletionsRef.current.add(set.tempId)
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
      deleteSetOnServer(set.id)
    } else if (set?.tempId && !set.id) {
      pendingDeletionsRef.current.add(set.tempId)
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

  const changePause = async (action) => {
    if (!workoutId || operationRef.current) return
    operationRef.current = true
    setChangingPause(true)
    try {
      const { workout, failed } = await changeWorkoutPause(workoutId, action, [...pendingSetPostsRef.current])
      if (workout) {
        setPausedAt(workout.pausedAt ? new Date(workout.pausedAt).getTime() : null)
        setTotalPausedMs(workout.totalPausedMs || 0)
        // Ответ PATCH может прийти без подходов — не теряем их в кэше
        queryClient.setQueryData(queryKeys.workouts.active, old => ({
          ...old, workout: { ...old?.workout, ...workout, sets: workout.sets ?? old?.workout?.sets },
        }))
      }
      if (failed) toast.show(t('errors.network'))
      return !failed
    } finally {
      operationRef.current = false
      setChangingPause(false)
    }
  }
  const handlePause = () => changePause('pause')
  const handleResume = () => changePause('resume')

  const handleFinish = async () => {
    if (!workoutId || operationRef.current) return
    operationRef.current = true
    setFinishing(true)
    try {
      await Promise.allSettled([...pendingSetPostsRef.current])
      await Promise.allSettled([...pendingDeletesRef.current])
      // Keep failed deletions queued and don't finish until they are confirmed.
      const failed = []
      await Promise.all(failedDeletionsRef.current.map(async id => {
        try { await apiDelete(`/api/v1/workouts/${workoutId}/sets/${id}`) }
        catch { failed.push(id) }
      }))
      failedDeletionsRef.current = failed
      if (failed.length) throw new Error('Set deletions are not saved')

      const result = await finishWorkoutMutation.mutateAsync(workoutId)
      closedRef.current = true
      clearWorkoutState()
      if (result.deleted) { navigate('/'); return }
      // Summary reads the exact server response, including its authoritative
      // sets, finishedAt and totalPausedMs; no optimistic totals survive here.
      queryClient.setQueryData(queryKeys.workouts.detail(workoutId), result)
      navigate(`/summary/${workoutId}`)
    } catch (err) {
      console.error('Failed to finish workout:', err)
      toast.show(t('errors.workoutFinish'))
    } finally {
      operationRef.current = false
      setFinishing(false)
    }
  }

  const handleCancelWorkout = async () => {
    if (operationRef.current) return
    operationRef.current = true
    setFinishing(true)
    setConfirmCancel(false)
    try {
      await Promise.allSettled([...pendingSetPostsRef.current])
      await Promise.allSettled([...pendingDeletesRef.current])
      if (workoutId) await cancelWorkoutMutation.mutateAsync(workoutId)
      closedRef.current = true
      clearWorkoutState()
      navigate('/')
    } catch {
      toast.show(t('errors.network'))
    } finally {
      operationRef.current = false
      setFinishing(false)
    }
  }

  const handleBack = async () => {
    if (operationRef.current) return
    operationRef.current = true
    setChangingPause(true)
    await Promise.allSettled([...pendingSetPostsRef.current])
    await Promise.allSettled([...pendingDeletesRef.current])
    operationRef.current = false
    setChangingPause(false)
    navigate('/')
  }

  const handleAskTrainer = async () => {
    if (!workoutId || askingTrainer) return
    setAskingTrainer(true)
    try {
      await openTrainerChat(webApp, { type: 'workout', refId: workoutId })
    } finally {
      setAskingTrainer(false)
    }
  }

  // ── Swap alternative ──

  const loadLastResults = (ids) => {
    const missing = ids.filter(id => !lastResultsCache[id])
    if (!missing.length) return
    apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: missing })
      .then(r => setLastResultsCache(prev => ({ ...prev, ...r.results })))
      .catch(() => {})
  }

  // Remember the chosen variant in the program slot, or make it the main one.
  // Fire-and-forget: today's swap never waits for the network.
  const rememberInProgram = (slot, alt, makeMain) => {
    if (!slot || programDayIndex == null) return
    const mainExerciseId = slot.mainExerciseId ?? slot.exerciseId
    if (alt.exerciseId === mainExerciseId) return
    apiPost('/api/v1/programs/active/slot', { dayIndex: programDayIndex, mainExerciseId, exerciseId: alt.exerciseId, makeMain })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.programs.active })
        queryClient.invalidateQueries({ queryKey: queryKeys.programs.next })
        if (makeMain) toast.show(t('workout.madeMain', { name: alt.nameRu }), 'success')
      })
      .catch(() => { if (makeMain) toast.show(t('errors.network')) })
  }

  const handleSwapAlternative = (alt, { makeMain = false } = {}) => {
    rememberInProgram(currentPlanExercise, alt, makeMain)
    executeSwap(alt, makeMain)
  }

  const executeSwap = (alt, makeMain = false) => {
    // Logged sets are real work: keep them as their own exercise in this
    // workout (and in its history); the alternative continues the slot.
    if (currentExercise && doneSets.length > 0) {
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }
    if (hasPlan && currentExercise) {
      setPlanExercises(prev => prev.map(pe => {
        if (pe.exerciseId !== currentExercise.id) return pe
        const swapped = swapSlot(pe, alt)
        // Made main: the slot's main is this exercise for the rest of the workout too.
        return makeMain ? { ...swapped, mainExerciseId: alt.exerciseId, mainNameRu: alt.nameRu, mainSlug: alt.slug, suggestMain: undefined } : swapped
      }))
    }

    setCurrentExercise({ id: alt.exerciseId, nameRu: alt.nameRu, slug: alt.slug })
    setDoneSets([])
    setResting(false)
    loadLastResults([alt.exerciseId])
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
  if (loadError) return (
    <div style={{ padding: 24 }}>
      <TopBar title={t('errors.network')} onBack={handleBack} />
      <Button onClick={() => setLoadAttempt(n => n + 1)}>{t('common.retry')}</Button>
    </div>
  )

  // ── Render: ExercisePicker (full-screen) ──
  if (picking) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
        <TopBar
          title={t('workout.selectExercise')}
          onBack={hasPlan ? () => setPicking(false) : handleBack}
          rightLabel={hasAnySets ? t('workout.finish') : workoutId ? t('workout.cancel') : undefined}
          onRight={hasAnySets ? handleFinish : workoutId ? handleCancelWorkout : undefined}
        />
        <div inert={finishing || changingPause || undefined}><ExercisePicker onSelect={handleSelectExercise} /></div>
      </div>
    )
  }

  // ── Render: Main workout screen ──
  const upcomingExercises = hasPlan
    ? planExercises.filter((pe) => pe.exerciseId !== currentExercise?.id && !doneExerciseIds.has(pe.exerciseId))
    : []

  return (
    <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
      {/* WorkoutTopBar */}
      <WorkoutTopBar
        busy={finishing || changingPause}
        startedAt={startedAt}
        pausedAt={pausedAt}
        totalPausedMs={totalPausedMs}
        exerciseNum={currentExerciseNum}
        totalExercises={hasPlan ? planExercises.length : 0}
        doneSetCount={totalDoneSets}
        totalSetCount={totalPlannedSets}
        onBack={handleBack}
        onFinish={handleFinish}
        onCancel={() => setConfirmCancel(true)}
        hasAnySets={hasAnySets}
        onPause={handlePause}
        onResume={handleResume}
      />

      <div inert={finishing || changingPause || undefined} style={{ position: 'relative', zIndex: 1, overflow: 'auto', padding: '4px 12px 22px' }}>

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
                      muscle={getExerciseMuscle(item.exercise, catalogById)}
                      name={item.exercise.nameRu}
                      summary={exerciseSummary(item.sets)}
                      expanded={isExpanded}
                      onClick={() => setExpandedDoneIndex(isExpanded ? null : i)}
                    />
                    {isExpanded && (
                      <Glass flat padding="0" radius="0 0 10px 10px" style={{ borderTop: 'none', marginTop: -1 }}>
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {item.sets.map((s, si) => (
                            <DoneSetRow
                              key={s.tempId ?? s.id ?? si}
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
              <ExerciseMuscleHeader muscle={currentMuscle} scheme={currentPlanExercise ? exerciseScheme(currentPlanExercise) : null} marker={t('workout.now')}>
                <button
                  type="button"
                  onClick={() => setDetailExerciseId(currentExercise.id)}
                  aria-label={t('a11y.exerciseInfo')}
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
              </ExerciseMuscleHeader>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: 'var(--fg-primary)', fontFamily: 'var(--font-display)', marginTop: 10, overflowWrap: 'anywhere' }}>
                {currentExercise.nameRu}
              </div>
            </div>

            {/* Same alternative chosen in the last two workouts of this day */}
            {currentPlanExercise?.suggestMain && currentExercise.id === (currentPlanExercise.mainExerciseId ?? currentPlanExercise.exerciseId)
              && !dismissedHints.has(currentPlanExercise.exerciseId) && (
              <div style={{
                margin: '0 12px 10px', padding: '10px 12px', borderRadius: 12,
                background: 'var(--accent-color-soft)', fontSize: 12.5, color: 'var(--fg-primary)', lineHeight: 1.4,
              }}>
                {t('workout.suggestMain', { name: currentPlanExercise.suggestMain.nameRu })}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => handleSwapAlternative(currentPlanExercise.suggestMain, { makeMain: true })} style={{
                    padding: '6px 10px', borderRadius: 8, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-color)', color: 'var(--fg-on-accent)',
                  }}>{t('workout.makeMain')}</button>
                  <button onClick={() => setDismissedHints(prev => new Set(prev).add(currentPlanExercise.exerciseId))} style={{
                    padding: '6px 10px', borderRadius: 8, border: 0, cursor: 'pointer', fontSize: 12,
                    background: 'rgba(236,234,239,0.08)', color: 'var(--fg-secondary)',
                  }}>{t('workout.keepMain')}</button>
                </div>
              </div>
            )}

            {exerciseSettings.setupNote && (
              <div style={{
                margin: '0 12px 8px', display: 'flex', gap: 6, alignItems: 'flex-start',
                fontSize: 12.5, color: 'var(--fg-secondary)', lineHeight: 1.4,
              }}>
                <Icon name="pen" size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--fg-tertiary)' }} />
                <span><span style={{ color: 'var(--fg-tertiary)' }}>{t('workout.setupNote')}: </span>{exerciseSettings.setupNote}</span>
              </div>
            )}

            <ExerciseProgress
              key={currentExercise.id}
              exerciseId={currentExercise.id}
              plan={currentPlanExercise}
              unit={exerciseSettings.unit}
              step={exerciseSettings.step}
              stepUnit={exerciseSettings.stepUnit}
              timed={exerciseSettings.type === 'timer'}
              assisted={assisted}
            />

            {/* Done sets inline */}
            {doneSets.length > 0 && (
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* key по tempId/id: с key={i} swipe-открытая «корзина» после
                    удаления переезжала на соседний сет (React переиспользует DOM). */}
                {doneSets.map((s, i) => (
                  <DoneSetRow key={s.tempId ?? s.id ?? i} index={i} weight={s.weightKg ?? 0} reps={s.reps}
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
                    startedAt={resting + totalPausedMs}
                    pausedAt={pausedAt}
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
                        {formatSuggestedSet(nextSet)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <ActiveSetInput
                  key={`${currentExercise.id}:${doneSets.length}`}
                  exercise={currentExercise}
                  unit={exerciseSettings.unit}
                  step={exerciseSettings.step}
                  stepUnit={exerciseSettings.stepUnit}
                  minWeight={exerciseSettings.minWeight}
                  maxWeight={exerciseSettings.maxWeight}
                  setOrder={doneSets.length}
                  plannedSets={currentPlanExercise?.sets || null}
                  lastWeight={nextSet.weightKg}
                  lastReps={nextSet.reps}
                  plannedReps={currentPlanExercise?.repsMin || null}
                  target={setTarget}
                  onDone={handleSetDone}
                  mode={exerciseSettings.type === 'timer' ? 'timer'
                    : assisted ? 'assisted'
                      : trackingTypeOf(currentExercise) === 'bodyweight_reps' ? 'bodyweight' : 'reps'}
                />
              )}

              {/* Pending sets preview (swipe to remove) */}
              {currentPlanExercise && doneSets.length + 1 < currentPlanExercise.sets && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {Array.from({ length: currentPlanExercise.sets - doneSets.length - 1 }, (_, i) => {
                    const setNum = doneSets.length + 2 + i
                    const setIdx = doneSets.length + 1 + i
                    const suggestion = suggestionFor(setIdx)
                    const repsLabel = currentPlanExercise.repsMin === currentPlanExercise.repsMax
                      ? `${currentPlanExercise.repsMin}`
                      : `${currentPlanExercise.repsMin}–${currentPlanExercise.repsMax}`
                    return (
                      <SwipeRow key={setNum} deleteWidth={56} onDelete={handleRemovePlannedSet}>
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
                            {suggestion.source !== 'default'
                              ? formatSuggestedSet(suggestion)
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
                        muscle={getExerciseMuscle(pe, catalogById)}
                        lastResults={lastResultsCache[pe.exerciseId]}
                        partialSets={partial}
                        progress={(() => {
                          const settings = getExerciseSettings(pe.slug, trackingTypeOf({ id: pe.exerciseId, ...pe }))
                          return <ExerciseProgress exerciseId={pe.exerciseId} plan={pe} unit={settings.unit}
                            step={settings.step} stepUnit={settings.stepUnit} timed={settings.type === 'timer'} />
                        })()}
                        onCollapse={() => setExpandedExerciseId(null)}
                        onStart={() => {
                          setExpandedExerciseId(null)
                          handleSelectFromPlan(pe)
                        }}
                        onDeletePartialSet={partial ? (setIdx) => handleDeletePartialSet(pe.exerciseId, setIdx) : null}
                        onInfo={setDetailExerciseId}
                      />
                    ) : (
                      <UpcomingExerciseItem
                        muscle={getExerciseMuscle(pe, catalogById)}
                        name={pe.nameRu}
                        scheme={scheme}
                        weightRange={weightRange(pe)}
                        trend={trendById.get(pe.exerciseId)}
                        expanded={false}
                        hasPartial={!!partial}
                        hasAlternatives={pe.alternatives?.length > 0}
                        onClick={() => setExpandedExerciseId(pe.exerciseId)}
                        onDragStart={canDrag ? (e) => handleDragStart(e, pe.exerciseId) : null}
                        isDragging={isDragging}
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

        {/* ── Ask trainer button ── */}
        {workoutId && (
          <button onClick={handleAskTrainer} disabled={askingTrainer} style={{
            marginTop: 10, width: '100%', height: 40, borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(236,234,239,0.7)', fontSize: 12, fontWeight: 600,
            cursor: askingTrainer ? 'default' : 'pointer', opacity: askingTrainer ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Icon name="messageCircle" size={14} />
            {t('workout.askTrainer')}
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



      {/* Exercise Detail Sheet */}
      <ExerciseDetailSheet
        exerciseId={detailExerciseId}
        open={!!detailExerciseId}
        onClose={() => setDetailExerciseId(null)}
        onSettingsChange={handleExerciseSettingsChange}
        alternatives={currentExercise && detailExerciseId === currentExercise.id ? (
          <AlternativesPanel
            current={currentExercise}
            slot={currentPlanExercise}
            lastResults={lastResultsCache}
            onNeedLastResults={loadLastResults}
            trendById={trendById}
            unit={exerciseSettings.unit}
            onPreview={setPreviewAlt}
          />
        ) : null}
      />

      {/* An alternative's description on top of the info sheet; chosen at the bottom */}
      <ExerciseDetailSheet
        exerciseId={previewAlt?.exerciseId}
        open={!!previewAlt}
        onClose={() => setPreviewAlt(null)}
        onSelect={() => { const alt = previewAlt; setPreviewAlt(null); setDetailExerciseId(null); handleSwapAlternative(alt) }}
        onMakeMain={currentPlanExercise && programDayIndex != null && !previewAlt?.isMain
          ? () => { const alt = previewAlt; setPreviewAlt(null); setDetailExerciseId(null); handleSwapAlternative(alt, { makeMain: true }) }
          : undefined}
      />
    </div>
  )
}
