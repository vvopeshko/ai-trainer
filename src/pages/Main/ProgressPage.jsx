/**
 * Progress Page — экран прогресса (BRD §12.4).
 *
 * Секции: Заголовок → Month stats (4 плитки) → Recent workouts (с swipe-to-delete).
 * Данные: monthStats + recent из HomeDataContext.
 */
import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { StatTile } from '../../components/ui/StatTile.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { BodyMap } from '../../components/ui/BodyMapLazy.jsx'
import { SwipeRow } from '../../components/ui/SwipeRow.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useMonthStats, useRecentWorkouts, useProgress, useProgressInsights } from '../../hooks/queries.js'
import { useDeleteWorkout } from '../../hooks/mutations.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { apiGet } from '../../utils/api.js'
import { formatDuration, formatDateLine, WEEKDAYS_RU } from '../../utils/formatters.js'

// ─── Month Stats Skeleton ─────────────────────────────────────────────

function MonthStatsSkeleton() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 'var(--space-3)',
    }}>
      {[0, 1, 2, 3].map(i => (
        <Glass key={i} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width={20} height={20} radius={6} />
          <Skeleton width="40%" height={18} />
          <Skeleton width="60%" height={10} />
        </Glass>
      ))}
    </div>
  )
}

// ─── Recent Workouts ──────────────────────────────────────────────────

function RecentListSkeleton() {
  return (
    <div style={{ marginTop: 'var(--space-5)' }}>
      <Skeleton width="25%" height={13} style={{ marginBottom: 'var(--space-3)' }} />
      <Glass padding={0}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              padding: '12px 14px',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Skeleton width="70%" height={13} />
              <Skeleton width="30%" height={10} />
            </div>
            <Skeleton width={50} height={10} />
          </div>
        ))}
      </Glass>
    </div>
  )
}

// SwipeRow, formatDuration, formatDateLine, WEEKDAYS_RU — imported from shared modules

function RecentList({ workouts, onDelete, onTap }) {
  const { t } = useTranslation()

  if (!workouts || workouts.length === 0) return null

  return (
    <div style={{ marginTop: 'var(--space-5)' }}>
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        {t('home.recent')}
      </div>
      <Glass padding={0} style={{ overflow: 'hidden' }}>
        {workouts.map((w, i) => {
          const title = w.dayTitle
            ? `${t('home.dayN', { n: (w.programDayIndex ?? 0) + 1 })} · ${w.dayTitle}`
            : (w.exercises?.length > 0 ? w.exercises.join(', ') : t('home.freeformWorkout'))
          const duration = formatDuration(w.durationSec, t)
          const dateLine = formatDateLine(w.startedAt, t, WEEKDAYS_RU)

          return (
            <SwipeRow key={w.id} onDelete={() => onDelete(w.id)}>
              <div
                onClick={() => onTap(w)}
                style={{
                  padding: '12px 14px',
                  borderBottom: i < workouts.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--fg-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {title}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--fg-tertiary)',
                    marginTop: 2,
                  }}>
                    <span>{dateLine}</span>
                    {duration && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>{duration}</span>
                      </>
                    )}
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{t('home.sets', { n: w.setsCount })}</span>
                  </div>
                </div>
                <Icon name="chevronRight" size={16} style={{ color: 'var(--fg-disabled)', flexShrink: 0 }} />
              </div>
            </SwipeRow>
          )
        })}
      </Glass>
    </div>
  )
}

// ─── Workout Detail Sheet ────────────────────────────────────────────

