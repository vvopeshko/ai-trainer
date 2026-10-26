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
 * 3. match        — похожие упражнения каталога + LLM (exerciseMatcher.js): то же
 *                   упражнение под другим названием → оно, а название запоминается
 *                   алиасом (в следующий раз сработает шаг 2 без LLM)
 * 4. auto-create  — INSERT Exercise с source: 'ai_generated', размеченное LLM
 *                   (мышцы, оборудование, целевая мышца…); без LLM — как есть
 *
 * Возвращает { exerciseId, exercise, resolvedBy } или null, если из входа
 * не получается осмысленный slug (защита общего каталога от мусора).
 */
import prisma from '../utils/prisma.js'
import { matchUnknownExercises, forgetCatalog } from './exerciseMatcher.js'
import { forgetCatalogResponse } from './exerciseCatalog.js'

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

const normKey = s => s.toLowerCase().replace(/ё/g, 'е').trim()

/** Шаги 1–2: точное совпадение по slug, названию или алиасу. */
async function findExisting(input) {
  const { nameEn, nameRu, slug: inputSlug } = input

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
  for (const term of [nameEn, nameRu, inputSlug].filter(Boolean)) {
    const key = normKey(term)

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
  return null
}

/** Slug нового упражнения; '' — вход мусорный (эмодзи, пунктуация), не создаём. */
const newSlugOf = (input, fields) => input.slug || slugify(input.nameEn || fields?.nameEn || input.nameRu || '')

/** Шаг 3: LLM узнала упражнение — запоминаем названия входа его алиасами. */
async function learnAliases(exercise, input) {
  const known = new Set([exercise.nameRu, exercise.nameEn, ...(exercise.aliases ?? [])].filter(Boolean).map(normKey))
  const add = [...new Set([input.nameRu, input.nameEn, input.slug].filter(Boolean).map(t => t.trim().toLowerCase()))]
    .filter(t => !known.has(normKey(t)))
  if (!add.length) return exercise
  forgetCatalog()
  forgetCatalogResponse()
  return prisma.exercise.update({ where: { id: exercise.id }, data: { aliases: { push: add } } })
}

/** Шаг 4: новое упражнение — с разметкой от LLM (fields) или как есть. */
async function createExercise(input, fields) {
  const { nameEn, nameRu, primaryMuscles, equipment } = input
  const newSlug = newSlugOf(input, fields)
  if (!newSlug) return null

  // Проверяем что slug не занят (может быть чуть другое написание)
  const existingSlug = await prisma.exercise.findUnique({ where: { slug: newSlug } })
  if (existingSlug) {
    return { exerciseId: existingSlug.id, exercise: existingSlug, resolvedBy: 'slug' }
  }

  const searchTerms = [nameEn, nameRu].filter(Boolean)
  const tool = fields?.equipment ?? equipment
  // upsert вместо create: check-then-create гоняется с параллельным резолвом
  // того же имени (P2002 на unique slug); upsert атомарен — при гонке вернёт существующее
  const exercise = await prisma.exercise.upsert({
    where: { slug: newSlug },
    update: {},
    create: {
      slug: newSlug,
      nameEn: nameEn || fields?.nameEn || null,
      nameRu: fields?.nameRu || nameRu || nameEn || newSlug,
      primaryMuscles: fields?.primaryMuscles?.length ? fields.primaryMuscles : primaryMuscles || [],
      secondaryMuscles: fields?.secondaryMuscles ?? [],
      equipment: tool ? [tool] : [],
      ...(fields?.category && { category: fields.category }),
      ...(fields && { targetMuscle: fields.targetMuscle ?? null, force: fields.force ?? null, unilateral: fields.unilateral ?? null }),
      aliases: [...new Set([...searchTerms, input.slug].filter(Boolean).map(s => s.toLowerCase()))]
        .filter(a => normKey(a) !== normKey(fields?.nameRu || nameRu || '')),
      source: 'ai_generated',
    },
  })
  forgetCatalog()
  forgetCatalogResponse()

  return { exerciseId: exercise.id, exercise, resolvedBy: 'auto-create' }
}

/** Шаги 3–4 для того, что не нашлось точно; decision — ответ exerciseMatcher. */
async function resolveUnknown(input, decision) {
  if (decision?.match) {
    const exercise = await learnAliases(decision.match, input)
    return { exerciseId: exercise.id, exercise, resolvedBy: 'match' }
  }
  return createExercise(input, decision?.fields)
}

/**
 * @param {object} input
 * @param {string} [input.nameEn]  — английское название (основной ключ)
 * @param {string} [input.nameRu]  — русское название (fallback для alias-поиска)
 * @param {string} [input.slug]    — готовый slug (если есть)
 * @param {string[]} [input.primaryMuscles] — для auto-create без LLM
 * @param {string} [input.equipment]        — для auto-create без LLM
 * @returns {Promise<null | { exerciseId: string, exercise: object, resolvedBy: 'slug'|'alias'|'match'|'auto-create' }>}
 *          null — если из входа не получился валидный slug (упражнение не создаём)
 */
export async function resolveExercise(input) {
  const existing = await findExisting(input)
  if (existing) return existing
  if (!newSlugOf(input)) return null
  const decisions = await matchUnknownExercises([['1', input]])
  return resolveUnknown(input, decisions.get('1'))
}

/**
 * Батч-резолв: дедуплицирует входы и резолвит их параллельно чанками —
 * вместо последовательных await в цикле (N+1 запросов к БД при импорте/генерации);
 * всё ненайденное сопоставляется одним вызовом LLM на батч.
 *
 * @param {Array<{slug?: string, nameEn?: string, nameRu?: string}>} inputs
 * @param {object} [opts]
 * @param {number} [opts.concurrency=8] — размер чанка (не выжирать connection pool)
 * @returns {Promise<Map<string, object|null>>} ключ — slug || nameEn || nameRu;
 *          значение — результат resolveExercise (null, если не зарезолвилось/упало)
 */
const FAILED = Symbol('failed')

export async function resolveExercisesBatch(inputs, { concurrency = 8 } = {}) {
  const keyOf = (input) => input.slug || input.nameEn || input.nameRu || ''

  const unique = new Map()
  for (const input of inputs) {
    const key = keyOf(input)
    if (key && !unique.has(key)) unique.set(key, input)
  }

  const results = new Map()
  const entries = [...unique.entries()]
  const misses = []
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency)
    // Упавший поиск — не «не нашлось»: иначе ошибка БД создавала бы дубль.
    const found = await Promise.all(chunk.map(([, input]) => findExisting(input).catch(() => FAILED)))
    chunk.forEach(([key, input], j) => {
      if (found[j] && found[j] !== FAILED) results.set(key, found[j])
      else if (!found[j] && newSlugOf(input)) misses.push([key, input])
      else results.set(key, null)
    })
  }

  // Всё, что не нашлось точно, — одним вызовом LLM на батч, а не по одному.
  const decisions = await matchUnknownExercises(misses)
  for (let i = 0; i < misses.length; i += concurrency) {
    const chunk = misses.slice(i, i + concurrency)
    const resolved = await Promise.all(chunk.map(([key, input]) => resolveUnknown(input, decisions.get(key)).catch(() => null)))
    chunk.forEach(([key], j) => results.set(key, resolved[j]))
  }
  return results
}
