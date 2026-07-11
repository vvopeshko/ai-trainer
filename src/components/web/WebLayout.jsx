import { Icon } from '../ui/Icon.jsx'
import { Mesh } from '../ui/Mesh.jsx'
import { useTranslation } from '../../i18n/useTranslation.js'

// Десктопный лэйаут web-версии (≥1024px, только platform='web'):
// сайдбар слева + колонка контента ~560px по центру
// (см. product/ARCHITECTURE_WEB_AUTH.md §7.3). Мобильный браузер и
// Mini App продолжают жить с нижним GlassNav.

const SIDEBAR_WIDTH = 220

const NAV_ITEMS = [
  { k: 'home', icon: 'home', label: 'nav.today' },
  { k: 'progress', icon: 'activity', label: 'nav.progress' },
  { k: 'lib', icon: 'book', label: 'nav.library' },
  { k: 'me', icon: 'user', label: 'nav.me' },
]

export function WebLayout({ active, onNav, children }) {
  const { t } = useTranslation()
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <Mesh />

      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          zIndex: 'var(--z-nav)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: 'var(--space-5) var(--space-3)',
          background: 'rgba(20,21,28,0.6)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            padding: '0 var(--space-3) var(--space-5)',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            letterSpacing: 0.3,
          }}
        >
          {t('app.title')}
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = active === item.k
          return (
            <button
              key={item.k}
              onClick={() => onNav?.(item.k)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px var(--space-3)',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'none',
                transition: 'all 150ms cubic-bezier(.4,0,.2,1)',
              }}
            >
              <Icon name={item.icon} size={17} />
              {t(item.label)}
            </button>
          )
        })}
      </aside>

      <main
        style={{
          position: 'relative',
          marginLeft: SIDEBAR_WIDTH,
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 560, padding: 'var(--space-5) var(--space-4)' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
