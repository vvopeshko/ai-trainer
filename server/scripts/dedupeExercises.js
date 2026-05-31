/**
 * Разовый скрипт: замена ai_generated дублей на seed-аналоги.
 *
 * При импорте программы через importProgramFromMd.js упражнения не смэтчились
 * по slug (русские слаги vs английские в seed-базе) и были созданы заново
 * как ai_generated. Этот скрипт:
 *
 * 1. Находит пары ai_generated → seed Exercise по slug
 * 2. Переносит WorkoutSets на seed-упражнения
 * 3. Обновляет planJson в программах (exerciseId, slug, nameRu)
 * 4. Удаляет дубли-ai_generated
 *
 * Всё в одной транзакции.
 *
 * Запуск: cd server && node --env-file=.env scripts/dedupeExercises.js
 */
import prisma from '../src/utils/prisma.js'

// ─── Маппинг: ai_generated slug → seed slug ─────────────────────────

const SLUG_MAP = {
  'zhim-v-smite-naklonnyj': 'smith-machine-incline-bench-press',
  'zhim-gantelej-lyozha-gorizontalnyj': 'dumbbell-bench-press',
  'babochka-v-trenazhere': 'machine-chest-fly',
  'krossover-snizu-vverkh': 'low-cable-crossover',
  'razgibaniya-s-kanatom-iz-za-golovy': 'cable-rope-overhead-triceps-extension',
  'razgibaniya-na-bloke-vniz': 'triceps-pushdown',
  'makhi-v-trenazhere': 'machine-shoulder-fly',
  'podtyagivaniya-obychnyj-khvat': 'pull-up',
  'tyaga-ganteli-v-upore-odnoj-rukoj': 'one-arm-dumbbell-row',
  'tyaga-nizhnego-bloka-sidya-nejtralnyj-khvat': 'seated-row',
  'tyaga-verkhnego-bloka-uzkim-parallelnym': 'lat-pulldown-narrow',
  'tyaga-na-pryamykh-rukakh-v-bloke': 'straight-arm-pulldown',
  'obratnye-razvodki-v-pec-deck-reverse': 'reverse-flyes',
  'sgibaniya-s-gantelyami-na-naklonnoj': 'incline-dumbbell-curl',
  'molotki': 'hammer-curls',
  'zhim-nogami': 'leg-press',
  'bolgarskie-vypady-s-gantelyami': 'split-squat-with-dumbbells',
  'yagodichnyj-most-so-shtangoj': 'barbell-hip-thrust',
  'razgibaniya-nog-sidya': 'leg-extensions',
  'sgibaniya-nog-lyozha': 'lying-leg-curls',
  'podyomy-na-noski-stoya': 'standing-calf-raises',
  'podyomy-na-noski-sidya': 'barbell-seated-calf-raise',
  'progulka-s-girej-v-odnoj-ruke': 'farmers-walk',
  'zhim-gantelej-na-naklonnoj': 'incline-bench-db',
  'zhim-v-trenazhere-sidya-gorizontal': 'machine-chest-press',
  'podtyagivaniya-obratnym-khvatom': 'chin-up',
  'zhim-gantelej-sidya': 'overhead-press-seated-db',
  'fejs-pul': 'face-pull',
  'sgibaniya-na-biceps-v-bloke': 'standing-biceps-cable-curl',
  'razgibaniya-s-kanatom-vniz': 'triceps-pushdown-rope-attachment',
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Dedupe ai_generated → seed exercises ===\n')

  // 1. Resolve slug pairs to Exercise records
  const aiSlugs = Object.keys(SLUG_MAP)
  const seedSlugs = Object.values(SLUG_MAP)

  const allExercises = await prisma.exercise.findMany({
    where: { slug: { in: [...aiSlugs, ...seedSlugs] } },
    select: { id: true, slug: true, nameRu: true, source: true },
  })

  const bySlug = Object.fromEntries(allExercises.map(e => [e.slug, e]))

  // Build replacement pairs: { aiId, seedId, aiSlug, seedSlug }
  const pairs = []
  const missing = []

  for (const [aiSlug, seedSlug] of Object.entries(SLUG_MAP)) {
    const ai = bySlug[aiSlug]
    const seed = bySlug[seedSlug]

    if (!ai) {
      missing.push(`AI exercise not found: ${aiSlug}`)
      continue
    }
    if (!seed) {
      missing.push(`Seed exercise not found: ${seedSlug}`)
      continue
    }

    pairs.push({
      aiId: ai.id,
      seedId: seed.id,
      aiSlug,
      seedSlug,
      seedNameRu: seed.nameRu,
    })
  }

  if (missing.length) {
    console.log('⚠️  Missing exercises:')
    missing.forEach(m => console.log(`   ${m}`))
    console.log()
  }

  console.log(`Found ${pairs.length} pairs to dedupe\n`)

  if (pairs.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // 2. Run everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    let totalSetsUpdated = 0
    let totalProgramsUpdated = 0

    // 2a. Update WorkoutSets
    for (const pair of pairs) {
      const updated = await tx.workoutSet.updateMany({
        where: { exerciseId: pair.aiId },
        data: { exerciseId: pair.seedId },
      })
      if (updated.count > 0) {
        console.log(`  WorkoutSets: ${pair.aiSlug} → ${pair.seedSlug} (${updated.count} sets)`)
        totalSetsUpdated += updated.count
      }
    }

    // 2b. Update planJson in programs
    const aiIdSet = new Set(pairs.map(p => p.aiId))
    const aiIdToSeed = Object.fromEntries(
      pairs.map(p => [p.aiId, { seedId: p.seedId, seedSlug: p.seedSlug, seedNameRu: p.seedNameRu }])
    )

    const programs = await tx.program.findMany({
      select: { id: true, name: true, planJson: true },
    })

    for (const program of programs) {
      const plan = program.planJson
      if (!plan?.days) continue

      let changed = false

      for (const day of plan.days) {
        if (!day.exercises) continue
        for (const ex of day.exercises) {
          if (aiIdSet.has(ex.exerciseId)) {
            const replacement = aiIdToSeed[ex.exerciseId]
            ex.exerciseId = replacement.seedId
            ex.slug = replacement.seedSlug
            ex.nameRu = replacement.seedNameRu
            changed = true
          }
        }
      }

      if (changed) {
        await tx.program.update({
          where: { id: program.id },
          data: { planJson: plan },
        })
        console.log(`  Program updated: "${program.name}" (${program.id})`)
        totalProgramsUpdated++
      }
    }

    // 2c. Delete ai_generated duplicates
    const aiIds = pairs.map(p => p.aiId)
    const deleted = await tx.exercise.deleteMany({
      where: { id: { in: aiIds } },
    })

    return { totalSetsUpdated, totalProgramsUpdated, totalDeleted: deleted.count }
  })

  console.log(`\n=== Done ===`)
  console.log(`  WorkoutSets updated: ${result.totalSetsUpdated}`)
  console.log(`  Programs updated:    ${result.totalProgramsUpdated}`)
  console.log(`  Exercises deleted:   ${result.totalDeleted}`)

  // Verify remaining ai_generated count
  const remaining = await prisma.exercise.count({
    where: { source: 'ai_generated' },
  })
  console.log(`  Remaining ai_generated: ${remaining}`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
