import { forwardRef } from 'react'
import { Icon } from './Icon.jsx'

const sizeMap = {
  sm: { h: 32, px: 12, fs: 11.5 },
  md: { h: 40, px: 16, fs: 13 },
  lg: { h: 48, px: 20, fs: 13.5 },
}

const variantMap = {
  primary:   { background: '#fff', color: 'hsl(var(--accent-h,158),50%,22%)' },
  accent:    { background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815' },
  secondary: { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' },
  ghost:     { background: 'rgba(255,255,255,0.04)', color: '#ECEAEF' },
  danger:    { background: 'hsla(0,70%,55%,0.18)',  color: 'hsl(0,70%,75%)',   border: '1px solid hsla(0,70%,55%,0.3)' },
  success:   { background: 'hsla(140,55%,40%,0.2)', color: 'hsl(140,55%,75%)', border: '1px solid hsla(140,55%,55%,0.3)' },
  warning:   { background: 'hsla(38,90%,55%,0.18)', color: 'hsl(38,90%,72%)',  border: '1px solid hsla(38,90%,55%,0.3)' },
}

/**
 * Button — primary action control.
 * Variants: primary | accent | secondary | ghost | danger | success | warning
 * Sizes: sm (32px) | md (40px) | lg (48px)
 */
export const Button = forwardRef(
  ({ variant = 'primary', size = 'md', icon, loading, block, disabled, children, style, ...rest }, ref) => {
    const s = sizeMap[size]
    const v = variantMap[variant]
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          height: s.h,
          padding: `0 ${s.px}px`,
          borderRadius: 10,
          fontSize: s.fs,
          fontWeight: 600,
          letterSpacing: 0.2,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: block ? 'flex' : 'inline-flex',
          width: block ? '100%' : 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          transition: 'all 150ms cubic-bezier(.4,0,.2,1)',
          opacity: disabled ? 0.4 : 1,
          ...v,
          ...style,
        }}
        {...rest}
      >
        {loading && <Spinner size={s.fs + 2} />}
        {!loading && icon && <Icon name={icon} size={s.fs + 1} />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

function Spinner({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'trainerSpin 0.9s linear infinite' }}>
      <style>{`@keyframes trainerSpin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
