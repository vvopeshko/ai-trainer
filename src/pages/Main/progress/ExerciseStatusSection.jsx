import { useMemo, useState } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { useExerciseOverview } from '../../../hooks/queries.js'
import { exerciseProgress } from '../../../utils/exerciseProgress.js'
import { getExerciseSettings } from '../../../utils/weightUnit.js'
import { Glass, Icon, Skeleton } from '../../../components/ui/index.js'
import { StatusPill, Sparkline } from '../workout/ProgressStatus.jsx'
import { ExerciseProgressSheet } from '../workout/ExerciseProgressSheet.jsx'
import { useProgressText } from '../workout/useProgressText.js'

// Exercises needing attention come first.
const ORDER = ['plateau', 'down', 'up', 'steady', 'first']
const COLLAPSED = 6
const caps = {
  fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 'var(--tracking-caps)',
  textTransform: 'uppercase', color: 'var(--fg-tertiary)',
}

function ExerciseRow({ item, first }) {
  const [open, setOpen] = useState(false)
  const text = useProgressText(item.progress, { plan: item.plan, ...item.settings })
  return <>
    <button onClick={() => setOpen(true)} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 0', textAlign: 'left',
      background: 'none', border: 0, borderTop: first ? 'none' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nameRu}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11.5, color: 'var(--fg-tertiary)' }}>
          <StatusPill trend={item.progress.trend} />
          <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text.reason}</span>
        </div>
      </div>
      <Sparkline chart={item.progress.charts[0]} trend={item.progress.trend} />
      <Icon name="chevronRight" size={14} style={{ flexShrink: 0, color: 'var(--fg-disabled)' }} />
    </button>
    <ExerciseProgressSheet open={open} onClose={() => setOpen(false)} exerciseId={item.id} title={item.nameRu}
      progress={item.progress} data={{ workouts: item.workouts }} text={text} unit={item.settings.unit} timed={false} />
  </>
}

export function ExerciseStatusSection() {
  const { t } = useTranslation()
  const { data, isPending } = useExerciseOverview()
  const [filter, setFilter] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const items = useMemo(() => (data?.exercises ?? []).flatMap(ex => {
    const settings = getExerciseSettings(ex.slug)
    // Timed exercises log seconds as reps: no strength status for them.
    if (settings.type === 'timer') return []
    const progress = exerciseProgress(ex.workouts, ex.plan, { experienceLevel: data.experienceLevel })
    return progress ? [{ ...ex, settings, progress }] : []
  }).sort((a, b) => ORDER.indexOf(a.progress.trend) - ORDER.indexOf(b.progress.trend)), [data])
  if (isPending) return <Glass style={{ padding: 'var(--space-4)' }}><Skeleton width="45%" height={12} /><Skeleton width="100%" height={40} style={{ marginTop: 12 }} /></Glass>
  if (!items.length) return null
  const counts = ORDER.map(trend => ({ trend, n: items.filter(i => i.progress.trend === trend).length })).filter(c => c.n)
  const shown = items.filter(i => !filter || i.progress.trend === filter)
  const visible = expanded ? shown : shown.slice(0, COLLAPSED)
  return <Glass style={{ padding: 'var(--space-4)' }}>
    <div style={caps}>{t('progress.exercises.title')}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 6px' }}>
      {counts.map(({ trend, n }) => <button key={trend} aria-pressed={filter === trend}
        onClick={() => { setFilter(filter === trend ? null : trend); setExpanded(false) }}
        style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer', borderRadius: 7,
          opacity: filter && filter !== trend ? 0.45 : 1, outline: filter === trend ? '1px solid currentColor' : 'none' }}>
        <StatusPill trend={trend} count={n} />
      </button>)}
    </div>
    {visible.map((item, i) => <ExerciseRow key={item.id} item={item} first={i === 0} />)}
    {shown.length > COLLAPSED && <button onClick={() => setExpanded(!expanded)} style={{
      width: '100%', padding: '8px 0 0', background: 'none', border: 0, cursor: 'pointer', color: 'var(--fg-secondary)', fontSize: 12.5,
    }}>{expanded ? t('progress.exercises.less') : t('progress.exercises.more', { n: shown.length })}</button>}
  </Glass>
}
