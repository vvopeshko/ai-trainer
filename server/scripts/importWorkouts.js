/**
 * Import исторических тренировок из prototype/mock_data/workouts.json.
 *
 * Две цели:
 * 1. Валидация resolve-слоя — 57 упражнений проходят через resolveExercise(),
 *    видим покрытие: slug / alias / auto-create.
 * 2. Данные для разработки — 60 тренировок для Home/Progress/Stats экранов.
 *
 * Привязывает всё к userId из аргумента или ADMIN_TELEGRAM_ID.
 *
 * Запуск: cd server && node scripts/importWorkouts.js [--user-id UUID]
 */
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
import { resolveExercise } from '../src/services/exerciseResolver.js'

const require = createRequire(import.meta.url)
const data = require('../../prototype/mock_data/workouts.json')

const prisma = new PrismaClient()

// ─── Находим пользователя ─────────────────────────────────────────────

async function getTargetUserId() {
  // Аргумент --user-id UUID
  const idx = process.argv.indexOf('--user-id')
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }

  // ADMIN_TELEGRAM_ID из env → найти User по telegramId
  const adminId = process.env.ADMIN_TELEGRAM_ID
  if (adminId) {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(adminId) },
    })
    if (user) return user.id
    console.error(`User with telegramId=${adminId} not found. Send /start to bot first.`)
    process.exit(1)
  }

  // Dev-bypass user
  const devUser = await prisma.user.findFirst()
  if (devUser) {
    console.log(`Using first user in DB: ${devUser.firstName} (${devUser.id})`)
    return devUser.id
  }

  console.error('No user found. Send /start to bot first, or pass --user-id.')
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const userId = await getTargetUserId()
  console.log(`Importing for userId: ${userId}\n`)

  // ── Шаг 1: Resolve все 57 упражнений ──

  const resolveReport = { slug: 0, alias: 0, 'auto-create': 0 }
  const exerciseMap = new Map() // workouts.json exercise.id → exerciseId (UUID)

  console.log('=== RESOLVING EXERCISES ===\n')
  for (const ex of data.exercises) {
    const result = await resolveExercise({
      nameEn: ex.name,
      slug: ex.id,
    })
    exerciseMap.set(ex.id, result.exerciseId)
    resolveReport[result.resolvedBy]++
    const mark = result.resolvedBy === 'slug' ? 'S' : result.resolvedBy === 'alias' ? 'A' : '+'
    console.log(`  [${mark}] ${ex.id} → ${result.exercise.nameRu} (${result.resolvedBy})`)
  }

  console.log(`\n=== RESOLVE REPORT ===`)
  console.log(`  By slug:        ${resolveReport.slug}/57`)
  console.log(`  By alias:       ${resolveReport.alias}/57`)
  console.log(`  Auto-created:   ${resolveReport['auto-create']}/57`)
  console.log(`  Total resolved: ${resolveReport.slug + resolveReport.alias + resolveReport['auto-create']}/57`)

  // ── Шаг 2: Импорт тренировок ──

  console.log(`\n=== IMPORTING WORKOUTS ===\n`)

  let workoutsCreated = 0
  let setsCreated = 0

  for (const w of data.workouts) {
    // Создаём тренировку
    const workout = await prisma.workout.create({
      data: {
        userId,
        startedAt: new Date(`${w.date}T10:00:00Z`),
        finishedAt: new Date(`${w.date}T11:30:00Z`),
        notes: w.name,
      },
    })
    workoutsCreated++

    // Создаём подходы
    let exerciseOrder = 0
    for (const ex of w.exercises) {
      const exerciseId = exerciseMap.get(ex.id)
      if (!exerciseId) {
        console.error(`  ! Exercise ${ex.id} not resolved, skipping`)
        continue
      }

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
            completedAt: new Date(new Date(`${w.date}T10:00:00Z`).getTime() + exerciseOrder * 600000 + setOrder * 180000),
          },
        })
        setOrder++
        setsCreated++
      }
      exerciseOrder++
    }

    console.log(`  ${w.date} "${w.name}" — ${w.exercises.length} exercises, ${w.exercises.reduce((s, e) => s + e.sets.length, 0)} sets`)
  }

  console.log(`\n=== IMPORT COMPLETE ===`)
  console.log(`  Workouts: ${workoutsCreated}`)
  console.log(`  Sets:     ${setsCreated}`)
  console.log(`  DB totals:`)
  console.log(`    Exercises:   ${await prisma.exercise.count()}`)
  console.log(`    Workouts:    ${await prisma.workout.count()}`)
  console.log(`    WorkoutSets: ${await prisma.workoutSet.count()}`)
}

main()
  .catch(e => {
    console.error('Import failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
