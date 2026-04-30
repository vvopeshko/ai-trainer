/**
 * Скачивает полный датасет Free Exercise DB (~870 упражнений)
 * и сохраняет в server/data/free-exercise-db.json.
 *
 * Запуск: node server/scripts/fetchFreeExerciseDB.js
 */

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'data', 'free-exercise-db.json')

const SOURCE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

async function main() {
  console.log('Fetching Free Exercise DB...')
  console.log(`URL: ${SOURCE_URL}\n`)

  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const exercises = await res.json()
  console.log(`Total exercises: ${exercises.length}\n`)

  // Статистика по мышцам
  const muscles = {}
  for (const ex of exercises) {
    for (const m of ex.primaryMuscles || []) {
      muscles[m] = (muscles[m] || 0) + 1
    }
  }
  console.log('=== Primary muscles ===')
  for (const [m, count] of Object.entries(muscles).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m}: ${count}`)
  }

  // Статистика по оборудованию
  const equipment = {}
  for (const ex of exercises) {
    const eq = ex.equipment || 'unknown'
    equipment[eq] = (equipment[eq] || 0) + 1
  }
  console.log('\n=== Equipment ===')
  for (const [eq, count] of Object.entries(equipment).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${eq}: ${count}`)
  }

  // Статистика по уровню
  const levels = {}
  for (const ex of exercises) {
    const l = ex.level || 'unknown'
    levels[l] = (levels[l] || 0) + 1
  }
  console.log('\n=== Difficulty levels ===')
  for (const [l, count] of Object.entries(levels).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${l}: ${count}`)
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(exercises, null, 2))
  console.log(`\nSaved to ${OUTPUT_PATH}`)
}

main().catch(e => {
  console.error('Failed:', e.message)
  process.exit(1)
})
