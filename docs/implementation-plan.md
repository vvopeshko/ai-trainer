# План реализации экранов мини-аппа

На основе [BRD §12](../BRD.md#12-спецификация-экранов-мини-аппа). Учитывает текущее состояние кодовой базы и принятые архитектурные решения.

**Создан:** 2026-04-24
**Обновлён:** 2026-04-26 (вечер)

---

## 0. Текущее состояние

### Что уже работает

| Слой | Готово |
|------|--------|
| **Prisma-схема** | 9 моделей + `ExerciseSource` enum, `source`, `gifUrl` на Exercise |
| **Сервер** | Auth middleware, бот, LLM-абстракция, analytics, identifyMachine, **exerciseResolver**, **seed/import скрипты**, **7 workout API**, **4 home API** (programs, stats, recent), **seedProgram** |
| **БД** | 57 упражнений seeded, 60 тренировок + 1687 подходов imported, 1 программа |
| **Фронт UI-кит** | Glass, Button, Icon (44), StatTile, ActivePill, GlassNav, GlassAINote, RestCard, Mesh, **BigStepper**, **TopBar** |
| **Фронт страницы** | **HomePage** (programme strip, hero, stats, recent), **WorkoutPage** (glass_v3 redesign: единый scrollable layout, rest timer, collapsed/active/upcoming), **SummaryPage** |
| **Фронт инфра** | i18n (`t()`), TelegramProvider, api.js, роутер, splash, токены, **TabLayout + GlassNav**, **FlowLayout** |

### Чего не хватает

| Слой | Не готово |
|------|-----------|
| **Сервер** | Edit/delete sets, AI-замена упражнений, progress/insights API, program CRUD, AI-генерация программ |
| **Фронт компоненты** | BottomSheet, Toast, Skeleton |
| **Фронт страницы** | Progress, ProgramEdit, ProgramLibrary |
| **Фронт инфра** | `ActiveWorkoutProvider` (React Context), deep-link парсер, offline-очередь |

---

## 1. Архитектурные решения

### 1.1 Resolve-слой упражнений (Вариант C: seed + auto-create)

**Проблема:** LLM (сканирование, генерация программ) возвращает упражнения как свободный текст. `WorkoutSet.exerciseId` — обязательный FK на `Exercise`. Без связки залогировать подход невозможно.

**Решение:** сервис `resolveExercise()` — единая точка входа для любого упоминания упражнения от LLM.

```
LLM ответ: { name: "Жим лёжа в Смите", nameEn: "Smith Machine Bench Press", ... }
                │
                ▼
     resolveExercise(llmExercise)
                │
    ┌───────────┼───────────────────────┐
    │           │                       │
    ▼           ▼                       ▼
  slug-match  alias-search          auto-create
  (slugify     (ilike по             (INSERT с
   nameEn)     aliases[])            source=ai)
    │           │                       │
    └───────────┴───────────────────────┘
                │
                ▼
          return exerciseId
```

**Алгоритм:**
1. `slugify(nameEn)` → точное совпадение по `Exercise.slug`
2. Поиск по `Exercise.aliases[]` — `@>` оператор PostgreSQL (массив содержит строку)
3. Нечёткий поиск по `nameRu` / `nameEn` (pg_trgm similarity > 0.5) — опционально в MVP, можно без него
4. Не найдено → создать новую запись `Exercise` с `source: 'ai_generated'`

**Изменение Prisma-схемы:**
```prisma
model Exercise {
  ...
  source  ExerciseSource  @default(seed)   // NEW
}

enum ExerciseSource {
  seed           // из seed-скрипта
  ai_generated   // auto-created LLM resolve
  user_created   // юзер добавил вручную (будущее)
}
```

**Файл:** `server/src/services/exerciseResolver.js`

**Используется в:**
- `identifyMachine.js` → после распознавания привязать suggestedExercises к реальным ID
- `generateProgram.js` → привязать упражнения программы к реальным ID
- Workout: добавление внепланового упражнения по имени

### 1.2 Seed-скрипт упражнений (Free Exercise DB + ExerciseDB OSS GIF-ки)

**Файл:** `server/scripts/seedExercises.js`

**Источники (комбинация двух баз):**

| База | Что берём | Лицензия |
|------|----------|----------|
| [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (873 упр.) | Основа: slug, name, primaryMuscles, secondaryMuscles, equipment, level, mechanic, force, instructions, images | Public Domain |
| [ExerciseDB OSS](https://oss.exercisedb.dev) (~1500 упр.) | Обогащение: анимированная GIF-демонстрация (`gifUrl`) | AGPL-3.0 |

**Протестировано (2026-04-24–26):** Free Exercise DB резолвит 67% (38/57) реальных упражнений автора из `workouts.json` простым текстовым матчем. С aliases + ручными маппингами — 100% (57/57). ExerciseDB OSS имеет качественные анимированные GIF-ки но жёсткий rate limit на free-tier (~25-50 запросов, потом 503). GIF-покрытие: 21/57 (дозагрузка через `server/data/fetch-missing-gifs.js`).

**Стратегия комбинации:**
1. Загрузить Free Exercise DB (JSON файл, мгновенно) — это основа
2. Отфильтровать до 100-150 силовых/зальных упражнений
3. Для каждого: slug, nameEn, nameRu (LLM/ручной маппинг), primaryMuscles, secondaryMuscles, equipment, difficulty, category, aliases[]
4. Для каждого — один поисковый запрос к ExerciseDB OSS API: `search(name)` → взять `gifUrl` из лучшего совпадения
5. Пауза 1.5с между запросами к OSS (100-150 упр. × 1.5с = ~3-4 минуты)
6. Сохранить `gifUrl` в поле `Exercise.gifUrl`
7. Upsert в БД по slug, `source: 'seed'`

**Runtime:** к ExerciseDB OSS API никогда не обращаемся — всё закэшировано в Exercise.gifUrl при seed.

**Запуск:** `cd server && node scripts/seedExercises.js` — разово, не на каждом деплое. Перезапуск безопасен (upsert).

### 1.3 Import исторических тренировок (валидация resolve-слоя)

**Файл:** `server/scripts/importWorkouts.js`

**Источник:** `prototype/mock_data/workouts.json` — реальные тренировки автора за 3 месяца:
- `exercises[]` — 57 уникальных упражнений (slug + name + bodyweight)
- `workouts[]` — 60 тренировок с подходами (~1687 сетов)
- `programs[]` — 2 программы (jan-split, ppl-arms)
- `stats{}` — помесячные агрегаты

**Зачем — две цели:**

1. **Валидация resolve-слоя.** 57 упражнений из реальных тренировок проходят через `exerciseResolver()` и стыкуются с каноничной базой из Free Exercise DB. Скрипт выводит отчёт:
   - Resolved by slug: N (точное совпадение slug)
   - Resolved by alias: N (нашли через aliases[])
   - Auto-created: N (не нашли в seed, создали с `source: 'ai_generated'`)
   - Цель: 80%+ resolved, остальное — повод дополнить aliases в seed

2. **Данные для разработки.** 60 тренировок + 2 программы дают реальные данные для Home/Progress/Stats экранов без ожидания месяца тренировок.

**Что делает:**
1. Читает `prototype/mock_data/workouts.json`
2. Для каждого упражнения — `resolveExercise({ nameEn, slug })` → exerciseId
3. Создаёт `Program` из `programs[]`
4. Создаёт `Workout` для каждой тренировки
5. Создаёт `WorkoutSet` для каждого подхода (с привязкой к resolved exerciseId)
6. Выводит resolve-отчёт в консоль

**Запуск:** `cd server && node scripts/importWorkouts.js` — после seedExercises, разово.

**Важно:** привязывает данные к конкретному userId (из env или аргумента). В dev — к dev-bypass юзеру, в проде — к `ADMIN_TELEGRAM_ID`.

### 1.3 Навигация — два режима layout

BRD §12.9: bottom-nav видна на Home / Progress, скрыта на Workout / Summary / ProgramEdit / ProgramLibrary.

```
<AppShell>
  ├─ <TabLayout>          ← GlassNav внизу, контент выше
  │    ├─ /home            (Home)
  │    ├─ /progress        (Progress)
  │    ├─ /library         (placeholder)
  │    └─ /profile         (placeholder)
  │
  └─ <FlowLayout>         ← TopBar с ← back, без GlassNav
       ├─ /workout/:id     (Workout)
       ├─ /summary/:id     (Summary)
       ├─ /program/:id     (ProgramEdit)
       └─ /programs        (ProgramLibrary)
```

**Файлы:**
- `src/layouts/TabLayout.jsx` — обёртка с GlassNav
- `src/layouts/FlowLayout.jsx` — обёртка с TopBar
- `src/components/ui/TopBar.jsx` — новый компонент

### 1.4 Стейт активной тренировки

Тренировка (startedAt, текущее упражнение, сделанные подходы) должна пережить навигацию Home ↔ Workout.

**Решение:**
- `ActiveWorkoutProvider` (React Context) в корне приложения
- При старте приложения: `GET /api/v1/workouts/active` — если есть незавершённая, восстанавливаем стейт
- Подходы: optimistic update в контексте → фоновый POST на сервер
- localStorage как fallback при разрыве сети (очередь pending-подходов)

**Файлы:**
- `src/contexts/ActiveWorkoutContext.jsx`
- `src/hooks/useActiveWorkout.js`

### 1.5 planJson — формализация структуры

Сейчас `Program.planJson` — неструктурированный JSON. Формализуем через Zod-схему:

```javascript
// server/src/schemas/program.js
const programDayExercise = z.object({
  exerciseId: z.string().uuid(),        // FK на Exercise
  slug: z.string(),                     // для UI без лишнего JOIN
  nameRu: z.string(),
  sets: z.number().int().positive(),
  repsMin: z.number().int().positive(),
  repsMax: z.number().int().positive(),
  restSec: z.number().int().default(90),
  notes: z.string().optional(),
  alternatives: z.array(z.string().uuid()).default([]),  // exerciseId[]
})

const programDay = z.object({
  title: z.string(),        // "День 1 — Грудь + Трицепс"
  subtitle: z.string().optional(),
  exercises: z.array(programDayExercise),
})

const planJsonSchema = z.object({
  days: z.array(programDay),
})
```

### 1.6 Новые UI-компоненты

| Компонент | Описание | Фаза |
|-----------|----------|------|
| `BigStepper` | ± кнопки для веса (шаг 2.5 кг) и повторов (шаг 1). Центральное значение крупным моно-шрифтом | 1 |
| `TopBar` | ← back + title + optional right action (⋯ / "Готово") | 1 |
| `BottomSheet` | Модалка снизу, backdrop blur, drag-handle | 3 |
| `Toast` | Уведомление поверх контента, auto-dismiss 2-3с | 3 |
| `Skeleton` | Загрузочные плейсхолдеры | 6 |

---

## 2. Фазы реализации

### Фаза 1 — Сквозной скелет ✅ ЗАВЕРШЕНА

**Цель:** открываю бота в зале → мини-апп → логирую реальный подход → данные в Neon. **Пройден.**

#### 1a. Seed + resolve + import ✅

- [x] `source` enum + `gifUrl` в Exercise (Prisma schema)
- [x] `server/data/enriched-exercises.json` (57 упр., полное покрытие, 21/57 gifUrl)
- [x] `server/scripts/seedExercises.js` — upsert по slug
- [x] `server/src/services/exerciseResolver.js` — slug → alias → auto-create
- [x] `server/scripts/importWorkouts.js` — 60 тренировок, 1687 подходов, 57/57 slug-match
- [x] Seed + import на проде

#### 1b. API для тренировок ✅

- [x] `GET /exercises` + `GET /exercises/search?q=`
- [x] `POST /workouts` (create/resume) + `GET /workouts/:id` + `GET /workouts/active`
- [x] `POST /workouts/:id/sets` + `PATCH /workouts/:id` (finish/delete)

#### 1c. Минимальный Workout-экран ✅

- [x] BigStepper, TopBar, FlowLayout
- [x] WorkoutPage — picker → stepper → log → finish
- [x] SummaryPage — "Готово!" + stat-tiles
- [x] Haptic feedback, optimistic updates
- [x] E2E в Telegram — работает

---

### Фаза 2 — Home-экран (BRD §12.1) ✅ ЗАВЕРШЕНА

**Цель:** главная страница с полной информацией: программа, статистика, инсайт, недавние тренировки. **Пройден.**

#### 2a. API для Home ✅

- [x] `GET /programs/active` — активная программа с днями
- [x] `GET /programs/active/next-workout` — следующая тренировка (день, упражнения, restSec)
- [x] `GET /stats/month` — `{ workouts, tonnage, streak }`
- [x] `GET /workouts/recent?limit=4` — недавние тренировки
- [ ] `GET /stats/year` — годовая статистика (отложено)
- [ ] `GET /insights/today` — AI-инсайт (отложено)

#### 2b. Home-экран ✅

- [x] TabLayout с GlassNav (4 таба)
- [x] HomePage — programme strip + hero + stat-tiles + недавние
- [x] Default / Active workout state (пульс + live-таймер + "Продолжить")
- [x] Роутинг: `/` → Home
- [x] `seedProgram.js` — генерация программы из исторических тренировок
- [ ] Empty state (новый юзер без программы)
- [ ] Loading skeleton
- [ ] `ActiveWorkoutProvider` (React Context) — отложено в техдолг

---

### Фаза 3 — Workout полный (BRD §12.2) — ЧАСТИЧНО ЗАВЕРШЕНА

**Цель:** полноценный экран тренировки — главный экран в зале.

#### 3a. Дополнительные API

**Сервер:**
- [ ] `PATCH /api/v1/workouts/:id/sets/:setId` — отменить / редактировать подход
- [ ] `POST /api/v1/workouts/:id/exercises` — добавить внеплановое упражнение (через exerciseResolver)
- [ ] `POST /api/v1/exercises/:id/replace-suggest` — AI-предложения замены

#### 3b. Workout-экран (glass_v3 redesign) — частично ✅

**Сделано:**
- [x] WorkoutTopBar (Glass strong, live-таймер, прогресс "упр 1/9 · 2/3 подх", ГОТОВО/ОТМЕНИТЬ)
- [x] Единый scrollable layout (вместо трёх отдельных режимов)
- [x] CollapsedExercise (свёрнутые завершённые упражнения с accent check)
- [x] ActiveSetInput (accent-tinted sub-card с BigStepper)
- [x] DoneSetRow (компактные строки выполненных подходов)
- [x] UpcomingExerciseItem (предстоящие упражнения с circle number)
- [x] Rest timer между подходами (RestCard с breathing radial, progress bar)
- [x] Авто-переход к следующему упражнению после всех подходов
- [x] Program-aware flow (PlanQueue, planned sets, pre-fill reps)
- [x] Cancel workout (0 подходов → "Отменить")
- [x] "+ Добавить подход"
- [x] Optimistic updates + haptic feedback

**Осталось:**
- [ ] Редактирование/удаление отдельных подходов
- [ ] BottomSheet: альтернативы, суперсет, AI-замена
- [ ] Quick actions: "Спросить тренера", "Фото тренажёра"
- [ ] Автоподстановка веса/повторов из прошлого подхода

---

### Фаза 4 — Summary + Progress (BRD §12.3, §12.4)

**Цель:** завершение тренировки и аналитика прогресса.

#### 4a. API для Progress

**Сервер:**
- [ ] `GET /api/v1/progress/plan-adherence` — план vs факт за неделю
- [ ] `GET /api/v1/progress/muscle-volume?period=week` — подходы по группам мышц
- [ ] `GET /api/v1/progress/insights?period=month` — плато, прогресс, регрессии
- [ ] `GET /api/v1/progress/imbalances?period=month` — дисбалансы
- [ ] `GET /api/v1/progress/records?period=month` — рекорды

#### 4b. Summary-экран (BRD §12.3)

**Фронт:**
- [ ] Зелёная иконка ✓ + "Готово!"
- [ ] 3 stat-tile: подходов, время, тоннаж
- [ ] CTA "К программе" → Home
- [ ] Haptic `notificationOccurred('success')`
- [ ] Триггер: бот шлёт развёрнутую сводку в Telegram через ~5с

#### 4c. Progress-экран (BRD §12.4)

**Фронт:**
- [ ] Адаптация плана (эта неделя) — featured-карточка с точечной визуализацией
- [ ] Подходы по мышцам — горизонтальный scroll-snap, 6 карточек с кольцами
- [ ] Прогрессивная перегрузка — чипы + expandable-карточки плато
- [ ] Дисбалансы — оранжевые карточки
- [ ] Рекорды месяца

---

### Фаза 5 — Programs (BRD §12.5, §12.6)

**Цель:** управление тренировочными программами.

#### 5a. API

**Сервер:**
- [ ] `GET /api/v1/programs/:id` — полная структура
- [ ] `PATCH /api/v1/programs/:id` — сохранить изменения
- [ ] `GET /api/v1/programs?include=archived` — все программы
- [ ] `POST /api/v1/programs/:id/activate` / `archive` / `duplicate`
- [ ] `DELETE /api/v1/programs/:id`
- [ ] `POST /api/v1/programs/generate` — AI-генерация (через generateProgram.js + resolveExercise)

#### 5b. ProgramEdit (BRD §12.5)

**Фронт:**
- [ ] Описание программы (gradient-карточка)
- [ ] Цели по мышцам (компактный список)
- [ ] Тренировочные дни (collapsible-карточки)
- [ ] Список упражнений с CRUD (× удалить, + добавить)
- [ ] Dirty-state → "Сохранить изменения"

#### 5c. ProgramLibrary (BRD §12.6)

**Фронт:**
- [ ] "Сейчас активна" featured-карточка
- [ ] "Собрать новую с тренером" — handoff в бот
- [ ] Мои программы + архив (collapsible)

---

### Фаза 6 — Cross-cutting (BRD §12.9) + Polish

- [ ] Deep-link парсер (`src/utils/deepLink.js`) + роутинг по start_param
- [ ] Toast система (React Context + Portal)
- [ ] Empty states (универсальный паттерн: иконка + текст + CTA)
- [ ] Loading states (Skeleton-компоненты)
- [ ] Error states (toast "Нет связи" + retry)
- [ ] Offline-очередь pending подходов (localStorage)
- [ ] Bot ↔ mini-app handoffs ("Спросить тренера", "Сфоткать тренажёр")

---

### Placeholder'ы (не в MVP)

- **Профиль (§12.7)** — страница-заглушка с аватаром и текстом "Скоро здесь будут настройки"
- **Библиотека упражнений (§12.8)** — заглушка "Скоро здесь будет каталог упражнений"

---

## 3. API-карта (все эндпоинты по фазам)

### Фаза 1
```
GET    /api/v1/exercises                    — список упражнений
GET    /api/v1/exercises/search?q=          — поиск
POST   /api/v1/workouts                    — создать тренировку
GET    /api/v1/workouts/:id                — тренировка с подходами
GET    /api/v1/workouts/active             — незавершённая тренировка
POST   /api/v1/workouts/:id/sets           — залогировать подход
PATCH  /api/v1/workouts/:id                — завершить тренировку
```

### Фаза 2
```
GET    /api/v1/programs/active             — активная программа
GET    /api/v1/programs/active/next-workout — следующая тренировка
GET    /api/v1/stats/year                  — годовая статистика
GET    /api/v1/stats/month                 — месячная статистика
GET    /api/v1/workouts/recent?limit=4     — недавние тренировки
GET    /api/v1/insights/today              — AI-инсайт дня
```

### Фаза 3
```
PATCH  /api/v1/workouts/:id/sets/:setId    — отмена/редакция подхода
POST   /api/v1/workouts/:id/exercises      — внеплановое упражнение
POST   /api/v1/exercises/:id/replace-suggest — AI-замена
```

### Фаза 4
```
GET    /api/v1/progress/plan-adherence     — план vs факт
GET    /api/v1/progress/muscle-volume      — подходы по мышцам
GET    /api/v1/progress/insights           — плато/прогресс/регрессии
GET    /api/v1/progress/imbalances         — дисбалансы
GET    /api/v1/progress/records            — рекорды месяца
```

### Фаза 5
```
GET    /api/v1/programs/:id                — структура программы
PATCH  /api/v1/programs/:id                — сохранить
GET    /api/v1/programs?include=archived   — все программы
POST   /api/v1/programs/:id/activate       — активировать
POST   /api/v1/programs/:id/archive        — архивировать
POST   /api/v1/programs/:id/duplicate      — копия
DELETE /api/v1/programs/:id                — удалить
POST   /api/v1/programs/generate           — AI-генерация
```

---

## 4. Изменения в Prisma-схеме

### Фаза 1
```prisma
// Новый enum
enum ExerciseSource {
  seed
  ai_generated
  user_created
}

// В модель Exercise добавить:
source  ExerciseSource  @default(seed)
gifUrl  String?                          // анимированная GIF из ExerciseDB OSS, кэшируется при seed
```

### Возможные будущие изменения
- `Workout.dayTitle` (String?) — сохранять название дня из программы для истории
- `WorkoutSet.isSkipped` (Boolean) — пропущенный подход (отличать от невыполненного)
- `Program.archivedAt` (DateTime?) — вместо удаления

---

## 5. Зависимости между фазами

```
Фаза 1 ✅ (seed + API + Workout UI)
    │
    ├──▶ Фаза 2 ✅ (Home + programs)
    │         │
    │         ▼
    │    Фаза 5 (Programs CRUD + AI-генерация)
    │
    ├──▶ Фаза 3 ⚡ (Workout: glass_v3 done, API edit/AI-замена осталось)
    │
    ├──▶ Фаза 4 (Summary + Progress) ── требует: N тренировок в БД
    │
    └──▶ Фаза 6 (polish)
```

**Следующий шаг:** Фаза 3 остаток (edit sets API, AI-замена) + Фаза 4 (Progress).
