import { Icon } from '../../../components/ui/Icon.jsx'

/**
 * Stepper control — increment/decrement numeric value with min/max bounds.
 */
export function Stepper({ value, min = 1, max = 20, onChange, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: 'none', color: value <= min ? 'var(--fg-disabled)' : 'var(--fg-primary)',
            cursor: value <= min ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="minus" size={16} />
        </button>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--fg-primary)',
          minWidth: 28, textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: 'none', color: value >= max ? 'var(--fg-disabled)' : 'var(--fg-primary)',
            cursor: value >= max ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}
