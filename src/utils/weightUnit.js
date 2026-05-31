const LBS_TO_KG = 0.45359237
const KG_TO_LBS = 1 / LBS_TO_KG

/** Convert lbs → kg, 1 decimal precision (stored to DB) */
export function lbsToKg(lbs) { return Math.round(lbs * LBS_TO_KG * 10) / 10 }

/** Convert kg → lbs, snapped to nearest 5 (clean stepper values) */
export function kgToLbs(kg) { return Math.round(kg * KG_TO_LBS / 5) * 5 }

const STORAGE_KEY = 'exercise-weight-units'
const SETTINGS_KEY = 'exercise-settings'

const DEFAULT_SETTINGS = { unit: 'kg', minWeight: 0, maxWeight: 500, step: 2.5, type: 'reps' }

export function getExerciseUnit(slug) {
  if (!slug) return 'kg'
  try {
    // Check new settings format first
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')?.[slug]
    if (settings?.unit) return settings.unit
    // Fall back to old format
    return JSON.parse(localStorage.getItem(STORAGE_KEY))?.[slug] || 'kg'
  } catch { return 'kg' }
}

export function setExerciseUnit(slug, unit) {
  if (!slug) return
  const settings = getExerciseSettings(slug)
  setExerciseSettings(slug, { ...settings, unit })
}

export function getExerciseSettings(slug) {
  if (!slug) return { ...DEFAULT_SETTINGS }
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    if (all[slug]) return { ...DEFAULT_SETTINGS, ...all[slug] }
    // Migrate from old format if exists
    const oldUnits = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (oldUnits[slug]) return { ...DEFAULT_SETTINGS, unit: oldUnits[slug] }
    return { ...DEFAULT_SETTINGS }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function setExerciseSettings(slug, settings) {
  if (!slug) return
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    all[slug] = { ...DEFAULT_SETTINGS, ...all[slug], ...settings }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(all))
  } catch { /* localStorage unavailable */ }
}
