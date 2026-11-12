import { Glass } from '../../../components/ui/Glass.jsx'
import { useTranslation } from '../../../i18n/useTranslation.js'

// Keep each exercise's drag target and expanded controls inside the shared outline.
export function SupersetListItem({ pair, exerciseId, children }) {
  const { t } = useTranslation()
  if (!pair) return children
  const first = pair[0].exerciseId === exerciseId
  return <Glass flat padding="8px" radius={0} style={{
    borderColor: 'var(--accent-color)',
    borderTopWidth: first ? 1 : 0,
    borderBottomWidth: first ? 0 : 1,
    borderRadius: first ? '14px 14px 0 0' : '0 0 14px 14px',
    marginTop: first ? 0 : -6,
    boxShadow: 'none',
  }}>
    {first && <div style={{ color: 'var(--accent-color)', fontSize: 12, fontWeight: 600, margin: '2px 4px 8px' }}>{t('superset.title')}</div>}
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--accent-color)', fontSize: 12, fontWeight: 700, paddingTop: 12 }}>{first ? 'A' : 'B'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
    {!first && <div style={{ color: 'var(--fg-secondary)', fontSize: 11, margin: '8px 4px 2px' }}>{t('superset.rest', { seconds: pair[1].restSec ?? 90 })}</div>}
  </Glass>
}
