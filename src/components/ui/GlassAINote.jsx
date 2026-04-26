import { Glass } from './Glass.jsx'
import { Icon } from './Icon.jsx'

const KIND_MAP = {
  insight: { icon: 'sparkles', color: 'hsl(var(--accent-h,158),55%,72%)' },
  warning: { icon: 'bell',     color: 'hsl(38, 90%, 70%)' },
  success: { icon: 'check',    color: 'hsl(140, 55%, 70%)' },
}

/** Inline AI note. 1-2 lines, optional CTA. One per screen. */
export function GlassAINote({ kind = 'insight', cta, onCta, children }) {
  const k = KIND_MAP[kind]
  return (
    <Glass padding="11px 13px" radius={11}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: k.color, marginTop: 1,
        }}>
          <Icon name={k.icon} size={12} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-base)', lineHeight: 1.4, color: 'rgba(236,234,239,0.85)' }}>{children}</div>
          {cta && (
            <button onClick={onCta} style={{
              marginTop: 6, height: 24, padding: '0 10px', borderRadius: 7,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--fg-primary)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer',
            }}>{cta}</button>
          )}
        </div>
      </div>
    </Glass>
  )
}
