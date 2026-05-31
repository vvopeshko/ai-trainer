# Code Style Guide

Правила стиля на основе реальных паттернов кодовой базы (~50 файлов). Не идеальный стандарт, а фиксация того, как пишем.

---

## 1. Именование

| Что | Конвенция | Примеры |
|-----|-----------|---------|
| React-компоненты (файлы) | PascalCase `.jsx` | `HomePage.jsx`, `Glass.jsx`, `MuscleGroupCard.jsx` |
| Суб-компоненты (вложенные) | PascalCase в папке | `home/YearHeader.jsx`, `workout/DoneSetRow.jsx` |
| Бэкенд (controllers, routes, utils) | camelCase `.js` | `workoutController.js`, `telegramAuth.js`, `llm.js` |
| Сервисы | camelCase `.js` | `importProgram.js`, `exerciseResolver.js` |
| Переменные, функции | camelCase | `handleStart`, `currentExercise`, `fetchWithTimeout` |
| Props | camelCase | `onConfirm`, `isExpanded`, `variant` |
| Модульные константы (lookup-maps) | UPPER_CASE | `ICON_PATHS`, `MUSCLE_ICONS`, `MUSCLE_ZONE_MAP` |
| Env-переменные | UPPER_CASE | `DATABASE_URL`, `VITE_API_URL` |
| React state | camelCase пара | `[doneSets, setDoneSets]` |

**Правила:**
- Функции-хэндлеры: `handle` + действие → `handleStart`, `handleContinue`, `handleDelete`
- Булевы переменные: `is`/`has`/`can` + прилагательное → `isExpanded`, `hasAnySets`, `canFinish`
- Loading-стейт: глагол в ing-форме → `starting`, `finishing`, `loading`

---

## 2. Компоненты

### Структура файла

```jsx
// Импорты (см. §4)
import { useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation.js'
// ...

// Вспомогательные функции/константы (если нужны только здесь)
function getStatus(actual, target) { /* ... */ }

// Компонент
export function MuscleGroupCard({ group, onTap }) {
  const { t } = useTranslation()

  // hooks
  const [expanded, setExpanded] = useState(false)

  // handlers
  const handleTap = () => onTap(group.id)

  // computed (не state!)
  const isComplete = group.actual >= group.target

  // render
  return <div>...</div>
}
```

### Экспорты

| Тип | Экспорт | Импорт |
|-----|---------|--------|
| UI-компоненты | Named: `export function Button()` | Из barrel: `import { Button } from '../../components/ui/index.js'` |
| TopBar, BigStepper | Default: `export default function TopBar()` | Напрямую: `import TopBar from '../../components/ui/TopBar.jsx'` |
| Страницы | Default: `export default function HomePage()` | Через `lazy()` или напрямую |
| Суб-компоненты | Named: `export function YearHeader()` | Из файла: `import { YearHeader } from './home/YearHeader.jsx'` |

### Размеры

- **Страницы** (HomePage, WorkoutPage): до 400–1200 строк — допустимо, выносить суб-компоненты в `./pageName/`
- **Средние** (MuscleGroupCard): 200–350 строк, допускают internal helper-компоненты (RingChart, StatusBadge)
- **UI** (Button, Glass): 30–80 строк, чистая презентация

---

## 3. Стилизация

### Inline styles + CSS tokens

Основной способ. Tailwind классы — только точечно (`.min-h-screen`, `.flex` в layout).

```jsx
// ✅ Правильно: токены через var()
<div style={{
  padding: 'var(--space-4)',
  color: 'var(--fg-secondary)',
  fontSize: 'var(--text-sm)',
  maxWidth: 480,
  margin: '0 auto',
}}>

// ✅ Accent-цвета через HSL
<span style={{ color: 'hsl(var(--accent-h,158),55%,72%)' }}>

// ❌ Неправильно: хардкод цвета
<div style={{ color: '#888', background: 'rgba(0,0,0,0.5)' }}>
```

### Основные токены

| Группа | Токены |
|--------|--------|
| Spacing | `--space-1`…`--space-10` (шаг 4px) |
| Text | `--fg-primary`, `--fg-secondary`, `--fg-tertiary`, `--fg-disabled` |
| Surface | `--bg-app`, `--surface-0`, `--surface-1` |
| Semantic | `--success`, `--warning`, `--danger` |
| Typography | `--text-xs`, `--text-sm`, `--text-base`, `--text-lg` |
| Accent | `hsl(var(--accent-h,158), %, %)` |

