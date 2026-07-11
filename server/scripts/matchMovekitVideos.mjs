/**
 * Match MoveKit exercises to our DB exercises and update gifUrl.
 *
 * Matching strategy (weighted scoring):
 *   1. Name similarity (normalized words overlap) — weight 0.4
 *   2. Primary muscles overlap — weight 0.3
 *   3. Equipment match — weight 0.2
 *   4. Slug similarity (Jaccard on words) — weight 0.1
 *
 * Usage:
 *   node scripts/matchMovekitVideos.mjs                     # dry-run
 *   node scripts/matchMovekitVideos.mjs --apply             # write to DB
 *   node scripts/matchMovekitVideos.mjs --min-score=0.5     # adjust threshold (default 0.55)
 *   node scripts/matchMovekitVideos.mjs --show-unmatched    # show unmatched movekit exercises
 *
 * Output: data/movekit-match-report.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')
const SHOW_UNMATCHED = process.argv.includes('--show-unmatched')
const MIN_SCORE = parseFloat(process.argv.find(a => a.startsWith('--min-score='))?.split('=')[1] || '0.55')

const movekitPath = resolve(__dirname, '..', 'data', 'movekit-exercises.json')
const reportPath = resolve(__dirname, '..', 'data', 'movekit-match-report.json')

// ── Muscle mapping: Movekit → our internal IDs ──

const MUSCLE_MAP = {
  'Back': ['lats', 'middle back', 'lower back'],
  'Biceps': ['biceps'],
  'Calves': ['calves'],
  'Chest': ['chest'],
  'Core': ['abdominals', 'obliques'],
  'Forearms': ['forearms'],
  'Glutes': ['glutes'],
  'Hamstrings': ['hamstrings'],
  'Quadriceps': ['quadriceps'],
  'Shoulders': ['shoulders'],
  'Trapezius': ['traps'],
  'Triceps': ['triceps'],
}

// Reverse: our muscle → movekit muscle
const REVERSE_MUSCLE = {}
for (const [mk, ours] of Object.entries(MUSCLE_MAP)) {
  for (const o of ours) REVERSE_MUSCLE[o] = mk
}

// ── Equipment mapping: Movekit → ours ──

const EQUIP_MAP = {
  'Band': 'bands',
  'Barbell': 'barbell',
  'Bodyweight': 'body only',
  'Cable Machine': 'cable',
  'Dumbbell': 'dumbbell',
  'Kettlebell': 'kettlebells',
  'Machine': 'machine',
}

// ── Scoring helpers ──

/** Normalize name to word set for comparison */
function nameWords(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1)
}

/** Jaccard similarity on two arrays (as sets) */
function jaccard(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  let inter = 0
  for (const x of setA) if (setB.has(x)) inter++
  return inter / (setA.size + setB.size - inter)
}

/** Check if movekit muscles match our exercise muscles */
function muscleScore(mkMuscles, ourMuscles) {
  if (mkMuscles.length === 0 && ourMuscles.length === 0) return 0.5
  // Map movekit muscles to our namespace
  const mkMapped = mkMuscles.flatMap(m => MUSCLE_MAP[m] || [])
  return jaccard(mkMapped, ourMuscles)
}

/** Check if equipment matches */
function equipmentScore(mkEquip, ourEquip) {
  if (mkEquip.length === 0 && ourEquip.length === 0) return 0.5
  const mkMapped = mkEquip.map(e => EQUIP_MAP[e] || e.toLowerCase())
  return jaccard(mkMapped, ourEquip)
}

/** Combined match score */
function matchScore(mkExercise, ourExercise) {
  const nameA = nameWords(mkExercise.name)
  const nameB = nameWords(ourExercise.nameEn)
  const nameSim = jaccard(nameA, nameB)

  const slugA = mkExercise.slug.split('-')
  const slugB = ourExercise.slug.split('-')
  const slugSim = jaccard(slugA, slugB)

  const muscleSim = muscleScore(mkExercise.primaryMuscles, ourExercise.primaryMuscles)
  const equipSim = equipmentScore(mkExercise.equipment, ourExercise.equipment)

  // Weighted score
  const score = nameSim * 0.4 + muscleSim * 0.3 + equipSim * 0.2 + slugSim * 0.1

  return { score, nameSim, muscleSim, equipSim, slugSim }
}

// ── Main ──

