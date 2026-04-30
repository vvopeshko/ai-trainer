/**
 * Progress Page — экран прогресса (BRD §12.4).
 *
 * Секции: Заголовок → Month stats (4 плитки) → Recent workouts (с swipe-to-delete).
 * Данные: monthStats + recent из HomeDataContext.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { StatTile } from '../../components/ui/StatTile.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'
import { apiDelete } from '../../utils/api.js'

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

const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function formatDuration(sec, t) {
  if (sec == null) return null
  const mins = Math.round(sec / 60)
  if (mins < 1) return '< 1 мин'
  return t('home.durationMin', { n: mins })
}

function formatDateLine(dateStr, t) {
  const date = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((todayStart - dateStart) / 86400000)

  const weekday = WEEKDAYS_RU[date.getDay()]
  if (diffDays === 0) return `${weekday}, ${t('home.today').toLowerCase()}`
  if (diffDays === 1) return `${weekday}, ${t('home.yesterday').toLowerCase()}`
  return `${weekday}, ${t('home.daysAgo', { n: diffDays })}`
}

function SwipeRow({ children, onDelete }) {
  const trackRef = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const opened = useRef(false)
  const DELETE_W = 72

  const handleTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX
    currentX.current = opened.current ? -DELETE_W : 0
  }, [])

  const handleTouchMove = useCallback((e) => {
    const dx = e.touches[0].clientX - startX.current
    let offset = opened.current ? dx - DELETE_W : dx
    offset = Math.min(0, Math.max(-DELETE_W - 20, offset))

    if (trackRef.current) {
      trackRef.current.style.transition = 'none'
      trackRef.current.style.transform = `translateX(${offset}px)`
    }
    currentX.current = offset
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!trackRef.current) return
    trackRef.current.style.transition = 'transform 0.25s ease-out'

    if (currentX.current < -DELETE_W / 2) {
      trackRef.current.style.transform = `translateX(-${DELETE_W}px)`
      opened.current = true
    } else {
      trackRef.current.style.transform = 'translateX(0)'
      opened.current = false
    }
  }, [])

  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex',
          transition: 'transform 0.25s ease-out',
        }}
      >
        <div style={{ flex: '0 0 100%', minWidth: 0 }}>
          {children}
        </div>
        <div
          onClick={onDelete}
          style={{
            flex: `0 0 ${DELETE_W}px`,
            background: 'var(--danger, hsl(0,65%,50%))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon name="trash" size={18} style={{ color: '#fff' }} />
        </div>
      </div>
    </div>
  )
}

function RecentList({ workouts, onDelete }) {
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
          const dateLine = formatDateLine(w.startedAt, t)

          return (
            <SwipeRow key={w.id} onDelete={() => onDelete(w.id)}>
              <div style={{
                padding: '12px 14px',
                borderBottom: i < workouts.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}>
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
              </div>
            </SwipeRow>
          )
        })}
      </Glass>
    </div>
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

// ─── Main Component ──────────────────────────────────────────────────

export default function ProgressPage() {
  const { t } = useTranslation()
  const { monthStats, recent, loaded, refresh, setData } = useHomeData()

  const [deletingWorkoutId, setDeletingWorkoutId] = useState(null)

  useEffect(() => { refresh() }, [refresh])

  const handleDeleteRecent = async () => {
    const id = deletingWorkoutId
    setDeletingWorkoutId(null)
    setData(prev => ({ ...prev, recent: prev.recent.filter(w => w.id !== id) }))
    try { await apiDelete(`/api/v1/workouts/${id}`) } catch { /* ignore */ }
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
          value={monthStats?.tonnageKg >= 1000 ? `${(monthStats.tonnageKg / 1000).toFixed(1)}т` : `${monthStats?.tonnageKg ?? 0}кг`}
          icon="trendingUp"
        />
        <StatTile label={t('home.streak')} value={monthStats?.streak ?? 0} icon="flame" />
        <StatTile label={t('home.records')} value="—" icon="trophy" />
      </div>

      {/* Recent workouts */}
      <RecentList workouts={recent} onDelete={id => setDeletingWorkoutId(id)} />

      <ConfirmDialog
        open={!!deletingWorkoutId}
        title={t('home.deleteWorkoutTitle')}
        message={t('home.deleteWorkoutMessage')}
        confirmLabel={t('home.deleteWorkoutConfirm')}
        variant="danger"
        onConfirm={handleDeleteRecent}
        onCancel={() => setDeletingWorkoutId(null)}
      />
    </div>
  )
}
