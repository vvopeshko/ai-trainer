import { useYearStats } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'

export function AnnualGoalCard() {
  const { data, isPending, isError, refetch } = useYearStats()
  const { t } = useTranslation()
  const plural = new Intl.PluralRules('ru')
  const pace = value => !Number.isFinite(value) ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const metrics = data ? [
    ['annualGoal.month', data.monthPace],
    ['annualGoal.year', data.yearPace],
    // Round the required pace up: 4.04 must not imply that 4.0 is sufficient.
    ['annualGoal.required', Math.ceil(data.requiredPace * 10) / 10],
  ] : []

  return (
    <section style={{ padding: '0 18px', marginTop: 22 }} aria-label={t('annualGoal.title')}>
      <Glass padding={18} style={{ background: 'var(--gd-card)', color: 'var(--gd-ink)', boxShadow: 'var(--gd-card-shadow)' }}>
        {isPending ? <Skeleton height={140} /> : isError ? (
          <button onClick={() => refetch()} style={{ color: 'var(--gd-ink)', background: 'none', border: 0, cursor: 'pointer' }}>
            {t('annualGoal.retry')}
          </button>
        ) : data && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>{t('annualGoal.title')} · {data.year}</h2>
              <span style={{ fontSize: 12, color: 'var(--gd-sub)' }}>{t('annualGoal.deadline')}</span>
            </div>
            <div style={{ marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
              <strong style={{ fontSize: 32, color: 'var(--gd-accent-ink)' }}>{data.done}</strong>
              <span style={{ fontSize: 18, color: 'var(--gd-sub)' }}> / {data.target}</span>
              <span style={{ marginLeft: 10, fontSize: 12 }}>{t('annualGoal.workouts')}</span>
            </div>
            <progress aria-label={t('annualGoal.title')} value={Math.min(data.done, data.target)} max={data.target}
              style={{ width: '100%', height: 8, marginTop: 10, accentColor: 'var(--gd-accent-ink)' }} />
            <p style={{ fontSize: 13, margin: '8px 0 16px', color: 'var(--gd-sub)' }}>
              {data.remaining === 0 ? t('annualGoal.complete') : t('annualGoal.remaining', {
                count: data.remaining,
                workoutWord: t(`annualGoal.workout.${plural.select(data.remaining)}`),
                days: data.daysRemaining,
                dayWord: t(`annualGoal.day.${plural.select(data.daysRemaining)}`),
              })}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {metrics.map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--gd-sub)', minHeight: 28 }}>{t(label)}</div>
                  <strong style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>{pace(value)}</strong>
                  <div style={{ fontSize: 10, color: 'var(--gd-sub)' }}>{t('annualGoal.perWeek')}</div>
                </div>
              ))}
            </div>
            {data.baselineDate && <p style={{ fontSize: 11, color: 'var(--gd-sub)', margin: '16px 0 0' }}>
              {t('annualGoal.baseline', { count: data.baselineCount, date: data.baselineDate.split('-').reverse().join('.'), added: data.added })}
            </p>}
            {data.monthPace === null && <p style={{ fontSize: 11, color: 'var(--gd-sub)' }}>{t('annualGoal.incompleteMonth')}</p>}
          </>
        )}
      </Glass>
    </section>
  )
}
