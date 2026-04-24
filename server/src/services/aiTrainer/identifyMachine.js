/**
 * Сервис распознавания тренажёра по фото.
 *
 * Поток: фото (base64) → LLM vision → парсинг JSON → валидация Zod → БД → аналитика.
 *
 * Используется из бот-хэндлера on('photo').
 * Потенциально может использоваться из API-роута (мини-апп с камерой).
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'

import llm from '../../utils/llm.js'
import prisma from '../../utils/prisma.js'
import { track } from '../../utils/analytics.js'

// ─── 1. Загрузка промпта ────────────────────────────────────────────
// Промпт лежит в отдельном .md файле — удобно итерировать и версионировать.
// readFileSync вызывается один раз при импорте модуля, не на каждый запрос.
// В продакшне файл прочитается при старте процесса и закэшируется в памяти.

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPT = readFileSync(
  join(__dirname, 'prompts', 'identifyMachine.md'),
  'utf-8',
)

// ─── 2. Zod-схема для валидации ответа LLM ─────────────────────────
// LLM может вернуть что угодно — битый JSON, лишние поля, неверные типы.
// Zod гарантирует, что до БД и до пользователя дойдёт только валидная структура.
//
// .passthrough() на верхнем уровне не используем — берём только то, что знаем.
// Для массивов мышц — просто string[], без enum: LLM может назвать мышцу
// по-разному ("chest" vs "pectoralis"), и это нормально на MVP.

const exerciseSchema = z.object({
  name: z.string(),
  nameEn: z.string(),
  primaryMuscles: z.array(z.string()),
  description: z.string(),
  sets: z.string(),
  reps: z.string(),
})

const identificationSchema = z.object({
  machineName: z.string(),
  machineNameEn: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  suggestedExercises: z.array(exerciseSchema),
})

// ─── 3. Парсинг JSON из ответа LLM ─────────────────────────────────
// Даже с инструкцией "отвечай только JSON", LLM иногда добавляет
// markdown-обёртку ```json ... ``` или текст до/после.
// Эта функция пытается извлечь JSON в любом случае.

function parseJsonFromLLM(text) {
  // Попытка 1: весь текст — валидный JSON
  try {
    return JSON.parse(text)
  } catch {
    // продолжаем
  }

  // Попытка 2: JSON обёрнут в ```json ... ``` или ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // продолжаем
    }
  }

  // Попытка 3: ищем первый { ... } в тексте
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0])
    } catch {
      // ничего не помогло
    }
  }

  return null
}

// ─── 4. Основная функция ────────────────────────────────────────────

/**
 * Распознать тренажёр по фото.
 *
 * @param {string} userId — UUID пользователя из нашей БД
 * @param {string} imageBase64 — base64-строка изображения (без data: prefix)
 * @param {object} [options]
 * @param {string} [options.mediaType='image/jpeg']
 * @param {string} [options.telegramFileId] — file_id из Telegram (сохраняем как imageUrl)
 * @returns {Promise<object>} — результат распознавания
 */
export async function identifyMachine(userId, imageBase64, options = {}) {
  const { mediaType = 'image/jpeg', telegramFileId = '' } = options

  // ─── 4a. Вызов LLM Vision ──────────────────────────────────────
  // Передаём фото + промпт. maxTokens = 2048, потому что ответ с 3-4
  // упражнениями занимает ~500-800 токенов, плюс запас.
  const result = await llm.vision(imageBase64, PROMPT, {
    mediaType,
    maxTokens: 2048,
  })

  // ─── 4b. Парсинг JSON из текстового ответа LLM ─────────────────
  const parsed = parseJsonFromLLM(result.text)

  if (!parsed) {
    // LLM вернул нечто, из чего мы не смогли достать JSON.
    // Сохраняем как неудачную попытку — полезно для отладки промпта.
    console.error('[identifyMachine] failed to parse LLM response:', result.text)

    const record = await prisma.machineIdentification.create({
      data: {
        userId,
        imageUrl: telegramFileId,
        recognizedName: null,
        confidence: 0,
        suggestedExercises: [],
        model: result.model,
      },
    })

    track(userId, 'exercise_identification_failed', {
      machineId: record.id,
      reason: 'json_parse_error',
    })

    return {
      id: record.id,
      success: false,
      error: 'Не удалось обработать фото. Попробуй сфоткать тренажёр ближе и чётче.',
    }
  }

  // ─── 4c. Валидация через Zod ────────────────────────────────────
  // safeParse не бросает исключение — возвращает { success, data, error }
  const validation = identificationSchema.safeParse(parsed)

  if (!validation.success) {
    console.error('[identifyMachine] Zod validation failed:', validation.error.issues)

    const record = await prisma.machineIdentification.create({
      data: {
        userId,
        imageUrl: telegramFileId,
        recognizedName: parsed.machineName ?? null,
        confidence: 0,
        suggestedExercises: parsed.suggestedExercises ?? [],
        model: result.model,
      },
    })

    track(userId, 'exercise_identification_failed', {
      machineId: record.id,
      reason: 'validation_error',
    })

    return {
      id: record.id,
      success: false,
      error: 'Не удалось распознать тренажёр. Попробуй другой ракурс.',
    }
  }

  const data = validation.data

  // ─── 4d. Сохранение в БД ────────────────────────────────────────
  const record = await prisma.machineIdentification.create({
    data: {
      userId,
      imageUrl: telegramFileId,
      recognizedName: data.machineName,
      confidence: data.confidence,
      suggestedExercises: data.suggestedExercises,
      model: result.model,
    },
  })

  // ─── 4e. Аналитика (fire-and-forget) ───────────────────────────
  const isLowConfidence = data.confidence < 0.5

  track(userId, isLowConfidence ? 'exercise_identification_failed' : 'exercise_identified', {
    machineId: record.id,
    machineName: data.machineName,
    confidence: data.confidence,
    suggestedCount: data.suggestedExercises.length,
    model: result.model,
    tokensInput: result.usage?.input_tokens,
    tokensOutput: result.usage?.output_tokens,
  })

  // ─── 4f. Возврат результата ─────────────────────────────────────
  return {
    id: record.id,
    success: true,
    machineName: data.machineName,
    machineNameEn: data.machineNameEn,
    confidence: data.confidence,
    description: data.description,
    suggestedExercises: data.suggestedExercises,
    model: result.model,
  }
}
