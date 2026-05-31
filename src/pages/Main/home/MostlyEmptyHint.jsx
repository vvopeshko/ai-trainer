import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

export function MostlyEmptyHint() {
  const { t } = useTranslation()

  return (
    <Glass style={{
      padding: 'var(--space-4)',
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    }}>
      <Icon name="sparkles" size={20} style={{ color: 'hsl(var(--accent-h,158),55%,72%)', flexShrink: 0 }} />
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>
        {t('progress.mostlyEmpty')}
      </div>
    </Glass>
  )
}
