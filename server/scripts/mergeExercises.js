/**
 * Сливает дубли упражнений по data/exercise-merges.json (старый slug → канонический):
 *
 * 1. WorkoutSet переносятся на каноническое упражнение (история и прогресс — в одном месте)
 * 2. Настройки упражнения (UserExerciseSettings, по slug) переезжают, если у юзера
 *    для канонического их ещё нет; иначе остаются настройки канонического
 * 3. planJson программ и разовые правки дня: exerciseId/slug/nameRu и аналоги;
 *    левая+правая сторона в одном дне схлопываются в одно упражнение
 * 4. Старые slug и названия становятся алиасами канонического (резолвер находит)
 * 5. Дубли удаляются
 *
 * Всё в одной транзакции. По умолчанию — dry-run (только отчёт), запись — с --apply.
 * Канонические упражнения должны уже быть в БД (сначала seedExercises).
 * Не запускать во время чьей-то тренировки: открытый экран держит старые id.
 *
 *   cd server && node --env-file=.env scripts/mergeExercises.js           # отчёт
 *   cd server && node --env-file=.env scripts/mergeExercises.js --apply   # записать
 */
import { readFileSync } from 'node:fs'
import prisma from '../src/utils/prisma.js'
import { loadMerges, rewritePlan, rewriteDayExercises, mergedAliases } from '../src/services/exerciseMerge.js'

const apply = process.argv.includes('--apply')
const merges = loadMerges(JSON.parse(readFileSync(new URL('../data/exercise-merges.json', import.meta.url), 'utf8')))

async function main() {
  const slugs = [...new Set([...Object.keys(merges), ...Object.values(merges)])]
  const rows = await prisma.exercise.findMany({ where: { slug: { in: slugs } } })
  const bySlug = new Map(rows.map(e => [e.slug, e]))

  const missingTargets = [...new Set(Object.values(merges))].filter(s => !bySlug.has(s))
  if (missingTargets.length) throw new Error(`Canonical exercises missing (run seedExercises first): ${missingTargets.join(', ')}`)

  const pairs = Object.entries(merges).filter(([from]) => bySlug.has(from)).map(([from, to]) => ({ from: bySlug.get(from), to: bySlug.get(to) }))
  if (!pairs.length) return console.log('Nothing to merge: every duplicate is already gone.')

  const byOldId = new Map(pairs.map(p => [p.from.id, p.to]))
  const sets = await prisma.workoutSet.groupBy({ by: ['exerciseId'], where: { exerciseId: { in: [...byOldId.keys()] } }, _count: true })
  const setCount = new Map(sets.map(s => [s.exerciseId, s._count]))
  console.log(`${pairs.length} duplicates → ${new Set(pairs.map(p => p.to.slug)).size} exercises${apply ? '' : ' (dry run)'}\n`)
  for (const p of pairs) console.log(`  ${p.from.slug} → ${p.to.slug}  (${setCount.get(p.from.id) ?? 0} sets)`)

  // Plan everything read-only first; the dry run stops here.
  // Left and right side may both carry settings: the first one moved wins.
  const settingsMoves = []
  const claimed = new Set()
  for (const p of pairs) {
    for (const s of await prisma.userExerciseSettings.findMany({ where: { exerciseSlug: p.from.slug } })) {
      const key = `${s.userId}|${p.to.slug}`
      const taken = claimed.has(key) || await prisma.userExerciseSettings.findUnique({ where: { userId_exerciseSlug: { userId: s.userId, exerciseSlug: p.to.slug } } })
      settingsMoves.push({ id: s.id, to: p.to.slug, drop: Boolean(taken) })
      claimed.add(key)
    }
  }
  const programs = (await prisma.program.findMany({ select: { id: true, name: true, planJson: true } }))
    .map(program => ({ id: program.id, name: program.name, ...rewritePlan(program.planJson, byOldId) }))
    .filter(r => r.changed)
  const overrides = (await prisma.workoutPlanOverride.findMany())
    .map(o => ({ id: o.id, ...rewriteDayExercises(o.exercises, byOldId) }))
    .filter(r => r.changed)
  const aliases = [...new Set(pairs.map(p => p.to))].map(to => ({ id: to.id, aliases: mergedAliases(to, pairs.filter(p => p.to === to).map(p => p.from)) }))

  console.log(`\nSets to move: ${[...setCount.values()].reduce((a, n) => a + n, 0)}`)
  console.log(`Settings: ${settingsMoves.filter(m => !m.drop).length} move, ${settingsMoves.filter(m => m.drop).length} dropped (canonical already set)`)
  console.log(`Programs: ${programs.map(p => p.name).join(', ') || 'none'}; day overrides: ${overrides.length}`)
  if (!apply) return console.log('\n=== DRY RUN — nothing written. Re-run with --apply ===')

  const report = await prisma.$transaction(async tx => {
    let moved = 0
    for (const p of pairs) moved += (await tx.workoutSet.updateMany({ where: { exerciseId: p.from.id }, data: { exerciseId: p.to.id } })).count
    for (const m of settingsMoves) {
      if (m.drop) await tx.userExerciseSettings.delete({ where: { id: m.id } })
      else await tx.userExerciseSettings.update({ where: { id: m.id }, data: { exerciseSlug: m.to } })
    }
    for (const p of programs) await tx.program.update({ where: { id: p.id }, data: { planJson: p.plan } })
    for (const o of overrides) await tx.workoutPlanOverride.update({ where: { id: o.id }, data: { exercises: o.exercises } })
    for (const a of aliases) await tx.exercise.update({ where: { id: a.id }, data: { aliases: a.aliases } })
    const deleted = (await tx.exercise.deleteMany({ where: { id: { in: [...byOldId.keys()] } } })).count
    return { sets: moved, settings: settingsMoves.length, programs: programs.length, overrides: overrides.length, deleted }
  }, { timeout: 120_000, maxWait: 10_000 })
  console.log('\n=== MERGED ===')
  console.log(report)
}

main()
  .catch(e => {
    console.error('Merge failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
