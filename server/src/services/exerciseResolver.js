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
 * 2. name/alias   — точное совпадение с nameRu/nameEn/aliases[] (регистр, ё/е не важны; детерминированный порядок)
 * 3. auto-create  — INSERT Exercise с source: 'ai_generated'
 *
 * Возвращает { exerciseId, exercise, resolvedBy } или null, если из входа
 * не получается осмысленный slug (защита общего каталога от мусора).
 */
import prisma from '../utils/prisma.js'

// Транслитерация ru→lat для slugify: без неё кириллические названия
// ('Жим лёжа') коллапсировали в пустой slug '' — и все русские имена
// без nameEn склеивались в одно упражнение.
const RU_TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/** Превращает "Smith Machine Bench Press" → "smith-machine-bench-press", "Жим лёжа" → "zhim-lezha" */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => RU_TRANSLIT[ch] ?? '')
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
 * @returns {Promise<null | { exerciseId: string, exercise: object, resolvedBy: 'slug'|'alias'|'auto-create' }>}
 *          null — если из входа не получился валидный slug (упражнение не создаём)
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

  // 2. Name/alias search — точное совпадение с nameRu, nameEn или алиасом
  //    (регистр и ё/е не важны). Один алиас бывает у нескольких упражнений,
  //    поэтому порядок фиксирован: совпадение по названию → каталог (seed) →
  //    самое раннее. Иначе LIMIT 1 отдавал бы случайное.
  // Slug тоже ищем среди алиасов: у слитых дублей старый slug остаётся алиасом
  // канонического упражнения (scripts/mergeExercises.js), и LLM, помнящая
  // 'rfess-l-db', попадает в него, а не создаёт дубль заново.
  const searchTerms = [nameEn, nameRu].filter(Boolean)
  for (const term of [...searchTerms, inputSlug].filter(Boolean)) {
    const key = term.toLowerCase().replace(/ё/g, 'е').trim()

    const found = await prisma.$queryRaw`
      SELECT * FROM "Exercise"
      WHERE replace(lower("nameRu"), 'ё', 'е') = ${key}
        OR replace(lower(coalesce("nameEn", '')), 'ё', 'е') = ${key}
        OR EXISTS (
          SELECT 1 FROM unnest(aliases) AS a
          WHERE replace(lower(a), 'ё', 'е') = ${key}
        )
      ORDER BY
        (replace(lower("nameRu"), 'ё', 'е') = ${key}
          OR replace(lower(coalesce("nameEn", '')), 'ё', 'е') = ${key}) DESC,
        (source = 'seed') DESC,
        "createdAt", id
      LIMIT 1
    `

    if (found.length > 0) {
      const exercise = found[0]
      return { exerciseId: exercise.id, exercise, resolvedBy: 'alias' }
    }
  }

  // 3. Auto-create — создаём новое упражнение с source: 'ai_generated'
  const newSlug = slug || slugify(nameEn || nameRu || '')

  // Пустой slug (эмодзи, пунктуация, мусор от LLM) — не создаём упражнение:
  // каталог общий для всех юзеров, upsert по slug '' склеивал бы весь мусор в одну запись.
  if (!newSlug) return null

  // Проверяем что slug не занят (может быть чуть другое написание)
  const existingSlug = await prisma.exercise.findUnique({ where: { slug: newSlug } })
  if (existingSlug) {
    return { exerciseId: existingSlug.id, exercise: existingSlug, resolvedBy: 'slug' }
  }

  // upsert вместо create: check-then-create гоняется с параллельным резолвом
  // того же имени (P2002 на unique slug); upsert атомарен — при гонке вернёт существующее
  const exercise = await prisma.exercise.upsert({
    where: { slug: newSlug },
    update: {},
    create: {
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

/**
 * Батч-резолв: дедуплицирует входы и резолвит их параллельно чанками —
 * вместо последовательных await в цикле (N+1 запросов к БД при импорте/генерации).
 *
 * @param {Array<{slug?: string, nameEn?: string, nameRu?: string}>} inputs
 * @param {object} [opts]
 * @param {number} [opts.concurrency=8] — размер чанка (не выжирать connection pool)
 * @returns {Promise<Map<string, object|null>>} ключ — slug || nameEn || nameRu;
 *          значение — результат resolveExercise (null, если не зарезолвилось/упало)
 */
export async function resolveExercisesBatch(inputs, { concurrency = 8 } = {}) {
  const keyOf = (input) => input.slug || input.nameEn || input.nameRu || ''

  const unique = new Map()
  for (const input of inputs) {
    const key = keyOf(input)
    if (key && !unique.has(key)) unique.set(key, input)
  }

  const results = new Map()
  const entries = [...unique.entries()]
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency)
    const resolved = await Promise.all(
      chunk.map(([, input]) => resolveExercise(input).catch(() => null)),
    )
    chunk.forEach(([key], j) => results.set(key, resolved[j]))
  }
  return results
}
