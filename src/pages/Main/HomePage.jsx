/**
 * Home Page — главный экран мини-аппа (GD redesign).
 *
 * Секции: HeroBlock → AnnualGoalCard → инсайт → MyPlanSection → слайдер подходов по мышцам.
 * Данные: HomeDataContext + ProgressDataContext.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiPost } from '../../utils/api.js'
import { Icon } from '../../components/ui/Icon.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { BodyMap } from '../../components/ui/BodyMapLazy.jsx'
import { GlassAINote } from '../../components/ui/GlassAINote.jsx'
import { useYearStats, useActiveWorkoutQuery, useActiveProgram, useNextWorkout, useProgress, useDailyInsight, programDetailQueryOptions } from '../../hooks/queries.js'
import { useCancelWorkout, useResumeWorkout } from '../../hooks/mutations.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

import { HeroBlock, HeroBlockSkeleton } from './home/HeroBlock.jsx'
import { MyPlanSection } from './home/MyPlanSection.jsx'
import { MuscleGroupCard, MUSCLE_ICONS } from './home/MuscleGroupCard.jsx'
import { MuscleIcon } from '../../components/ui/MuscleIcon.jsx'
import { AnnualGoalCard } from './home/AnnualGoalCard.jsx'

// ─── Main Component ────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useTelegram()

  const { data: yearStats } = useYearStats()
  const { data: activeWorkoutData, isPending: activePending } = useActiveWorkoutQuery()
  const activeWorkout = activeWorkoutData?.workout ?? null
  const { data: program, isPending: programPending } = useActiveProgram()
  const { data: nextWorkoutData, isPending: nextPending } = useNextWorkout()
  const nextWorkout = nextWorkoutData?.day ? nextWorkoutData : null
  const { data: progressData } = useProgress()
  const planAdherence = progressData?.planAdherence ?? null
  const muscleVolume = progressData?.muscleVolume ?? null
  const { data: dailyInsight } = useDailyInsight()

  const cancelWorkoutMutation = useCancelWorkout()
  const resumeWorkoutMutation = useResumeWorkout()

  // Hero рисуем, как только есть то, что он показывает (тренировка/программа/следующий день)
  const loaded = !activePending && !programPending && !nextPending
  const progressLoaded = progressData !== undefined

  const toast = useToast()
  const [starting, setStarting] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  const handleStart = async (programId, dayIndex) => {
    setStarting(true)
    try {
      const body = {}
      if (programId) {
        body.programId = programId
        body.programDayIndex = dayIndex
      }
      // Ответ старта — та же форма, что GET /active (тренировка + план дня):
      // кладём в кэш, и WorkoutPage открывается сразу, без скелетона
      const { workout, planExercises, planDayTitle } = await apiPost('/api/v1/workouts', body)
      queryClient.setQueryData(queryKeys.workouts.active, { workout, planExercises, planDayTitle })
      navigate('/workout')
    } catch (err) {
      console.error('Failed to start workout:', err)
      toast.show(t('errors.workoutStart'))
      setStarting(false)
    }
  }

  const handleContinue = () => navigate('/workout')

  const handleResume = async () => {
    if (!activeWorkout?.pausedAt) return
    const pauseDuration = Date.now() - new Date(activeWorkout.pausedAt).getTime()
    // Ждём мутацию до navigate: WorkoutPage на маунте читает кэш one-shot и
    // при мгновенном переходе увидел бы ещё pausedAt != null (двойной resume).
    try {
      await resumeWorkoutMutation.mutateAsync({ id: activeWorkout.id, pauseDuration })
    } catch {
      // Откат в onError вернул паузу — WorkoutPage покажет паузу, там можно повторить.
    }
    navigate('/workout')
  }

  const handleCancel = async () => {
    if (!activeWorkout) return
    setConfirmCancel(false)
    cancelWorkoutMutation.mutate(activeWorkout.id)
  }

  const handlePickDay = (dayIndex) => {
    const day = program.planJson.days[dayIndex]
    queryClient.setQueryData(queryKeys.programs.next, {
      programId: program.id,
      day,
      dayIndex,
      totalDays: program.planJson.days.length,
    })
    setShowDayPicker(false)
  }

  const handlePickFreeform = () => {
    setShowDayPicker(false)
    handleStart()
  }

  const showSkeletons = !loaded

  // Merge doneDates from planAdherence
  const doneDates = planAdherence?.doneDates || []

  // Filter muscle groups with data or targets
  const visibleMuscles = (muscleVolume || []).filter(
    g => g.setsActual > 0 || (g.setsTarget != null && g.setsTarget > 0)
  )

  return (
    <div style={{
      background: 'var(--home-bg)',
      minHeight: '100vh',
      position: 'relative',
      zIndex: 1,
    }}>
      {/* Hero */}
      {showSkeletons ? (
        <HeroBlockSkeleton />
      ) : (
        <HeroBlock
          user={user}
          annualCount={yearStats?.done}
          onShowGoal={() => {
            const goal = document.getElementById('annual-goal')
            goal?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
            goal?.focus({ preventScroll: true })
          }}
          program={program}
          nextWorkout={nextWorkout}
          activeWorkout={activeWorkout}
          doneDates={doneDates}
          onStart={handleStart}
          onContinue={handleContinue}
          onResume={handleResume}
          onCancel={() => setConfirmCancel(true)}
          onPickDay={() => setShowDayPicker(true)}
          onNotifications={() => navigate('/me')}
          loading={starting}
        />
      )}

      <AnnualGoalCard />

      {/* Coach note (daily insight) */}
      {dailyInsight?.text && (
        <div style={{ padding: '0 18px', marginTop: 18 }}>
          <GlassAINote
            kind={dailyInsight.factType === 'regression' ? 'warning' : 'insight'}
            cta={t('insights.details')}
            onCta={() => navigate('/progress')}
          >
            {dailyInsight.text}
          </GlassAINote>
        </div>
      )}

      {/* My plan section */}
      {program && progressLoaded && planAdherence && (
        <MyPlanSection
          planAdherence={planAdherence}
          program={program}
          onProgramTap={() => navigate('/program/' + program.id)}
          // Палец коснулся — грузим чанк экрана и программу, пока он не отпущен
          onProgramIntent={() => {
            import('./ProgramEditPage.jsx')
            queryClient.prefetchQuery(programDetailQueryOptions(program.id))
          }}
        />
      )}

      {/* Muscle volume — горизонтальный слайдер, виден край следующей карточки */}
      {progressLoaded && visibleMuscles.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--gd-faint)',
            margin: '0 18px 10px',
          }}>
            {t('progress.muscle.sectionTitle')}
          </div>
          <div
            role="region"
            aria-label={t('progress.muscle.sectionTitle')}
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 10,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollPaddingInline: 18,
              padding: '0 18px 4px',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              outline: 'none',
            }}
          >
            {visibleMuscles.map(g => (
              <MuscleGroupCard
                key={g.group}
                group={g}
                onTap={g.exercises?.length > 0 ? setSelectedMuscle : undefined}
                style={{
                  flex: visibleMuscles.length > 1 ? '0 0 86%' : '1 0 100%',
                  scrollSnapAlign: 'start',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div style={{ height: 24 }} />

      {/* Cancel workout confirmation */}
      <ConfirmDialog
        open={confirmCancel}
        title={t('workout.cancelWorkoutTitle')}
        message={t('workout.cancelWorkoutMessage')}
        confirmLabel={t('workout.cancelWorkoutConfirm')}
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      {/* Muscle group detail bottom sheet */}
      <BottomSheet open={!!selectedMuscle} onClose={() => setSelectedMuscle(null)}>
        {selectedMuscle && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              marginBottom: 4,
            }}>
              <MuscleIcon
                name={MUSCLE_ICONS[selectedMuscle.group] || 'activity'}
                size={60}
              />
              <span style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--fg-primary)',
              }}>
                {selectedMuscle.nameRu}
              </span>
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--fg-tertiary)',
              marginBottom: 'var(--space-4)',
            }}>
              {t('progress.muscle.setsThisWeek', { n: selectedMuscle.setsActual })}
            </div>

            {selectedMuscle.subMuscles?.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <BodyMap muscles={selectedMuscle.subMuscles} height={180} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {selectedMuscle.exercises.map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < selectedMuscle.exercises.length - 1
                    ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--fg-primary)',
                    flex: 1, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginRight: 'var(--space-3)',
                  }}>
                    {ex.nameRu}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--fg-tertiary)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {t('progress.muscle.nSets', { n: ex.sets })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </BottomSheet>

      {/* Day picker bottom sheet */}
      <BottomSheet open={showDayPicker} onClose={() => setShowDayPicker(false)}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--fg-primary)',
            marginBottom: 4,
          }}>
            {t('home.pickDayTitle')}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--fg-tertiary)',
          }}>
            {t('home.pickDaySubtitle')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {program?.planJson?.days?.map((day, idx) => {
            const isPlanned = nextWorkout?.dayIndex === idx
            const exCount = day.exercises?.length || 0
            const muscles = day.exercises
              ?.map(ex => ex.muscleGroup)
              .filter((v, i, a) => v && a.indexOf(v) === i)
              .join(', ')

            return (
              <button
                key={idx}
                onClick={() => handlePickDay(idx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--surface-0, rgba(255,255,255,0.04))',
                  backdropFilter: 'blur(12px)',
                  border: isPlanned
                    ? '1.5px solid hsl(var(--accent-h,158),55%,55%)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="dumbbell" size={16} style={{ color: 'hsl(var(--accent-h,158),55%,72%)', flexShrink: 0 }} />
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--fg-primary)',
                    flex: 1,
                  }}>
                    {`${t('home.dayN', { n: idx + 1 })} · ${day.title}`}
                  </span>
                  {isPlanned && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 'var(--tracking-caps)',
                      color: 'hsl(var(--accent-h,158),55%,72%)',
                      background: 'hsla(var(--accent-h,158),40%,30%,0.3)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                    }}>
                      {t('home.pickDayPlanned')}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--fg-tertiary)',
                  marginTop: 4,
                  marginLeft: 24,
                }}>
                  {muscles || t('home.nExercises', { n: exCount })}
                </div>
              </button>
            )
          })}

          {/* Freeform option */}
          <button
            onClick={handlePickFreeform}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '12px 14px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plus" size={16} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--fg-primary)',
              }}>
                {t('home.pickFreeform')}
              </span>
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--fg-tertiary)',
              marginTop: 4,
              marginLeft: 24,
            }}>
              {t('home.pickFreeformDesc')}
            </div>
          </button>
        </div>

        <button
          onClick={() => setShowDayPicker(false)}
          style={{
            marginTop: 'var(--space-4)',
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--fg-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          {t('confirm.cancel')}
        </button>
      </BottomSheet>
    </div>
  )
}
