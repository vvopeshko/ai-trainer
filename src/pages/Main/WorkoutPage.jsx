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
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPost, apiPatch } from '../../utils/api.js'
import TopBar from '../../components/ui/TopBar.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { RestCard } from '../../components/ui/RestCard.jsx'
import BigStepper from '../../components/ui/BigStepper.jsx'

// ─── WorkoutTopBar (glass_v3: Glass strong, timer, progress, ГОТОВО) ────

function WorkoutTopBar({ elapsed, exerciseNum, totalExercises, doneSetCount, totalSetCount, onBack, onFinish, onCancel, hasAnySets }) {
  const { t } = useTranslation()
  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '12px 12px 8px' }}>
      <Glass variant="strong" padding="8px 8px 8px 6px" radius={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'rgba(255,255,255,0.04)', border: 'none',
          color: '#ECEAEF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Icon name="chevronLeft" size={17} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 21, fontWeight: 600,
            lineHeight: 1, color: 'hsl(var(--accent-h,158),55%,75%)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {mm}:{ss}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3,
          }}>
            {totalExercises > 0
              ? `${t('workout.exerciseOf', { n: exerciseNum, total: totalExercises })} · ${t('workout.setsProgress', { done: doneSetCount, total: totalSetCount })}`
              : `${doneSetCount} ${t('workout.sets')}`
            }
          </div>
        </div>

        <button onClick={hasAnySets ? onFinish : onCancel} style={{
          height: 32, padding: '0 13px', borderRadius: 9, border: 'none',
          background: hasAnySets ? 'hsl(var(--accent-h,158),55%,55%)' : 'rgba(255,255,255,0.08)',
          color: hasAnySets ? '#0a1815' : 'rgba(236,234,239,0.7)',
          fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        }}>
          {hasAnySets ? t('workout.ready') : t('workout.cancel')}
        </button>
      </Glass>
    </div>
  )
}

// ─── CollapsedExercise (done exercise row) ──────────────────────────────

function CollapsedExercise({ name, summary }) {
  return (
    <Glass padding="9px 12px" radius={10} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name="check" size={12} strokeWidth={3} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: 'rgba(236,234,239,0.9)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(236,234,239,0.55)' }}>
        {summary}
      </div>
      <Icon name="chevronDown" size={13} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}

// ─── DoneSetRow (compact done set inside active card) ───────────���───────

