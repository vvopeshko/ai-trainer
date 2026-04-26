/**
 * Home Page — главный экран мини-аппа (BRD §12.1).
 *
 * Секции: YearHeader → ProgrammeStrip → Hero (start/continue) → Month stats → Recent workouts.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { apiGet, apiPost } from '../../utils/api.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { StatTile } from '../../components/ui/StatTile.jsx'

// ─── Year Header ────────────────────────────────────────────────────────

function YearHeader({ done, target }) {
  const { t } = useTranslation()
  const { user } = useTelegram()

  const initial = (user?.firstName || 'U')[0].toUpperCase()
  const pct = target > 0 ? Math.min(done / target, 1) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      {/* Avatar circle */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#0a1815',
        flexShrink: 0,
      }}>
        {initial}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--fg-secondary)',
          marginBottom: 4,
        }}>
          {t('home.yearGoal', { done, target })}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct * 100}%`,
            borderRadius: 3,
            background: 'hsl(var(--accent-h,158),55%,55%)',
            transition: 'width 0.4s ease-out',
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── Programme Strip ────────────────────────────────────────────────────

function ProgrammeStrip({ program }) {
  const { t } = useTranslation()

  if (!program) return null

  const daysCount = program.planJson?.days?.length || 0

  return (
    <Glass padding="12px 14px" style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'hsl(var(--accent-h,158),55%,72%)',
          flexShrink: 0,
        }}>
          <Icon name="list" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--fg-primary)',
          }}>
            {program.name}
          </div>
          {daysCount > 0 && (
            <div style={{
              fontSize: 'var(--text-2xs)',
              color: 'var(--fg-tertiary)',
              marginTop: 1,
            }}>
              {t('home.nDays', { n: daysCount })}
            </div>
          )}
        </div>
        <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)' }} />
      </div>
    </Glass>
  )
}

// ─── Hero: default (start workout) ─────────────────────────────────────

function HeroDefault({ nextDay, programId, dayIndex, onStart, loading }) {
  const { t } = useTranslation()

  return (
    <Glass padding="20px" style={{ marginBottom: 'var(--space-5)' }}>
      {nextDay && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase',
            color: 'hsl(var(--accent-h,158),55%,72%)',
            marginBottom: 4,
          }}>
            {t('home.next')}
          </div>
          <div style={{
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            color: 'var(--fg-primary)',
          }}>
            {nextDay.title}
          </div>
          <div style={{
            fontSize: 'var(--text-2xs)',
            color: 'var(--fg-tertiary)',
            marginTop: 2,
          }}>
            {t('home.nExercises', { n: nextDay.exercises?.length || 0 })}
          </div>
        </div>
      )}
      <Button
        variant="primary"
        size="lg"
        block
        icon="play"
        loading={loading}
        onClick={() => onStart(programId, dayIndex)}
      >
        {t('home.startWorkout')}
      </Button>
    </Glass>
  )
}

// ─── Hero: active workout ──────────────────────────────────────────────

function HeroActive({ workout, onContinue }) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(() => calcElapsed(workout.startedAt))

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(calcElapsed(workout.startedAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [workout.startedAt])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <Glass variant="tint" padding="16px" style={{ marginBottom: 'var(--space-5)', cursor: 'pointer' }} onClick={onContinue}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Pulsing green dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'hsl(140,55%,65%)',
          boxShadow: '0 0 8px hsla(140,55%,55%,0.7)',
          animation: 'trainerPulse 2s ease-in-out infinite',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase',
            color: 'hsl(140,55%,72%)',
          }}>
            {t('home.workoutActive')}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--fg-primary)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 2,
          }}>
            {mm}:{ss}
          </div>
        </div>
        <Button variant="accent" size="sm" onClick={(e) => { e.stopPropagation(); onContinue() }}>
          {t('home.continueWorkout')}
        </Button>
      </div>
      <style>{`@keyframes trainerPulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </Glass>
  )
}

function calcElapsed(startedAt) {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

// ─── Recent Workouts List ──────────────────────────────────────────────

function RecentList({ workouts }) {
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
      <Glass padding={0}>
        {workouts.map((w, i) => (
          <div
            key={w.id}
            style={{
              padding: '12px 14px',
              borderBottom: i < workouts.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
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
                {w.exercises.join(', ')}
              </div>
              <div style={{
                fontSize: 'var(--text-2xs)',
                color: 'var(--fg-tertiary)',
                marginTop: 2,
              }}>
                {t('home.sets', { n: w.setsCount })}
              </div>
            </div>
            <div style={{
              fontSize: 'var(--text-2xs)',
              color: 'var(--fg-tertiary)',
              whiteSpace: 'nowrap',
            }}>
              {relativeDate(w.finishedAt, t)}
            </div>
          </div>
        ))}
      </Glass>
    </div>
  )
}

function relativeDate(dateStr, t) {
  const date = new Date(dateStr)
  const now = new Date()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((todayStart - dateStart) / 86400000)

  if (diffDays === 0) return t('home.today')
  if (diffDays === 1) return t('home.yesterday')
  return t('home.daysAgo', { n: diffDays })
}

// ─── Main Component ────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [yearStats, setYearStats] = useState({ done: 0, target: 208 })
  const [monthStats, setMonthStats] = useState({ workouts: 0, tonnageKg: 0, streak: 0 })
  const [recent, setRecent] = useState([])
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [program, setProgram] = useState(null)
  const [nextWorkout, setNextWorkout] = useState(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      apiGet('/api/v1/stats/year').catch(() => null),
      apiGet('/api/v1/stats/month').catch(() => null),
      apiGet('/api/v1/workouts/recent?limit=4').catch(() => null),
      apiGet('/api/v1/workouts/active').catch(() => null),
      apiGet('/api/v1/programs/active').catch(() => null),
      apiGet('/api/v1/programs/active/next-workout').catch(() => null),
    ]).then(([year, month, recentData, active, prog, next]) => {
      if (cancelled) return
      if (year) setYearStats(year)
      if (month) setMonthStats(month)
      if (recentData?.workouts) setRecent(recentData.workouts)
      if (active?.workout) setActiveWorkout(active.workout)
      if (prog?.program) setProgram(prog.program)
      if (next?.day) setNextWorkout(next)
    })

    return () => { cancelled = true }
  }, [])

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

  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
      <YearHeader done={yearStats.done} target={yearStats.target} />

      <ProgrammeStrip program={program} />

      {activeWorkout
        ? <HeroActive workout={activeWorkout} onContinue={handleContinue} />
        : <HeroDefault
            nextDay={nextWorkout?.day}
            programId={nextWorkout?.programId}
            dayIndex={nextWorkout?.dayIndex}
            onStart={handleStart}
            loading={starting}
          />
      }

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
        <StatTile label={t('home.workouts')} value={monthStats.workouts} icon="calendar" />
        <StatTile
          label={t('home.tonnage')}
          value={monthStats.tonnageKg >= 1000 ? `${(monthStats.tonnageKg / 1000).toFixed(1)}т` : `${monthStats.tonnageKg}кг`}
          icon="trendingUp"
        />
        <StatTile label={t('home.streak')} value={monthStats.streak} icon="flame" />
        <StatTile label={t('home.records')} value="—" icon="trophy" />
      </div>

      <RecentList workouts={recent} />
    </div>
  )
}
