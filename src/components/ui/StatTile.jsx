import { Glass } from './Glass.jsx'
import { Icon } from './Icon.jsx'

/** Small stat tile. Use in a 2-4 column grid; mono digits for alignment. */
export function StatTile({ label, value, sub, icon }) {
  return (
    <Glass padding={12} radius={12}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase', color: 'var(--fg-tertiary)',
          }}>{label}</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 19, fontWeight: 600, color: 'var(--fg-primary)', marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>{value}</div>
          {sub && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)', marginTop: 2 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'hsl(var(--accent-h,158),55%,72%)',
          }}>
            <Icon name={icon} size={14} />
          </div>
        )}
      </div>
    </Glass>
  )
}
