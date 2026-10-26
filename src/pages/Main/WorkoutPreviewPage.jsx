import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation.js'
import TopBar from '../../components/ui/TopBar.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { BodyMap } from '../../components/ui/BodyMapLazy.jsx'
import { ExerciseDetailSheet } from '../../components/ui/ExerciseDetailSheetLazy.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useNextWorkout, useExerciseCatalog, useExerciseOverview } from '../../hooks/queries.js'
import { useActiveWorkout } from '../../contexts/ActiveWorkoutContext.jsx'
import { queryKeys } from '../../lib/queryKeys.js'
import { startWorkout } from '../../lib/activeWorkoutQuery.js'
import { apiPost } from '../../utils/api.js'
import { getExerciseSettings, kgToLbs } from '../../utils/weightUnit.js'
import { getExerciseMuscle } from '../../utils/exerciseMuscle.js'
import { exerciseProgress } from '../../utils/exerciseProgress.js'
import { UpcomingExerciseItem } from './workout/UpcomingExerciseItem.jsx'
import { ExpandedUpcomingCard } from './workout/ExpandedUpcomingCard.jsx'
import { ExerciseProgress } from './workout/ExerciseProgress.jsx'
import { WorkoutSkeleton } from './workout/WorkoutSkeleton.jsx'

