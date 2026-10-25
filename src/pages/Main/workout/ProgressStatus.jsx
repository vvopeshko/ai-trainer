import { useTranslation } from '../../../i18n/useTranslation.js'

const STATUS_COLORS = {
  up: { fg: 'var(--success)', bg: 'var(--success-soft)' },
  plateau: { fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  down: { fg: 'var(--danger)', bg: 'var(--danger-soft)' },
}
const NEUTRAL = { fg: 'var(--fg-secondary)', bg: 'rgba(236,234,239,0.08)' }
const statusColor = trend => STATUS_COLORS[trend] ?? NEUTRAL

export function StatusPill({ trend }) {
  const { t } = useTranslation()
  const { fg, bg } = statusColor(trend)
  return <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 6, background: bg, color: fg, fontSize: 11.5, fontWeight: 600 }}>
    {t(`exerciseProgress.status.${trend}`)}
  </span>
}

export function Sparkline({ chart, trend }) {
  const points = chart?.points ?? []
  if (points.length < 3) return null
  const values = points.map(p => p.value)
  const min = Math.min(...values), max = Math.max(...values)
  const x = i => 2 + 52 * i / (points.length - 1)
  const y = v => max === min ? 10 : 17 - 14 * (v - min) / (max - min)
  const color = statusColor(trend).fg
  return <svg width="56" height="20" viewBox="0 0 56 20" aria-hidden="true" style={{ flexShrink: 0 }}>
    <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx={x(points.length - 1)} cy={y(values.at(-1))} r="2.2" fill={color} />
  </svg>
}
