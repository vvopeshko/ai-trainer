// Catalog metadata belongs to the selected exercise, while a swapped plan slot
// can still carry the original exercise's muscles.
export function getExerciseMuscle(exercise, catalogById, fallback) {
  const id = exercise?.exerciseId ?? exercise?.id
  const catalogExercise = catalogById?.get(id)
  if (catalogExercise?.primaryMuscles?.length) return catalogExercise.primaryMuscles[0]
  if (exercise?.primaryMuscles?.length) return exercise.primaryMuscles[0]
  const fallbackId = fallback?.exerciseId ?? fallback?.id
  return id != null && id === fallbackId ? fallback.primaryMuscles?.[0] : undefined
}
