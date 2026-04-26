import { forwardRef } from 'react'
import { Icon } from './Icon.jsx'

/**
 * TopBar — тонкая шапка для flow-экранов (Workout, Summary, ProgramEdit).
 *
 * Props:
 *   title     — текст заголовка (центр)
 *   onBack    — handler кнопки ←. Если null — кнопка не показывается
 *   rightIcon — имя иконки справа (e.g. 'moreHorizontal')
 *   rightLabel— текст справа (e.g. 'Готово'). Приоритет над rightIcon
 *   onRight   — handler правой кнопки
 */
const TopBar = forwardRef(function TopBar(
  { title, onBack, rightIcon, rightLabel, onRight, style },
  ref,
) {
  return (
    <header
      ref={ref}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-nav)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 48,
        padding: '0 var(--space-3)',
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      {/* Left: back button */}
      <div style={{ width: 40, display: 'flex', alignItems: 'center' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
        )}
      </div>

      {/* Center: title */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-semi)',
          color: 'var(--fg-primary)',
          letterSpacing: 'var(--tracking-tight)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>

      {/* Right: action */}
      <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {(rightLabel || rightIcon) && onRight && (
          <button
            onClick={onRight}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-color)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semi)',
            }}
          >
            {rightLabel || <Icon name={rightIcon} size={20} />}
          </button>
        )}
      </div>
    </header>
  )
})

export default TopBar
