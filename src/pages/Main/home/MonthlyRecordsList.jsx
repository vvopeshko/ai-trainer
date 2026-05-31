import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

export function MonthlyRecordsList({ records }) {
  const { t } = useTranslation()

  if (!records || records.length === 0) return null

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        <Icon name="trophy" size={16} style={{ color: 'hsl(45,80%,60%)' }} />
        {t('progress.records.title')}
      </div>
      <Glass padding={0} style={{ overflow: 'hidden' }}>
        {records.map((r, i) => {
          const diff = r.previousBest > 0 ? r.value - r.previousBest : r.value
          return (
            <div key={`${r.exerciseSlug}-${i}`} style={{
              padding: '12px 14px',
              borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', gap: 'var(--space-3)',
            }}>
              <div style={{
                fontSize: 'var(--text-sm)', color: 'var(--fg-primary)',
                flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {r.exerciseNameRu}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)', fontWeight: 600,
                color: 'hsl(140,55%,55%)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {t('progress.records.plus', { kg: diff % 1 === 0 ? diff : diff.toFixed(1) })}
              </div>
            </div>
          )
        })}
      </Glass>
    </div>
  )
}
