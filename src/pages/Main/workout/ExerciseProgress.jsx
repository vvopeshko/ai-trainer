import { useState } from 'react'
import { useExerciseHistory } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { exerciseProgress } from '../../../utils/exerciseProgress.js'
import { Icon } from '../../../components/ui/index.js'
import { ExerciseProgressSheet } from './ExerciseProgressSheet.jsx'
import { StatusPill, Sparkline } from './ProgressStatus.jsx'
import { useProgressText } from './useProgressText.js'

export function ExerciseProgress({ exerciseId, plan, unit = 'kg', step, stepUnit, timed = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data, isPending, isError, refetch } = useExerciseHistory(exerciseId)
  const workouts = data?.workouts ?? []
  const progress = exerciseProgress(workouts, timed ? null : plan, { experienceLevel: data?.experienceLevel })
  const text = useProgressText(progress, { plan, unit, step, stepUnit })
  const style = { margin: '0 12px 12px', fontSize: 11.5, color: 'var(--fg-secondary)', lineHeight: 1.45 }
  if (isPending) return <div style={style}>{t('exerciseProgress.loading')}</div>
  if (isError) return <div style={style}><button onClick={() => refetch()} style={{ color: 'inherit', background: 'none', border: 0, padding: 0 }}>{t('exerciseProgress.retry')}</button></div>
  if (!progress) return <div style={style}>{t('exerciseProgress.empty')}</div>
  // Last session's sets are not repeated here: the set input is prefilled from them.
  // Timed exercises have no strength status, so their card names the last session.
  const last = text.lastSession
  return <>
    <button onClick={() => setOpen(true)} aria-label={t('exerciseProgress.open')} style={{
      ...style, display: 'block', width: 'calc(100% - 24px)', textAlign: 'left', cursor: 'pointer',
      padding: '9px 11px', borderRadius: 12, border: '1px solid rgba(236,234,239,0.08)', background: 'rgba(236,234,239,0.03)',
    }}>
      {!timed && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusPill trend={progress.trend} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text.reason}</span>
        {progress.records.latest.length > 0 && <Icon name="trophy" size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />}
        <Sparkline chart={progress.charts[0]} trend={progress.trend} />
        <Icon name="chevronRight" size={14} style={{ flexShrink: 0, color: 'var(--fg-tertiary)' }} />
      </div>}
      {!timed && text.action && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 7, fontSize: 13, color: 'var(--fg-primary)' }}>
        <Icon name="target" size={15} style={{ flexShrink: 0, marginTop: 1, color: progress.ready ? 'var(--success)' : progress.plateau ? 'var(--warning)' : 'var(--accent-color)' }} />
        <span>{text.action}</span>
      </div>}
      {timed && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-tertiary)' }}>
        <span style={{ flex: 1, minWidth: 0 }}>{t('exerciseProgress.lastTime', {
          date: text.date(last.time), sets: `${last.sets.map(s => s.reps).join(' / ')} ${t('exerciseProgress.seconds')}`,
        })}</span>
        <Icon name="chevronRight" size={14} style={{ flexShrink: 0 }} />
      </div>}
    </button>
    <ExerciseProgressSheet open={open} onClose={() => setOpen(false)} exerciseId={exerciseId}
      progress={progress} data={data} text={text} unit={unit} timed={timed} />
  </>
}