function WorkoutDetailSheet({ recentItem, workoutDetail, onClose }) {
  const { t } = useTranslation()

  if (!recentItem) return null

  const title = recentItem.dayTitle
    ? `${t('home.dayN', { n: (recentItem.programDayIndex ?? 0) + 1 })} · ${recentItem.dayTitle}`
    : (recentItem.exercises?.length > 0 ? recentItem.exercises.join(', ') : t('home.freeformWorkout'))
  const duration = formatDuration(recentItem.durationSec, t)
  const dateLine = formatDateLine(recentItem.startedAt, t, WEEKDAYS_RU)

  // Group sets by exerciseOrder (maintaining order)
  const exerciseGroups = []
  if (workoutDetail?.sets) {
    let currentExId = null
    let currentGroup = null
    for (const s of workoutDetail.sets) {
      if (s.exerciseId !== currentExId) {
        currentExId = s.exerciseId
        currentGroup = { name: s.exercise.nameRu, sets: [] }
        exerciseGroups.push(currentGroup)
      }
      currentGroup.sets.push(s)
    }
  }

  return (
    <BottomSheet open={!!recentItem} onClose={onClose}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--fg-primary)',
          marginBottom: 4,
        }}>
          {title}
        </div>
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--fg-tertiary)',
        }}>
          <span>{dateLine}</span>
          {duration && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{duration}</span>
            </>
          )}
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{t('home.sets', { n: recentItem.setsCount })}</span>
        </div>
      </div>

      {/* Exercise list */}
      {!workoutDetail ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[0, 1, 2].map(i => (
            <div key={i}>
              <Skeleton width="60%" height={14} style={{ marginBottom: 8 }} />
              <Skeleton width="40%" height={12} />
              <Skeleton width="35%" height={12} style={{ marginTop: 4 }} />
            </div>
          ))}
        </div>
      ) : exerciseGroups.length === 0 ? (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>
          {t('home.freeformWorkout')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {exerciseGroups.map((group, gi) => (
            <div key={gi}>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--fg-primary)',
                marginBottom: 6,
              }}>
                {group.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.sets.map((s, si) => (
                  <div key={s.id} style={{
                    fontSize: 'var(--text-xs)',
                    color: s.isWarmup ? 'var(--fg-disabled)' : 'var(--fg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}>
                    <span style={{
                      width: 18,
                      color: 'var(--fg-disabled)',
                      fontSize: 'var(--text-xs)',
                    }}>
                      {si + 1}.
                    </span>
                    <span>
                      {s.weightKg != null ? `${s.weightKg} ${t('units.kg')} × ${s.reps}` : `× ${s.reps}`}
                    </span>
                    {s.isWarmup && (
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--fg-disabled)',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 4,
                        padding: '1px 4px',
                      }}>
                        {t('units.warmup')}
                      </span>
                    )}
                    {s.rpe != null && (
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--fg-tertiary)',
                      }}>
                        RPE {s.rpe}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyProgress() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 'var(--space-4)',
      }}>
        <Icon name="activity" size={28} style={{ color: 'var(--fg-disabled)' }} />
      </div>
      <div style={{
        fontSize: 'var(--text-base)', fontWeight: 600,
        color: 'var(--fg-primary)', marginBottom: 'var(--space-2)',
      }}>
        {t('progress.emptyTitle')}
      </div>
      <div style={{
        fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)',
        marginBottom: 'var(--space-5)', maxWidth: 260,
      }}>
        {t('progress.emptyDescription')}
      </div>
      <Button variant="accent" icon="play" onClick={() => navigate('/')}>
        {t('progress.goTrain')}
      </Button>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────

function ProgressSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <Skeleton width="40%" height={24} style={{ marginBottom: 6 }} />
      </div>
      <MonthStatsSkeleton />
      <RecentListSkeleton />
    </div>
  )
}

// ─── Insights (фаза 4) ───────────────────────────────────────────────

const INSIGHT_STYLE = {
  growth:     { icon: 'trendingUp', color: 'hsl(140, 55%, 70%)' },
  plateau:    { icon: 'minus',      color: 'hsl(38, 90%, 70%)' },
  regression: { icon: 'chevronDown', color: 'hsl(4, 75%, 70%)' },
  imbalance:  { icon: 'activity',   color: 'hsl(var(--accent-h,158),55%,72%)' },
}