// Просмотр следующей тренировки без старта: упражнения дня, прошлые подходы,
// прогресс и описание — как на экране тренировки, но тренировка не создаётся
// (таймер не идёт, в статистику ничего не пишется). Старт — кнопкой внизу
// (весь день) или «Начать» в карточке упражнения (сразу с него).
// День — тот же, что в hero на главной (programs.next, учитывает выбор дня).
export default function WorkoutPreviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { save: saveWorkoutState } = useActiveWorkout()

  const { data: next, isPending } = useNextWorkout()
  const { data: catalog } = useExerciseCatalog()
  const { data: overview } = useExerciseOverview()
  const catalogById = useMemo(() => new Map((catalog ?? []).map(ex => [ex.id, ex])), [catalog])
  const trendById = useMemo(() => new Map((overview?.exercises ?? []).map(ex => [ex.id,
    exerciseProgress(ex.workouts, ex.plan, { experienceLevel: overview.experienceLevel })?.trend])), [overview])

  const exercises = useMemo(() => next?.day?.exercises ?? [], [next])
  const [expandedId, setExpandedId] = useState(null)
  const [detailExerciseId, setDetailExerciseId] = useState(null)
  const [starting, setStarting] = useState(false)

  // Прошлые результаты — в общем кэше с WorkoutPage: после старта вес уже предзаполнен
  const [lastResults, setLastResults] = useState(() => {
    const cached = queryClient.getQueryState(queryKeys.exercises.lastResults)
    return cached && !cached.isInvalidated ? cached.data ?? {} : {}
  })
  const missingIds = exercises.map(pe => pe.exerciseId).filter(id => id && !lastResults[id]).join(',')
  useEffect(() => {
    if (!missingIds) return
    let cancelled = false
    apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: missingIds.split(',') })
      .then(r => {
        if (cancelled) return
        setLastResults(prev => {
          const merged = { ...prev, ...r.results }
          queryClient.setQueryData(queryKeys.exercises.lastResults, merged)
          return merged
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [missingIds, queryClient])

  const muscles = useMemo(() => {
    const set = new Set()
    for (const pe of exercises) {
      for (const m of catalogById.get(pe.exerciseId)?.primaryMuscles ?? pe.primaryMuscles ?? []) set.add(m)
    }
    return [...set].map(muscle => ({ muscle, setsActual: 5 }))
  }, [exercises, catalogById])

  const scheme = pe => pe.repsMin === pe.repsMax ? `${pe.sets}×${pe.repsMin}` : `${pe.sets}×${pe.repsMin}-${pe.repsMax}`
  const weightRange = pe => {
    const weights = (lastResults[pe.exerciseId]?.lastSets ?? []).map(s => s.weightKg ?? 0).filter(w => w > 0)
    if (!weights.length) return null
    const unit = getExerciseSettings(pe.slug).unit
    const show = kg => unit === 'lbs' ? kgToLbs(kg) : kg
    const low = show(Math.min(...weights)), high = show(Math.max(...weights))
    return `${low === high ? low : `${low}–${high}`} ${t(unit === 'lbs' ? 'units.lbs' : 'units.kg')}`
  }

  // fromExerciseId — «Начать» в карточке: тренировка открывается сразу на этом упражнении
  const handleStart = async (fromExerciseId) => {
    if (starting || !next) return
    setStarting(true)
    try {
      const { workout, planExercises } = await startWorkout(queryClient, {
        programId: next.programId, programDayIndex: next.dayIndex,
      })
      const index = fromExerciseId ? (planExercises ?? []).findIndex(pe => pe.exerciseId === fromExerciseId) : -1
      // Только для новой тренировки: у продолженной уже есть своё сохранённое состояние
      if (index > 0 && !workout.sets?.length) {
        const pe = planExercises[index]
        saveWorkoutState({
          workoutId: workout.id,
          currentExercise: { id: pe.exerciseId, nameRu: pe.nameRu, slug: pe.slug },
          planExercises, planIndex: index, picking: false,
        })
      }
      navigate('/workout', { replace: true })
    } catch {
      toast.show(t('errors.workoutStart'))
      setStarting(false)
    }
  }

  const title = next?.day?.title ?? t('workoutPreview.title')

  if (isPending) return <WorkoutSkeleton />

  return (
    <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
      <TopBar title={title} onBack={() => navigate('/')} style={{ paddingTop: 'var(--safe-top, 0px)' }} />

      {!next?.day ? (
        <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)' }}>
          {t('workoutPreview.empty')}
        </div>
      ) : (
        <div style={{ padding: '0 12px calc(96px + var(--safe-bottom, 0px))' }}>
          <div style={{ fontSize: 11.5, color: 'rgba(236,234,239,0.5)', padding: '4px 4px 0' }}>
            {t('workoutPreview.subtitle', { n: next.dayIndex + 1, count: exercises.length })}
          </div>

          {muscles.length > 0 && (
            <div style={{ marginTop: 14, marginBottom: 4 }}>
              <BodyMap muscles={muscles} height={160} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {exercises.map(pe => pe.exerciseId === expandedId ? (
              <ExpandedUpcomingCard
                key={pe.exerciseId}
                planExercise={pe}
                muscle={getExerciseMuscle(pe, catalogById)}
                lastResults={lastResults[pe.exerciseId]}
                progress={(() => {
                  const settings = getExerciseSettings(pe.slug, pe.trackingType)
                  return <ExerciseProgress exerciseId={pe.exerciseId} plan={pe} unit={settings.unit}
                    step={settings.step} stepUnit={settings.stepUnit} timed={settings.type === 'timer'} />
                })()}
                onCollapse={() => setExpandedId(null)}
                onStart={() => handleStart(pe.exerciseId)}
                onInfo={setDetailExerciseId}
              />
            ) : (
              <UpcomingExerciseItem
                key={pe.exerciseId}
                muscle={getExerciseMuscle(pe, catalogById)}
                name={pe.nameRu}
                scheme={scheme(pe)}
                weightRange={weightRange(pe)}
                trend={trendById.get(pe.exerciseId)}
                expanded={false}
                hasAlternatives={pe.alternatives?.length > 0}
                onClick={() => setExpandedId(pe.exerciseId)}
              />
            ))}
          </div>
        </div>
      )}

      {next?.day && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 'var(--z-nav)',
          padding: '12px 12px calc(12px + var(--safe-bottom, 0px))',
          background: 'linear-gradient(180deg, transparent 0%, var(--bg-app) 35%)',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <Button variant="primary" block size="lg" loading={starting} onClick={() => handleStart()}>
              {t('home.startWorkoutCta')}
            </Button>
          </div>
        </div>
      )}

      <ExerciseDetailSheet exerciseId={detailExerciseId} open={!!detailExerciseId} onClose={() => setDetailExerciseId(null)} />
    </div>
  )
}
