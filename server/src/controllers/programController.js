import { z } from 'zod'
import prisma from '../utils/prisma.js'
import { importProgram } from '../services/aiTrainer/importProgram.js'

/**
 * GET /api/v1/programs
 *
 * Список всех программ юзера.
 */
export async function listPrograms(req, res) {
  const programs = await prisma.program.findMany({
    where: { userId: req.user.id },
    select: {
      id: true,
      name: true,
      description: true,
      durationWeeks: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ programs })
}

/**
 * GET /api/v1/programs/active
 *
 * Активная программа текущего юзера.
 */
export async function getActive(req, res) {
  const program = await prisma.program.findFirst({
    where: { userId: req.user.id, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      durationWeeks: true,
      planJson: true,
    },
  })

  res.json({ program })
}

/**
 * GET /api/v1/programs/active/next-workout
 *
 * Следующая тренировка по программе. Определяется по последней завершённой.
 */
export async function getNextWorkout(req, res) {
  const program = await prisma.program.findFirst({
    where: { userId: req.user.id, isActive: true },
    select: { id: true, planJson: true },
  })

  if (!program) {
    return res.json({ day: null })
  }

  const days = program.planJson.days
  if (!days || days.length === 0) {
    return res.json({ day: null })
  }

  // Последняя завершённая тренировка этой программы
  const lastWorkout = await prisma.workout.findFirst({
    where: {
      userId: req.user.id,
      programId: program.id,
      finishedAt: { not: null },
      programDayIndex: { not: null },
    },
    orderBy: { finishedAt: 'desc' },
    select: { programDayIndex: true },
  })

  const nextDayIndex = lastWorkout
    ? (lastWorkout.programDayIndex + 1) % days.length
    : 0

  res.json({
    programId: program.id,
    day: days[nextDayIndex],
    dayIndex: nextDayIndex,
    totalDays: days.length,
  })
}

/**
 * Обогащает planJson данными из Exercise (primaryMuscles, secondaryMuscles, equipment).
 * Используется в getProgram и importProgramHandler.
 */
export async function enrichPlanExercises(planJson) {
  const exerciseIds = []
  for (const day of planJson?.days || []) {
    for (const ex of day.exercises || []) {
      if (ex.exerciseId) exerciseIds.push(ex.exerciseId)
    }
  }

  const exercises = exerciseIds.length > 0
    ? await prisma.exercise.findMany({
        where: { id: { in: [...new Set(exerciseIds)] } },
        select: { id: true, primaryMuscles: true, secondaryMuscles: true, equipment: true },
      })
    : []

  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]))

  return {
    ...planJson,
    days: (planJson?.days || []).map(day => ({
      ...day,
      exercises: (day.exercises || []).map(ex => {
        const info = exerciseMap[ex.exerciseId]
        return {
          ...ex,
          primaryMuscles: info?.primaryMuscles || [],
          secondaryMuscles: info?.secondaryMuscles || [],
          equipment: info?.equipment || [],
        }
      }),
    })),
  }
}

/**
 * GET /api/v1/programs/:id
 *
 * Полная программа с обогащёнными данными упражнений (primaryMuscles, equipment).
 */
export async function getProgram(req, res) {
  const program = await prisma.program.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  })

  if (!program) {
    return res.status(404).json({ error: 'Program not found' })
  }

  const enrichedPlanJson = await enrichPlanExercises(program.planJson)

  res.json({
    program: {
      id: program.id,
      name: program.name,
      description: program.description,
      durationWeeks: program.durationWeeks,
      isActive: program.isActive,
      planJson: enrichedPlanJson,
      guidelines: program.guidelines,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    },
  })
}

/**
 * PATCH /api/v1/programs/:id
 *
 * Обновление программы (название, planJson).
 */
const planExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  slug: z.string(),
  nameRu: z.string(),
  sets: z.number().int().positive(),
  repsMin: z.number().int().positive(),
  repsMax: z.number().int().positive(),
  restSec: z.number().int().nonnegative().default(90),
  rir: z.string().optional(),
  notes: z.string().optional(),
  alternatives: z.array(z.string()).default([]),
})

const updateProgramSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  planJson: z.object({
    days: z.array(z.object({
      title: z.string(),
      durationMin: z.number().int().positive().optional(),
      notes: z.string().optional(),
      exercises: z.array(planExerciseSchema),
    })),
  }).optional(),
  guidelines: z.record(z.unknown()).nullable().optional(),
}).refine(d => d.name || d.planJson || d.guidelines !== undefined, { message: 'Nothing to update' })

export async function updateProgram(req, res) {
  const data = updateProgramSchema.parse(req.body)

  const program = await prisma.program.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  })

  if (!program) {
    return res.status(404).json({ error: 'Program not found' })
  }

  const updated = await prisma.program.update({
    where: { id: program.id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.planJson && { planJson: data.planJson }),
      ...(data.guidelines !== undefined && { guidelines: data.guidelines }),
    },
  })

  res.json({
    program: {
      id: updated.id,
      name: updated.name,
      planJson: updated.planJson,
      guidelines: updated.guidelines,
      updatedAt: updated.updatedAt,
    },
  })
}

/**
 * POST /api/v1/programs/:id/activate
 *
 * Сделать программу активной (деактивировать остальные).
 */
export async function activateProgram(req, res) {
  const program = await prisma.program.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  })

  if (!program) {
    return res.status(404).json({ error: 'Program not found' })
  }

  await prisma.$transaction([
    prisma.program.updateMany({
      where: { userId: req.user.id, isActive: true },
      data: { isActive: false },
    }),
    prisma.program.update({
      where: { id: program.id },
      data: { isActive: true },
    }),
  ])

  res.json({ ok: true })
}

/**
 * POST /api/v1/programs/import
 *
 * Импорт программы из markdown-текста через LLM.
 */
const importBodySchema = z.object({
  text: z.string().min(100),
})

export async function importProgramHandler(req, res) {
  const { text } = importBodySchema.parse(req.body)

  const result = await importProgram(req.user.id, text)

  if (!result.success) {
    return res.status(422).json({ error: result.error })
  }

  const enrichedPlanJson = await enrichPlanExercises(result.program.planJson)

  res.json({
    program: {
      id: result.program.id,
      name: result.program.name,
      description: result.program.description,
      durationWeeks: result.program.durationWeeks,
      isActive: result.program.isActive,
      planJson: enrichedPlanJson,
      guidelines: result.program.guidelines,
      createdAt: result.program.createdAt,
      updatedAt: result.program.updatedAt,
    },
  })
}
