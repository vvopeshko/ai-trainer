const LBS_TO_KG = 0.45359237
const KG_TO_LBS = 1 / LBS_TO_KG

/** Convert lbs → kg, 1 decimal precision (stored to DB) */
export function lbsToKg(lbs) { return Math.round(lbs * LBS_TO_KG * 10) / 10 }

/** Convert kg → lbs, snapped to nearest 5 (clean stepper values) */
export function kgToLbs(kg) { return Math.round(kg * KG_TO_LBS / 5) * 5 }

// ─── Presets ──────────────────────────────────────────────────────────

export const PRESETS = {
  dumbbell_kg:  { unit: 'kg',  step: 2,   stepUnit: 'kg',  minWeight: 1,  maxWeight: 80  },
  dumbbell_lbs: { unit: 'lbs', step: 5,   stepUnit: 'lbs', minWeight: 5,  maxWeight: 150 },
  barbell_kg:   { unit: 'kg',  step: 2.5, stepUnit: 'kg',  minWeight: 20, maxWeight: 300 },
  machine_kg:   { unit: 'kg',  step: 5,   stepUnit: 'kg',  minWeight: 5,  maxWeight: 200 },
  machine_lbs:  { unit: 'kg',  step: 10,  stepUnit: 'lbs', minWeight: 0,  maxWeight: 200 },
}

const EQUIPMENT_TO_PRESET = {
  barbell: 'barbell_kg',
  'e-z curl bar': 'barbell_kg',
  dumbbell: 'dumbbell_kg',
  kettlebells: 'dumbbell_kg',
  machine: 'machine_kg',
  cable: 'machine_kg',
}

const DEFAULT_PRESET = 'dumbbell_kg'

/** Relevant preset IDs by equipment group (always includes 'custom') */
const EQUIPMENT_PRESETS = {
  barbell:        ['barbell_kg', 'custom'],
  'e-z curl bar': ['barbell_kg', 'custom'],
  dumbbell:       ['dumbbell_kg', 'dumbbell_lbs', 'custom'],
  kettlebells:    ['dumbbell_kg', 'dumbbell_lbs', 'custom'],
  machine:        ['machine_kg', 'machine_lbs', 'custom'],
  cable:          ['machine_kg', 'machine_lbs', 'custom'],
}

const ALL_PRESET_IDS = ['dumbbell_kg', 'dumbbell_lbs', 'barbell_kg', 'machine_kg', 'machine_lbs', 'custom']

/** Get relevant preset IDs for an exercise's equipment */
export function getPresetsForEquipment(equipment) {
  if (!equipment) return ALL_PRESET_IDS
  const list = Array.isArray(equipment) ? equipment : [equipment]
  for (const eq of list) {
    const key = eq?.toLowerCase?.()
    if (key && EQUIPMENT_PRESETS[key]) return EQUIPMENT_PRESETS[key]
  }
  return ALL_PRESET_IDS
}

/** Pick a default preset ID based on exercise equipment field(s) */
export function getDefaultPreset(equipment) {
  if (!equipment) return DEFAULT_PRESET
  const list = Array.isArray(equipment) ? equipment : [equipment]
  for (const eq of list) {
    const key = eq?.toLowerCase?.()
    if (key && EQUIPMENT_TO_PRESET[key]) return EQUIPMENT_TO_PRESET[key]
  }
  return DEFAULT_PRESET
}

/**
 * Step weight with unit conversion support.
 *
 * When stepUnit differs from display unit (e.g. stepUnit='lbs', unit='kg'),
 * converts to stepUnit, snaps to nearest step, applies +/- step, converts back.
 *
 * @param {number} current — current weight in display unit
 * @param {1|-1} direction — +1 or -1
 * @param {number} step — step size in stepUnit
 * @param {string} stepUnit — 'kg' or 'lbs'
 * @param {string} unit — display unit ('kg' or 'lbs')
 * @returns {number} new weight in display unit
 */
export function stepWeight(current, direction, step, stepUnit, unit) {
  if (stepUnit === unit) {
    return +(current + direction * step).toFixed(2)
  }
  // Cross-unit stepping: convert to stepUnit, snap, step, convert back
  if (stepUnit === 'lbs' && unit === 'kg') {
    const inLbs = current * KG_TO_LBS
    const snapped = Math.round(inLbs / step) * step
    const stepped = snapped + direction * step
    return Math.round(stepped * LBS_TO_KG * 10) / 10
  }
  if (stepUnit === 'kg' && unit === 'lbs') {
    const inKg = current * LBS_TO_KG
    const snapped = Math.round(inKg / step) * step
    const stepped = snapped + direction * step
    return Math.round(stepped * KG_TO_LBS * 10) / 10
  }
  return +(current + direction * step).toFixed(2)
}

// ─── Settings persistence ─────────────────────────────────────────────

const STORAGE_KEY = 'exercise-weight-units'
const SETTINGS_KEY = 'exercise-settings'

const DEFAULT_SETTINGS = { unit: 'kg', minWeight: 0, maxWeight: 500, step: 2.5, stepUnit: 'kg', preset: null, type: 'reps' }

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

// ─── Server sync ─────────────────────────────────────────────────────

/**
 * Merge server settings into localStorage.
 * Server wins over local (server is source of truth for cross-device sync).
 * @param {{ [slug]: { preset, unit, step, stepUnit, minWeight, maxWeight, type, updatedAt } }} settingsMap
 */
export function syncSettingsFromServer(settingsMap) {
  if (!settingsMap || typeof settingsMap !== 'object') return
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    for (const [slug, serverSettings] of Object.entries(settingsMap)) {
      const { updatedAt, ...fields } = serverSettings
      all[slug] = { ...DEFAULT_SETTINGS, ...all[slug], ...fields }
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(all))
  } catch { /* localStorage unavailable */ }
}

/**
 * Fire-and-forget save to server.
 * Import apiPut lazily to avoid circular deps (weightUnit is used in non-API contexts too).
 * @param {string} slug
 * @param {object} settings
 */
let _apiPut = null
export function saveSettingsToServer(slug, settings) {
  if (!slug) return
  const send = (put) => {
    const { preset, unit, step, stepUnit, minWeight, maxWeight, type } = settings
    put(`/api/v1/exercises/settings/${encodeURIComponent(slug)}`, {
      preset: preset || null,
      unit, step, stepUnit, minWeight, maxWeight, type,
    }).catch(() => { /* silent — localStorage is the fallback */ })
  }
  if (_apiPut) { send(_apiPut); return }
  import('./api.js').then(({ apiPut }) => { _apiPut = apiPut; send(apiPut) })
}