async function main() {
  const prisma = new PrismaClient()

  const movekit = JSON.parse(readFileSync(movekitPath, 'utf8'))
  const exercises = await prisma.exercise.findMany({
    select: { id: true, slug: true, nameEn: true, nameRu: true, primaryMuscles: true, equipment: true, gifUrl: true },
  })

  console.log(`Our exercises: ${exercises.length}, MoveKit exercises: ${movekit.length}\n`)

  const matched = []
  const unmatched = []
  const usedOurIds = new Set()

  // For each movekit exercise, find best match in our DB
  for (const mk of movekit) {
    let bestMatch = null
    let bestScore = 0
    let bestDetails = null

    for (const our of exercises) {
      if (usedOurIds.has(our.id)) continue

      const details = matchScore(mk, our)
      if (details.score > bestScore) {
        bestScore = details.score
        bestMatch = our
        bestDetails = details
      }
    }

    if (bestMatch && bestScore >= MIN_SCORE) {
      matched.push({
        mkSlug: mk.slug,
        mkName: mk.name,
        ourSlug: bestMatch.slug,
        ourName: bestMatch.nameEn,
        ourNameRu: bestMatch.nameRu,
        score: bestScore,
        details: bestDetails,
        hasGif: !!bestMatch.gifUrl,
        videoUrl: mk.videoPreviewUrl,
      })
      usedOurIds.add(bestMatch.id)
    } else {
      unmatched.push({
        mkSlug: mk.slug,
        mkName: mk.name,
        bestCandidate: bestMatch?.nameEn || null,
        bestScore,
      })
    }
  }

  // Sort by score descending
  matched.sort((a, b) => b.score - a.score)

  // Print matches
  console.log(`=== MATCHED: ${matched.length} ===\n`)
  for (const m of matched) {
    const flag = m.hasGif ? ' (has media)' : ''
    const detail = `name=${m.details.nameSim.toFixed(2)} musc=${m.details.muscleSim.toFixed(2)} equip=${m.details.equipSim.toFixed(2)} slug=${m.details.slugSim.toFixed(2)}`
    console.log(`  ${m.score.toFixed(2)}  ${m.mkName.padEnd(45)} → ${m.ourName}${flag}`)
    console.log(`        [${detail}]`)
  }

  // Print unmatched
  if (SHOW_UNMATCHED) {
    console.log(`\n=== UNMATCHED: ${unmatched.length} ===\n`)
    for (const u of unmatched) {
      console.log(`  ${u.mkName.padEnd(45)} best: ${u.bestCandidate || '?'} (${u.bestScore.toFixed(2)})`)
    }
  } else {
    console.log(`\nUnmatched: ${unmatched.length} (use --show-unmatched to see)`)
  }

  // Show questionable matches (score 0.55-0.65)
  const questionable = matched.filter(m => m.score < 0.65)
  if (questionable.length > 0) {
    console.log(`\n=== QUESTIONABLE (score < 0.65): ${questionable.length} ===\n`)
    for (const m of questionable) {
      console.log(`  ${m.score.toFixed(2)}  ${m.mkName.padEnd(45)} → ${m.ourName}`)
    }
  }

  // Save report
  const report = { matched, unmatched, stats: { total: movekit.length, matched: matched.length, unmatched: unmatched.length } }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport saved to ${reportPath}`)

  // Apply
  if (APPLY) {
    console.log('\n=== APPLYING TO DB ===\n')
    let updated = 0
    let skipped = 0
    const slugToExercise = Object.fromEntries(exercises.map(e => [e.slug, e]))

    for (const m of matched) {
      const ex = slugToExercise[m.ourSlug]
      if (!ex) continue
      // Guard: movekit-запись без видео не должна затирать существующий gifUrl null'ом
      if (!m.videoUrl) { skipped++; continue }

      // Only update if no gifUrl or current is old exercisedb GIF
      const currentIsOldGif = ex.gifUrl && (ex.gifUrl.endsWith('.gif') || ex.gifUrl.includes('exercisedb'))
      if (!ex.gifUrl || currentIsOldGif) {
        await prisma.exercise.update({
          where: { id: ex.id },
          data: { gifUrl: m.videoUrl },
        })
        updated++
      } else {
        skipped++
      }
    }
    console.log(`Updated: ${updated}, Skipped (already has video): ${skipped}`)
  } else {
    const slugToExercise = Object.fromEntries(exercises.map(e => [e.slug, e]))
    const wouldUpdate = matched.filter(m => {
      const ex = slugToExercise[m.ourSlug]
      if (!ex || !m.videoUrl) return false
      const isOldGif = ex.gifUrl && (ex.gifUrl.endsWith('.gif') || ex.gifUrl.includes('exercisedb'))
      return !ex.gifUrl || isOldGif
    }).length
    console.log(`\nDry run. Would update ${wouldUpdate} exercises. Use --apply to write to DB.`)
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
