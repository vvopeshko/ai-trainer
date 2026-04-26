/**
 * ConfirmDialog — Glass модалка с подтверждением действия.
 *
 * Props: open, title, message, confirmLabel, cancelLabel, variant ('danger'|'default'), onConfirm, onCancel
 */
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from './Glass.jsx'

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, variant = 'default', onConfirm, onCancel }) {
  const { t } = useTranslation()

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
        animation: 'confirmFadeIn 0.15s ease-out',
      }}
    >
      <Glass
        padding="20px"
        radius={16}
        style={{ maxWidth: 320, width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--fg-primary)',
          marginBottom: 8,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--fg-secondary)',
          lineHeight: 1.5,
          marginBottom: 20,
        }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 10,
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--fg-secondary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cancelLabel || t('confirm.cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 10,
              border: 'none',
              background: isDanger ? 'var(--danger, #f87171)' : 'hsl(var(--accent-h,158),55%,55%)',
              color: isDanger ? '#fff' : '#0a1815',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </Glass>
      <style>{`@keyframes confirmFadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  )
}
