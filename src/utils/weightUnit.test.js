import { describe, it, expect } from 'vitest'
import { lbsToKg, kgToLbs, stepWeight, getDefaultPreset } from './weightUnit.js'

describe('lbsToKg', () => {
  it('converts 100 lbs to ~45.4 kg', () => {
    expect(lbsToKg(100)).toBe(45.4)
  })

  it('converts 0 lbs to 0 kg', () => {
    expect(lbsToKg(0)).toBe(0)
  })

  it('converts 1 lb to 0.5 kg (rounded)', () => {
    expect(lbsToKg(1)).toBe(0.5)
  })

  it('converts 225 lbs to ~102.1 kg', () => {
    expect(lbsToKg(225)).toBe(102.1)
  })

  it('handles negative values', () => {
    expect(lbsToKg(-10)).toBe(-4.5)
  })
})

describe('kgToLbs', () => {
  it('converts 100 kg to 220 lbs (snapped to nearest 5)', () => {
    expect(kgToLbs(100)).toBe(220)
  })

  it('converts 0 kg to 0 lbs', () => {
    expect(kgToLbs(0)).toBe(0)
  })

  it('converts 60 kg to 130 lbs (snapped to nearest 5)', () => {
    expect(kgToLbs(60)).toBe(130)
  })

  it('converts 20 kg to 45 lbs (snapped to nearest 5)', () => {
    expect(kgToLbs(20)).toBe(45)
  })

  it('always returns multiples of 5', () => {
    for (let kg = 1; kg <= 200; kg++) {
      expect(kgToLbs(kg) % 5).toBe(0)
    }
  })
})

describe('getDefaultPreset', () => {
  it('returns barbell_kg for barbell equipment', () => {
    expect(getDefaultPreset('barbell')).toBe('barbell_kg')
  })

  it('returns barbell_kg for e-z curl bar', () => {
    expect(getDefaultPreset('e-z curl bar')).toBe('barbell_kg')
  })

  it('returns dumbbell_kg for dumbbell equipment', () => {
    expect(getDefaultPreset('dumbbell')).toBe('dumbbell_kg')
  })

  it('returns dumbbell_kg for kettlebells', () => {
    expect(getDefaultPreset('kettlebells')).toBe('dumbbell_kg')
  })

  it('returns machine_kg for machine equipment', () => {
    expect(getDefaultPreset('machine')).toBe('machine_kg')
  })

  it('returns machine_kg for cable equipment', () => {
    expect(getDefaultPreset('cable')).toBe('machine_kg')
  })

  it('returns dumbbell_kg as default for body only', () => {
    expect(getDefaultPreset('body only')).toBe('dumbbell_kg')
  })

  it('returns dumbbell_kg as default for unknown equipment', () => {
    expect(getDefaultPreset('bands')).toBe('dumbbell_kg')
  })

  it('returns dumbbell_kg for null/undefined', () => {
    expect(getDefaultPreset(null)).toBe('dumbbell_kg')
    expect(getDefaultPreset(undefined)).toBe('dumbbell_kg')
  })

  it('handles array of equipment (picks first match)', () => {
    expect(getDefaultPreset(['cable', 'body only'])).toBe('machine_kg')
  })

  it('is case-insensitive', () => {
    expect(getDefaultPreset('Barbell')).toBe('barbell_kg')
    expect(getDefaultPreset('MACHINE')).toBe('machine_kg')
  })
})

describe('stepWeight', () => {
  describe('same unit stepping (no conversion)', () => {
    it('steps kg up by 2.5', () => {
      expect(stepWeight(10, 1, 2.5, 'kg', 'kg')).toBe(12.5)
    })

    it('steps kg down by 2.5', () => {
      expect(stepWeight(10, -1, 2.5, 'kg', 'kg')).toBe(7.5)
    })

    it('steps lbs up by 5', () => {
      expect(stepWeight(50, 1, 5, 'lbs', 'lbs')).toBe(55)
    })

    it('steps lbs down by 5', () => {
      expect(stepWeight(50, -1, 5, 'lbs', 'lbs')).toBe(45)
    })
  })

  describe('cross-unit stepping: lbs step, kg display (machine_lbs preset)', () => {
    // Machine with lbs plates showing kg:
    // 10 lbs = 4.5 kg, 20 lbs = 9.1 kg, 30 lbs = 13.6 kg, 40 lbs = 18.1 kg

    it('steps up from 4.5 kg (≈10 lbs) → 9.1 kg (≈20 lbs)', () => {
      const result = stepWeight(4.5, 1, 10, 'lbs', 'kg')
      expect(result).toBe(9.1)
    })

    it('steps up from 9.1 kg (≈20 lbs) → 13.6 kg (≈30 lbs)', () => {
      const result = stepWeight(9.1, 1, 10, 'lbs', 'kg')
      expect(result).toBe(13.6)
    })

    it('steps up from 13.6 kg (≈30 lbs) → 18.1 kg (≈40 lbs)', () => {
      const result = stepWeight(13.6, 1, 10, 'lbs', 'kg')
      expect(result).toBe(18.1)
    })

    it('steps down from 18.1 kg (≈40 lbs) → 13.6 kg (≈30 lbs)', () => {
      const result = stepWeight(18.1, -1, 10, 'lbs', 'kg')
      expect(result).toBe(13.6)
    })

    it('steps down from 13.6 kg (≈30 lbs) → 9.1 kg (≈20 lbs)', () => {
      const result = stepWeight(13.6, -1, 10, 'lbs', 'kg')
      expect(result).toBe(9.1)
    })

    it('steps down from 9.1 kg → 4.5 kg', () => {
      const result = stepWeight(9.1, -1, 10, 'lbs', 'kg')
      expect(result).toBe(4.5)
    })

    it('steps up from 0 kg → 4.5 kg (≈10 lbs)', () => {
      const result = stepWeight(0, 1, 10, 'lbs', 'kg')
      expect(result).toBe(4.5)
    })

    it('handles snapping from slightly off value', () => {
      // If user somehow has 14.0 kg, should snap to 30 lbs and step to 40 lbs = 18.1 kg
      const result = stepWeight(14.0, 1, 10, 'lbs', 'kg')
      expect(result).toBe(18.1)
    })
  })
})