function DoneSetRow({ index, weight, reps }) {
  return (
    <div style={{
      padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="check" size={11} strokeWidth={3} />
      </div>
      <div style={{
        fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        подход {index + 1}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13.5, flex: 1,
        fontWeight: 600, color: '#ECEAEF', textAlign: 'right',
      }}>
        {weight} × {reps}
      </span>
    </div>
  )
}

// ─── ActiveSetInput (accent-tinted stepper card) ────────────────────────

function ActiveSetInput({ exercise, setOrder, plannedSets, lastWeight, lastReps, plannedReps, onDone }) {
  const { t } = useTranslation()
  const [weight, setWeight] = useState(lastWeight ?? 0)
  const [reps, setReps] = useState(lastReps ?? plannedReps ?? 10)

  useEffect(() => {
    setWeight(lastWeight ?? 0)
    setReps(lastReps ?? plannedReps ?? 10)
  }, [exercise.id, lastWeight, lastReps, plannedReps])

  const targetLabel = plannedReps
    ? (plannedReps === (lastReps ?? plannedReps)
      ? t('workout.targetReps', { reps: plannedReps })
      : t('workout.targetReps', { reps: plannedReps }))
    : null

  return (
    <div style={{
      padding: 14, borderRadius: 13,
      background: 'hsla(var(--accent-h,158),50%,22%,0.55)',
      border: '1px solid hsla(var(--accent-h,158),55%,50%,0.32)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {plannedSets
            ? t('workout.setOf', { n: setOrder + 1, total: plannedSets })
            : t('workout.set', { n: setOrder + 1 })
          }
        </div>
        {targetLabel && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{targetLabel}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <div style={{
          padding: '7px 4px', borderRadius: 10,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => setWeight(w => Math.max(0, w - 2.5))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {weight % 1 === 0 ? weight : weight.toFixed(1)}
            </div>
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('workout.weightKg')}
            </div>
          </div>
          <button onClick={() => setWeight(w => Math.min(500, w + 2.5))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>+</button>
        </div>

        <div style={{
          padding: '7px 4px', borderRadius: 10,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => setReps(r => Math.max(1, r - 1))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#fff' }}>{reps}</div>
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              повт
            </div>
          </div>
          <button onClick={() => setReps(r => Math.min(100, r + 1))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>+</button>
        </div>
      </div>

      <button onClick={() => onDone({ weight, reps })} style={{
        marginTop: 11, width: '100%', height: 46, borderRadius: 11, border: 'none',
        background: '#fff', color: 'hsl(var(--accent-h,158),50%,22%)',
        fontSize: 13, fontWeight: 700, letterSpacing: 0.4, cursor: 'pointer',
      }}>
        {t('workout.done').toUpperCase()} · {weight % 1 === 0 ? weight : weight.toFixed(1)} × {reps}
      </button>
    </div>
  )
}

// ─── UpcomingExerciseItem ───────────────────────────────────────────────

function UpcomingExerciseItem({ index, name, scheme, onClick }) {
  return (
    <Glass padding="11px 12px" radius={11} style={{
      display: 'flex', alignItems: 'center', gap: 11, cursor: onClick ? 'pointer' : 'default',
    }} onClick={onClick}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'rgba(236,234,239,0.55)',
        flexShrink: 0,
      }}>
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: '#ECEAEF',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{ fontSize: 10.5, color: 'rgba(236,234,239,0.5)', marginTop: 2 }}>{scheme}</div>
      </div>
      <Icon name="chevronRight" size={14} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}

// ─── ExercisePicker ─────────────────────────────────────────────────────

function ExercisePicker({ onSelect }) {
  const { t } = useTranslation()
  const [exercises, setExercises] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = query.length >= 2
          ? await apiGet(`/api/v1/exercises/search?q=${encodeURIComponent(query)}`)
          : await apiGet('/api/v1/exercises?limit=57')
        if (!cancelled) setExercises(data.exercises)
      } catch (err) {
        console.error('Failed to load exercises:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    const timer = setTimeout(load, query ? 300 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('workout.search')}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)', background: 'var(--surface-0)',
            color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading && <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>...</div>}
        {!loading && exercises.length === 0 && (
          <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>{t('workout.noExercises')}</div>
        )}
        {exercises.map(ex => (
          <button key={ex.id} onClick={() => onSelect(ex)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)', background: 'var(--surface-0)',
            color: 'var(--fg-primary)', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', width: '100%',
          }}>
            <Icon name="dumbbell" size={16} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--weight-medium)' }}>{ex.nameRu}</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
                {(ex.primaryMuscles || []).join(', ')}
                {ex.equipment?.length > 0 ? ` · ${ex.equipment.join(', ')}` : ''}
              </div>
            </div>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main WorkoutPage ───────────────────────────────────────────────────

export default function WorkoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [workoutId, setWorkoutId] = useState(null)
  const [currentExercise, setCurrentExercise] = useState(null)
  const [doneSets, setDoneSets] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [startedAt, setStartedAt] = useState(null)
  const [resting, setResting] = useState(false)

  // Plan state
  const [planExercises, setPlanExercises] = useState(null)
  const [planDayTitle, setPlanDayTitle] = useState(null)
  const [planIndex, setPlanIndex] = useState(0)

  const hasPlan = planExercises && planExercises.length > 0

  // ── Timer ──
  useEffect(() => {
    if (!startedAt) return
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  // ── Mount: check active workout ──
  useEffect(() => {
    let cancelled = false
    async function checkActive() {
      try {
        const data = await apiGet('/api/v1/workouts/active')
        if (cancelled) return
        if (!data.workout) { setPicking(true); return }

        const workout = data.workout
        setWorkoutId(workout.id)
        setStartedAt(new Date(workout.startedAt).getTime())

        if (data.planExercises) {
          setPlanExercises(data.planExercises)
          setPlanDayTitle(data.planDayTitle)
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
              setCurrentExercise({ id: data.planExercises[nextIdx].exerciseId, nameRu: data.planExercises[nextIdx].nameRu })
            } else {
              setPlanIndex(data.planExercises.length)
            }
          }
        } else if (data.planExercises) {
          // Fresh start with plan — auto-select first exercise
          const first = data.planExercises[0]
          setPlanIndex(0)
          setCurrentExercise({ id: first.exerciseId, nameRu: first.nameRu })
        } else {
          setPicking(true)
        }
      } catch {
        setPicking(true)
      }
    }
    checkActive()
    return () => { cancelled = true }
  }, [])

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
  const hasAnySets = allExercises.length > 0 || doneSets.length > 0
  const totalDoneSets = allExercises.reduce((s, e) => s + e.sets.length, 0) + doneSets.length
  const totalPlannedSets = hasPlan ? planExercises.reduce((s, e) => s + e.sets, 0) : 0
  const currentExerciseNum = allExercises.length + (currentExercise ? 1 : 0)
  const currentPlanExercise = hasPlan && planIndex < planExercises.length ? planExercises[planIndex] : null

  // ── Handlers ──

  const handleSelectFromPlan = (planEx) => {
    const idx = planExercises.findIndex(pe => pe.exerciseId === planEx.exerciseId)
    if (idx >= 0) setPlanIndex(idx)
    setCurrentExercise({ id: planEx.exerciseId, nameRu: planEx.nameRu })
    setDoneSets([])
    setResting(false)
    setPicking(false)
  }

  const handleSelectExercise = async (exercise) => {
    try { await ensureWorkout() } catch (err) {
      console.error('Failed to create workout:', err); return
    }
    setCurrentExercise(exercise)
    setDoneSets([])
    setResting(false)
    setPicking(false)
  }

  const handleSetDone = async ({ weight, reps }) => {
    if (!workoutId || !currentExercise) return

    const newSet = { weightKg: weight, reps, exerciseId: currentExercise.id }
    const updatedSets = [...doneSets, newSet]
    setDoneSets(updatedSets)

    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}

    try {
      await apiPost(`/api/v1/workouts/${workoutId}/sets`, {
        exerciseId: currentExercise.id,
        exerciseOrder: allExercises.length,
        setOrder: doneSets.length,
        weightKg: weight || null,
        reps,
      })
    } catch (err) {
      console.error('Failed to log set:', err)
    }

    // Auto-advance if all planned sets done
    const plannedSets = currentPlanExercise?.sets
    if (plannedSets && updatedSets.length >= plannedSets) {
      handleNextExercise(updatedSets)
    } else {
      // Show rest timer
      setResting(true)
    }
  }

  const handleRestComplete = () => setResting(false)

  const handleNextExercise = (setsOverride) => {
    const sets = setsOverride || doneSets
    if (currentExercise && sets.length > 0) {
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...sets] }])
    }
    setCurrentExercise(null)
    setDoneSets([])
    setResting(false)

    if (hasPlan) {
      const updatedDoneIds = new Set([...doneExerciseIds])
      if (currentExercise) updatedDoneIds.add(currentExercise.id)

      const nextIdx = planExercises.findIndex((pe, i) => i > planIndex && !updatedDoneIds.has(pe.exerciseId))
      if (nextIdx >= 0) {
        const next = planExercises[nextIdx]
        setPlanIndex(nextIdx)
        setCurrentExercise({ id: next.exerciseId, nameRu: next.nameRu })
        return
      }
      setPlanIndex(planExercises.length)
    } else {
      setPicking(true)
    }
  }

  const handleFinish = async () => {
    if (!workoutId) return
    setFinishing(true)

    // Save current exercise sets if any
    if (currentExercise && doneSets.length > 0) {
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }

    const totalSets = allExercises.reduce((sum, ex) => sum + ex.sets.length, 0) + doneSets.length
    const totalExercises = allExercises.length + (doneSets.length > 0 ? 1 : 0)

    try {
      const result = await apiPatch(`/api/v1/workouts/${workoutId}`, {})
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

  const handleBack = () => navigate('/')

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
    ? planExercises.filter((pe, i) => i > planIndex && !doneExerciseIds.has(pe.exerciseId))
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
        onCancel={handleCancel}
        hasAnySets={hasAnySets}
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
              {allExercises.map((item, i) => (
                <CollapsedExercise
                  key={i}
                  name={item.exercise.nameRu}
                  summary={exerciseSummary(item.sets)}
                />
              ))}
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
                fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginTop: 6,
                color: '#fff', fontFamily: 'var(--font-display)',
              }}>
                {currentExercise.nameRu}
              </div>
              {currentPlanExercise && (
                <div style={{ fontSize: 11.5, color: 'rgba(236,234,239,0.55)', marginTop: 4 }}>
                  {exerciseScheme(currentPlanExercise)}
                </div>
              )}
            </div>

            {/* Done sets inline */}
            {doneSets.length > 0 && (
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {doneSets.map((s, i) => (
                  <DoneSetRow key={i} index={i} weight={s.weightKg ?? 0} reps={s.reps} />
                ))}
              </div>
            )}

            {/* Active set input OR rest timer */}
            <div style={{ padding: '12px 12px 14px' }}>
              {resting ? (
                <>
                  <RestCard
                    seconds={currentPlanExercise?.restSec || 90}
                    onSkip={handleRestComplete}
                    onComplete={handleRestComplete}
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
                  setOrder={doneSets.length}
                  plannedSets={currentPlanExercise?.sets || null}
                  lastWeight={doneSets.length > 0 ? doneSets[doneSets.length - 1].weightKg : null}
                  lastReps={doneSets.length > 0 ? doneSets[doneSets.length - 1].reps : null}
                  plannedReps={currentPlanExercise?.repsMin || null}
                  onDone={handleSetDone}
                />
              )}

              {/* + добавить подход (when all planned done but user wants more) */}
              {!resting && currentPlanExercise && doneSets.length >= currentPlanExercise.sets && (
                <button style={{
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
        {!currentExercise && hasPlan && planIndex >= planExercises.length && (
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
              {upcomingExercises.map((pe, i) => (
                <UpcomingExerciseItem
                  key={pe.exerciseId}
                  index={planExercises.indexOf(pe) + 1}
                  name={pe.nameRu}
                  scheme={exerciseScheme(pe)}
                  onClick={() => handleSelectFromPlan(pe)}
                />
              ))}
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
    </div>
  )
}
