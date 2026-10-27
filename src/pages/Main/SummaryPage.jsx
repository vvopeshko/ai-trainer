import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useWorkoutDetail, useWorkoutResults } from '../../hooks/queries.js'
import { summarizeWorkout } from '../../utils/workoutSummary.js'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { WorkoutResults } from './summary/WorkoutResults.jsx'
import './summary/summary.css'

/** The summary URL survives reloads; the background is a read-only snapshot of
 * the finished workout, never a live WorkoutPage that could start another one. */
export default function SummaryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useWorkoutDetail(id)
  const workout = data?.workout
  const summary = useMemo(() => summarizeWorkout(workout), [workout])
  const results = useWorkoutResults(workout?.finishedAt ? id : null)
  const close = () => navigate('/', { replace: true })
  const exercises = useMemo(() => {
    const grouped = new Map()
    for (const s of workout?.sets ?? []) {
      const entry = grouped.get(s.exerciseId) ?? { name: s.exercise?.nameRu || s.exercise?.nameEn, count: 0 }
      entry.count++
      grouped.set(s.exerciseId, entry)
    }
    return [...grouped.values()]
  }, [workout])

  useEffect(() => {
    if (!workout?.finishedAt) return
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
  }, [workout?.finishedAt])

  const formatTime = sec => {
    if (sec < 60) return t('summary.timeSec', { s: sec })
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60)
    return h ? t('summary.timeHm', { h, hUnit: t('units.hoursShort'), m, mUnit: t('units.minsShort') })
      : t('summary.timeMin', { m })
  }
  const tonnage = summary?.tonnageKg ?? 0

  return (
    <div className="workout-summary-page">
      <div className="workout-summary-background" aria-hidden="true" inert>
        <h1>{t('summary.completedTitle')}</h1>
        {exercises.map((exercise, i) => (
          <Glass flat padding="16px" key={i} style={{ marginBottom: 10 }}>
            <span>{i + 1}</span><div><strong>{exercise.name}</strong><p>{t('summary.setCount', { count: exercise.count })}</p></div>
            <Icon name="check" style={{ color: 'var(--gd-accent-ink)' }} />
          </Glass>
        ))}
      </div>
      <BottomSheet open trapFocus swipeToClose onClose={close} className="workout-completion-sheet" labelledBy="workout-completion-title"
        style={{ background: 'var(--home-bg)', width: '100%', maxWidth: 480, margin: '0 auto',
          maxHeight: 'calc(100dvh - var(--safe-top, 0px) - 12px)', overflowY: 'auto',
          padding: '4px 16px 0', border: '1px solid var(--gd-line)', borderBottom: 0 }}>
        <header className="completion-header">
          <span className="completion-check"><Icon name="check" size={21} /></span>
          <div><h2 id="workout-completion-title">{t('summary.completedTitle')}</h2>
            <p>{state?.planDayTitle && <>{state.planDayTitle} · </>}{t('summary.exerciseCount', { count: summary?.totalExercises ?? 0 })}</p>
          </div>
          <button className="completion-close" onClick={close} aria-label={t('summary.close')}><Icon name="x" size={20} /></button>
        </header>

        {isPending ? <p role="status">{t('common.loading')}</p> : isError || !summary || !workout.finishedAt ? (
          <div className="completion-error" role="alert">
            <p>{t(isError ? 'errors.network' : 'summary.notFinished')}</p>
            {isError && <Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
          </div>
        ) : <>
          <Glass flat className="completion-stats" padding="14px 0" style={{ background: 'var(--goal-surface)', borderColor: 'var(--goal-border)' }}>
            {[
              ['clock', formatTime(summary.elapsedSec), 'summary.time'],
              ['dumbbell', tonnage >= 1000 ? `${(tonnage / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${t('units.tonnes')}` : `${tonnage} ${t('units.kg')}`, 'summary.tonnage'],
              ['list', summary.totalSets, 'summary.sets'],
            ].map(([icon, value, label]) => <div key={label}>
              <Icon name={icon} size={19} /><strong>{value}</strong><span>{t(label)}</span>
            </div>)}
          </Glass>
          <div className="completion-results" aria-live="polite" aria-busy={results.isPending}>
            {results.isPending ? <p className="completion-note" role="status">{t('summary.comparing')}</p>
              : results.isError ? <div className="completion-error" role="alert">
                <p>{t('summary.resultsError')}</p><Button variant="secondary" onClick={() => results.refetch()}>{t('common.retry')}</Button>
              </div> : <WorkoutResults exercises={results.data?.exercises ?? []} />}
          </div>
        </>}
        <footer className="completion-footer">
          <Button variant="accent" size="lg" block icon="check" onClick={close}
            style={{ background: 'var(--home-cta)', color: 'var(--home-cta-ink)', borderRadius: 13 }}>{t('summary.done')}</Button>
        </footer>
      </BottomSheet>
    </div>
  )
}
