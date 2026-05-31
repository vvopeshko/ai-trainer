#!/usr/bin/env node
/**
 * Обогащение упражнений активной программы медиа (GIF + YouTube).
 *
 * Пилот: обрабатывает только упражнения из активной программы пользователя (~15-20 шт.).
 *
 * Usage:
 *   node scripts/enrichProgramMedia.js                  # dev user (telegramId=0)
 *   node scripts/enrichProgramMedia.js --telegramId=123 # конкретный юзер
 *   node scripts/enrichProgramMedia.js --skip-gif       # только YouTube
 *   node scripts/enrichProgramMedia.js --skip-youtube   # только GIF
 */

import prisma from '../src/utils/prisma.js'
import llm from '../src/utils/llm.js'
import { parseJsonFromLLM } from '../src/utils/parseJsonFromLLM.js'
import ytsearch from 'yt-search'

// ─── Config ────────────────────────────────────────────────────────

const GIF_DELAY_MS = 4000 // ExerciseDB OSS rate limit
const YT_DELAY_MS = 2000  // be polite with yt-search scraping
const LLM_MODEL = 'claude-sonnet-4-6'

// Маппинг проблемных названий для ExerciseDB OSS (из fetch-missing-gifs.js)
const manualSearches = {
  'Cable Face Pull': 'face pull',
  'Triceps Pulldown Rope': 'triceps pushdown',
  'Biceps Curl Cable': 'cable curl',
  'Hammer Curl DB': 'hammer curl',
  'Pull Up': 'pull-up',
  'Adductor Machine': 'adductor',
  'Lat Pulldown Narrow': 'close-grip pulldown',
  'Machine Chest Fly': 'pec deck',
  'Biceps Curl DB': 'dumbbell biceps curl',
  'Upright Row Cable': 'cable upright row',
  'Seated Row Wide': 'cable seated row',
  'Reverse Curl Barbell': 'barbell reverse curl',
  'Pec Fly': 'chest fly',
  'Push Up': 'push-up',
  'Front Plank': 'plank',
  'Box Jump': 'box jump',
  'Plié Squat': 'sumo squat',
  'Bench Pullover DB': 'dumbbell pullover',
  'Overhead Press Seated DB': 'dumbbell shoulder press seated',
  'Standing Cable Crossover': 'cable crossover',
  'Reverse Fly DB': 'dumbbell reverse fly',
  'Lateral Raise DB': 'dumbbell lateral raise',
  'Seated Leg Curl': 'seated leg curl',
  'Shoulder Press Machine': 'machine shoulder press',
  'Incline Bench DB': 'incline dumbbell press',
  'Leg Raises (lying)': 'lying leg raise',
  'Incline Bench Press Barbell': 'incline barbell bench press',
  'Incline Row DB': 'incline dumbbell row',
  'RFESS L DB': 'bulgarian split squat',
  'RFESS R DB': 'bulgarian split squat',
  'Machine Shoulder Fly': 'rear delt fly',
  'One-arm Biceps Curl Machine': 'machine biceps curl',
  'Single Arm Row L Cable': 'single arm cable row',
  'Single Arm Row R Cable': 'single arm cable row',
  'Row Single Arm L DB': 'one arm dumbbell row',
  'Row Single Arm R DB': 'one arm dumbbell row',
}

// ─── CLI args ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let telegramId = BigInt(process.env.ADMIN_TELEGRAM_ID || '383934339')
  let skipGif = false
  let skipYoutube = false

  for (const arg of args) {
    if (arg.startsWith('--telegramId=')) {
      telegramId = BigInt(arg.split('=')[1])
    } else if (arg === '--skip-gif') {
      skipGif = true
    } else if (arg === '--skip-youtube') {
      skipYoutube = true
    }
  }

  return { telegramId, skipGif, skipYoutube }
}

// ─── Step 1: Get exercises from active program ─────────────────────

async function getProgramExercises(telegramId) {
  const program = await prisma.program.findFirst({
    where: {
      user: { telegramId },
      isActive: true,
    },
  })

  if (!program) {
    console.error(`No active program found for telegramId=${telegramId}`)
    process.exit(1)
  }

  console.log(`Program: "${program.name}" (${program.id})`)

  // Extract unique exerciseIds from planJson
  const exerciseIds = new Set()
  const plan = program.planJson
  // planJson structure: { weeks: [{ days: [{ exercises: [{ exerciseId }] }] }] }
  // or flattened: { days: [{ exercises: [{ exerciseId }] }] }
  const days = plan.days ?? plan.weeks?.flatMap(w => w.days) ?? []
  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      if (ex.exerciseId) exerciseIds.add(ex.exerciseId)
    }
  }

  if (exerciseIds.size === 0) {
    console.error('No exercises found in program planJson')
    process.exit(1)
  }

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: [...exerciseIds] } },
  })

  console.log(`Found ${exercises.length} unique exercises in program\n`)
  return exercises
}

