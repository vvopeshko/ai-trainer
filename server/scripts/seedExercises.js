/**
 * Seed-скрипт: загружает обогащённые упражнения в таблицу Exercise.
 *
 * Источник: server/data/enriched-exercises.json (880 упр.)
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
 *
 * Флаги:
 *   --dry-run   — только отчёт, ничего не пишет
 *   --clear     — с --only: пустое значение каталога тоже записывается
 *                 (по умолчанию пустое никогда ничего не стирает)
 *   --drop-db-aliases — с --only=aliases: разрешить удалить алиасы, которых нет
 *                 в каталоге. Без флага сид останавливается и перечисляет их:
 *                 резолвер учит алиасы на проде — сначала scripts/pullAliases.js.
 */
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
import { mapExercise, seedUpdate, droppedAliases } from '../src/utils/exerciseSeed.js'

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
  const dryRun = process.argv.includes('--dry-run')
  const clear = process.argv.includes('--clear')
  if (clear && !only) throw new Error('--clear works only with --only=<fields>')
  console.log(`Seeding ${exercises.length} exercises${only ? ` (overwrite: ${only.join(', ')}${clear ? ', empty values too' : ''})` : ''}${dryRun ? ' — DRY RUN' : ''}...\n`)

  // Plan everything read-only first: the alias guard must stop before any write.
  const existingBySlug = new Map((await prisma.exercise.findMany()).map(e => [e.slug, e]))
  const creates = []
  const updates = []
  let unchanged = 0
  const dropped = []
  for (const raw of exercises) {
    const data = mapExercise(raw)
    const existing = existingBySlug.get(data.slug)
    if (!existing) {
      if (!only) creates.push(data)
      continue
    }
    const update = seedUpdate(existing, data, only, { clear })
    if (Object.keys(update).length === 0) {
      unchanged++
      continue
    }
    updates.push({ slug: data.slug, update })
    const lost = droppedAliases(existing, update)
    if (lost.length) dropped.push({ slug: data.slug, lost })
  }

  if (dropped.length) {
    console.log(`Aliases in the database but not in the catalog (${dropped.length} exercises):`)
    for (const d of dropped) console.log(`  ${d.slug}: ${d.lost.join('; ')}`)
    if (!process.argv.includes('--drop-db-aliases') && !dryRun) {
      console.log('\nStopped, nothing written. Copy them into the catalog (scripts/pullAliases.js)')
      console.log('or re-run with --drop-db-aliases to delete them.')
      process.exitCode = 1
      return
    }
    console.log()
  }

  for (const data of creates) {
    if (!dryRun) await prisma.exercise.create({ data })
    console.log(`  + ${data.slug} (${data.nameRu})`)
  }
  for (const { slug, update } of updates) {
    if (!dryRun) await prisma.exercise.update({ where: { slug }, data: update })
    console.log(`  ~ ${slug}: ${Object.keys(update).join(', ')}`)
  }

  console.log(`\n=== ${dryRun ? 'DRY RUN — nothing written' : 'SEED COMPLETE'} ===`)
  console.log(`Created: ${creates.length}`)
  console.log(`Updated: ${updates.length}`)
  console.log(`Unchanged: ${unchanged}`)
  console.log(`Total in DB: ${await prisma.exercise.count()}`)
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
