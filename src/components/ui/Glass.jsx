import { forwardRef } from 'react'

const variantStyles = {
  default: {
    background: 'rgba(22,22,28,0.55)',
    backdropFilter: 'blur(var(--glass-blur, 16px)) saturate(var(--glass-sat, 1.25))',
    WebkitBackdropFilter: 'blur(var(--glass-blur, 16px)) saturate(var(--glass-sat, 1.25))',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 14px rgba(0,0,0,0.35)',
  },
  strong: {
    background: 'rgba(28,28,34,0.7)',
    backdropFilter: 'blur(calc(var(--glass-blur, 16px) * 1.4)) saturate(var(--glass-sat, 1.25))',
    WebkitBackdropFilter: 'blur(calc(var(--glass-blur, 16px) * 1.4)) saturate(var(--glass-sat, 1.25))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 22px rgba(0,0,0,0.4)',
  },
  tint: {
    background: 'linear-gradient(180deg, hsla(var(--accent-h,158),70%,22%,0.55) 0%, rgba(22,22,28,0.6) 100%)',
    backdropFilter: 'blur(var(--glass-blur, 16px)) saturate(1.3)',
    WebkitBackdropFilter: 'blur(var(--glass-blur, 16px)) saturate(1.3)',
    border: '1px solid hsla(var(--accent-h,158),70%,50%,0.20)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 22px rgba(0,0,0,0.4)',
  },
}

const specularLayer = {
  content: "''",
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  pointerEvents: 'none',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 36%)',
}

// backdrop-filter — самое дорогое в отрисовке: каждый такой слой пересэмплирует
// фон при скролле и анимациях (особенно Android WebView). Он оправдан только
// для одиночных карточек над «живым» фоном.
const NO_BLUR = { backdropFilter: 'none', WebkitBackdropFilter: 'none' }

/**
 * Base glass surface. All cards build on this.
 * Variants: default | strong | tint (accent gradient — use sparingly).
 *
 * flat — тот же вид без blur: для элементов списков, карточек внутри другого
 * Glass/шита (blur поверх blur ничего не добавляет) и длинных контейнеров.
 * Свой непрозрачный background в style — blur выключается сам (его не видно).
 */
export const Glass = forwardRef(
  ({ variant = 'default', specular, flat, padding, radius = 14, style, children, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        position: 'relative',
        borderRadius: radius,
        ...variantStyles[variant],
        ...((flat || style?.background) && NO_BLUR),
        padding,
        ...style,
      }}
      {...rest}
    >
      {specular && <span aria-hidden="true" style={specularLayer} />}
      {children}
    </div>
  ),
)
Glass.displayName = 'Glass'