// ─── Step 2: GIF enrichment via ExerciseDB OSS ─────────────────────

async function searchOSS(query) {
  const url = `https://oss.exercisedb.dev/api/v1/exercises/search?search=${encodeURIComponent(query)}&limit=5`
  const res = await fetch(url)
  if (res.status === 503) return null // rate limited
  if (res.status !== 200) return []
  const text = await res.text()
  if (text.startsWith('<')) return null
  return JSON.parse(text).data || []
}

async function enrichGifs(exercises) {
  const missing = exercises.filter(e => !e.gifUrl)
  if (missing.length === 0) {
    console.log('[GIF] All exercises already have GIFs\n')
    return
  }

  console.log(`[GIF] Missing GIFs: ${missing.length}/${exercises.length}`)
  let found = 0

  for (let i = 0; i < missing.length; i++) {
    const ex = missing[i]
    const query = manualSearches[ex.nameEn] || ex.nameEn || ex.nameRu

    if (!query) {
      console.log(`[GIF] ${i + 1}/${missing.length} SKIP ${ex.nameRu} (no search query)`)
      continue
    }

    const results = await searchOSS(query)
    if (results === null) {
      console.log(`[GIF] RATE LIMITED at ${i + 1}/${missing.length}. Remaining exercises skipped.`)
      break
    }

    const best = results.find(r => r.gifUrl)
    if (best) {
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { gifUrl: best.gifUrl },
      })
      ex.gifUrl = best.gifUrl
      found++
      console.log(`[GIF] ${i + 1}/${missing.length} OK ${ex.nameEn || ex.nameRu} -> ${best.name}`)
    } else {
      console.log(`[GIF] ${i + 1}/${missing.length} NOT FOUND ${ex.nameEn || ex.nameRu}`)
    }

    if (i < missing.length - 1) {
      await new Promise(r => setTimeout(r, GIF_DELAY_MS))
    }
  }

  console.log(`[GIF] New GIFs found: ${found}\n`)
}

// ─── Step 3: YouTube enrichment via LLM + yt-search ────────────────

async function generateSearchQueries(exercise) {
  const name = exercise.nameRu
  const nameEn = exercise.nameEn || ''

  const { text } = await llm.chat(
    [
      {
        role: 'user',
        content: `Для упражнения "${name}"${nameEn ? ` (${nameEn})` : ''} подбери 3 поисковых запроса для YouTube, чтобы найти лучшие обучающие видео по технике выполнения.
Один запрос на русском, два на английском.
Запросы должны быть конкретными, включать "техника" или "how to" / "form guide".

Ответь строго JSON-массивом строк, без пояснений:
["запрос 1", "query 2", "query 3"]`,
      },
    ],
    { model: LLM_MODEL, maxTokens: 256 }
  )

  const queries = parseJsonFromLLM(text)
  if (!Array.isArray(queries)) {
    console.warn(`[YT] Failed to parse search queries for "${name}": ${text.slice(0, 100)}`)
    return []
  }
  return queries
}

async function searchYouTube(query) {
  try {
    const result = await ytsearch(query)
    // Filter to reasonable length videos (30s - 20min) and take top 2
    return (result.videos || [])
      .filter(v => v.seconds >= 30 && v.seconds <= 1200)
      .slice(0, 2)
      .map(v => ({
        url: v.url,
        title: v.title,
        channel: v.author?.name || '',
        duration: v.timestamp,
        views: v.views,
      }))
  } catch (err) {
    console.warn(`[YT] Search failed for "${query}": ${err.message}`)
    return []
  }
}

