import { useTranslation } from '../../../i18n/useTranslation.js'
import { getExerciseSettings } from '../../../utils/weightUnit.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

function displayWeight(weight, unit) {
  // Conversion for recorded results must not snap to the input's 5-lb step.
  return (unit === 'lbs' ? weight / 0.45359237 : weight).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

function SetValue({ set, exercise, t }) {
  if (!set) return null
  const unit = getExerciseSettings(exercise.slug).unit
  const load = `${displayWeight(set.weightKg, unit)} ${t(unit === 'lbs' ? 'units.lbs' : 'units.kg')}`
  if (exercise.trackingType === 'duration') return <>{set.weightKg > 0 && `${load} × `}{set.reps} {t('units.sec')}</>
  if (exercise.trackingType === 'distance') return <>{set.reps} {t('summary.metres')}</>
  if (exercise.trackingType === 'assisted_bodyweight') return <>{t('units.assistance')} {load} × {set.reps}</>
  if (set.weightKg === 0) return <>{set.reps} {t('units.reps')}</>
  return <>{exercise.trackingType === 'bodyweight_reps' && '+'}{load} × {set.reps}</>
}

function Delta({ comparison, exercise, t }) {
  if (!comparison?.delta || !comparison.metric) return null
  const unit = getExerciseSettings(exercise.slug).unit
  const value = comparison.metric === 'weight' ? displayWeight(Math.abs(comparison.delta), unit) : Math.abs(comparison.delta)
  const label = comparison.metric === 'weight' ? t(unit === 'lbs' ? 'units.lbs' : 'units.kg')
    : t(comparison.metric === 'duration' ? 'units.sec' : 'units.reps')
  return <>{comparison.delta > 0 ? '+' : '−'}{value} {label}</>
}

function ResultRow({ exercise, t }) {
  const changed = ['up', 'down'].includes(exercise.status)
  return <div className="completion-result-row">
    <div className="completion-result-copy"><strong>{exercise.name}</strong>
      <p>{exercise.previous && <><SetValue set={exercise.previous} exercise={exercise} t={t} /><span className="completion-arrow"> → </span></>}
        <SetValue set={exercise.current} exercise={exercise} t={t} /></p>
    </div>
    <span className={`completion-delta completion-delta--${exercise.status}`}>
      {changed && <Icon name={exercise.status === 'up' ? 'chevronUp' : 'chevronDown'} size={15} />}
      {changed && exercise.comparison?.metric ? <Delta comparison={exercise.comparison} exercise={exercise} t={t} />
        : t(`summary.status.${exercise.status}`)}
    </span>
  </div>
}

function RecordCard({ exercise, t }) {
  return <Glass flat className="completion-record" padding="14px" style={{ background: 'var(--home-cta)', color: 'var(--home-cta-ink)', overflow: 'hidden', border: 0 }}>
    <div className="completion-record-heading"><Icon name="trophy" size={18} />{t('summary.record')}</div>
    <strong className="completion-record-name">{exercise.name}</strong>
    {exercise.records.map((record, i) => <div className="completion-record-set" key={i}>
      <div className="completion-record-numbers"><strong><SetValue set={record.current} exercise={exercise} t={t} /></strong>
        {record.comparison?.delta ? <span><Delta comparison={record.comparison} exercise={exercise} t={t} /></span> : null}
      </div>
      {record.previous ? <p>{t('summary.was')} <SetValue set={record.previous} exercise={exercise} t={t} /></p>
        : <p>{t('summary.newCombination')}</p>}
    </div>)}
  </Glass>
}

export function WorkoutResults({ exercises }) {
  const { t } = useTranslation()
  const records = exercises.filter(ex => ex.records.length)
  const changes = exercises.filter(ex => ['up', 'down', 'changed'].includes(ex.status)
    && (!ex.records.length || ex.status !== 'up'))
  const others = exercises.filter(ex => !ex.records.length && !['up', 'down', 'changed'].includes(ex.status))
  return <>
    {records[0] && <RecordCard exercise={records[0]} t={t} />}
    {records.length > 1 && <details className="completion-disclosure">
      <summary>{t('summary.moreRecords', { count: records.length - 1 })}<Icon name="chevronDown" size={16} /></summary>
      {records.slice(1).map(ex => <RecordCard key={ex.exerciseId} exercise={ex} t={t} />)}
    </details>}
    {changes.length > 0 && <section className="completion-changes" aria-label={t('summary.changes')}>
      <h3>{t('summary.changes')}</h3>
      {changes.map(ex => <ResultRow key={ex.exerciseId} exercise={ex} t={t} />)}
    </section>}
    {!records.length && !changes.length && <p className="completion-note">{t(exercises.some(ex => ex.status === 'same') ? 'summary.steady' : 'summary.baseline')}</p>}
    {others.length > 0 && <details className="completion-disclosure" open={!records.length && !changes.length}>
      <summary>{t('summary.otherResults', { count: others.length })}<Icon name="chevronDown" size={16} /></summary>
      {others.map(ex => <ResultRow key={ex.exerciseId} exercise={ex} t={t} />)}
    </details>}
    <p className="completion-note completion-method">{t('summary.comparisonNote')}</p>
  </>
}
