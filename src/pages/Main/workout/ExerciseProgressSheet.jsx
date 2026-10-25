import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { useTelegram } from '../../../components/TelegramProvider.jsx'
import { openTrainerChat } from '../../../utils/askTrainer.js'
import { BottomSheet, Icon } from '../../../components/ui/index.js'
import { ExerciseTrendChart } from './ExerciseTrendChart.jsx'
import { StatusPill } from './ProgressStatus.jsx'

const muted = { color: 'var(--fg-tertiary)' }
const heading = { fontSize: 12.5, fontWeight: 600, color: 'var(--fg-primary)', margin: '16px 0 6px' }

function Tile({ label, value, sub }) {
  return <div style={{ minWidth: 0, padding: '8px 10px', borderRadius: 10, background: 'rgba(236,234,239,0.05)' }}>
    <div style={{ ...muted, fontSize: 11 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    {sub && <div style={{ ...muted, fontSize: 11 }}>{sub}</div>}
  </div>
}

// Sessions as columns, sets as rows: shows which sets reached a new level.
function Logbook({ sessions, text }) {
  const rows = Math.max(...sessions.map(s => s.sets.length))
  const isRecord = (session, s) => session.records.some(r => r.weightKg === (s.weightKg ?? 0) && r.reps === s.reps)
  return <div style={{ display: 'grid', gridTemplateColumns: `14px repeat(${sessions.length}, minmax(0, 1fr))`, gap: 3, fontSize: 11 }}>
    <span />
    {sessions.map(session => <span key={session.time} style={{ ...muted, textAlign: 'center' }}>{text.date(session.time)}</span>)}
    {Array.from({ length: rows }, (_, row) => [
      <span key={`n${row}`} style={muted}>{row + 1}</span>,
      ...sessions.map(session => {
        const s = session.sets[row]
        const record = s && isRecord(session, s)
        return <span key={`${session.time}-${row}`} style={{
          textAlign: 'center', padding: '2px 0', borderRadius: 5, whiteSpace: 'nowrap',
          background: record ? 'var(--success-soft)' : s ? 'rgba(236,234,239,0.05)' : 'transparent',
          color: record ? 'var(--success)' : 'var(--fg-secondary)', fontWeight: record ? 600 : 400,
        }}>{s ? text.set(s) : ''}</span>
      }),
    ])}
  </div>
}

export function ExerciseProgressSheet({ open, onClose, exerciseId, progress, data, text, unit, timed }) {
  const { t } = useTranslation()
  const { webApp } = useTelegram()
  const [showAll, setShowAll] = useState(false)
  const [asking, setAsking] = useState(false)
  const workouts = data?.workouts ?? []
  const { records, volume } = progress
  const sessions = records.sessions
  const best = records.last?.records.toSorted((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0]
  const volumeUnit = volume.metric === 'tonnage' ? text.unitLabel : t('units.reps')
  const number = value => Math.round(volume.metric === 'tonnage' && unit === 'lbs' ? value / 0.45359237 : value).toLocaleString('ru-RU')
  const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`
  const askTrainer = async () => {
    if (asking) return
    setAsking(true)
    try { await openTrainerChat(webApp, { type: 'exercise', refId: exerciseId }) } catch { /* сеть: кнопку можно нажать снова */ }
    setAsking(false)
  }
  // Portal: the exercise card's Glass (backdrop-filter) would otherwise become
  // the containing block of the sheet's position: fixed.
  return createPortal(<BottomSheet open={open} onClose={onClose}>
    <div style={{ padding: '4px 4px 12px', fontSize: 12.5, color: 'var(--fg-secondary)', lineHeight: 1.5 }}>
      {/* tabIndex: BottomSheet focuses the first focusable element; keep the sheet at its top. */}
      <div tabIndex={0} style={{ fontSize: 17, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 8, outline: 'none' }}>{t('exerciseProgress.sheetTitle')}</div>
      {!timed && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill trend={progress.trend} />
          <span style={muted}>{text.period} · {text.date(sessions[0].time)}–{text.date(sessions.at(-1).time)}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 14, color: 'var(--fg-primary)' }}>{text.reason}</div>
        {text.action && <div style={{ display: 'flex', gap: 6, marginTop: 8, color: 'var(--fg-primary)' }}>
          <Icon name="target" size={15} style={{ flexShrink: 0, marginTop: 2, color: progress.ready ? 'var(--success)' : progress.plateau ? 'var(--warning)' : 'var(--accent-color)' }} />
          <span>{text.action}</span>
        </div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 14 }}>
          <Tile label={t('exerciseProgress.tile.record')} value={best ? text.set(best) : '—'} sub={records.last && text.date(records.last.time)} />
          <Tile label={t('exerciseProgress.tile.since')}
            value={progress.trend === 'first' ? '—' : t('exerciseProgress.sessions', { n: progress.stall.sessions })}
            sub={progress.stall.sessions > 0 ? text.span(progress.stall.days) : null} />
          <Tile label={t('exerciseProgress.tile.volume')} value={t(`exerciseProgress.volumeShort.${volume.status}`)}
            sub={volume.size && volume.status !== 'changed' ? `${signed(volume.percent)}%` : null} />
        </div>

        <div style={heading}>{t('exerciseProgress.logbook', { n: Math.min(6, sessions.length) })}</div>
        <Logbook sessions={sessions.slice(-6)} text={text} />

        {progress.charts.map(chart => <ExerciseTrendChart key={`${chart.kind}-${chart.anchor}`} chart={chart} unit={unit} />)}

        {['plateau', 'down', 'steady'].includes(progress.trend) && (
          <button onClick={askTrainer} disabled={asking} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 12,
            padding: '10px 12px', borderRadius: 12, border: 0, cursor: 'pointer',
            background: 'var(--accent-color-soft)', color: 'var(--accent-color-strong)', fontSize: 13, fontWeight: 600, opacity: asking ? 0.6 : 1,
          }}>
            <Icon name="messageCircle" size={15} />{t('exerciseProgress.askTrainer')}
          </button>
        )}
      </>}

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--fg-primary)' }}>{t('exerciseProgress.allRecords', { n: workouts.length })}</summary>
        {workouts.slice(0, showAll ? workouts.length : 8).map(w => (
          <div key={w.id} style={{ display: 'flex', gap: 10, paddingTop: 5 }}>
            <time dateTime={w.startedAt} style={{ flexShrink: 0, ...muted }}>
              {new Date(w.startedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </time>
            <span>{w.sets.map(s => timed ? `${s.reps} ${t('exerciseProgress.seconds')}` : `${text.weight(s.weightKg)} ${text.unitLabel} × ${s.reps}`).join(' · ')}</span>
          </div>
        ))}
        {workouts.length > 8 && <button onClick={() => setShowAll(!showAll)} style={{ background: 'none', border: 0, padding: '6px 0', color: 'inherit' }}>{t(showAll ? 'exerciseProgress.less' : 'exerciseProgress.more')}</button>}
      </details>

      {!timed && <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--fg-primary)' }}>{t('exerciseProgress.how')}</summary>
        {volume.size && <>
          <p>{t(volume.metric === 'tonnage' ? 'exerciseProgress.volumeDefinition' : 'exerciseProgress.repsDefinition')}</p>
          <div>{text.date(volume.fromPeriod[0])}–{text.date(volume.fromPeriod[1])}: {number(volume.from)} {volumeUnit}</div>
          <div>{text.date(volume.toPeriod[0])}–{text.date(volume.toPeriod[1])}: {number(volume.to)} {volumeUnit}</div>
          <div>{t('exerciseProgress.volumeSamples', { n: volume.size, percent: signed(volume.percent) })}</div>
        </>}
        {volume.latest?.from != null && <p>{t('exerciseProgress.lastNumbers', { from: number(volume.latest.from), to: number(volume.latest.to), unit: volumeUnit })}</p>}
        <p>{t('exerciseProgress.method')}</p>
        {data?.hasMore && <p>{t('exerciseProgress.limited')}</p>}
      </details>}
    </div>
  </BottomSheet>, document.body)
}
