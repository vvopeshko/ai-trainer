/**
 * Сервис импорта тренировочной программы из markdown через LLM.
 *
 * Два вызова LLM:
 * 1. Парсинг структуры (дни, упражнения) — maxTokens: 4096
 * 2. Парсинг guidelines (методические указания) — maxTokens: 2048
 *
 * Разделение нужно для стабильности: один большой вызов на 8192 токенов
 * может обрываться по таймауту.
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

// ─── Загрузка промптов ───────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROGRAM_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'importProgram.md'),
  'utf-8',
)

const GUIDELINES_PROMPT = readFileSync(
  join(__dirname, 'prompts', 'importGuidelines.md'),
  'utf-8',
)

// ─── Zod-схемы ──────────────────────────────────────────────────────

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

const programSchema = z.object({
  name: z.string(),
  description: z.string(),
  days: z.array(z.object({
    title: z.string(),
    durationMin: z.number().int().positive().optional(),
    notes: z.string().optional(),
    exercises: z.array(importExerciseSchema).min(1),
  })).min(1),
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
  const userMessage = [{ role: 'user', content: markdownText }]

  // 1. Два параллельных вызова LLM: структура + guidelines
  const [programResult, guidelinesResult] = await Promise.all([
    llm.chat(userMessage, { system: PROGRAM_PROMPT, maxTokens: 8192 }),
    llm.chat(userMessage, { system: GUIDELINES_PROMPT, maxTokens: 2048 }),
  ])

  // 2. Парсинг структуры программы
  const parsedProgram = parseJsonFromLLM(programResult.text)

  if (!parsedProgram) {
    console.error('[importProgram] failed to parse program response:', programResult.text.slice(0, 500))
    track(userId, 'program_import_failed', { reason: 'json_parse_error' })
    return { success: false, error: 'Не удалось распарсить программу. Попробуй ещё раз.' }
  }

  const programValidation = programSchema.safeParse(parsedProgram)

  if (!programValidation.success) {
    console.error('[importProgram] program validation failed:', programValidation.error.issues)
    track(userId, 'program_import_failed', { reason: 'validation_error' })
    return { success: false, error: 'Не удалось валидировать программу. Попробуй ещё раз.' }
  }

  // 3. Парсинг guidelines (best-effort — если не получилось, сохраним null)
  let guidelines = null
  const parsedGuidelines = parseJsonFromLLM(guidelinesResult.text)
  if (parsedGuidelines) {
    const guidelinesValidation = guidelinesSchema.safeParse(parsedGuidelines)
    if (guidelinesValidation.success) {
      guidelines = guidelinesValidation.data
    } else {
      console.warn('[importProgram] guidelines validation failed, skipping:', guidelinesValidation.error.issues)
    }
  }

  const data = programValidation.data

  // 4. Привязка упражнений к БД через exerciseResolver
  const resolvedDays = []
  for (const day of data.days) {
    const resolvedExercises = []
    for (const ex of day.exercises) {
      const resolved = await resolveExercise({
        slug: ex.slug,
        nameRu: ex.nameRu,
      })
      // Резолвим alternatives slug → exerciseId
      const resolvedAlts = []
      if (ex.alternatives?.length > 0) {
        for (const altSlug of ex.alternatives) {
          try {
            const alt = await resolveExercise({ slug: altSlug })
            resolvedAlts.push(alt.exerciseId)
          } catch { /* skip unresolved */ }
        }
      }

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
        alternatives: resolvedAlts,
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
      guidelines,
      generatedByModel: programResult.model,
    },
  })

  // 6. Аналитика
  track(userId, 'program_imported', {
    programId: program.id,
    name: data.name,
    daysCount: resolvedDays.length,
    totalExercises: resolvedDays.reduce((sum, d) => sum + d.exercises.length, 0),
    hasGuidelines: !!guidelines,
    model: programResult.model,
    tokensInput: (programResult.usage?.input_tokens || 0) + (guidelinesResult.usage?.input_tokens || 0),
    tokensOutput: (programResult.usage?.output_tokens || 0) + (guidelinesResult.usage?.output_tokens || 0),
  })

  return { success: true, program }
}
