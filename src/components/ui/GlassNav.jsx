import { Icon } from './Icon.jsx'

const NAV_ITEMS = [
  { k: 'home',     l: 'Главная',  i: 'home' },
  { k: 'progress', l: 'Прогресс', i: 'activity' },
  { k: 'lib',      l: 'Каталог',  i: 'book' },
  { k: 'me',       l: 'Профиль',  i: 'user' },
]

/**
 * Bottom nav dock — 4 tabs with monochrome icons + thin accent indicator.
 * Place inside a frame with position: relative; overflow: hidden.
 */
export function GlassNav({ active, onNav, items = NAV_ITEMS }) {
  return (
    <div style={{ position: 'fixed', bottom: 'calc(8px + var(--safe-bottom, 0px))', left: 8, right: 8, height: 56, zIndex: 'var(--z-nav)' }}>
      <div style={{
        position: 'relative', height: '100%', borderRadius: 14, display: 'flex', padding: '0 4px',
        background: 'rgba(28,28,34,0.7)',
        backdropFilter: 'blur(22px) saturate(1.25)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 22px rgba(0,0,0,0.4)',
      }}>
        <span aria-hidden="true" style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 36%)',
        }} />
        {items.map(t => {
          const is = active === t.k
          return (
            <button
              key={t.k}
              onClick={() => onNav?.(t.k)}
              style={{
                flex: 1, background: 'none', border: 'none',
                color: is ? '#fff' : 'rgba(236,234,239,0.42)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, cursor: 'pointer', position: 'relative',
              }}
            >
              {is && <div style={{
                position: 'absolute', top: 5, height: 2, width: 22, borderRadius: 1,
                background: 'hsl(var(--accent-h,158), 70%, 65%)',
              }} />}
              <Icon name={t.i} size={18} strokeWidth={is ? 2.2 : 1.7} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: is ? 600 : 500, letterSpacing: 0.2 }}>{t.l}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