### Glass — основа карточек

```jsx
// ✅ Используем Glass-компонент
<Glass padding="var(--space-4)" radius={16}>
  {children}
</Glass>

// ❌ Не создаём div с ручным backdrop-filter
<div style={{ background: 'rgba(...)', backdropFilter: 'blur(...)' }}>
```

### Safe Area

CSS-переменные `--safe-top` / `--safe-bottom` устанавливаются TelegramProvider. Используются в layout-компонентах для отступов.

---

## 4. Импорты

### Порядок (фронтенд)

```jsx
// 1. React
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// 2. Хуки проекта
import { useTranslation } from '../../i18n/useTranslation.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'

// 3. Утилиты
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/api.js'

// 4. UI-компоненты
import { Glass, Button, Icon, ConfirmDialog } from '../../components/ui/index.js'
import TopBar from '../../components/ui/TopBar.jsx'

// 5. Суб-компоненты
import { YearHeader } from './home/YearHeader.jsx'
import { ProgrammeHero } from './home/ProgrammeHero.jsx'
```

### Порядок (бэкенд)

```js
// 1. Node built-ins
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'

// 2. Third-party
import { z } from 'zod'

// 3. Локальные
import prisma from '../utils/prisma.js'
import { track } from '../utils/analytics.js'
import llm from '../utils/llm.js'
```

### Правила

- **Всегда** указывать расширение: `.js`, `.jsx`
- **Barrel** (`index.js`) — только для `components/ui/`; остальное — прямой импорт
- **ESM only** — `import`/`export`, никогда `require()`

---

## 5. Стейт и эффекты

### useState — группировка по смыслу

```jsx
// Данные тренировки
const [workoutId, setWorkoutId] = useState(null)
const [currentExercise, setCurrentExercise] = useState(null)
const [doneSets, setDoneSets] = useState([])

// UI-состояние
const [picking, setPicking] = useState(false)
const [finishing, setFinishing] = useState(false)
```

### useEffect — паттерн с cancellation

```jsx
useEffect(() => {
  let cancelled = false

  apiGet('/api/v1/workouts/active')
    .then(data => { if (!cancelled) applyData(data) })
    .catch(() => { if (!cancelled) setPicking(true) })

  return () => { cancelled = true }
}, [])
```

### useEffect — таймеры

```jsx
useEffect(() => {
  if (!startedAt || pausedAt) return
  const tick = () => setElapsedSec(/* calc */)
  tick()
  const interval = setInterval(tick, 1000)
  return () => clearInterval(interval)
}, [startedAt, pausedAt, totalPausedMs])
```

### Computed values — не state!

```jsx
// ✅ Вычисляемое — const или useMemo
const hasAnySets = allExercises.length > 0 || doneSets.length > 0
const totalDone = allExercises.reduce((s, e) => s + e.sets.length, 0)

// ❌ Не хранить вычисляемое в state
const [hasAnySets, setHasAnySets] = useState(false) // лишний стейт
```

### useMemo — для тяжёлых вычислений

```jsx
const workoutMuscles = useMemo(() => {
  if (!hasPlan) return []
  // heavy computation...
  return result
}, [hasPlan, allExercises, currentExercise])
```

### Optimistic updates

```jsx
// Обновляем UI сразу, API — в фоне
setData(prev => ({ ...prev, activeWorkout: null }))
apiDelete(`/api/v1/workouts/${id}`).catch(() => {})
```

---

## 6. API-клиент

### Вызовы

```jsx
// GET
const data = await apiGet('/api/v1/workouts/active')

// POST с телом
const result = await apiPost('/api/v1/workouts', { programId, programDayIndex })

// PATCH
await apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'finish' })

// DELETE
await apiDelete(`/api/v1/workouts/${id}`)
```

### Обработка ошибок

```jsx
// Критичное действие — try/catch с UI-feedback
try {
  await apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'finish' })
} catch (err) {
  console.error('Failed to finish:', err)
  setFinishing(false) // сброс loading-стейта
}

// Fire-and-forget — .catch(() => {})
apiPost('/api/v1/exercises/batch-last-results', { exerciseIds })
  .then(r => setCache(r.results))
  .catch(() => {})
```

### Ошибка содержит