function InsightsSection() {
  const { t } = useTranslation()
  const { data } = useProgressInsights()

  const chips = data?.chips ?? []
  const cards = data?.cards ?? []
  if (chips.length === 0 && cards.length === 0) return null

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        {t('insights.sectionTitle')}
      </div>

      {/* Chips */}
      {chips.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)',
          marginBottom: cards.length > 0 ? 'var(--space-3)' : 0,
        }}>
          {chips.map(c => {
            const s = INSIGHT_STYLE[c.type] || INSIGHT_STYLE.imbalance
            return (
              <span key={c.type} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)',
              }}>
                <Icon name={s.icon} size={13} style={{ color: s.color }} />
                <span style={{ fontWeight: 600, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                <span>{t(`insights.chip.${c.type}`)}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Cards */}
      {cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {cards.map((c, i) => {
            const s = INSIGHT_STYLE[c.type] || INSIGHT_STYLE.imbalance
            return (
              <Glass key={i} padding="11px 13px" radius={11}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.color, marginTop: 1,
                  }}>
                    <Icon name={s.icon} size={12} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 2 }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4, color: 'var(--fg-tertiary)' }}>
                      {c.detail}
                    </div>
                  </div>
                </div>
              </Glass>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export default function ProgressPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: monthStats, isLoading: statsLoading } = useMonthStats()
  const { data: recent = [] } = useRecentWorkouts()
  const { data: progressData, isLoading: progressLoading } = useProgress()
  const deleteWorkoutMutation = useDeleteWorkout()

  const loaded = !statsLoading

  const [deletingWorkoutId, setDeletingWorkoutId] = useState(null)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [workoutDetail, setWorkoutDetail] = useState(null)
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  // Flatten all subMuscles from muscleVolume for BodyMap
  const flatMuscles = useMemo(() => {
    if (!progressData?.muscleVolume) return []
    return progressData.muscleVolume.flatMap(g => g.subMuscles || [])
  }, [progressData?.muscleVolume])

  // Find group + exercises for a clicked muscle
  const handleMuscleClick = useCallback((muscleId) => {
    if (!progressData?.muscleVolume) return
    const group = progressData.muscleVolume.find(g =>
      g.subMuscles?.some(s => s.muscle === muscleId)
    )
    if (group) setSelectedMuscle(group)
  }, [progressData?.muscleVolume])

  const handleDeleteRecent = async () => {
    const id = deletingWorkoutId
    setDeletingWorkoutId(null)
    deleteWorkoutMutation.mutate(id)
  }

  const handleTapWorkout = async (w) => {
    setSelectedWorkout(w)
    setWorkoutDetail(null)
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.workouts.detail(w.id),
        queryFn: () => apiGet(`/api/v1/workouts/${w.id}`),
        staleTime: Infinity,
      })
      setWorkoutDetail(data.workout)
    } catch {
      // Ошибка загрузки: закрываем шит (иначе он вечно висит на скелетоне) и показываем toast
      setSelectedWorkout(null)
      setWorkoutDetail(null)
      toast.show(t('errors.workoutDetail'))
    }
  }

  const handleCloseDetail = () => {
    setSelectedWorkout(null)
    setWorkoutDetail(null)
  }

  if (!loaded) {
    return (
      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
        <ProgressSkeleton />
      </div>
    )
  }

  const hasData = (monthStats?.workouts ?? 0) > 0 || (recent?.length ?? 0) > 0
  if (!hasData) {
    return (
      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
        <EmptyProgress />
      </div>
    )
  }

  return (
    <div style={{
      padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
    }}>
      {/* Page header */}
      <div style={{
        fontSize: 'var(--text-2xl)', fontWeight: 700,
        color: 'var(--fg-primary)', marginBottom: 4,
      }}>
        {t('progress.title')}
      </div>

      {/* Month stats */}
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        {t('home.thisMonth')}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-3)',
      }}>
        <StatTile label={t('home.workouts')} value={monthStats?.workouts ?? 0} icon="calendar" />
        <StatTile
          label={t('home.tonnage')}
          value={monthStats?.tonnageKg >= 1000 ? `${(monthStats.tonnageKg / 1000).toFixed(1)}${t('units.tonnes')}` : `${monthStats?.tonnageKg ?? 0}${t('units.kg')}`}
          icon="trendingUp"
        />
        <StatTile label={t('home.streak')} value={monthStats?.streak ?? 0} icon="flame" />
        <StatTile label={t('home.records')} value="—" icon="trophy" />
      </div>

      {/* Muscle volume body map */}
      {flatMuscles.length > 0 && (
        <Glass style={{ padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase',
            color: 'var(--fg-tertiary)',
            marginBottom: 'var(--space-3)',
          }}>
            {t('progress.muscle.sectionTitle')}
          </div>
          <BodyMap muscles={flatMuscles} height={260} onMuscleClick={handleMuscleClick} />
        </Glass>
      )}

      {/* Coach insights (фаза 4) */}
      <InsightsSection />

      {/* Muscle detail sheet */}
      <BottomSheet open={!!selectedMuscle} onClose={() => setSelectedMuscle(null)}>
        {selectedMuscle && (
          <>
            <div style={{
              fontSize: 'var(--text-base)', fontWeight: 600,
              color: 'var(--fg-primary)', marginBottom: 4,
            }}>
              {selectedMuscle.nameRu}
            </div>
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
              marginBottom: 'var(--space-4)',
            }}>
              {t('progress.muscle.nSets', { n: selectedMuscle.setsActual })}
              {selectedMuscle.setsTarget && ` / ${selectedMuscle.setsTarget}`}
            </div>

            {/* Sub-muscles */}
            {selectedMuscle.subMuscles?.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
              }}>
                {selectedMuscle.subMuscles.map(s => (
                  <span key={s.muscle} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)',
                  }}>
                    <span style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>{s.nameRu}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-tertiary)' }}>
                      {s.setsActual}{s.setsTarget ? `/${s.setsTarget}` : ''}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Exercises */}
            {selectedMuscle.exercises?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedMuscle.exercises.map((ex, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-primary)' }}>
                      {ex.nameRu}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {t('progress.muscle.nSets', { n: ex.sets })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </BottomSheet>

      {/* Recent workouts */}
      <RecentList workouts={recent} onDelete={id => setDeletingWorkoutId(id)} onTap={handleTapWorkout} />

      <ConfirmDialog
        open={!!deletingWorkoutId}
        title={t('home.deleteWorkoutTitle')}
        message={t('home.deleteWorkoutMessage')}
        confirmLabel={t('home.deleteWorkoutConfirm')}
        variant="danger"
        onConfirm={handleDeleteRecent}
        onCancel={() => setDeletingWorkoutId(null)}
      />

      <WorkoutDetailSheet
        recentItem={selectedWorkout}
        workoutDetail={workoutDetail}
        onClose={handleCloseDetail}
      />
    </div>
  )
}
