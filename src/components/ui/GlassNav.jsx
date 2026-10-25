import { Icon } from './Icon.jsx'
import { useTranslation } from '../../i18n/useTranslation.js'
import './glassNav.css'

const NAV_ITEMS = [
  { k: 'home',     l: 'nav.today',     i: 'navHome' },
  { k: 'progress', l: 'nav.progress',  i: 'navProgress' },
  { k: 'lib',      l: 'nav.exercises', i: 'navDumbbell' },
  { k: 'me',       l: 'nav.self',      i: 'bicepsFlexed' },
]

/** Floating mobile navigation with dimensional icon tiles. */
export function GlassNav({ active, onNav, items = NAV_ITEMS }) {
  const { t } = useTranslation()

  return (
    <div className="glass-nav-positioner">
      <nav
        className="glass-nav"
        aria-label={t('a11y.mainNavigation')}
        style={{ '--nav-count': items.length || 1 }}
      >
        {items.map(item => {
          const is = active === item.k
          return (
            <button
              key={item.k}
              type="button"
              className="glass-nav__item"
              aria-current={is ? 'page' : undefined}
              onClick={() => onNav?.(item.k)}
            >
              <span className="glass-nav__icon" aria-hidden="true">
                <Icon name={item.i} size={24} strokeWidth={1.9} />
              </span>
              <span className="glass-nav__label">{t(item.l)}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
