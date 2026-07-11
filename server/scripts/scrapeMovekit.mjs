/**
 * Scrape MoveKit exercise library — full exercise data.
 *
 * 1. Fetches sitemap.xml → extracts all /exercises/ slugs
 * 2. For each exercise page, extracts embedded JSON data:
 *    name, slug, primaryMuscles, secondaryMuscles, equipment,
 *    movementPattern, difficulty, instructions, benefits,
 *    video-preview URL, poster URL
 * 3. Outputs full dataset to server/data/movekit-exercises.json
 *
 * Usage:
 *   node scripts/scrapeMovekit.mjs
 *   node scripts/scrapeMovekit.mjs --concurrency=5
 */

import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3')
const BASE = 'https://movekit.com'
const OUTPUT = resolve(__dirname, '..', 'data', 'movekit-exercises.json')

// ── Step 1: Get all slugs from sitemap ──

async function fetchSlugs() {
  console.log('Fetching sitemap...')
  const res = await fetch(`${BASE}/sitemap.xml`)
  const xml = await res.text()

  const slugs = []
  const re = /\/exercises\/([a-z0-9-]+)/g
  let match
  while ((match = re.exec(xml)) !== null) {
    if (!slugs.includes(match[1])) slugs.push(match[1])
  }

  console.log(`Found ${slugs.length} exercise slugs`)
  return slugs
}

// ── Step 2: Extract exercise data from page ──

/** Extract the full exercise JSON object from Next.js RSC payload */
function extractExerciseJson(html, slug) {
  // Find {\"id\":\"...\",\"slug\":\"<slug>\" in the escaped RSC payload
  const re = new RegExp(`\\{\\\\?"id\\\\?":\\\\?"\\d+\\\\?",\\\\?"slug\\\\?":\\\\?"${slug}\\\\?"`)
  const m = html.match(re)
  if (!m) return null

  const start = m.index
  const chunk = html.slice(start, start + 15000)

  // Track brace depth, handling \" as quote delimiter in escaped JSON
  let depth = 0
  let inString = false
  let end = -1

  for (let i = 0; i < chunk.length; i++) {
    const c = chunk[i]
    if (c === '\\' && i + 1 < chunk.length && chunk[i + 1] === '"') {
      inString = !inString
      i++
      continue
    }
    if (c === '"' && (i === 0 || chunk[i - 1] !== '\\')) {
      inString = !inString
      continue
    }
    if (!inString) {
      if (c === '{') depth++
      if (c === '}') { depth--; if (depth === 0) { end = i + 1; break } }
    }
  }

  if (end === -1) return null

  const raw = chunk.slice(0, end)
  try {
    const unescaped = raw
      .replace(/\\\\n/g, '\\n')
      .replace(/\\\\t/g, '\\t')
      .replace(/\\\\"/g, '\\"')
      .replace(/\\"/g, '"')
    return JSON.parse(unescaped)
  } catch {
    return null
  }
}

async function fetchExerciseData(slug) {
  try {
    const res = await fetch(`${BASE}/exercises/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; exercise-scraper/1.0)' },
    })
    if (!res.ok) return null

    const html = await res.text()
    const json = extractExerciseJson(html, slug)

    // Fallback: extract video URL from HTML directly
    const previewMatch = html.match(/https:\/\/[^"'\s]+video-preview[^"'\s]+\.mp4/)
    const posterMatch = html.match(/https:\/\/[^"'\s]+\/exercises\/[^"'\s]+poster\.webp/)

    // Extract name from <h1> tag as fallback
    const h1Match = html.match(/<h1[^>]*>([^<]+)/)

    if (json) {
      return {
        slug,
        name: json.name || h1Match?.[1]?.trim() || slug,
        shortDescription: json.shortDescription || null,
        primaryMuscles: json.primaryMuscles || [],
        secondaryMuscles: json.secondaryMuscles || [],
        equipment: json.equipment || [],
        movementPattern: json.movementPattern || [],
        difficulty: json.difficulty || null,
        durationSeconds: json.durationSeconds || null,
        instructions: json.instructions || [],
        benefits: json.benefits || [],
        tags: json.tags || [],
        videoPreviewUrl: json.videoPreviewUrl || previewMatch?.[0] || null,
        posterUrl: json.posterImageUrl || posterMatch?.[0] || null,
      }
    }

    // Fallback if JSON extraction fails — at least get video
    return {
      slug,
      name: h1Match?.[1]?.trim() || slug,
      shortDescription: null,
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: [],
      movementPattern: [],
      difficulty: null,
      durationSeconds: null,
      instructions: [],
      benefits: [],
      tags: [],
      videoPreviewUrl: previewMatch?.[0] || null,
      posterUrl: posterMatch?.[0] || null,
    }
  } catch (err) {
    console.error(`  Error fetching ${slug}:`, err.message)
    return null
  }
}

// ── Step 3: Process with concurrency limit ──

async function processAll(slugs) {
  const results = []
  let done = 0
  let found = 0

  async function worker(queue) {
    while (queue.length > 0) {
      const slug = queue.shift()
      const data = await fetchExerciseData(slug)
      done++
      if (data) {
        results.push(data)
        found++
      }
      if (done % 10 === 0 || done === slugs.length) {
        console.log(`  ${done}/${slugs.length} processed, ${found} scraped`)
      }
    }
  }

  const queue = [...slugs]
  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue))
  await Promise.all(workers)

  return results
}

// ── Main ──

async function main() {
  const slugs = await fetchSlugs()

  console.log(`\nScraping ${slugs.length} pages (concurrency: ${CONCURRENCY})...\n`)
  const results = await processAll(slugs)

  // Sort by slug for readability
  results.sort((a, b) => a.slug.localeCompare(b.slug))

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2))
  console.log(`\nDone! ${results.length}/${slugs.length} exercises saved to ${OUTPUT}`)

  // Stats
  const withVideo = results.filter(r => r.videoPreviewUrl).length
  const withInstructions = results.filter(r => r.instructions.length > 0).length
  console.log(`  Videos: ${withVideo}, Instructions: ${withInstructions}`)
}

main().catch(err => { console.error(err); process.exit(1) })
