/**
 * Seed-скрипт: загружает обогащённые упражнения в таблицу Exercise.
 *
 * Источник: server/data/enriched-exercises.json (57 упр.)
 * Данные получены из Free Exercise DB + ExerciseDB OSS + ручная русификация.
 *
 * Upsert по slug — можно перезапускать безопасно.
 *
 * Запуск: cd server && node scripts/seedExercises.js
 */
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
const exercises = require('../data/enriched-exercises.json')

const prisma = new PrismaClient()

// ─── Маппинг JSON → Prisma ───────────────────────────────────────────

/** Free Exercise DB level → Prisma ExerciseDifficulty */
function mapDifficulty(level) {
  if (level === 'expert') return 'advanced'
  if (['beginner', 'intermediate', 'advanced'].includes(level)) return level
  return 'beginner'
}

/** Free Exercise DB mechanic → Prisma ExerciseCategory */
function mapCategory(mechanic) {
  if (['compound', 'isolation'].includes(mechanic)) return mechanic
  return 'compound'
}

function mapExercise(ex) {
  return {
    slug: ex.slug,
    nameRu: ex.nameRu,
    nameEn: ex.nameEn,
    instructions: Array.isArray(ex.instructions)
      ? ex.instructions.join('\n\n')
      : ex.instructions || null,
    primaryMuscles: ex.primaryMuscles || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    equipment: ex.equipment ? [ex.equipment] : [],
    difficulty: mapDifficulty(ex.level),
    category: mapCategory(ex.mechanic),
    imageUrl: ex.images?.[0] || null,
    gifUrl: ex.gifUrl || null,
    aliases: ex.aliases || [],
    source: 'seed',
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${exercises.length} exercises...\n`)

  let created = 0
  let updated = 0

  for (const raw of exercises) {
    const data = mapExercise(raw)

    const result = await prisma.exercise.upsert({
      where: { slug: data.slug },
      create: data,
      update: data,
    })

    // upsert не сообщает create vs update напрямую,
    // но createdAt === updatedAt значит create
    const isNew = result.createdAt.getTime() === result.updatedAt.getTime()
    if (isNew) created++
    else updated++

    console.log(`  ${isNew ? '+' : '~'} ${data.slug} (${data.nameRu})`)
  }

  console.log(`\n=== SEED COMPLETE ===`)
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Total in DB: ${await prisma.exercise.count()}`)
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
