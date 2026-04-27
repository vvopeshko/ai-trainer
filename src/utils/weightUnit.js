const LBS_TO_KG = 0.45359237
const KG_TO_LBS = 1 / LBS_TO_KG

/** Convert lbs → kg, 1 decimal precision (stored to DB) */
export function lbsToKg(lbs) { return Math.round(lbs * LBS_TO_KG * 10) / 10 }

/** Convert kg → lbs, snapped to nearest 5 (clean stepper values) */
export function kgToLbs(kg) { return Math.round(kg * KG_TO_LBS / 5) * 5 }

const STORAGE_KEY = 'exercise-weight-units'

export function getExerciseUnit(slug) {
  if (!slug) return 'kg'
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.[slug] || 'kg' }
  catch { return 'kg' }
}

export function setExerciseUnit(slug, unit) {
  if (!slug) return
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    data[slug] = unit
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* localStorage unavailable */ }
}
