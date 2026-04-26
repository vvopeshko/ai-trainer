/**
 * Полная настройка dev-окружения: создаёт dev-пользователя (telegramId=0)
 * с той же историей тренировок и программой, что и продовый аккаунт.
 *
 * Что делает:
 * 1. Upsert dev user (telegramId=0)
 * 2. Чистит старые данные dev user (sets → workouts → programs)
 * 3. Импортирует 60 тренировок из workouts.json
 * 4. Создаёт программу PPL+Arms
 * 5. Привязывает тренировки к программе
 *
 * Idempotent — можно запускать повторно (каждый раз чистит и пересоздаёт).
 *
 * Запуск: cd server && node scripts/seedDevData.js
 */
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
import { resolveExercise } from '../src/services/exerciseResolver.js'

const require = createRequire(import.meta.url)
const workoutsData = require('../../prototype/mock_data/workouts.json')

const prisma = new PrismaClient()

const DEV_TELEGRAM_ID = 0n

// ─── Дни PPL+Arms (из seedProgram.js) ────────────────────────────────────

const DAYS = [
  {
    title: 'Грудь + Трицепс',
    notesPrefix: '.1',
    exercises: [
      { slug: 'machine-chest-press', sets: 4, repsMin: 8, repsMax: 10, restSec: 120 },
      { slug: 'smith-machine-incline-bench-press', sets: 4, repsMin: 8, repsMax: 10, restSec: 120 },
      { slug: 'dip', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: 'machine-chest-fly', sets: 3, repsMin: 10, repsMax: 12, restSec: 60, alternatives: ['standing-cable-crossover'] },
      { slug: 'triceps-extension-rope', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'triceps-pulldown-rope', sets: 3, repsMin: 8, repsMax: 12, restSec: 60 },
      { slug: 'upright-row-cable', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'lateral-raise-machine', sets: 3, repsMin: 10, repsMax: 15, restSec: 60 },
      { slug: 'hanging-leg-raises', sets: 3, repsMin: 12, repsMax: 20, restSec: 45 },
      { slug: 'crunches', sets: 2, repsMin: 15, repsMax: 25, restSec: 45 },
    ],
  },
  {
    title: 'Спина + Бицепс',
    notesPrefix: '.2',
    exercises: [
      { slug: 'pull-up', sets: 4, repsMin: 4, repsMax: 8, restSec: 120 },
      { slug: 'seated-row', sets: 3, repsMin: 10, repsMax: 12, restSec: 90 },
      { slug: 'lat-pulldown-wide', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: 'incline-row-db', sets: 3, repsMin: 10, repsMax: 12, restSec: 90 },
      { slug: 'straight-arm-pulldown', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'hammer-curl-db', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'one-arm-biceps-curl-machine', sets: 3, repsMin: 12, repsMax: 16, restSec: 60, alternatives: ['biceps-curl-barbell'] },
      { slug: 'front-plank', sets: 1, repsMin: 30, repsMax: 60, restSec: 30 },
      { slug: 'side-plank-l-r', sets: 1, repsMin: 20, repsMax: 40, restSec: 30 },
      { slug: 'crunches', sets: 2, repsMin: 15, repsMax: 25, restSec: 45 },
    ],
  },
  {
    title: 'Ноги',
    notesPrefix: '.3',
    exercises: [
      { slug: 'leg-press', sets: 4, repsMin: 8, repsMax: 12, restSec: 120 },
      { slug: 'seated-leg-extension', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'prone-leg-curl', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'rfess-l-db', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: 'rfess-r-db', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: 'adductor-machine', sets: 3, repsMin: 10, repsMax: 15, restSec: 60 },
      { slug: 'machine-incline-press', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: 'bench-press-db', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: 'pec-fly', sets: 3, repsMin: 12, repsMax: 15, restSec: 60 },
      { slug: 'hanging-leg-raises', sets: 2, repsMin: 12, repsMax: 20, restSec: 45 },
      { slug: 'crunches', sets: 1, repsMin: 15, repsMax: 25, restSec: 45 },
    ],
  },
  {
    title: 'Плечи + Руки',
    notesPrefix: '.4',
    exercises: [
      { slug: 'lat-pulldown-narrow', sets: 3, repsMin: 10, repsMax: 12, restSec: 90 },
      { slug: 'seated-row-wide', sets: 3, repsMin: 10, repsMax: 12, restSec: 90 },
      { slug: 'chin-up', sets: 3, repsMin: 4, repsMax: 8, restSec: 90 },
      { slug: 'cable-face-pull', sets: 3, repsMin: 12, repsMax: 15, restSec: 60 },
      { slug: 'lateral-raise-machine', sets: 3, repsMin: 10, repsMax: 15, restSec: 60 },
      { slug: 'machine-shoulder-fly', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'biceps-curl-cable', sets: 3, repsMin: 10, repsMax: 12, restSec: 60 },
      { slug: 'biceps-curl-db', sets: 1, repsMin: 21, repsMax: 21, restSec: 60 },
      { slug: 'reverse-curl-barbell', sets: 2, repsMin: 8, repsMax: 12, restSec: 60 },
      { slug: 'crunches', sets: 2, repsMin: 20, repsMax: 30, restSec: 45 },
    ],
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SEED DEV DATA ===\n')

  // 1. Upsert dev user
  const user = await prisma.user.upsert({
    where: { telegramId: DEV_TELEGRAM_ID },
    create: {
      telegramId: DEV_TELEGRAM_ID,
      firstName: 'Dev',
      lastName: 'User',
      username: 'dev_user',
      languageCode: 'ru',
    },
    update: {},
  })
  console.log(`👤 Dev user: ${user.firstName} ${user.lastName} (${user.id})\n`)

  // 2. Чистим старые данные
  const deletedSets = await prisma.workoutSet.deleteMany({ where: { workout: { userId: user.id } } })
  const deletedWorkouts = await prisma.workout.deleteMany({ where: { userId: user.id } })
  const deletedPrograms = await prisma.program.deleteMany({ where: { userId: user.id } })
  console.log(`🧹 Cleaned: ${deletedSets.count} sets, ${deletedWorkouts.count} workouts, ${deletedPrograms.count} programs\n`)

  // 3. Resolve упражнения
  console.log('=== RESOLVING EXERCISES ===\n')
  const exerciseMap = new Map()

  for (const ex of workoutsData.exercises) {
    const result = await resolveExercise({ nameEn: ex.name, slug: ex.id })
    exerciseMap.set(ex.id, result.exerciseId)
  }
  console.log(`  Resolved: ${exerciseMap.size} exercises\n`)

  // 4. Импорт тренировок
  console.log('=== IMPORTING WORKOUTS ===\n')
  let workoutsCreated = 0
  let setsCreated = 0

  for (const w of workoutsData.workouts) {
    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        startedAt: new Date(`${w.date}T10:00:00Z`),
        finishedAt: new Date(`${w.date}T11:30:00Z`),
        notes: w.name,
      },
    })
    workoutsCreated++

    let exerciseOrder = 0
    for (const ex of w.exercises) {
      const exerciseId = exerciseMap.get(ex.id)
      if (!exerciseId) continue

      let setOrder = 0
      for (const set of ex.sets) {
        await prisma.workoutSet.create({
          data: {
            workoutId: workout.id,
            exerciseId,
            exerciseOrder,
            setOrder,
            weightKg: set.weightKg ?? null,
            reps: set.reps,
            completedAt: new Date(
              new Date(`${w.date}T10:00:00Z`).getTime() +
              exerciseOrder * 600000 + setOrder * 180000
            ),
          },
        })
        setOrder++
        setsCreated++
      }
      exerciseOrder++
    }
  }
  console.log(`  Workouts: ${workoutsCreated}, Sets: ${setsCreated}\n`)

  // 5. Создаём программу PPL+Arms
  console.log('=== CREATING PROGRAM ===\n')

  const allSlugs = new Set()
  for (const day of DAYS) {
    for (const ex of day.exercises) {
      allSlugs.add(ex.slug)
      if (ex.alternatives) ex.alternatives.forEach(a => allSlugs.add(a))
    }
  }

  const exercises = await prisma.exercise.findMany({
    where: { slug: { in: [...allSlugs] } },
    select: { id: true, slug: true, nameRu: true },
  })
  const slugMap = Object.fromEntries(exercises.map(e => [e.slug, e]))

  const missing = [...allSlugs].filter(s => !slugMap[s])
  if (missing.length > 0) {
    console.error(`❌ Missing exercises: ${missing.join(', ')}`)
    console.error('Run seedExercises.js first.')
    process.exit(1)
  }

  const planJson = {
    days: DAYS.map(day => ({
      title: day.title,
      exercises: day.exercises.map(ex => {
        const dbEx = slugMap[ex.slug]
        return {
          exerciseId: dbEx.id,
          slug: ex.slug,
          nameRu: dbEx.nameRu,
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          restSec: ex.restSec,
          ...(ex.alternatives && {
            alternatives: ex.alternatives.map(altSlug => slugMap[altSlug].id),
          }),
        }
      }),
    })),
  }

  const program = await prisma.program.create({
    data: {
      userId: user.id,
      name: 'PPL+Arms',
      description: '4-дневный сплит: Push, Pull, Legs, Shoulders+Arms',
      durationWeeks: 0,
      isActive: true,
      planJson,
    },
  })
  console.log(`  Program: ${program.name} (${program.id})`)

  // 6. Привязать тренировки к программе
  let linked = 0
  for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
    const prefix = DAYS[dayIndex].notesPrefix
    const result = await prisma.workout.updateMany({
      where: {
        userId: user.id,
        notes: { startsWith: prefix },
        programId: null,
      },
      data: {
        programId: program.id,
        programDayIndex: dayIndex,
      },
    })
    linked += result.count
  }
  console.log(`  Linked workouts: ${linked}\n`)

  // Итог
  console.log('=== DEV DATA READY ===')
  console.log(`  User:     ${user.firstName} (telegramId=${DEV_TELEGRAM_ID})`)
  console.log(`  Workouts: ${workoutsCreated}`)
  console.log(`  Sets:     ${setsCreated}`)
  console.log(`  Program:  PPL+Arms (${DAYS.length} days)`)
  console.log(`\nОткрой http://localhost:5173 — dev_bypass подхватит этого юзера.`)
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
