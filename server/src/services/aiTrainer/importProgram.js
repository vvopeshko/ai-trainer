/**
 * Сервис импорта тренировочной программы из markdown через LLM.
 *
 * Поток: markdown-текст → промпт → llm.chat() → JSON → Zod → resolveExercise → БД.
 *
 * Используется из API: POST /api/v1/programs/import
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
  join(__dirname, 'prompts', 'importProgram.md'),
  'utf-8',
)

// ─── Zod-схема ответа LLM ───────────────────────────────────────────

const importExerciseSchema = z.object({
  slug: z.string(),
  nameRu: z.string(),
  sets: z.number().int().min(1).max(20),
  repsMin: z.number().int().min(1).max(100),
  repsMax: z.number().int().min(1).max(100),
  restSec: z.number().int().min(0).max(600).default(90),
  rir: z.string().optional(),
  notes: z.string().optional().default(''),
  alternatives: z.array(z.string()).optional().default([]),
})

const volumeTargetSchema = z.object({
  muscle: z.string(),
  sets: z.string(),
  note: z.string().optional().default(''),
})

const guidelinesSchema = z.object({
  volumeTargets: z.array(volumeTargetSchema).optional(),
  progression: z.string().optional(),
  deload: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  nutrition: z.string().optional(),
  schedule: z.string().optional(),
}).optional()

const importSchema = z.object({
  name: z.string(),
  description: z.string(),
  days: z.array(z.object({
    title: z.string(),
    durationMin: z.number().int().positive().optional(),
    notes: z.string().optional(),
    exercises: z.array(importExerciseSchema).min(1),
  })).min(1),
  guidelines: guidelinesSchema,
})

// ─── Основная функция ────────────────────────────────────────────────

/**
 * Импортировать тренировочную программу из markdown.
 *
 * @param {string} userId — UUID пользователя
 * @param {string} markdownText — текст программы в markdown
 * @returns {Promise<{ success: boolean, program?: object, error?: string }>}
 */
export async function importProgram(userId, markdownText) {
  // 1. Вызов LLM
  const result = await llm.chat(
    [{ role: 'user', content: markdownText }],
    {
      system: SYSTEM_PROMPT,
      maxTokens: 8192,
    },
  )

  // 2. Парсинг JSON
  const parsed = parseJsonFromLLM(result.text)

  if (!parsed) {
    console.error('[importProgram] failed to parse LLM response:', result.text.slice(0, 500))
    track(userId, 'program_import_failed', { reason: 'json_parse_error' })
    return { success: false, error: 'Не удалось распарсить программу. Попробуй ещё раз.' }
  }

  // 3. Zod-валидация
  const validation = importSchema.safeParse(parsed)

  if (!validation.success) {
    console.error('[importProgram] Zod validation failed:', validation.error.issues)
    track(userId, 'program_import_failed', { reason: 'validation_error' })
    return { success: false, error: 'Не удалось валидировать программу. Попробуй ещё раз.' }
  }

  const data = validation.data

  // 4. Привязка упражнений к БД через exerciseResolver
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
        ...(ex.rir && { rir: ex.rir }),
        notes: ex.notes,
        alternatives: ex.alternatives,
      })
    }
    resolvedDays.push({
      title: day.title,
      ...(day.durationMin && { durationMin: day.durationMin }),
      ...(day.notes && { notes: day.notes }),
      exercises: resolvedExercises,
    })
  }

  // 5. Сохранение программы
  const program = await prisma.program.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      durationWeeks: 4,
      isActive: false,
      planJson: { days: resolvedDays },
      guidelines: data.guidelines || null,
      generatedByModel: result.model,
    },
  })

  // 6. Аналитика
  track(userId, 'program_imported', {
    programId: program.id,
    name: data.name,
    daysCount: resolvedDays.length,
    totalExercises: resolvedDays.reduce((sum, d) => sum + d.exercises.length, 0),
    hasGuidelines: !!data.guidelines,
    model: result.model,
    tokensInput: result.usage?.input_tokens,
    tokensOutput: result.usage?.output_tokens,
  })

  return { success: true, program }
}
