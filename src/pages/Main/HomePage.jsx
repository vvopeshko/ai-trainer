/**
 * Home Page — главный экран мини-аппа (BRD §12.1).
 *
 * Секции: YearHeader → ProgrammeHero → WeeklyCard → MuscleGroups → Records.
 * Данные: HomeDataContext + ProgressDataContext.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiPost, apiPatch, apiDelete } from '../../utils/api.js'
import { Icon } from '../../components/ui/Icon.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { BodyMap } from '../../components/ui/BodyMap.jsx'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'
import { useProgressData } from '../../contexts/ProgressDataContext.jsx'

import { YearHeader } from './home/YearHeader.jsx'
import { ProgrammeHeroSkeleton, ProgrammeHero } from './home/ProgrammeHero.jsx'
import { WeeklyCard } from './home/WeeklyCard.jsx'
import { MuscleGroupCard, MUSCLE_ICONS } from './home/MuscleGroupCard.jsx'
import { MonthlyRecordsList } from './home/MonthlyRecordsList.jsx'
import { MostlyEmptyHint } from './home/MostlyEmptyHint.jsx'
import { ProgressSectionSkeleton } from './home/ProgressSectionSkeleton.jsx'

// ─── Main Component ────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { yearStats, activeWorkout, program, nextWorkout, loaded, refresh, setData } = useHomeData()
  const { state: progressState, planAdherence, muscleVolume, records, loaded: progressLoaded, refresh: refreshProgress } = useProgressData()

  const [starting, setStarting] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { refreshProgress() }, [refreshProgress])

  const handleStart = async (programId, dayIndex) => {
    setStarting(true)
    try {
      const body = {}
      if (programId) {
        body.programId = programId
        body.programDayIndex = dayIndex
      }
      await apiPost('/api/v1/workouts', body)
      navigate('/workout')
    } catch (err) {
      console.error('Failed to start workout:', err)
      setStarting(false)
    }
  }

  const handleContinue = () => navigate('/workout')

  const handleResume = async () => {
    if (!activeWorkout?.pausedAt) return
    const pauseDuration = Date.now() - new Date(activeWorkout.pausedAt).getTime()
    setData(prev => ({
      ...prev,
      activeWorkout: {
        ...prev.activeWorkout,
        pausedAt: null,
        totalPausedMs: (prev.activeWorkout.totalPausedMs || 0) + pauseDuration,
      },
    }))
    try {
      await apiPatch(`/api/v1/workouts/${activeWorkout.id}`, { action: 'resume' })
    } catch { /* optimistic update already applied */ }
    navigate('/workout')
  }

  const handleCancel = async () => {
    if (!activeWorkout) return
    setConfirmCancel(false)
    setData(prev => ({ ...prev, activeWorkout: null }))
    try { await apiDelete(`/api/v1/workouts/${activeWorkout.id}`) } catch { /* ignore */ }
  }

  const handlePickDay = (dayIndex) => {
    const day = program.planJson.days[dayIndex]
    setData(prev => ({
      ...prev,
      nextWorkout: {
        programId: program.id,
        day,
        dayIndex,
        totalDays: program.planJson.days.length,
      },
    }))
    setShowDayPicker(false)
  }

  const handlePickFreeform = () => {
    setShowDayPicker(false)
    handleStart()
  }

  const showSkeletons = !loaded

  // Filter muscle groups with data or targets
  const visibleMuscles = (muscleVolume || []).filter(
    g => g.setsActual > 0 || (g.setsTarget != null && g.setsTarget > 0)
  )

  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
      <YearHeader
        done={yearStats?.done ?? 0}
        target={yearStats?.target ?? 208}
        loading={showSkeletons}
      />

      {showSkeletons ? (
        <ProgrammeHeroSkeleton />
      ) : (
        <ProgrammeHero
          program={program}
          activeWorkout={activeWorkout}
          nextDay={nextWorkout?.day}
          nextWorkoutData={nextWorkout}
          onStart={handleStart}
          onContinue={handleContinue}
          onResume={handleResume}
          onCancel={() => setConfirmCancel(true)}
          onPickDay={() => setShowDayPicker(true)}
          onProgramTap={() => program && navigate('/program/' + program.id)}
          loading={starting}
        />
      )}

      {/* Progress section */}
      {!progressLoaded ? (
        <ProgressSectionSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Weekly adherence */}
          {planAdherence && <WeeklyCard data={planAdherence} />}

          {/* Muscle volume */}
          {visibleMuscles.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: 'var(--tracking-caps, 0.08em)',
                textTransform: 'uppercase',
                color: 'var(--fg-tertiary)',
                marginBottom: 'var(--space-3)',
              }}>
                {t('progress.muscle.sectionTitle')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {visibleMuscles.map(g => (
                  <MuscleGroupCard
                    key={g.group}
                    group={g}
                    onTap={g.exercises?.length > 0 ? setSelectedMuscle : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Monthly records */}
          {records && <MonthlyRecordsList records={records} />}

          {/* Mostly empty hint */}
          {progressState === 'mostly_empty' && <MostlyEmptyHint />}
        </div>
      )}

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
              <Icon
                name={MUSCLE_ICONS[selectedMuscle.group] || 'activity'}
                size={20}
                style={{ color: 'hsl(var(--accent-h,158),55%,72%)' }}
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
                    {`День ${idx + 1} · ${day.title}`}
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
