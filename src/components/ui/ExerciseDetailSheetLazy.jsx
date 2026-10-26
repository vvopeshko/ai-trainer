import { lazy, Suspense } from 'react'
import { loadExerciseDetailSheet } from './lazyChunks.js'

// Ленивая обёртка над ExerciseDetailSheet (~18 KB, 1000+ строк): fullscreen
// overlay, всегда открывается по тапу. Пока шит ни разу не открыт (open=false)
// чанк не тянется вовсе — сам компонент тоже делает `if (!open) return null`,
// так что поведение эквивалентно, но 18 KB уходят из критического пути.
// Чанк греется в idle (App): первый тап по упражнению не ждёт сеть
const Inner = lazy(() => loadExerciseDetailSheet().then((m) => ({ default: m.ExerciseDetailSheet })))

export function ExerciseDetailSheet(props) {
  if (!props.open) return null
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  )
}
