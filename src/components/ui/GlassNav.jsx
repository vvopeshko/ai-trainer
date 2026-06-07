import { Icon } from './Icon.jsx'

const NAV_ITEMS = [
  { k: 'home',     l: 'Сегодня',    i: 'home' },
  { k: 'progress', l: 'Прогресс',   i: 'activity' },
  { k: 'lib',      l: 'Упражнения', i: 'book' },
  { k: 'me',       l: 'Я',          i: 'user' },
]

/**
 * Bottom nav dock — 4 tabs, GD style (flat, no blur, edge-to-edge).
 */
export function GlassNav({ active, onNav, items = NAV_ITEMS }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'calc(72px + var(--safe-bottom, 0px))',
      zIndex: 'var(--z-nav)',
      background: 'rgba(27,29,38,0.92)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderTop: '1px solid var(--gd-line)',
      paddingBottom: 'var(--safe-bottom, 0px)',
    }}>
      <div style={{
        height: 72,
        display: 'flex',
        padding: '0 4px',
      }}>
        {items.map(t => {
          const is = active === t.k
          return (
            <button
              key={t.k}
              onClick={() => onNav?.(t.k)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: is ? 'var(--gd-ink)' : 'var(--gd-faint)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <Icon name={t.i} size={18} strokeWidth={is ? 2.2 : 1.8} />
              <span style={{
                fontSize: 'var(--text-xs)',
                fontWeight: is ? 700 : 500,
                letterSpacing: 0.2,
              }}>
                {t.l}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
