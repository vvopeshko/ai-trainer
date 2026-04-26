import { forwardRef } from 'react'
import { Icon } from './Icon.jsx'

/**
 * BigStepper — ± кнопки для ввода числовых значений (вес, повторы).
 *
 * BRD §12.2: "большая карточка с двумя BigStepper'ами"
 * Шаг настраивается: 2.5 для веса, 1 для повторов.
 *
 * Props:
 *   label    — подпись сверху ("Вес, кг" / "Повторы")
 *   value    — текущее значение
 *   onChange — (newValue) => void
 *   step     — шаг (default 1)
 *   min      — минимум (default 0)
 *   max      — максимум (default 999)
 *   format   — функция форматирования для отображения (default: String)
 */
const BigStepper = forwardRef(function BigStepper(
  { label, value, onChange, step = 1, min = 0, max = 999, format, style },
  ref,
) {
  const display = format ? format(value) : String(value)

  const decrement = () => {
    const next = Math.max(min, value - step)
    onChange(Math.round(next * 100) / 100) // fix float precision
  }

  const increment = () => {
    const next = Math.min(max, value + step)
    onChange(Math.round(next * 100) / 100)
  }

  return (
    <div ref={ref} style={{ textAlign: 'center', ...style }}>
      {/* Label */}
      {label && (
        <div
          style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--fg-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {label}
        </div>
      )}

      {/* Stepper row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-5)',
        }}
      >
        {/* Minus button */}
        <button
          onClick={decrement}
          disabled={value <= min}
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-medium)',
            background: 'var(--surface-0)',
            color: value <= min ? 'var(--fg-disabled)' : 'var(--fg-primary)',
            cursor: value <= min ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background var(--duration-fast) var(--ease-out)',
          }}
        >
          <Icon name="minus" size={20} />
        </button>

        {/* Value */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--fg-primary)',
            minWidth: 72,
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {display}
        </span>

        {/* Plus button */}
        <button
          onClick={increment}
          disabled={value >= max}
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-medium)',
            background: 'var(--surface-0)',
            color: value >= max ? 'var(--fg-disabled)' : 'var(--fg-primary)',
            cursor: value >= max ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background var(--duration-fast) var(--ease-out)',
          }}
        >
          <Icon name="plus" size={20} />
        </button>
      </div>
    </div>
  )
})

export default BigStepper
