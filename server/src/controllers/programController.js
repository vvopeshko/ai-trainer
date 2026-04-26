import prisma from '../utils/prisma.js'

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
