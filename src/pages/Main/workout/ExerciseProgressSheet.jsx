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

// Sessions as columns, sets as rows: solid — a new record that day,
// outline — a repeat of the current best level.
function Logbook({ sessions, front, text }) {
  const rows = Math.max(...sessions.map(s => s.sets.length))
  const same = s => r => r.weightKg === (s.weightKg ?? 0) && r.reps === s.reps
  const isRecord = (session, s) => session.records.some(same(s))
  return <div style={{ display: 'grid', gridTemplateColumns: `14px repeat(${sessions.length}, minmax(0, 1fr))`, gap: 3, fontSize: 11 }}>
    <span />
    {sessions.map(session => <span key={session.time} style={{ ...muted, textAlign: 'center' }}>{text.date(session.time)}</span>)}
    {Array.from({ length: rows }, (_, row) => [
      <span key={`n${row}`} style={muted}>{row + 1}</span>,
      ...sessions.map(session => {
        const s = session.sets[row]
        const record = s && isRecord(session, s)
        const best = s && !record && front.some(same(s))
        return <span key={`${session.time}-${row}`} style={{
          textAlign: 'center', padding: '2px 0', borderRadius: 5, whiteSpace: 'nowrap',
          background: record ? 'var(--success-soft)' : s ? 'rgba(236,234,239,0.05)' : 'transparent',
          boxShadow: best ? 'inset 0 0 0 1px var(--success)' : 'none',
          color: record || best ? 'var(--success)' : 'var(--fg-secondary)', fontWeight: record ? 600 : 400,
        }}>{s ? text.set(s) : ''}</span>
      }),
    ])}
  </div>
}

// Consolidate plateau: sets per session at the heavier weight, the goal is all of them.
function HeavySets({ plateau, text, t }) {
  return <>
    <div style={heading}>{t('exerciseProgress.heavySets', { weight: text.weight(plateau.weightKg), unit: text.unitLabel })}</div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      {plateau.bars.map(b => <div key={b.time} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11 }}>
        <div style={{ height: 36, display: 'flex', alignItems: 'flex-end', borderRadius: 5, background: 'rgba(236,234,239,0.05)', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: `${100 * b.heavy / b.total}%`, background: b.heavy === b.total ? 'var(--success)' : 'var(--warning)', opacity: 0.85 }} />
        </div>
        <div style={{ color: 'var(--fg-primary)', marginTop: 3 }}>{b.heavy}/{b.total}</div>
        <div style={muted}>{text.date(b.time)}</div>
      </div>)}
    </div>
  </>
}

// Volume per session from zero: equal-looking bars are the honest picture of
// "≈ the same"; a missed set shows as a dip, not as weakness.
function VolumeBars({ view, text, unit, t }) {
  const points = view.points.slice(-12)
  const toUnit = v => view.metric === 'tonnage' && unit === 'lbs' ? v / 0.45359237 : v
  const format = v => Math.round(toUnit(v)).toLocaleString('ru-RU')
  const max = Math.max(...points.map(p => p.value))
  const unitLabel = view.metric === 'tonnage' ? text.unitLabel : t('units.reps')
  return <figure style={{ margin: '12px 0' }}>
    <figcaption style={{ color: 'var(--fg-primary)', fontWeight: 600 }}>
      {t(view.metric === 'tonnage' ? 'exerciseProgress.chartVolume' : 'exerciseProgress.chartVolumeReps')}
    </figcaption>
    <div style={{ ...muted, fontSize: 11, margin: '2px 0 4px' }}>{t('exerciseProgress.volumeMax', { value: format(max), unit: unitLabel })}</div>
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56 }}>
      {points.map(p => <div key={p.time} title={`${text.date(p.time)} · ${format(p.value)} ${unitLabel} · ${p.sets}`}
        style={{ flex: 1, minWidth: 0, height: `${100 * p.value / max}%`, borderRadius: '3px 3px 0 0', background: 'rgba(236,234,239,0.28)' }} />)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', ...muted, fontSize: 11, marginTop: 3 }}>
      <span>{text.date(points[0].time)}</span><span>{text.date(points.at(-1).time)}</span>
    </div>
    <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>{t('exerciseProgress.volumeNote')}</div>
  </figure>
}

function Segmented({ options, value, onChange }) {
  return <div role="tablist" style={{ display: 'flex', gap: 4, padding: 3, marginTop: 16, borderRadius: 10, background: 'rgba(236,234,239,0.05)' }}>
    {options.map(o => <button key={o.id} role="tab" aria-selected={o.id === value} onClick={() => onChange(o.id)} style={{
      flex: 1, padding: '6px 4px', borderRadius: 8, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600,
      background: o.id === value ? 'var(--accent-color-soft)' : 'transparent',
      color: o.id === value ? 'var(--accent-color-strong)' : 'var(--fg-secondary)',
    }}>{o.label}</button>)}
  </div>
}

export function ExerciseProgressSheet({ open, onClose, exerciseId, title, progress, data, text, unit, timed }) {
  const { t } = useTranslation()
  const { webApp } = useTelegram()
  const [showAll, setShowAll] = useState(false)
  const [asking, setAsking] = useState(false)
  const [view, setView] = useState('main')
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div tabIndex={0} style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600, color: 'var(--fg-primary)', outline: 'none' }}>{title ?? t('exerciseProgress.sheetTitle')}</div>
        {/* Swipe-down to close is unreliable inside the Telegram Mini App. */}
        <button onClick={onClose} aria-label={t('a11y.close')} style={{
          width: 30, height: 30, marginTop: -3, borderRadius: '50%', border: 0, flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(236,234,239,0.08)', color: 'var(--fg-secondary)',
        }}>
          <Icon name="x" size={16} />
        </button>
      </div>
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
        <Logbook sessions={sessions.slice(-6)} front={records.front} text={text} />
        {records.front.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, fontSize: 11, ...muted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--success-soft)' }} />{t('exerciseProgress.legendNew')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, boxShadow: 'inset 0 0 0 1px var(--success)' }} />
            {t('exerciseProgress.legendBest', { sets: records.front.toSorted((a, b) => b.weightKg - a.weightKg).slice(0, 3)
              .map(r => `${text.set(r)} · ${text.date(r.time)}`).join(', ') })}
          </span>
        </div>}

        {progress.plateau?.kind === 'consolidate' && <HeavySets plateau={progress.plateau} text={text} t={t} />}
        {(() => {
          const main = progress.charts[0]
          const options = [
            main && { id: 'main', label: main.top ? t('exerciseProgress.tab.top', { reps: main.anchor }) : t('exerciseProgress.tab.main') },
            progress.views.e1rm && { id: 'e1rm', label: t('exerciseProgress.tab.e1rm') },
            progress.views.volume && { id: 'volume', label: t('exerciseProgress.tab.volume') },
          ].filter(Boolean)
          const current = options.some(o => o.id === view) ? view : options[0]?.id
          return <>
            {options.length > 1 && <Segmented options={options} value={current} onChange={setView} />}
            {current === 'main' && <ExerciseTrendChart chart={main} unit={unit} />}
            {current === 'e1rm' && <>
              <ExerciseTrendChart chart={progress.views.e1rm} unit={unit} />
              <div style={{ ...muted, fontSize: 11 }}>{t('exerciseProgress.e1rmNote')}</div>
            </>}
            {current === 'volume' && <VolumeBars view={progress.views.volume} text={text} unit={unit} t={t} />}
          </>
        })()}

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
