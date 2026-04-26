/**
 * Workout Page — главный экран в зале (BRD §12.2, Фаза 1c).
 *
 * Flow:
 * 1. Создаём тренировку → выбираем упражнение
 * 2. BigStepper (вес + повторы) → "Сделал" → подход сохраняется
 * 3. "К следующему" → выбор следующего упражнения
 * 4. "Завершить тренировку" → Summary
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPost, apiPatch } from '../../utils/api.js'
import TopBar from '../../components/ui/TopBar.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import BigStepper from '../../components/ui/BigStepper.jsx'

// ─── Выбор упражнения ──────────────────────────────────────────────────

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
      {/* Search input */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('workout.search')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            background: 'var(--surface-0)',
            color: 'var(--fg-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Exercise list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading && (
          <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>...</div>
        )}
        {!loading && exercises.length === 0 && (
          <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>
            {t('workout.noExercises')}
          </div>
        )}
        {exercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => onSelect(ex)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-0)',
              color: 'var(--fg-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              width: '100%',
            }}
          >
            <Icon name="dumbbell" size={16} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--weight-medium)' }}>{ex.nameRu}</div>
              <div style={{
                fontSize: 'var(--text-2xs)',
                color: 'var(--fg-tertiary)',
                marginTop: 2,
              }}>
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

// ─── Активный подход ────────────────────────────────────────────────────

function ActiveSet({ exercise, setOrder, lastWeight, lastReps, onDone }) {
  const { t } = useTranslation()
  const [weight, setWeight] = useState(lastWeight ?? 0)
  const [reps, setReps] = useState(lastReps ?? 10)

  // Обновить defaults при смене упражнения
  useEffect(() => {
    setWeight(lastWeight ?? 0)
    setReps(lastReps ?? 10)
  }, [exercise.id, lastWeight, lastReps])

  return (
    <Glass padding="16px" style={{ marginTop: 'var(--space-3)' }}>
      {/* Set number */}
      <div style={{
        fontSize: 'var(--text-2xs)',
        fontWeight: 'var(--weight-semi)',
        color: 'var(--fg-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)',
        textAlign: 'center',
        marginBottom: 'var(--space-4)',
      }}>
        {t('workout.set', { n: setOrder + 1 })}
      </div>

      {/* BigSteppers */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-5)',
        justifyContent: 'center',
        marginBottom: 'var(--space-5)',
      }}>
        <BigStepper
          label={t('workout.weightKg')}
          value={weight}
          onChange={setWeight}
          step={2.5}
          min={0}
          max={500}
          format={v => v % 1 === 0 ? String(v) : v.toFixed(1)}
        />
        <BigStepper
          label={t('workout.reps')}
          value={reps}
          onChange={setReps}
          step={1}
          min={1}
          max={100}
        />
      </div>

      {/* "Сделал" button */}
      <Button
        variant="accent"
        block
        size="lg"
        onClick={() => onDone({ weight, reps })}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {t('workout.done')} · {weight} × {reps}
      </Button>
    </Glass>
  )
}

// ─── Выполненные подходы ────────────────────────────────────────────────

function DoneSets({ sets }) {
  if (sets.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-2)',
      marginTop: 'var(--space-3)',
    }}>
      {sets.map((s, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--success-soft)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--success)',
          }}
        >
          <Icon name="check" size={12} />
          {s.weightKg ?? 0}×{s.reps}
        </div>
      ))}
    </div>
  )
}

// ─── Основной экран ─────────────────────────────────────────────────────

