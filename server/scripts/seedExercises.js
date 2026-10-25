/**
 * Seed-скрипт: загружает обогащённые упражнения в таблицу Exercise.
 *
 * Источник: server/data/enriched-exercises.json (924 упр.)
 * Данные получены из Free Exercise DB + ExerciseDB OSS + ручная русификация.
 *
 * По умолчанию создаёт недостающие упражнения (по slug) и у существующих
 * заполняет только пустые поля: GIF, найденные enrichProgramMedia (пишет
 * только в БД), и ручные правки на проде переживают повторный запуск.
 *
 * Запуск: cd server && node --env-file=.env scripts/seedExercises.js
 * Перезаписать конкретные поля существующих записей (новые не создаются):
 * node --env-file=.env scripts/seedExercises.js --only=category,difficulty
 * Только описания и ошибки (= --only=description,typicalMistakes):
 * node --env-file=.env scripts/seedExercises.js --content-only
 */
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
import { mapExercise, seedUpdate } from '../src/utils/exerciseSeed.js'

const require = createRequire(import.meta.url)
const exercises = require('../data/enriched-exercises.json')

const prisma = new PrismaClient()

function parseOnly(argv) {
  if (argv.includes('--content-only')) return ['description', 'typicalMistakes']
  const arg = argv.find(a => a.startsWith('--only='))
  if (!arg) return null
  const fields = arg.slice('--only='.length).split(',').map(f => f.trim()).filter(Boolean)
  const known = new Set(Object.keys(mapExercise(exercises[0])).concat('description', 'typicalMistakes'))
  const unknown = fields.filter(f => !known.has(f))
  if (!fields.length || unknown.length) throw new Error(`Unknown --only fields: ${unknown.join(', ') || '(empty)'}`)
  return fields
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const only = parseOnly(process.argv)
  console.log(`Seeding ${exercises.length} exercises${only ? ` (overwrite: ${only.join(', ')})` : ''}...\n`)

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const raw of exercises) {
    const data = mapExercise(raw)
    const existing = await prisma.exercise.findUnique({ where: { slug: data.slug } })

    if (!existing) {
      if (only) continue
      await prisma.exercise.create({ data })
      created++
      console.log(`  + ${data.slug} (${data.nameRu})`)
      continue
    }

    const update = seedUpdate(existing, data, only)
    if (Object.keys(update).length === 0) {
      unchanged++
      continue
    }
    await prisma.exercise.update({ where: { slug: data.slug }, data: update })
    updated++
    console.log(`  ~ ${data.slug}: ${Object.keys(update).join(', ')}`)
  }

  console.log(`\n=== SEED COMPLETE ===`)
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Unchanged: ${unchanged}`)
  console.log(`Total in DB: ${await prisma.exercise.count()}`)
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
