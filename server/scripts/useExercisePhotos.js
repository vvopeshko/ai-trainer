/**
 * Switch existing seed exercises to photos. No schema changes or new exercises.
 * node --env-file=.env scripts/useExercisePhotos.js          # dry run
 * node --env-file=.env scripts/useExercisePhotos.js --apply  # backup + transaction
 * Old imageUrl/gifUrl values are saved under server/.cache/exercise-photos/.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const catalog = JSON.parse(readFileSync(new URL('../data/enriched-exercises.json', import.meta.url), 'utf8'))
const bySlug = new Map(catalog.map(e => [e.slug, e]))
const prisma = new PrismaClient()

try {
  const rows = await prisma.exercise.findMany({
    where: { source: 'seed', slug: { in: [...bySlug.keys()] } },
    select: { id: true, slug: true, imageUrl: true, gifUrl: true },
  })
  const changes = rows.map(row => ({
    before: row,
    imageUrl: row.imageUrl || bySlug.get(row.slug).images?.[0],
  })).filter(({ before, imageUrl }) => before.gifUrl || before.imageUrl !== imageUrl)
  if (changes.some(c => !c.imageUrl)) throw new Error('An exercise has no replacement photo')
  console.log(JSON.stringify({ matched: rows.length, changed: changes.length,
    photosAdded: changes.filter(c => !c.before.imageUrl).length,
    gifsRemoved: changes.filter(c => c.before.gifUrl).length }))

  if (process.argv.includes('--apply') && changes.length) {
    const dir = new URL('../.cache/exercise-photos/', import.meta.url)
    mkdirSync(dir, { recursive: true })
    const backup = new URL(`${new Date().toISOString().replaceAll(':', '-')}.json`, dir)
    writeFileSync(backup, JSON.stringify(changes.map(c => c.before), null, 2) + '\n', { flag: 'wx' })
    console.log(`Backup: ${fileURLToPath(backup)}`)
    await prisma.$transaction(async tx => {
      for (const { before, imageUrl } of changes) {
        const result = await tx.exercise.updateMany({
          where: { id: before.id, imageUrl: before.imageUrl, gifUrl: before.gifUrl },
          data: { imageUrl, gifUrl: null },
        })
        if (result.count !== 1) throw new Error(`Concurrent media change: ${before.slug}`)
      }
    }, { timeout: 60000 })
    console.log('Applied')
  }
} finally {
  await prisma.$disconnect()
}
