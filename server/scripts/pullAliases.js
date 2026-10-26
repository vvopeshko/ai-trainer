/**
 * Копирует в каталог (data/enriched-exercises.json) алиасы, которые есть в БД,
 * но нет в каталоге: их выучил резолвер на проде (exerciseMatcher запоминает
 * узнанные названия). Запускать перед `seedExercises.js --only=aliases`, иначе
 * сид их сотрёт (он и остановится, перечислив их).
 *
 * Только читает БД. По умолчанию — отчёт; с --write дописывает в JSON —
 * результат видно в git diff: алиас, удалённый из каталога намеренно, там
 * вернётся — его достаточно откатить.
 * Отдельно перечисляет упражнения, созданные резолвером (их нет в каталоге).
 *
 *   cd server && node --env-file=.env scripts/pullAliases.js [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import prisma from '../src/utils/prisma.js'

const FILE = new URL('../data/enriched-exercises.json', import.meta.url)
const key = a => a.trim().toLowerCase().replace(/ё/g, 'е')

async function main() {
  const write = process.argv.includes('--write')
  const catalog = JSON.parse(readFileSync(FILE, 'utf8'))
  const bySlug = new Map(catalog.map(e => [e.slug, e]))
  const rows = await prisma.$queryRaw`SELECT slug, "nameRu", aliases, source::text AS source, "createdAt" FROM "Exercise" ORDER BY slug`

  let added = 0
  for (const row of rows) {
    const entry = bySlug.get(row.slug)
    if (!entry) continue
    const known = new Set([entry.nameRu, entry.nameEn, ...entry.aliases].filter(Boolean).map(key))
    const extra = row.aliases.filter(a => !known.has(key(a)))
    if (!extra.length) continue
    console.log(`  ${row.slug}: + ${extra.join('; ')}`)
    entry.aliases.push(...extra)
    added += extra.length
  }

  const outside = rows.filter(r => !bySlug.has(r.slug))
  if (outside.length) {
    console.log(`\nNot in the catalog (created in production, ${outside.length}) — add by hand if worth keeping:`)
    for (const r of outside) console.log(`  ${r.slug} — ${r.nameRu} [${r.source}, ${r.createdAt.toISOString().slice(0, 10)}]`)
  }

  if (write && added) writeFileSync(FILE, JSON.stringify(catalog, null, 2))
  console.log(`\n${added} aliases ${write ? 'written to' : 'missing from'} the catalog${write || !added ? '' : ' — re-run with --write'}.`)
}

main()
  .catch(e => {
    console.error('Pull failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