export default function WorkoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [workoutId, setWorkoutId] = useState(null)
  const [currentExercise, setCurrentExercise] = useState(null)
  const [doneSets, setDoneSets] = useState([])           // подходы текущего упражнения
  const [allExercises, setAllExercises] = useState([])    // выполненные упражнения
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [startedAt, setStartedAt] = useState(null)

  // ── Timer ──
  useEffect(() => {
    if (!startedAt) return
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Создать или восстановить тренировку ──
  const startWorkout = useCallback(async () => {
    try {
      const { workout, resumed } = await apiPost('/api/v1/workouts', {})
      setWorkoutId(workout.id)
      setStartedAt(new Date(workout.startedAt).getTime())

      if (resumed && workout.sets?.length > 0) {
        // Восстановить подходы по упражнениям
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
      }

      setPicking(true)
    } catch (err) {
      console.error('Failed to start workout:', err)
    }
  }, [])

  useEffect(() => { startWorkout() }, [startWorkout])

  // ── Handlers ──

  const handleSelectExercise = (exercise) => {
    setCurrentExercise(exercise)
    setDoneSets([])
    setPicking(false)
  }

  const handleSetDone = async ({ weight, reps }) => {
    if (!workoutId || !currentExercise) return

    const newSet = { weightKg: weight, reps, exerciseId: currentExercise.id }
    setDoneSets(prev => [...prev, newSet])

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
  }

  const handleNextExercise = () => {
    if (currentExercise && doneSets.length > 0) {
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }
    setCurrentExercise(null)
    setDoneSets([])
    setPicking(true)
  }

  const handleFinish = async () => {
    if (!workoutId) return
    setFinishing(true)

    const totalSets = allExercises.reduce((sum, ex) => sum + ex.sets.length, 0) + doneSets.length
    const totalExercises = allExercises.length + (doneSets.length > 0 ? 1 : 0)

    try {
      await apiPatch(`/api/v1/workouts/${workoutId}`, {})
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
      navigate(`/summary/${workoutId}`, {
        state: { totalSets, totalExercises, elapsedSec },
      })
    } catch (err) {
      console.error('Failed to finish workout:', err)
      setFinishing(false)
    }
  }

  const handleBack = () => navigate('/')

  // ── Render: picker ──
  if (picking) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
        <TopBar
          title={t('workout.selectExercise')}
          onBack={currentExercise ? () => setPicking(false) : handleBack}
          rightLabel={workoutId && allExercises.length > 0 ? t('workout.finish') : undefined}
          onRight={workoutId && allExercises.length > 0 ? handleFinish : undefined}
        />

        {startedAt && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            color: 'var(--fg-tertiary)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
          }}>
            <Icon name="clock" size={14} />
            {formatTime(elapsedSec)}
            {allExercises.length > 0 && (
              <span> · {allExercises.length} {t('workout.exercises')}</span>
            )}
          </div>
        )}

        <ExercisePicker onSelect={handleSelectExercise} />
      </div>
    )
  }

  // ── Render: active workout ──
  return (
    <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
      <TopBar
        title={t('workout.title')}
        onBack={handleBack}
        rightLabel={t('workout.finish')}
        onRight={handleFinish}
      />

      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
        {/* Timer bar */}
        {startedAt && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2)',
            color: 'var(--fg-tertiary)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 'var(--space-3)',
          }}>
            <Icon name="clock" size={14} />
            {formatTime(elapsedSec)}
            <span style={{ color: 'var(--fg-disabled)' }}>
              {' '}· {allExercises.length + 1} {t('workout.exercises')} · {allExercises.reduce((s, e) => s + e.sets.length, 0) + doneSets.length} {t('workout.sets')}
            </span>
          </div>
        )}

        {/* Done exercises */}
        {allExercises.map((item, i) => (
          <Glass key={i} padding="10px 12px" style={{ marginBottom: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{
                width: 22, height: 22,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--success-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="check" size={13} style={{ color: 'var(--success)' }} />
              </div>
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--fg-secondary)',
                flex: 1,
              }}>
                {item.exercise.nameRu}
              </span>
              <span style={{
                fontSize: 'var(--text-2xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-tertiary)',
              }}>
                {item.sets.map(s => `${s.weightKg ?? 0}×${s.reps}`).join(' · ')}
              </span>
            </div>
          </Glass>
        ))}

        {/* Current exercise */}
        {currentExercise && (
          <>
            <Glass variant="tint" padding="14px" style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Icon name="dumbbell" size={20} style={{ color: 'var(--accent-color)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--weight-semi)',
                    color: 'var(--fg-primary)',
                  }}>
                    {currentExercise.nameRu}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-2xs)',
                    color: 'var(--fg-tertiary)',
                    marginTop: 2,
                  }}>
                    {(currentExercise.primaryMuscles || []).join(', ')}
                  </div>
                </div>
              </div>
              <DoneSets sets={doneSets} />
            </Glass>

            <ActiveSet
              exercise={currentExercise}
              setOrder={doneSets.length}
              lastWeight={doneSets.length > 0 ? doneSets[doneSets.length - 1].weightKg : null}
              lastReps={doneSets.length > 0 ? doneSets[doneSets.length - 1].reps : null}
              onDone={handleSetDone}
            />

            {doneSets.length > 0 && (
              <Button
                variant="secondary"
                block
                onClick={handleNextExercise}
                style={{ marginTop: 'var(--space-3)' }}
              >
                <Icon name="arrowRight" size={16} style={{ marginRight: 6 }} />
                {t('workout.nextExercise')}
              </Button>
            )}
          </>
        )}

        {/* Finish button */}
        {(allExercises.length > 0 || doneSets.length > 0) && (
          <Button
            variant="success"
            block
            size="lg"
            loading={finishing}
            onClick={handleFinish}
            style={{ marginTop: 'var(--space-7)' }}
          >
            <Icon name="check" size={18} style={{ marginRight: 6 }} />
            {t('workout.finishWorkout')}
          </Button>
        )}
      </div>
    </div>
  )
}