```js
err.status   // HTTP код
err.payload  // JSON-тело ответа сервера
err.message  // payload?.error ?? `HTTP ${status}`
```

---

## 7. Бэкенд

### Роуты

```js
import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { list, create, update } from '../controllers/workoutController.js'

const router = Router()
router.use(telegramAuth)

router.get('/', list)
router.post('/', create)
router.patch('/:id', update)

export default router
```

### Контроллеры

```js
export async function create(req, res) {
  // 1. Валидация (Zod inline)
  const data = z.object({
    programId: z.string().uuid().optional(),
  }).parse(req.body)

  // 2. Бизнес-логика (Prisma)
  const workout = await prisma.workout.create({
    data: { userId: req.user.id, programId: data.programId },
    include: { sets: true },
  })

  // 3. Аналитика (fire-and-forget, без await)
  track(req.user.id, 'workout_started', { workoutId: workout.id })

  // 4. Ответ
  res.status(201).json({ workout })
}
```

### Валидация — Zod inline

```js
// Query params
const { muscle, limit } = z.object({
  muscle: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1500).default(100),
}).parse(req.query)

// Body
const { exerciseIds } = z.object({
  exerciseIds: z.array(z.string().uuid()).min(1).max(50),
}).parse(req.body)
```

ZodError перехватывается `errorHandler` middleware → 400.

### Prisma

```js
// Стандартные запросы — через Prisma client
const workout = await prisma.workout.findFirst({
  where: { userId: req.user.id, finishedAt: null },
  include: { sets: { orderBy: { setOrder: 'asc' } } },
})

// Сложные (CTE, агрегации, unnest) — raw SQL
const exercises = await prisma.$queryRaw`
  SELECT * FROM "Exercise"
  WHERE EXISTS (
    SELECT 1 FROM unnest(aliases) AS a
    WHERE lower(a) LIKE '%' || ${term} || '%'
  )
`
```

### LLM

- Только через `server/src/utils/llm.js` (`llm.chat()`, `llm.vision()`)
- Промпты — `.md` файлы в `services/aiTrainer/prompts/`, читаются `readFileSync` при загрузке модуля
- Парсинг ответов — `utils/parseJsonFromLLM.js`

### Аналитика

```js
// Всегда fire-and-forget, без await
track(req.user.id, 'workout_started', { workoutId: workout.id })
```

---

## 8. i18n

### Правила

- **Все** UI-строки через `t()`, никаких хардкодов в JSX
- Параметры через `{{param}}`: `t('workout.hello', { name })`
- Namespace через точку: `home.yearGoal`, `progress.muscle.title`
- В MVP поддерживаем `ru`, но всё через `t()` сразу

### Использование

```jsx
const { t } = useTranslation()

// Простая строка
<div>{t('home.yearGoal')}</div>

// С параметрами
<span>{t('progress.week.planDone', { n: extra })}</span>
```

### Формат ключей в translations.js

```js
export const translations = {
  ru: {
    'home.yearGoal': 'За год {{done}}/{{target}}',
    'workout.sets': '{{n}} подходов',
  },
}
```

---

## 9. Чеклист для нового кода

### Фронтенд

- [ ] Файл `.jsx`, PascalCase, named export (или default для страниц)
- [ ] Стили — inline `style={}` с токенами (`var(--space-4)`, `var(--fg-primary)`)
- [ ] Цвета — только из токенов, accent через `hsl(var(--accent-h,158),...)`
- [ ] Карточки — через `<Glass>`, не самодельный backdrop-filter
- [ ] Строки — через `t('namespace.key')`, не хардкод
- [ ] Импорты с расширением `.js`/`.jsx`
- [ ] useEffect с `let cancelled = false` для async-операций
- [ ] Computed values — const/useMemo, не лишний useState
- [ ] API ошибки — try/catch для критичных, `.catch(() => {})` для фоновых

### Бэкенд

- [ ] Файл `.js`, camelCase
- [ ] ESM: `import`/`export`, не `require()`
- [ ] Валидация — Zod inline в контроллере
- [ ] `req.user.id` — из telegramAuth middleware, не из body
- [ ] Prisma — стандартные запросы через client, сложные — raw SQL
- [ ] LLM — только через `utils/llm.js`, не SDK напрямую
- [ ] Аналитика — `track()` без await
- [ ] Ответ — `res.json({})` или `res.status(201).json({})`
