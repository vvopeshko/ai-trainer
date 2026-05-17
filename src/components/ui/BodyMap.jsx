/**
 * BodyMap — React wrapper over body-muscles library.
 *
 * Shows front + back anatomical views side-by-side.
 * Accepts our internal muscle IDs and maps them to body-muscles zones.
 *
 * Usage:
 *   <BodyMap
 *     muscles={[{ muscle: 'upper_chest', setsActual: 4, setsTarget: 6 }]}
 *     height={240}
 *     onMuscleClick={(muscleId) => {}}
 *   />
 */
import { useRef, useEffect, useCallback } from 'react'
import { BodyChart, ViewSide } from 'body-muscles'

// ─── Our muscle IDs → body-muscles zone IDs ─────────────────────────────

const MUSCLE_ZONE_MAP = {
  upper_chest: ['chest-upper-left', 'chest-upper-right'],
  mid_chest: ['chest-lower-left', 'chest-lower-right'],
  lower_chest: ['chest-lower-left', 'chest-lower-right'],
  chest: ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
  front_delt: ['shoulder-front-left', 'shoulder-front-right'],
  side_delt: ['shoulder-side-left', 'shoulder-side-right'],
  rear_delt: ['deltoid-rear-left', 'deltoid-rear-right'],
  shoulders: ['shoulder-front-left', 'shoulder-front-right', 'shoulder-side-left', 'shoulder-side-right', 'deltoid-rear-left', 'deltoid-rear-right'],
  traps: ['traps-upper-left', 'traps-upper-right', 'traps-mid-left', 'traps-mid-right'],
  lats: ['lats-upper-left', 'lats-upper-right', 'lats-mid-left', 'lats-mid-right', 'lats-lower-left', 'lats-lower-right'],
  'middle back': ['spine'],
  biceps: ['biceps-left', 'biceps-right'],
  triceps: ['triceps-long-left', 'triceps-long-right', 'triceps-lateral-left', 'triceps-lateral-right'],
  forearms: ['forearm-left', 'forearm-right', 'forearm-flexors-left', 'forearm-flexors-right', 'forearm-extensors-left', 'forearm-extensors-right'],
  quadriceps: ['quads-left', 'quads-right'],
  hamstrings: ['hamstrings-medial-left', 'hamstrings-medial-right', 'hamstrings-lateral-left', 'hamstrings-lateral-right'],
  glutes: ['gluteus-maximus-left', 'gluteus-maximus-right'],
  calves: ['calves-gastroc-medial-left', 'calves-gastroc-medial-right', 'calves-soleus-left', 'calves-soleus-right'],
  adductors: ['adductors-left', 'adductors-right'],
  abdominals: ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right'],
  obliques: ['obliques-left', 'obliques-right'],
}

// Reverse map: body-muscles zone ID → our muscle ID
const ZONE_TO_MUSCLE = {}
for (const [muscle, zones] of Object.entries(MUSCLE_ZONE_MAP)) {
  // Skip generic aliases that overlap with specific sub-muscles
  if (muscle === 'chest' || muscle === 'shoulders') continue
  for (const zone of zones) {
    // First writer wins — specific sub-muscles are listed before generics
    if (!ZONE_TO_MUSCLE[zone]) ZONE_TO_MUSCLE[zone] = muscle
  }
}

// ─── Intensity calculation ──────────────────────────────────────────────

function calcIntensity(setsActual, setsTarget) {
  if (!setsActual || setsActual <= 0) return 0
  if (setsTarget && setsTarget > 0) {
    return Math.min(10, Math.round((setsActual / setsTarget) * 7))
  }
  // Absolute mode: no target
  if (setsActual <= 3) return 2
  if (setsActual <= 6) return 4
  if (setsActual <= 9) return 6
  return 8
}

// ─── Build bodyState from muscles array ─────────────────────────────────

function buildBodyState(muscles) {
  const state = {}
  if (!muscles) return state
  for (const { muscle, setsActual, setsTarget } of muscles) {
    const zones = MUSCLE_ZONE_MAP[muscle]
    if (!zones) continue
    const intensity = calcIntensity(setsActual, setsTarget)
    if (intensity <= 0) continue
    for (const zone of zones) {
      // Take max intensity if multiple muscles map to same zone
      const existing = state[zone]?.intensity || 0
      if (intensity > existing) {
        state[zone] = { intensity }
      }
    }
  }
  return state
}

// ─── Fix library styles to fit within container height ──────────────────

function fixSvgSizing(containerEl) {
  const wrapper = containerEl.querySelector('.body-chart-container')
  if (wrapper) {
    wrapper.style.padding = '0'
  }
  const svg = containerEl.querySelector('.body-chart-svg')
  if (svg) {
    svg.style.width = 'auto'
    svg.style.height = '100%'
    svg.style.maxHeight = '100%'
    svg.style.maxWidth = '100%'
  }
}

// ─── Component ──────────────────────────────────────────────────────────

export function BodyMap({ muscles, height = 240, onMuscleClick }) {
  const frontRef = useRef(null)
  const backRef = useRef(null)
  const frontChart = useRef(null)
  const backChart = useRef(null)
  const onClickRef = useRef(onMuscleClick)
  onClickRef.current = onMuscleClick

  const handleClick = useCallback((zoneId) => {
    if (!onClickRef.current) return
    const muscleId = ZONE_TO_MUSCLE[zoneId]
    if (muscleId) onClickRef.current(muscleId)
  }, [])

  // Mount charts
  useEffect(() => {
    if (!frontRef.current || !backRef.current) return
    const bodyState = buildBodyState(muscles)
    const clickHandler = onMuscleClick ? (id) => handleClick(id) : undefined

    frontChart.current = new BodyChart(frontRef.current, {
      view: ViewSide.FRONT,
      bodyState,
      onMuscleClick: clickHandler,
      enableTransitions: true,
    })
    backChart.current = new BodyChart(backRef.current, {
      view: ViewSide.BACK,
      bodyState,
      onMuscleClick: clickHandler,
      enableTransitions: true,
    })

    fixSvgSizing(frontRef.current)
    fixSvgSizing(backRef.current)

    return () => {
      frontChart.current?.destroy()
      backChart.current?.destroy()
      frontChart.current = null
      backChart.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update on muscles change
  useEffect(() => {
    const bodyState = buildBodyState(muscles)
    frontChart.current?.update({ bodyState })
    backChart.current?.update({ bodyState })
  }, [muscles])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      height,
    }}>
      <div
        ref={frontRef}
        style={{ height: '100%', display: 'flex', justifyContent: 'center' }}
      />
      <div
        ref={backRef}
        style={{ height: '100%', display: 'flex', justifyContent: 'center' }}
      />
    </div>
  )
}
