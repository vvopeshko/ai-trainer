/**
 * Seed-скрипт: создаёт программу PPL+Arms из исторических данных.
 *
 * - Собирает planJson из реальных упражнений в БД (по slug)
 * - Привязывает существующие Workout к программе по полю notes
 * - Idempotent: пропускает если программа уже есть
 *
 * Запуск: cd server && node scripts/seedProgram.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Определение дней PPL+Arms ─────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Найти юзера (dev_bypass = telegramId 0, или первый доступный)
  let user = await prisma.user.findFirst({ where: { telegramId: 0n } })
  if (!user) {
    user = await prisma.user.findFirst()
  }
  if (!user) {
    console.error('❌ No users in DB. Run the app first to create a user.')
    process.exit(1)
  }
  console.log(`👤 User: ${user.firstName} (${user.id})`)

  // Проверить идемпотентность
  const existing = await prisma.program.findFirst({
    where: { userId: user.id, name: 'PPL+Arms' },
  })
  if (existing) {
    console.log('⏭️  Program "PPL+Arms" already exists, skipping.')
    return
  }

  // Собрать все slug → exerciseId
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

  // Проверить что все slug найдены
  const missing = [...allSlugs].filter(s => !slugMap[s])
  if (missing.length > 0) {
    console.error(`❌ Missing exercises: ${missing.join(', ')}`)
    console.error('Run seedExercises.js first.')
    process.exit(1)
  }

  // Собрать planJson
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

  // Создать программу
  const program = await prisma.program.create({
    data: {
      userId: user.id,
      name: 'PPL+Arms',
      description: '4-дневный сплит: Push, Pull, Legs, Shoulders+Arms',
      durationWeeks: 0, // бессрочная
      isActive: true,
      planJson,
    },
  })
  console.log(`✅ Program created: ${program.id}`)

  // Привязать существующие тренировки
  const prefixes = DAYS.map(d => d.notesPrefix)
  let linked = 0

  for (let dayIndex = 0; dayIndex < prefixes.length; dayIndex++) {
    const prefix = prefixes[dayIndex]
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
    console.log(`  Day ${dayIndex} ("${prefix}*"): ${result.count} workouts linked`)
  }

  console.log(`🔗 Total workouts linked: ${linked}`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
