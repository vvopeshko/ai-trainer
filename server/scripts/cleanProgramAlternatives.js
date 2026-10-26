/**
 * Убирает из программ аналоги, которые ссылаются на удалённые упражнения
 * (остались от прошлых слияний дублей). Основные упражнения не трогает —
 * только сообщает, если такое нашлось.
 *
 * По умолчанию — отчёт (только чтение), запись — с --apply.
 *
 *   cd server && node --env-file=.env scripts/cleanProgramAlternatives.js [--apply]
 */
import prisma from '../src/utils/prisma.js'
import { dropUnknownAlternatives } from '../src/services/exerciseMerge.js'

async function main() {
  const apply = process.argv.includes('--apply')
  const ids = new Set((await prisma.exercise.findMany({ select: { id: true } })).map(e => e.id))
  const programs = await prisma.program.findMany({ select: { id: true, name: true, isActive: true, planJson: true } })

  let total = 0
  for (const program of programs) {
    const { plan, removed, missingMain } = dropUnknownAlternatives(program.planJson, ids)
    if (missingMain.length) console.log(`  ⚠️ ${program.name}: main exercise missing — ${missingMain.join(', ')}`)
    if (!removed) continue
    total += removed
    console.log(`  ${program.name}${program.isActive ? ' (active)' : ''}: ${removed} alternatives removed`)
    if (apply) await prisma.program.update({ where: { id: program.id }, data: { planJson: plan } })
  }
  console.log(`\n${total} dangling alternatives${apply ? ' removed' : ' — DRY RUN, re-run with --apply'}.`)
}

main()
  .catch(e => {
    console.error('Clean failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
