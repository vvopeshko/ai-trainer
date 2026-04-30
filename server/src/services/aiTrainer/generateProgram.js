/**
 * Сервис генерации тренировочной программы через LLM.
 *
 * Поток: профиль + список упражнений → промпт → llm.chat() → JSON → Zod → resolveExercise → БД.
 *
 * Используется из бот-сцены /program и потенциально из API.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'

import llm from '../../utils/llm.js'
import prisma from '../../utils/prisma.js'
import { track } from '../../utils/analytics.js'
import { parseJsonFromLLM } from '../../utils/parseJsonFromLLM.js'
import { resolveExercise } from '../exerciseResolver.js'

// ─── Загрузка промпта ────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'generateProgram.md'),
  'utf-8',
)

// ─── Zod-схема ответа LLM ───────────────────────────────────────────

const programExerciseSchema = z.object({
  slug: z.string(),
  nameRu: z.string(),
  sets: z.number().int().min(1).max(10),
  repsMin: z.number().int().min(1).max(100),
  repsMax: z.number().int().min(1).max(100),
  restSec: z.number().int().min(0).max(600).default(90),
  notes: z.string().optional().default(''),
  alternatives: z.array(z.string()).optional().default([]),
})

const programSchema = z.object({
  name: z.string(),
  description: z.string(),
  days: z.array(z.object({
    title: z.string(),
    exercises: z.array(programExerciseSchema).min(1),
  })).min(1),
})

// ─── Маппинг оборудования ────────────────────────────────────────────

const EQUIPMENT_PRESETS = {
  gym: null, // все упражнения
  home: ['body only', 'dumbbell', 'bands', 'exercise ball', 'kettlebells', 'foam roll'],
  minimal: ['body only', 'dumbbell'],
}

// ─── Формирование user-промпта ───────────────────────────────────────

function buildUserPrompt(profile, exercises) {
  const goalLabels = {
    muscle_gain: 'Набор мышечной массы',
    strength: 'Развитие силы',
    weight_loss: 'Снижение веса',
    tone: 'Тонус и рельеф',
    endurance: 'Выносливость',
    general_fitness: 'Общая физическая форма',
  }

  const levelLabels = {
    beginner: 'Новичок',
    intermediate: 'Средний',
    advanced: 'Продвинутый',
  }

  // Компактный список упражнений: slug | nameRu | muscles | equipment
  const exerciseList = exercises
    .map(ex => `${ex.slug} | ${ex.nameRu} | ${ex.primaryMuscles.join(',')} | ${ex.equipment.join(',')}`)
    .join('\n')

  return `## Профиль пользователя

- Цель: ${goalLabels[profile.goal] || profile.goal}
- Уровень: ${levelLabels[profile.experienceLevel] || profile.experienceLevel}
- Дней в неделю: ${profile.sessionsPerWeek || profile.availableDays?.length || 3}
- Оборудование: ${profile.equipmentPreset || 'полный зал'}
- Ограничения: ${profile.constraints?.length ? profile.constraints.join(', ') : 'нет'}

## Доступные упражнения (slug | nameRu | muscles | equipment)

${exerciseList}`
}

// ─── Основная функция ────────────────────────────────────────────────

/**
 * Сгенерировать тренировочную программу.
 *
 * @param {string} userId — UUID пользователя
 * @param {object} profile — профиль: goal, experienceLevel, sessionsPerWeek, equipmentPreset, constraints
 * @returns {Promise<{ success: boolean, program?: object, summary?: string, error?: string }>}
 */
export async function generateProgram(userId, profile) {
  // 1. Получить список упражнений с фильтрацией по оборудованию
  const equipmentFilter = EQUIPMENT_PRESETS[profile.equipmentPreset]

  const exercises = await prisma.exercise.findMany({
    where: equipmentFilter
      ? { equipment: { hasSome: equipmentFilter } }
      : undefined,
    select: {
      slug: true,
      nameRu: true,
      primaryMuscles: true,
      equipment: true,
      category: true,
    },
    orderBy: { slug: 'asc' },
  })

  if (exercises.length === 0) {
    return { success: false, error: 'Нет упражнений в базе. Запустите seed.' }
  }

  // 2. Вызов LLM
  const userPrompt = buildUserPrompt(profile, exercises)

  const result = await llm.chat(
    [{ role: 'user', content: userPrompt }],
    {
      system: SYSTEM_PROMPT,
      maxTokens: 4096,
    },
  )

  // 3. Парсинг JSON
  const parsed = parseJsonFromLLM(result.text)

  if (!parsed) {
    console.error('[generateProgram] failed to parse LLM response:', result.text.slice(0, 500))
    track(userId, 'program_generation_failed', { reason: 'json_parse_error' })
    return { success: false, error: 'Не удалось сгенерировать программу. Попробуй ещё раз.' }
  }

  // 4. Zod-валидация
  const validation = programSchema.safeParse(parsed)

  if (!validation.success) {
    console.error('[generateProgram] Zod validation failed:', validation.error.issues)
    track(userId, 'program_generation_failed', { reason: 'validation_error' })
    return { success: false, error: 'Не удалось сгенерировать программу. Попробуй ещё раз.' }
  }

  const data = validation.data

  // 5. Привязка упражнений к БД через exerciseResolver
  const resolvedDays = []
  for (const day of data.days) {
    const resolvedExercises = []
    for (const ex of day.exercises) {
      const resolved = await resolveExercise({
        slug: ex.slug,
        nameRu: ex.nameRu,
      })
      resolvedExercises.push({
        exerciseId: resolved.exerciseId,
        slug: ex.slug,
        nameRu: ex.nameRu,
        sets: ex.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        restSec: ex.restSec,
        notes: ex.notes,
        alternatives: ex.alternatives,
      })
    }
    resolvedDays.push({
      title: day.title,
      exercises: resolvedExercises,
    })
  }

  // 6. Сохранение программы (isActive: false — юзер сам активирует)
  const program = await prisma.program.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      durationWeeks: 4,
      isActive: false,
      planJson: { days: resolvedDays },
      generatedByModel: result.model,
    },
  })

  // 7. Аналитика
  track(userId, 'program_generated', {
    programId: program.id,
    name: data.name,
    daysCount: resolvedDays.length,
    totalExercises: resolvedDays.reduce((sum, d) => sum + d.exercises.length, 0),
    model: result.model,
    tokensInput: result.usage?.input_tokens,
    tokensOutput: result.usage?.output_tokens,
  })

  // 8. Формирование краткого описания для бота
  const daysSummary = resolvedDays
    .map(d => `${d.title} (${d.exercises.length} упр.)`)
    .join('\n')

  const summary = `📋 ${data.name}\n${resolvedDays.length} дней в неделю\n\n${daysSummary}`

  return { success: true, program, summary }
}
