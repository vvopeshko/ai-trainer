import { useState, useEffect } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Icon } from '../../../components/ui/Icon.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'
import { Glass } from '../../../components/ui/Glass.jsx'
import { WeekCalendar } from './WeekCalendar.jsx'
import './hero.css'

const PLURAL_RU = new Intl.PluralRules('ru')

// Секундный тик — только в этом спане, а не во всём hero (календарь, фото, Glass)
function HeroTimer({ workout }) {
  const isPaused = workout.pausedAt != null
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isPaused])
  const elapsed = Math.max(0, Math.floor(((isPaused ? new Date(workout.pausedAt).getTime() : now)
    - new Date(workout.startedAt).getTime() - (workout.totalPausedMs || 0)) / 1000))
  const timer = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  return <span className="home-hero__timer" role="timer">· {timer}</span>
}

export function HeroBlock({
  user, annualCount, onShowGoal, program, nextWorkout, activeWorkout, doneDates,
  onStart, onContinue, onResume, onCancel, onPickDay, onNotifications, onPreview, loading,
}) {
  const { t } = useTranslation()
  const plural = PLURAL_RU
  const isPaused = activeWorkout?.pausedAt != null
  const isActive = !!activeWorkout
  const dayIndex = isActive ? activeWorkout.programDayIndex : nextWorkout?.dayIndex
  const day = isActive ? program?.planJson?.days?.[dayIndex] : nextWorkout?.day
  const estimatedMin = Math.round(day?.exercises?.reduce((sum, ex) => {
    const sets = ex.sets || 3
    return sum + sets * 1.5 + (sets - 1) * (ex.restSec || 90) / 60
  }, 0) || 0)
  const canPickDay = !isActive && program?.planJson?.days?.length > 0
  const cardAction = isActive ? (isPaused ? null : onContinue) : day && !loading ? onPreview : null

  return (
    <div className="home-hero">
      <header className="home-hero__header">
        <div className="home-hero__greeting">
          <span>{t('home.greeting')}</span>
          <h1>{t('home.greetingName', { name: user?.firstName || t('home.greetingFallback') })}</h1>
        </div>
        <div className="home-hero__header-actions">
          <button type="button" className="home-hero__year-count" onClick={onShowGoal}
            aria-label={t('home.openAnnualGoal', { n: annualCount ?? '—' })} aria-controls="annual-goal">
            <Icon name="flame" size={21} />
            <span>{annualCount ?? '—'} {t('home.workoutsShort')}</span>
          </button>
          <button type="button" className="home-hero__icon-button home-hero__bell" onClick={onNotifications} aria-label={t('a11y.notifications')}>
            <Icon name="bell" size={22} />
          </button>
        </div>
      </header>
      <WeekCalendar doneDates={doneDates} />
      <Glass className="home-hero__workout"
        // Тап по карточке (мимо кнопок): идёт тренировка — открыть её, нет — посмотреть день без старта
        onClick={cardAction && ((e) => { if (!e.target.closest('button')) cardAction() })}
        style={{ background: 'var(--home-card-bg)', border: '1px solid var(--home-card-border)', boxShadow: 'var(--home-card-shadow)', borderRadius: 20, cursor: cardAction ? 'pointer' : undefined }}>
        <img className="home-hero__photo" src="/workout-hero.jpg" alt="" fetchPriority="high" />
        <div className="home-hero__shade" />
        <div className="home-hero__workout-content">
          {program && <div className="home-hero__program">
            <Icon name="sparkles" size={13} />
            <span>{program.name}{dayIndex != null && ` · ${t('home.dayN', { n: dayIndex + 1 })}`}</span>
          </div>}
          <h2 className="home-hero__title">{day?.title || t('home.pickFreeform')}</h2>
          {/* Статус активной тренировки занимает строку меты — высота карточки не меняется между состояниями */}
          <div className="home-hero__meta">
            {isActive ? <span className={`home-hero__status${isPaused ? ' home-hero__status--paused' : ''}`}>
              <span className="home-hero__status-dot" aria-hidden="true" />
              {isPaused ? t('home.workoutPaused') : t('home.workoutActive')}
            </span> : day && <>
              <span><Icon name="dumbbell" size={18} />{day.exercises?.length || 0} {t(`home.exerciseWord.${plural.select(day.exercises?.length || 0)}`)}</span>
              {estimatedMin > 0 && <span><Icon name="clock" size={18} />{t('home.estimatedMin', { n: estimatedMin })}</span>}
            </>}
          </div>
          <div className="home-hero__actions">
            <button type="button" className="home-hero__start" disabled={loading}
              onClick={isActive ? (isPaused ? onResume : onContinue) : () => onStart(nextWorkout?.programId, nextWorkout?.dayIndex)}>
              <span className="home-hero__start-label">
                {!loading && <Icon name="play" size={19} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />}
                <span>{loading ? t('workout.starting') : t(isActive ? 'home.continueWorkout' : 'home.startWorkoutCta')}</span>
                {isActive && <HeroTimer workout={activeWorkout} />}
              </span>
            </button>
            {isActive ? <button type="button" className="home-hero__icon-button home-hero__side-action home-hero__cancel"
              onClick={onCancel} aria-label={t('home.cancelWorkout')} aria-haspopup="dialog">
              <Icon name="stop" size={20} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
            </button> : canPickDay && <button type="button" className="home-hero__icon-button home-hero__side-action"
              onClick={onPickDay} disabled={loading} aria-label={t('home.pickDayTitle')} aria-haspopup="dialog">
              <Icon name="shuffle" size={23} aria-hidden="true" />
            </button>}
          </div>
        </div>
      </Glass>
    </div>
  )
}

export function HeroBlockSkeleton() {
  return <div className="home-hero" aria-hidden="true">
    <div className="home-hero__header"><Skeleton width={160} height={64} /><Skeleton width={100} height={44} radius={20} /></div>
    <Skeleton height={86} radius={18} style={{ margin: '20px 0 14px' }} />
    <Skeleton height={250} radius={20} />
  </div>
}
