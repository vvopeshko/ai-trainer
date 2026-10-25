import { useYearStats } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'
import './annualGoal.css'

export function AnnualGoalCard() {
  const { data, isPending, isError, refetch } = useYearStats()
  const { t } = useTranslation()
  const pace = value => !Number.isFinite(value) ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const percent = data?.target > 0 ? Math.floor(data.done / data.target * 100) : 0
  const metrics = data ? [
    ['annualGoal.month', data.monthPace],
    ['annualGoal.year', data.yearPace],
    // Round up so the required pace never understates the effort needed.
    ['annualGoal.required', Math.ceil(data.requiredPace * 10) / 10],
  ] : []

  return (
    <section id="annual-goal" className="annual-goal" tabIndex={-1} aria-label={t('annualGoal.title')}>
      <Glass className="annual-goal__card" style={{ background: 'var(--goal-surface)', color: 'var(--gd-ink)', border: '1px solid var(--goal-border)', boxShadow: 'var(--goal-shadow)', borderRadius: 22 }}>
        {isPending ? <Skeleton height={142} /> : isError ? (
          <button className="annual-goal__retry" onClick={() => refetch()}>{t('annualGoal.retry')}</button>
        ) : data && (
          <>
            <header className="annual-goal__header">
              <span className="annual-goal__badge"><Icon name="target" size={17} aria-hidden="true" /></span>
              <h2>{t('annualGoal.title')} · {data.year}</h2>
              <span className="annual-goal__deadline" aria-label={t('annualGoal.deadline')}>{t('annualGoal.deadlineCompact')}</span>
            </header>
            <div className="annual-goal__main">
              <div className="annual-goal__count">
                <strong>{data.done}</strong><span className="annual-goal__target">/ {data.target}</span>
                <span className="annual-goal__unit">{t('annualGoal.workouts')}</span>
              </div>
              <span className="annual-goal__percent">{percent}%</span>
            </div>
            <div className="annual-goal__progress-row">
              <div className="annual-goal__track" role="progressbar" aria-label={t('annualGoal.title')}
                aria-valuenow={Math.min(data.done, data.target)} aria-valuemin={0} aria-valuemax={data.target}
                aria-valuetext={`${data.done} / ${data.target}`}>
                <div className="annual-goal__fill" style={{ width: `${Math.max(0, Math.min(100, data.done / data.target * 100))}%` }} />
              </div>
            </div>
            <div className="annual-goal__metrics-label">{t('annualGoal.perWeek')}</div>
            <div className="annual-goal__metrics">
              {metrics.map(([label, value]) => (
                <div key={label} className="annual-goal__metric">
                  <div className="annual-goal__metric-top">
                    <strong>{pace(value)}</strong>
                    <div className="annual-goal__metric-label">{t(label)}</div>
                  </div>
                </div>
              ))}
            </div>
            {data.remaining === 0 && <p className="annual-goal__note">{t('annualGoal.complete')}</p>}
            {data.monthPace === null && <p className="annual-goal__note">{t('annualGoal.incompleteMonth')}</p>}
          </>
        )}
      </Glass>
    </section>
  )
}
