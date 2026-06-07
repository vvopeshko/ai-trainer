import { useTranslation } from '../../../i18n/useTranslation.js'

/**
 * MonthStatsTiles — "Этот месяц" 4-tile grid.
 */
export function MonthStatsTiles({ monthStats, records }) {
  const { t } = useTranslation()

  const workouts = monthStats?.workouts ?? 0
  const tonnage = monthStats?.tonnageKg ?? 0
  const streak = monthStats?.streak ?? 0
  const recordCount = records?.length ?? 0

  // Format tonnage: show as tons if >= 1000
  const tonnageStr = tonnage >= 1000
    ? `${(tonnage / 1000).toFixed(1)}т`
    : `${Math.round(tonnage)}`

  const tiles = [
    { value: workouts, label: t('home.statWorkouts'), accent: true },
    { value: tonnageStr, label: t('home.statTonnage'), accent: false },
    { value: streak, label: t('home.statStreak'), accent: false },
    { value: recordCount, label: t('home.statRecords'), accent: false },
  ]

  return (
    <div style={{ padding: '0 18px', marginTop: 22 }}>
      {/* Section title */}
      <h2 style={{
        fontSize: 22,
        fontWeight: 800,
        color: 'var(--gd-ink)',
        margin: '0 0 12px 0',
      }}>
        {t('home.thisMonthTitle')}
      </h2>

      {/* 4-col grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {tiles.map((tile, i) => (
          <div key={i} style={{
            background: 'var(--gd-card)',
            borderRadius: 16,
            padding: '13px 6px 11px',
            textAlign: 'center',
            boxShadow: 'var(--gd-card-shadow)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 19,
              fontWeight: 800,
              color: tile.accent ? 'var(--gd-accent-ink)' : 'var(--gd-ink)',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {tile.value}
            </div>
            <div style={{
              fontSize: 8.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--gd-sub)',
              marginTop: 4,
            }}>
              {tile.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
