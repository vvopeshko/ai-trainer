/**
 * Applies data/exercise-name-fixes.json — corrected Russian names of catalog
 * exercises — to an existing database, touching nothing else.
 *
 * Safe by design:
 *   - dry run by default: prints what would change; writes only with --apply;
 *   - each row changes only when its nameRu is still exactly the old value
 *     (a name edited by hand meanwhile is reported and left alone);
 *   - one transaction, and only the nameRu column of the listed slugs.
 * Programs keep exercise IDs, so alternatives pick up new names at once;
 * a name copied into a program's planJson stays as it was.
 *
 *   cd server && node --env-file=.env scripts/fixExerciseNames.js            # dry run (dev)
 *   cd server && DATABASE_URL="<prod url>" node scripts/fixExerciseNames.js  # dry run (prod)
 *   cd server && DATABASE_URL="<prod url>" node scripts/fixExerciseNames.js --apply
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const fixes = JSON.parse(readFileSync(new URL('../data/exercise-name-fixes.json', import.meta.url), 'utf8'))
const apply = process.argv.includes('--apply')
const prisma = new PrismaClient()

try {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).hostname } catch { return '?' } })()
  console.log(`Database: ${host} · ${apply ? 'APPLY' : 'dry run (add --apply to write)'}\n`)
  const rows = await prisma.exercise.findMany({
    where: { slug: { in: fixes.map(f => f.slug) } },
    select: { id: true, slug: true, nameRu: true },
  })
  const bySlug = new Map(rows.map(r => [r.slug, r]))
  const toUpdate = []
  for (const fix of fixes) {
    const row = bySlug.get(fix.slug)
    if (!row) console.log(`  skip  ${fix.slug}: not in this database`)
    else if (row.nameRu === fix.to) console.log(`  ok    ${fix.slug}: already «${fix.to}»`)
    else if (row.nameRu !== fix.from) console.log(`  skip  ${fix.slug}: name is «${row.nameRu}», expected «${fix.from}» — left as is`)
    else {
      console.log(`  fix   ${fix.slug}: «${fix.from}» → «${fix.to}»`)
      toUpdate.push({ id: row.id, from: fix.from, to: fix.to })
    }
  }
  if (apply && toUpdate.length) {
    // updateMany with the old name in WHERE: a concurrent edit is not overwritten.
    const counts = await prisma.$transaction(toUpdate.map(u =>
      prisma.exercise.updateMany({ where: { id: u.id, nameRu: u.from }, data: { nameRu: u.to } })))
    console.log(`\nUpdated ${counts.reduce((sum, c) => sum + c.count, 0)} of ${toUpdate.length}.`)
  } else {
    console.log(`\n${toUpdate.length} to update${apply ? '' : ' — run again with --apply'}.`)
  }
} finally {
  await prisma.$disconnect()
}