async function rankVideos(exercise, candidates) {
  if (candidates.length === 0) return []
  if (candidates.length <= 3) {
    // If 3 or fewer, just return them with lang detection
    return candidates.map(c => ({
      url: c.url,
      title: c.title,
      channel: c.channel,
      source: 'youtube',
      lang: /[а-яА-ЯёЁ]/.test(c.title) ? 'ru' : 'en',
    }))
  }

  const candidateList = candidates.map((c, i) =>
    `${i + 1}. "${c.title}" — канал: ${c.channel}, длительность: ${c.duration}, просмотры: ${c.views}`
  ).join('\n')

  const { text } = await llm.chat(
    [
      {
        role: 'user',
        content: `Для упражнения "${exercise.nameRu}"${exercise.nameEn ? ` (${exercise.nameEn})` : ''} выбери 2-3 лучших обучающих видео из списка кандидатов.

Критерии:
- Видео должно быть именно про технику этого упражнения (не компиляция, не влог)
- Предпочтительны каналы с экспертизой в фитнесе
- Желательно одно на русском и одно-два на английском
- Длительность 1-10 минут идеально

Кандидаты:
${candidateList}

Ответь строго JSON-массивом номеров выбранных видео, без пояснений:
[1, 3, 5]`,
      },
    ],
    { model: LLM_MODEL, maxTokens: 128 }
  )

  const indices = parseJsonFromLLM(text)
  if (!Array.isArray(indices)) {
    console.warn(`[YT] Failed to parse ranking for "${exercise.nameRu}", taking first 3`)
    return candidates.slice(0, 3).map(c => ({
      url: c.url,
      title: c.title,
      channel: c.channel,
      source: 'youtube',
      lang: /[а-яА-ЯёЁ]/.test(c.title) ? 'ru' : 'en',
    }))
  }

  return indices
    .map(i => candidates[i - 1])
    .filter(Boolean)
    .map(c => ({
      url: c.url,
      title: c.title,
      channel: c.channel,
      source: 'youtube',
      lang: /[а-яА-ЯёЁ]/.test(c.title) ? 'ru' : 'en',
    }))
}

async function enrichYouTube(exercises) {
  const missing = exercises.filter(e => !e.videos || (Array.isArray(e.videos) && e.videos.length === 0))
  if (missing.length === 0) {
    console.log('[YT] All exercises already have videos\n')
    return
  }

  console.log(`[YT] Exercises to enrich: ${missing.length}/${exercises.length}`)
  let enriched = 0

  for (let i = 0; i < missing.length; i++) {
    const ex = missing[i]
    console.log(`[YT] ${i + 1}/${missing.length} Processing: ${ex.nameRu}`)

    // Step A: LLM generates search queries
    const queries = await generateSearchQueries(ex)
    if (queries.length === 0) {
      console.log(`[YT]   Skipped (no queries generated)`)
      continue
    }
    console.log(`[YT]   Queries: ${queries.join(' | ')}`)

    // Step B: Search YouTube for each query
    const allCandidates = []
    const seenUrls = new Set()

    for (const query of queries) {
      const results = await searchYouTube(query)
      for (const r of results) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url)
          allCandidates.push(r)
        }
      }
      await new Promise(r => setTimeout(r, YT_DELAY_MS))
    }

    console.log(`[YT]   Found ${allCandidates.length} unique candidates`)

    if (allCandidates.length === 0) {
      console.log(`[YT]   No videos found`)
      continue
    }

    // Step C: LLM ranks/filters candidates
    const videos = await rankVideos(ex, allCandidates)

    if (videos.length > 0) {
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { videos },
      })
      enriched++
      console.log(`[YT]   Saved ${videos.length} videos: ${videos.map(v => v.title.slice(0, 40)).join(' | ')}`)
    } else {
      console.log(`[YT]   No suitable videos selected`)
    }
  }

  console.log(`[YT] Enriched: ${enriched}/${missing.length}\n`)
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const { telegramId, skipGif, skipYoutube } = parseArgs()

  console.log(`\n=== Enrich Program Media ===`)
  console.log(`telegramId: ${telegramId}`)
  console.log(`GIF: ${skipGif ? 'SKIP' : 'ON'}, YouTube: ${skipYoutube ? 'SKIP' : 'ON'}\n`)

  const exercises = await getProgramExercises(telegramId)

  if (!skipGif) {
    await enrichGifs(exercises)
  }

  if (!skipYoutube) {
    await enrichYouTube(exercises)
  }

  // Summary
  const withGif = exercises.filter(e => e.gifUrl).length
  const withVideos = exercises.filter(e => e.videos && Array.isArray(e.videos) && e.videos.length > 0).length
  console.log('=== Summary ===')
  console.log(`Exercises: ${exercises.length}`)
  console.log(`With GIF: ${withGif}/${exercises.length}`)
  console.log(`With YouTube: ${withVideos}/${exercises.length}`)
}

main()
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
