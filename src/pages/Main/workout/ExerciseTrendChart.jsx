import { useTranslation } from '../../../i18n/useTranslation.js'

export function ExerciseTrendChart({ chart, unit }) {
  const { t } = useTranslation()
  // Continuous chart coordinates must not snap to the 5 lb input step.
  const convert = value => chart.kind === 'weight' && unit === 'lbs' ? value / 0.45359237 : value
  const format = value => convert(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  const weightUnit = t(unit === 'lbs' ? 'units.lbs' : 'units.kg')
  const axisUnit = chart.kind === 'weight' ? weightUnit : t('units.reps')
  const label = chart.kind === 'weight'
    ? t('exerciseProgress.chartWeight', { reps: chart.anchor })
    : chart.anchor === 0 ? t('exerciseProgress.chartBodyweight')
      : t('exerciseProgress.chartReps', { weight: (unit === 'lbs' ? chart.anchor / 0.45359237 : chart.anchor).toLocaleString('ru-RU', { maximumFractionDigits: 1 }), unit: weightUnit })
  const { points, line } = chart
  const values = [...points, ...line].map(p => p.value)
  const min = Math.min(...values), max = Math.max(...values)
  const padding = Math.max((max - min) * 0.2, chart.kind === 'weight' ? 1 : 0.5)
  const low = Math.max(0, min - padding), high = max + padding
  const x = p => 42 + 270 * (p.time - points[0].time) / Math.max(1, points.at(-1).time - points[0].time)
  const y = p => 76 - 60 * (p.value - low) / (high - low)
  const date = time => new Date(time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  const color = chart.trend === 'up' ? 'var(--success)' : chart.trend === 'down' ? 'var(--warning)' : 'var(--fg-primary)'
  const ticks = max === min ? [min] : [min, max]
  return <figure style={{ margin: '12px 0' }}>
    <figcaption style={{ color: 'var(--fg-primary)', fontWeight: 600 }}>{label}</figcaption>
    <svg viewBox="0 0 320 100" role="img" aria-label={`${label}. ${t('exerciseProgress.chartLegend')}`} style={{ width: '100%', display: 'block' }}>
      {ticks.map(value => <g key={value}>
        <line x1="42" x2="312" y1={y({ value })} y2={y({ value })} stroke="var(--fg-tertiary)" opacity="0.2" />
        <text x="35" y={y({ value }) + 3} textAnchor="end" fill="var(--fg-secondary)" fontSize="10">{format(value)}</text>
      </g>)}
      <text x="4" y="10" fill="var(--fg-tertiary)" fontSize="9">{axisUnit}</text>
      {line.length > 0 && <polyline points={line.map(p => `${x(p)},${y(p)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}
      {points.map(p => <circle key={p.time} cx={x(p)} cy={y(p)} r="3" fill="var(--fg-secondary)" stroke="var(--bg-primary, #111)" strokeWidth="1"><title>{date(p.time)} · {format(p.value)} {axisUnit}</title></circle>)}
      <text x="42" y="96" fill="var(--fg-tertiary)" fontSize="10">{date(points[0].time)}</text>
      <text x="312" y="96" textAnchor="end" fill="var(--fg-tertiary)" fontSize="10">{date(points.at(-1).time)}</text>
    </svg>
    <div style={{ color: 'var(--fg-tertiary)' }}>{t(line.length ? 'exerciseProgress.chartLegend' : 'exerciseProgress.chartInsufficient')}</div>
  </figure>
}
