import { lazy, Suspense } from 'react'

// Ленивая обёртка над BodyMap: библиотека body-muscles (~26 KB, SVG-данные
// 70+ зон) выносится из main-чанка в отдельный async-чанк, общий для всех
// экранов. BodyMap везде рендерится условно (в BottomSheet/карточке после
// интеракции), поэтому null-фолбэк на время загрузки чанка допустим.
const BodyMapInner = lazy(() =>
  import('./BodyMap.jsx').then((m) => ({ default: m.BodyMap })),
)

export function BodyMap(props) {
  return (
    <Suspense fallback={null}>
      <BodyMapInner {...props} />
    </Suspense>
  )
}
