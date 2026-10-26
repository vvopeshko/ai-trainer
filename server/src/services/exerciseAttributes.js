/**
 * Catalog attributes beyond muscles (classified once by LLM, see
 * scripts/classifyExerciseAttributes.js, shipped in enriched-exercises.json):
 *
 * - trackingType — what a set records and what counts as progress:
 *   weight_reps (weight × reps), bodyweight_reps (reps, optional extra weight),
 *   assisted_bodyweight (weight = assistance: less is progress, no tonnage),
 *   duration (seconds), distance (cardio / carries).
 * - movementPattern — the movement, independent of the tool: the base for
 *   alternatives (same pattern, other tool) and push/pull balance.
 * - jointStress — joints an exercise loads noticeably; matches the injury tags
 *   of UserProfile.constraints ('lower_back', 'knee', 'shoulder').
 * - stable — fixed path or support (machine, cable, bench): high stimulus with
 *   little fatigue and skill; preferred by hypertrophy-oriented selection.
 */

export const TRACKING_TYPES = ['weight_reps', 'bodyweight_reps', 'assisted_bodyweight', 'duration', 'distance']

export const MOVEMENT_PATTERNS = [
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  'chest_fly', 'shoulder_abduction', 'shoulder_flexion', 'rear_delt', 'pullover', 'shrug',
  'elbow_flexion', 'elbow_extension', 'wrist',
  'squat', 'lunge', 'hinge', 'hip_extension', 'knee_extension', 'knee_flexion',
  'hip_adduction', 'hip_abduction', 'calf_raise',
  'core_flexion', 'core_rotation', 'core_stability', 'carry', 'neck',
  'olympic', 'plyometric', 'cardio', 'stretch',
]

export const JOINTS = ['lower_back', 'knee', 'shoulder', 'elbow', 'wrist', 'hip', 'neck']

// Weight × reps is tonnage only where the weight is lifted: not assistance
// (гравитрон), not seconds or distance stored in `reps`.
const NO_TONNAGE = ['assisted_bodyweight', 'duration', 'distance']

/** Does weight × reps of this exercise count as tonnage (unknown type: yes). */
export const countsTonnage = trackingType => !NO_TONNAGE.includes(trackingType)

/** SQL condition on an Exercise alias `e` for the same rule. */
export const TONNAGE_SQL = `COALESCE(e."trackingType", 'weight_reps') NOT IN (${NO_TONNAGE.map(t => `'${t}'`).join(', ')})`

/** Patterns that push or pull — the rest are neither for the balance. */
export const PUSH_PATTERNS = new Set(['horizontal_push', 'vertical_push', 'chest_fly', 'elbow_extension'])
export const PULL_PATTERNS = new Set(['horizontal_pull', 'vertical_pull', 'rear_delt', 'pullover', 'elbow_flexion', 'shrug'])

/**
 * Catalog exercises a user should not get with these injury tags
 * (UserProfile.constraints; 'none' and unknown tags ignore nothing).
 */
export function loadsInjured(exercise, constraints = []) {
  const injured = constraints.filter(c => JOINTS.includes(c))
  return injured.length > 0 && (exercise.jointStress ?? []).some(j => injured.includes(j))
}
