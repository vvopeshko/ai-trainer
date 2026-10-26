import { lazy, Suspense } from 'react'
import { loadBodyMap } from './lazyChunks.js'

// Ленивая обёртка над BodyMap: библиотека body-muscles (~26 KB, SVG-данные
// 70+ зон) выносится из main-чанка в отдельный async-чанк, общий для всех
// экранов. Фолбэк — пустой блок той же высоты (на Workout и Progress карта
// видна сразу: без него контент прыгал на 160–260 px). Чанк греется в idle (App).
const BodyMapInner = lazy(() => loadBodyMap().then((m) => ({ default: m.BodyMap })))

export function BodyMap(props) {
  return (
    <Suspense fallback={<div style={{ height: props.height ?? 240 }} />}>
      <BodyMapInner {...props} />
    </Suspense>
  )
}
