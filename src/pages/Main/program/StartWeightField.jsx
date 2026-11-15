import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon.jsx'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { getExerciseSettings, kgToLbs, lbsToKg, stepWeight } from '../../../utils/weightUnit.js'

const buttonStyle = disabled => ({
  width: 32, height: 32, borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  border: 'none', color: disabled ? 'var(--fg-disabled)' : 'var(--fg-primary)',
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
})

/**
 * Стартовый вес упражнения в программе (хранится в кг). Вводится в единицах и
 * с шагом из настроек упражнения; пустое поле — стартового веса нет.
 * Монтировать с key={exerciseId}: черновик ввода живёт в локальном состоянии.
 */
export function StartWeightField({ slug, valueKg, onChange }) {
  const { t } = useTranslation()
  const { unit, step, stepUnit, minWeight, maxWeight } = getExerciseSettings(slug)
  const lbs = unit === 'lbs'
  const show = kg => kg == null ? '' : String(lbs ? kgToLbs(kg) : kg)
  const [draft, setDraft] = useState(() => show(valueKg))

  const commit = shown => {
    const kg = lbs ? lbsToKg(shown) : Math.round(shown * 100) / 100
    onChange(kg > 0 ? kg : undefined)
  }
  const handleInput = e => {
    const text = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')
    setDraft(text)
    const shown = parseFloat(text)
    if (text === '') onChange(undefined)
    else if (Number.isFinite(shown) && shown <= maxWeight) commit(shown)
  }
  const current = parseFloat(draft) || 0
  const stepBy = direction => {
    const next = Math.min(maxWeight, Math.max(minWeight, stepWeight(current, direction, step, stepUnit || unit, unit)))
    setDraft(next > 0 ? String(next) : '')
    commit(next)
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>
          {t('program.startWeight')}, {t(lbs ? 'units.lbs' : 'units.kg')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button onClick={() => stepBy(-1)} disabled={current <= 0} aria-label={t('program.startWeightLess')} style={buttonStyle(current <= 0)}>
            <Icon name="minus" size={16} />
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            placeholder="—"
            onChange={handleInput}
            aria-label={t('program.startWeight')}
            style={{
              width: 56, padding: '4px 0', textAlign: 'center',
              background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, outline: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 600,
              color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums',
            }}
          />
          <button onClick={() => stepBy(1)} disabled={current >= maxWeight} aria-label={t('program.startWeightMore')} style={buttonStyle(current >= maxWeight)}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginTop: 'var(--space-1)' }}>
        {t('program.startWeightHint')}
      </div>
    </div>
  )
}
