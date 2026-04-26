/**
 * Exercise Resolver — единая точка привязки текстовых упражнений к Exercise ID.
 *
 * Используется всюду, где LLM возвращает упражнение как текст:
 * - identifyMachine.js → suggestedExercises привязка к exerciseId
 * - generateProgram.js → упражнения программы привязка к exerciseId
 * - importWorkouts.js  → импорт исторических тренировок
 * - Workout: добавление внепланового упражнения по имени
 *
 * Алгоритм:
 * 1. slug-match   — slugify(nameEn) → точное совпадение Exercise.slug
 * 2. alias-search — поиск по Exercise.aliases[] (case-insensitive)
 * 3. auto-create  — INSERT Exercise с source: 'ai_generated'
 *
 * Всегда возвращает { exerciseId, exercise, resolvedBy }.
 */
import prisma from '../utils/prisma.js'

/** Превращает "Smith Machine Bench Press" → "smith-machine-bench-press" */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * @param {object} input
 * @param {string} [input.nameEn]  — английское название (основной ключ)
 * @param {string} [input.nameRu]  — русское название (fallback для alias-поиска)
 * @param {string} [input.slug]    — готовый slug (если есть)
 * @param {string[]} [input.primaryMuscles] — для auto-create
 * @param {string} [input.equipment]        — для auto-create
 * @returns {Promise<{ exerciseId: string, exercise: object, resolvedBy: 'slug'|'alias'|'auto-create' }>}
 */
export async function resolveExercise(input) {
  const { nameEn, nameRu, slug: inputSlug, primaryMuscles, equipment } = input

  // 1. Slug match
  const slug = inputSlug || (nameEn ? slugify(nameEn) : null)
  if (slug) {
    const bySlug = await prisma.exercise.findUnique({ where: { slug } })
    if (bySlug) {
      return { exerciseId: bySlug.id, exercise: bySlug, resolvedBy: 'slug' }
    }
  }

  // 2. Alias search — ищем в массиве aliases (case-insensitive)
  const searchTerms = [nameEn, nameRu].filter(Boolean)
  for (const term of searchTerms) {
    const lower = term.toLowerCase()

    // Prisma не поддерживает case-insensitive array search нативно,
    // используем raw-запрос с array_to_string + ILIKE
    const found = await prisma.$queryRaw`
      SELECT * FROM "Exercise"
      WHERE EXISTS (
        SELECT 1 FROM unnest(aliases) AS a
        WHERE lower(a) = ${lower}
      )
      LIMIT 1
    `

    if (found.length > 0) {
      const exercise = found[0]
      return { exerciseId: exercise.id, exercise, resolvedBy: 'alias' }
    }
  }

  // 3. Auto-create — создаём новое упражнение с source: 'ai_generated'
  const newSlug = slug || slugify(nameEn || nameRu || 'unknown')

  // Проверяем что slug не занят (может быть чуть другое написание)
  const existingSlug = await prisma.exercise.findUnique({ where: { slug: newSlug } })
  if (existingSlug) {
    return { exerciseId: existingSlug.id, exercise: existingSlug, resolvedBy: 'slug' }
  }

  const exercise = await prisma.exercise.create({
    data: {
      slug: newSlug,
      nameEn: nameEn || null,
      nameRu: nameRu || nameEn || newSlug,
      primaryMuscles: primaryMuscles || [],
      secondaryMuscles: [],
      equipment: equipment ? [equipment] : [],
      aliases: searchTerms.map(s => s.toLowerCase()),
      source: 'ai_generated',
    },
  })

  return { exerciseId: exercise.id, exercise, resolvedBy: 'auto-create' }
}
