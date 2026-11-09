import { useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Icon } from './Icon.jsx'
import './exerciseSearch.css'

/** Shared by the catalog, workout picker and both alternative searches. */
export function ExerciseSearchField({ value, onChange, placeholder }) {
  const { t } = useTranslation()
  const input = useRef(null)
  return (
    <div className="exercise-search-field">
      <Icon name="search" size={20} style={{ flexShrink: 0, color: 'var(--fg-tertiary)' }} />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape' && value) { e.stopPropagation(); onChange('') }
        }}
      />
      {value && <button type="button" aria-label={t('a11y.clearSearch')}
        onPointerDown={e => e.preventDefault()}
        onClick={() => { onChange(''); input.current?.focus({ preventScroll: true }) }}>
        <Icon name="x" size={18} />
      </button>}
    </div>
  )
}
