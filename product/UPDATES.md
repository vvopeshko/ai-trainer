# UPDATES — AI Trainer

Хронологический changelog. Новые записи — сверху. Фиксируем всё, что реально сделано (не планы — для них [NEXT_PLANS.md](NEXT_PLANS.md)).

---

## 2026-06-13 — Fix: Railway deploy (cross-platform npm lock file)

### Проблема

После миграции на TanStack Query Railway deploy начал падать на `npm ci` с ошибкой `Missing: @emnapi/core@1.11.1 from lock file`. Корневая причина: lock file, сгенерированный npm на macOS, не содержит Linux platform-specific optional dependencies (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`). Эти пакеты — transitive deps от lightningcss/rolldown (через vitest → vite). `npm ci` строго валидирует lock file и падает при несовпадении.

### Что НЕ сработало

| Попытка | Почему не помогла |
|---------|-------------------|
| Регенерация lock file на macOS | macOS npm не резолвит Linux optional deps |
| `@emnapi/*` как explicit dependencies | Не решает проблему — npm ci всё равно валидирует transitive deps |
| `.node-version` в корне репо | Railway rootDirectory = `/server`, файл в корне не виден |
| `.node-version` в `server/` | Railpack игнорирует `.node-version`, использует свой default |
| `railpack.json` с `installCmd` | Невалидный ключ конфига, Railpack игнорирует |
| `.npmrc` с `os[]=linux` | Неполное решение: резолвит часть deps, но версии расходятся (`@emnapi/wasi-threads@1.2.1` vs `1.2.2`), не все transitive deps включаются |

### Что сработало

`server/railpack.json` с правильным форматом по [документации Railpack](https://railpack.com/config/file/):

```json
{
  "$schema": "https://schema.railpack.com",
  "packages": { "node": "24" },
  "steps": {
    "install": { "commands": ["npm install"] }
  }
}
```

- `packages.node: "24"` — пиннинг Node-версии (совпадает с локальной dev-машиной)
- `steps.install.commands: ["npm install"]` — вместо `npm ci`. `npm install` на Linux резолвит platform-specific deps нативно, не полагаясь на lock file

### Выводы

1. **Railpack конфиг:** формат — `steps.install.commands`, НЕ `installCmd`. Схема: `https://schema.railpack.com`
2. **Cross-platform lock files:** npm lock file привязан к платформе. macOS ≠ Linux для optional deps с native bindings
3. **`.npmrc os[]=linux`** — ненадёжный workaround. Неполное/некорректное разрешение transitive deps
4. **Railway rootDirectory:** все конфиги (`.node-version`, `railpack.json`, `.npmrc`) должны лежать в директории, указанной как rootDirectory, а не в корне репо

---

## 2026-06-12 — Миграция на TanStack Query (кэш-слой данных)

### Что сделано

- Установлен `@tanstack/react-query` (~13 KB gzip), создана инфраструктура: `queryClient.js`, `queryKeys.js`, `queries.js`, `mutations.js`
- **Удалены** `HomeDataContext` и `ProgressDataContext` — заменены на отдельные useQuery hooks по каждому endpoint
- Каждый экран подписывается только на нужные ключи (Home: 5 queries вместо 8-в-1, Progress: 3 queries вместо 7+1)
- `staleTime` по endpoint: stats 5 мин, programs 10 мин, catalog 24ч, active workout 30 сек
- Дедупликация: Home и Progress оба подписаны на `stats.month` — один запрос
- Optimistic updates через mutation hooks: cancel/resume/finish workout, delete recent workout
- `ExerciseDetailSheet` использует `useExerciseDetail` с `placeholderData` из catalog cache — открывается мгновенно
- Library (`useExerciseCatalog`) кэширует каталог на 24ч — повторный заход мгновенный
- ProgramEditPage: `useProgramDetail` + `useProgramList` + targeted invalidation вместо `refresh()`
- WorkoutPage: `queryClient.getQueryData` для одноразового чтения cached active workout
- Prefetch ProgressPage и LibraryPage данных через `requestIdleCallback` в App.jsx
- Suspense fallback: `<PageSkeleton />` вместо `null` для lazy-loaded tabs
- Provider chain: `BrowserRouter > ErrorBoundary > TranslationProvider > TelegramProvider > ToastProvider > QueryClientProvider > ActiveWorkoutProvider > App`

---

## 2026-06-12 — Фаза 2: UX polish (timezone, workout persistence, summary)

### Timezone-aware date boundaries

- `X-Timezone` заголовок отправляется из фронтенда во все API-запросы (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- `telegramAuth` middleware сохраняет timezone в User при создании и обновляет при изменении (debounced)
- `getUserTimezone(req)` хелпер в `server/src/utils/dateUtils.js` — приоритет: header > user.timezone > UTC
- `statsController`: month/year/streak запросы используют PostgreSQL `AT TIME ZONE` вместо JS Date math
- `progressController`: week/month boundaries через `DATE_TRUNC(..., NOW() AT TIME ZONE $tz)` из PostgreSQL
- Удалена `getMonday()` JS-функция — заменена на SQL

### ActiveWorkoutProvider — сохранение состояния тренировки при навигации

- `ActiveWorkoutContext` — React Context с `useRef`-буфером (без лишних ре-рендеров)
- WorkoutPage сохраняет ephemeral state при unmount: currentExercise, doneSets, partialSets, planExercises reorder, planIndex, resting
- При возврате на WorkoutPage — восстановление сохранённого состояния (если workoutId совпадает)
- При finish/cancel — `clear()` очищает буфер
- Добавлен в provider chain: `HomeDataProvider > ProgressDataProvider > ActiveWorkoutProvider > App`

### Summary — тоннаж + мышцы + упражнения

- WorkoutPage `handleFinish()` вычисляет tonnageKg и собирает muscles из allExercises + doneSets + partialSets
- SummaryPage: 2×2 grid (подходы, время, упражнения, тоннаж) вместо 2-3 колонок
- Мышечные группы отображаются как chip-badges под тайлами
- Новый i18n-ключ `summary.exercises`

### Тесты

- `dateUtils.test.js` — 5 тестов для getUserTimezone

---

## 2026-06-12 — Фаза 1: Корректность и устойчивость

### Backend: race condition, auth debounce, alternatives fix

**Workout race condition → `$transaction`:**
- `workoutController.create()` обёрнут в `prisma.$transaction()` — findFirst + delete + create атомарны
- Исключает создание дублирующих тренировок при двойном тапе / конкурентных запросах

**Auth: debounce DB writes:**
- `telegramAuth` больше не делает upsert с `lastSeenAt` + `sessionsCount` на КАЖДЫЙ HTTP-запрос
- In-memory `Map` с debounce 5 мин: `lastSeenAt` обновляется fire-and-forget раз в 5 мин
- Upsert оставлен с пустым `update: {}` (для первого визита)
- Снижение нагрузки на БД: ~10 writes → 1 за 5 мин на юзера

**Alternatives: slug → UUID:**
- `generateProgram.js` и `importProgram.js` теперь резолвят alternative slugs через `resolveExercise()`
- Раньше LLM возвращал slug-строки, workoutController искал их как UUID → альтернативы всегда пустые

### Frontend: AbortSignal, race fix, error state

**`api.js` — AbortSignal support:**
- `fetchWithTimeout()` совмещает внешний signal с timeout-controller через `AbortSignal.any()`
- Все функции (`apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`) принимают `{ signal }` в options

**`HomeDataContext` — race fix + error state:**
- `AbortController` ref отменяет предыдущий запрос при повторном `refresh()`
- Новое поле `error: true` при полном сбое сети (все 7 запросов вернули null)
- `signal.aborted` проверяется перед `setState` — отменённые запросы не перетирают свежие данные

**`ProgressDataContext` — error state:**
- Аналогичное поле `error: true/false` при сбое/успехе запроса

### Toast для ошибок API

- `useToast()` подключён в `HomePage`, `WorkoutPage`, `ProgramEditPage`
- `handleStart` catch → `t('errors.workoutStart')`
- `handleSetDone` catch → `t('errors.network')`
- `handleFinish` catch → `t('errors.workoutFinish')`
- `handleSave` catch → `t('errors.saveFailed')`
- `handleActivate` catch → `t('errors.network')`
- 4 новых i18n-ключа: `errors.network`, `errors.workoutStart`, `errors.workoutFinish`, `errors.saveFailed`

### Тесты и lint

**Реальные тесты (замена заглушек):**
- `src/utils/api.test.js` — 9 тестов: auth header, apiGet/apiPost/apiPatch/apiDelete, error shape, signal passthrough
- `server/src/services/exerciseResolver.test.js` — 5 тестов: slug path, alias path, auto-create path, race condition handling

**ESLint для server/:**
- `eslint.config.js` — добавлен серверный блок (`server/src/**/*.js`, Node globals)
- React 19 strict rules (`set-state-in-effect`, `refs`, `preserve-manual-memoization`) даунгрейднуты в warnings
- `no-empty` с `allowEmptyCatch: true` — предотвращает ложные ошибки на catch-блоках

**Pre-push:**
- `.husky/pre-push` — добавлен `npm run lint` перед build и тестами

---

## 2026-06-12 — Фаза 0: Security hardening

### Исправления безопасности по результатам code review

5 уязвимостей закрыты, добавлен rate limiting.

**telegramAuth — replay-атаки и dev_bypass:**
- `auth_date` валидация: initData старше 24 часов отклоняется (после проверки HMAC)
- `dev_bypass` переключён с `NODE_ENV !== 'production'` на явный `ALLOW_DEV_BYPASS=true` env var (fail-closed — без переменной bypass отключён)

**workoutController — IDOR на programId:**
- `create()`: добавлена проверка владельца программы перед созданием тренировки (403 если чужая)
- `getActive()`: `findUnique` → `findFirst` с фильтром `userId` при загрузке связанной программы

**errorHandler — утечка внутренних ошибок:**
- При status >= 500 возвращается generic "Internal Server Error" вместо `err.message`
- Клиентские ошибки (< 500) по-прежнему возвращают конкретное сообщение

**Rate limiting (express-rate-limit):**
- Новый middleware `server/src/middleware/rateLimiter.js`
- Глобальный лимит: 100 req/мин на пользователя (по Authorization header) на `/api/v1`
- LLM-лимит: 5 req/мин на `/programs/import` (защита от LLM cost abuse)
- Ключ — Authorization header (не IP), `validate: { ip: false }`

**Input validation / body limits:**
- `importBodySchema.text`: добавлен `.max(50000)` (50KB) для защиты от гигантских LLM-запросов
- Глобальный body limit снижен с 10MB до 1MB (`express.json({ limit: '1mb' })`)

**Тесты:**
- `telegramAuth.test.js`: обновлены тесты dev_bypass (ALLOW_DEV_BYPASS), добавлен тест expired initData
- `errorHandler.test.js`: тест на скрытие internal errors при 500, тест на сохранение err.message при 400
- Хелпер `buildValidInitData()` для генерации валидных initData в тестах

**Конфигурация:**
- `server/.env.example`: добавлен `ALLOW_DEV_BYPASS=true`
- `server/.env`: добавлен `ALLOW_DEV_BYPASS=true` для локальной разработки

---

## 2026-06-02 — Backend persistence для настроек упражнений

### Серверная синхронизация exercise settings

Настройки упражнений (preset, unit, step, stepUnit, minWeight, maxWeight, type) ранее хранились только в localStorage. Добавлена серверная персистенция для синхронизации между устройствами.

**Backend:**
- Новая Prisma-модель `UserExerciseSettings` — `@@unique([userId, exerciseSlug])`, все колонки с default → безопасно через `db push`
- `GET /api/v1/exercises/settings` — все настройки пользователя как `{ [slug]: {...} }`
- `PUT /api/v1/exercises/settings/:slug` — upsert с Zod-валидацией
- Роуты зарегистрированы перед `/:id` (иначе `settings` ловится как id)

**Frontend:**
- `apiPut()` — новая функция в `src/utils/api.js`
- `syncSettingsFromServer(settingsMap)` — мёрж серверных настроек в localStorage (сервер приоритетнее)
- `saveSettingsToServer(slug, settings)` — fire-and-forget PUT при каждом изменении настроек
- `HomeDataContext` — fetch настроек параллельно с остальными данными при инициализации
- `ExerciseDetailSheet` — `handleSettingsChange` вызывает `saveSettingsToServer` fire-and-forget

**Архитектура:** localStorage остаётся как кэш для мгновенного чтения, сервер — source of truth для cross-device sync.

---

## 2026-06-01 — ExerciseDetailSheet: визуальная полировка

### Production-quality glass UI

ExerciseDetailSheet переработан из прототипа в production-ready по дизайн-макету:

**Новые компоненты:**
- **Header** — круглые кнопки 38px (back + swap-заглушка), двустрочный центр (название + «мышца · оборудование»)
- **SegTabs** — pill-контейнер, active tab с accent-цветом
- **DemoMedia** — 4:3 карточка с radial gradient, pill-бейдж (GIF/Video), objectFit cover
- **VideoRow** — единая Glass-карточка, строки с разделителями, 62×42 превью с play overlay
- **StepCard** — пронумерованные Glass-карточки для шагов техники (accent-tinted номера)
- **Chip** — 3 варианта (primary/neutral/meta) с иконками
- **Toggle2** — glass-контейнер, иконки для типа упражнения (list/clock)
- **Stepper** — заменил `<input type="number">` для шага веса (−/+ кнопки, десятичная запятая)
- **NumberField** — стилизованный инпут с суффиксом
- **Save button** — accent, иконка check, сохраняет + закрывает overlay

**Контент:**
- Русское описание (`descriptionRu`) и типичные ошибки перенесены на вкладку "Инструкции"
- Секция "Характеристики" (difficulty + category с иконками) на вкладке "Мышцы"
- BodyMap с подписями "спереди"/"сзади"
- fadeUp-анимация при переключении табов

**Интеграция с WorkoutPage:**
- Кнопка info (ⓘ) рядом с названием упражнения
- Настройки (unit, step, weight range) передаются из overlay в ActiveSetInput
- Убран inline kg/lbs toggle — теперь через ExerciseDetailSheet

**Утилиты:**
- `EQUIPMENT_NAME` + `getEquipmentName()` в muscleMapping.js
- `getExerciseSettings()` / `setExerciseSettings()` в weightUnit.js (localStorage, миграция из старого формата)
- 8 новых i18n-ключей

---

## 2026-05-31 — Тесты + pre-push хук

### Тестовая инфраструктура

- **Vitest** — фронтенд + бэкенд (ESM-native, подхватывает Vite-конфиг)
- **Husky** pre-push хук — блокирует `git push` если build или тесты падают
- 8 тестовых файлов, 61 тест на чистые функции и middleware

**Бэкенд (29 тестов):**
- `parseJsonFromLLM` — парсинг JSON из LLM-ответов (fences, braces, невалидный вход)
- `errorHandler` — ZodError → 400, кастомный status, fallback 500
- `telegramAuth` — HMAC-SHA256, dev_bypass, отсутствие заголовка
- `exerciseResolver` (slugify) — трансформация строк в slug

**Фронтенд (32 теста):**
- `weightUnit` — lbsToKg/kgToLbs конверсии
- `muscleMapping` — slug → группа/название
- `formatters` — formatDuration, formatDateLine
- `api` — формирование объекта ошибки

**Конфигурация:**
- `vite.config.js` — `test.include: ['src/**/*.test.js']` (ограничивает scope фронта)
- `server/vitest.config.js` — отдельный конфиг бэка (без react-plugin warnings)
- `.husky/pre-push` — `npm run build && npm test && cd server && npm test`

---

## 2026-05-27–29 — Landing page (Liquid Glass)

### Лендинг продукта

- Статический HTML-лендинг в `public/landing.html` — доступен по `/landing.html` через Vercel
- Дизайн-система **Liquid Glass** — glassmorphism + градиенты + backdrop-filter
- Маркетинговые копирайты в `docs/landing-copy.md`

**Секции лендинга:**
- Hero с CTA
- Pain narrative — "tried-cards" (приложения, которые пробовали и бросили) + SVG-иллюстрация "chasm" между тренером и приложением
- Product tour — секции с реальными мокапами из приложения
- Pricing — тарифы с ценами
- CTA footer

### Итерации

- Первая версия как static asset (5c86166)
- Полный редизайн в Liquid Glass (440f90d)
- Pain narrative с tried-cards и chasm SVG (288ac88)
- Product tour с мокапами приложения (8727856)
- Множество копирайт-итераций

---

## 2026-05-19 — ExerciseDetailSheet, BodyMap fix

### ExerciseDetailSheet — выделение компонента (0ca20fb)

- Извлечён `ExerciseDetailSheet` из LibraryPage в отдельный переиспользуемый компонент (`src/components/ui/ExerciseDetailSheet.jsx`)
- Named export через barrel `index.js`
- Добавлены кнопки info (ⓘ) на 3 экранах: WorkoutPage (активное и предстоящее упражнение), ProgramEditPage (строка упражнения)
- По тапу — BottomSheet с полной инфой об упражнении (мышцы, оборудование, описание, GIF)

### BodyMap SVG clipping fix (9e106d9)

- BodyMap SVG обрезалась снизу — fix через масштабирование в контейнер по высоте

---

## 2026-05-17 — Body Map, импорт программы, guidelines, RIR

### BodyMap — анатомическая карта мышц (body-muscles)

- Новый компонент `src/components/ui/BodyMap.jsx` — React-обёртка над библиотекой `body-muscles` (70+ SVG-зон, front+back вид, интенсивность 0-10)
- Зависимость `body-muscles` добавлена в корневой `package.json`
- Маппинг 20 внутренних muscle ID на зоны библиотеки (`MUSCLE_ZONE_MAP`)
- Автоматический расчёт интенсивности из setsActual/setsTarget
- Named export через barrel (`src/components/ui/index.js`)

**Интеграция в 5 экранов:**

| Экран | Что показывает |
|-------|---------------|
| ProgressPage | Тепловая карта недельного объёма мышц + detail BottomSheet при клике |
| HomePage (BottomSheet) | Компактная карта в детали группы мышц |
| ProgramEditPage | Карта над badges целевых мышц программы |
| WorkoutPage | Done/current/upcoming мышцы с 3 уровнями интенсивности |
| HomePage (ProgrammeHero) | Мини-карта под таймером во время активной тренировки |

### Fix: hooks crash в ProgramEditPage (a36b15d)

- `useMemo` был после условных return (loading/error) — нарушение Rules of Hooks, чёрный экран
- Заменён на обычный вызов функции (вычисление дешёвое)

---

## 2026-05-17 — Импорт программы из markdown, guidelines, RIR

### Program entity: guidelines + RIR + day notes

- Prisma: добавлена nullable колонка `guidelines Json?` на Program (безопасно через `db push`)
- Zod-схемы в programController расширены: `rir` (string) и `notes` на упражнении, `durationMin` и `notes` на дне, `guidelines` на программе
- `GET /programs/:id` возвращает `guidelines`
- `PATCH /programs/:id` сохраняет `guidelines`
- Извлечена `enrichPlanExercises(planJson)` — переиспользуемый хелпер для обогащения упражнений в программе

### Импорт программы из markdown

- Новый эндпоинт `POST /api/v1/programs/import` — импорт программы из markdown-текста через два параллельных LLM-вызова
- Сервис `importProgram.js` — два вызова LLM: структура программы (maxTokens: 8192) + guidelines (maxTokens: 2048)
- Промпты: `importProgram.md` (парсинг структуры) + `importGuidelines.md` (парсинг методических указаний)
- Guidelines: volumeTargets, progression, deload, constraints, nutrition, schedule
- Best-effort парсинг guidelines — если не получилось, сохраняется null
- Скрипт `importProgramFromMd.js` — прямой импорт без LLM (для обхода сетевых проблем с длинными LLM-ответами)

### Генерация программы: расширение

- `generateProgram.js`: схемы расширены — rir, durationMin, notes проходят через resolved exercises/days

### LLM: retry logic

- `llm.js` (`chat()`) — добавлен retry с backoff: до 2 повторов при Connection error / ECONNRESET (задержка 1с, 2с)

### Фронтенд: ProgramEditPage

- **RIR** в строке упражнения: `4×12 RIR 1-2`
- **Day notes** — блок с иконкой info под заголовком дня (при раскрытии)
- **Guidelines** — collapsible Glass-карточка с 6 подсекциями: целевые объёмы (badges), прогрессия, деблок, ограничения (bullet list), питание, расписание
- **RIR selector** в BottomSheet — chip-кнопки `['0', '0-1', '1-2', '2-3', '3+']` с toggle-поведением

### i18n

8 новых ключей: `program.rir`, `program.guidelines`, `program.volumeTargets`, `program.progression`, `program.deload`, `program.constraints`, `program.nutrition`, `program.schedule`

---

## 2026-04-30 — Бот: wizard с полом/возрастом, /workout, layout reorganization

### Бот: генерация программы — пол и возраст

- Визард `/program` расширен с 7 до 9 шагов: пол → возраст → цель → уровень → дни → оборудование → ограничения
- Опции: `GENDERS` (мужчина/женщина), `AGES` (16–24, 25–34, 35–44, 45+)
- При "использовать профиль" — gender и age берутся из existingProfile (с конвертацией возраста в диапазон через `ageToRange()`)
- `buildUserPrompt` передаёт пол и возраст в LLM-промпт
- Системный промпт `generateProgram.md` дополнен правилами: женщинам — акцент на ягодичные/ноги, 45+ — больше разминки, меньше осевой нагрузки
- Фикс: визард зависал на "использовать профиль" — `selectStep` не вызывал обработчик (b57bfa8)

### Бот: команда /workout

- `/workout` теперь показывает следующий день из активной программы: название программы, название дня, список упражнений + кнопка "Начать тренировку"
- Если нет активной программы — предлагает `/program`
- Логика nextDayIndex — как в контроллере `getNextWorkout`

### Layout reorganization

- Месячная статистика (тренировки/тоннаж/серия) перенесена из Home на Progress-экран
- Еженедельные тренировки и карточка мышц перенесены из Progress на Home-экран
- Убрана зелёная левая линия на карточке "Эта неделя"

### UX-фиксы

- Safe-area top padding для loading/error состояний TopBar в ProgramEditPage
- ProgramEditPage: кнопка "назад", действие активации, список программ на экране редактирования
- Telegram safe area insets в fullscreen mode (ff9fed4)

---

## 2026-04-29 — Библиотека упражнений, программы, rest timer fix

### LibraryPage — каталог упражнений

- Полноценный экран `/library` — поиск, фильтры по группе мышц и оборудованию
- BottomSheet с детальной информацией по упражнению (мышцы, оборудование, описание)
- Ленивая загрузка через `lazy()`

### ProgramEditPage — редактирование программы

- Экран `/program/:id` — просмотр и редактирование программы
- Параметры упражнений: подходы, повторы, время отдыха
- Удаление упражнений, сохранение изменений (PATCH API)
- Кнопка активации программы (`POST /programs/:id/activate`)
- Список программ и навигация

### Rest timer fix

- Исправлен дрифт rest timer при сворачивании приложения (2d29222)
- Таймер теперь корректно работает при выходе/возврате в mini-app

---

## 2026-04-28 — Safe area insets, sub-muscle breakdown

### Telegram safe area

- Fullscreen mode корректно учитывает safe area insets (notch/dynamic island)
- Layout не перекрывается системными элементами

### Sub-muscle breakdown

- `EXERCISE_MUSCLE_OVERRIDE` для груди (верх/середина/низ) и плеч (передние/средние/задние дельты)
- Трапеции перенесены из группы "Плечи" в "Спина"

---

## 2026-04-27 — Progress-экран: ring charts, sub-muscles, UX-фиксы

### Progress API (`GET /api/v1/progress`)

- `planAdherence` — тренировки за неделю vs план (done/planned/extra)
- `muscleVolume` — подходы по 6 группам мышц с sub-muscle разбивкой
- `records` — рекорды месяца (макс вес vs предыдущий лучший)
- Три состояния: `empty` (0 тренировок), `mostly_empty` (1-2), `has_data` (≥3)

### Sub-muscle breakdown

Добавлен `EXERCISE_MUSCLE_OVERRIDE` — маппинг slug упражнения → конкретная sub-muscle:
- **Грудь:** incline → Верх груди, flat/fly → Середина груди, dip → Низ груди
- **Плечи:** press → Передние дельты, lateral/upright → Средние дельты, face-pull/reverse → Задние дельты
- **Трапеции** перенесены из группы "Плечи" в "Спина"

Применяется и к фактическим подходам, и к целям программы.

### ProgressPage — полный редизайн по glass_v4

Все компоненты inline (как в HomePage):
- **WeeklyCard** — capsule bars (done/extra/remaining), контекстный текст
- **MuscleGroupCard** — full-width Glass карточка с RingChart (SVG) + StatusBadge
- **RingChart** — SVG кольцо: фон, зона цели (min–max), заполнение цветом статуса
- **DotLadder** — точечная лесенка по sub-muscles (gray→green→red) с маркерами min/max
- **StatusBadge** — цветная пилюля ("Перебор +N", "В норме", "Недогруз −N")
- **EmptyProgress** — CTA для нового пользователя
- **MostlyEmptyHint** — подсказка при 1-2 тренировках

### ProgressDataContext

`src/contexts/ProgressDataContext.jsx` — React Context по образцу HomeDataContext:
- Stale-while-revalidate
- `refresh()` для фонового обновления
- Provider добавлен в цепочку (`main.jsx`)

### UX-фиксы

- **Табар не скролится:** GlassNav → `position: fixed` (было `absolute`)
- **Пустое состояние с целями:** показываем план программы и muscle targets даже при 0 тренировок
- Убрана заглушка-субтайтл "что AI подсказывает скорректировать"

### Новые i18n-ключи

`progress.title`, `progress.week.*` (title, ofPlanned, workoutsWeek, planDone, planComplete, planRemaining), `progress.muscle.sectionTitle`, `progress.muscle.target`, `progress.status.*` (low, optimal, over, overload), `progress.records.*`, `progress.empty*`, `progress.goTrain`, `progress.mostlyEmpty`

---

## 2026-04-26 (день, позже) — Автовес, свайп-удаление подходов

### Автоподстановка веса в подходах

- Первый подход упражнения теперь подтягивает вес из прошлой тренировки (`lastResultsCache`)
- Последующие подходы — из предыдущего подхода текущей тренировки
- Для freeform: при выборе упражнения через picker загружаются прошлые результаты (`batch-last-results`)

### Свайп-удаление подходов (SwipeRow)

- `DoneSetRow` — кнопка × заменена на свайп влево (красная зона с иконкой корзины)
- Работает в трёх местах: активная карточка, раскрытые завершённые, раскрытые предстоящие (partial sets)
- `SwipeRow` — локальный touch-based компонент в WorkoutPage (flex-track + overflow:hidden)
- `handleDeletePartialSet` — удаление partial set из предстоящих упражнений (API + state)
- Удаление всех partial sets возвращает упражнение в чистое "предстоящее" состояние

---

## 2026-04-26 (день) — Скелетоны, кэш, cancel/delete, day picker, recent list

### HomeDataContext — кэширование данных Home-экрана

- `src/contexts/HomeDataContext.jsx` — React Context выше Routes, stale-while-revalidate
- Данные (yearStats, monthStats, recent, activeWorkout, program, nextWorkout) переживают переключение табов
- `refresh()` для фонового обновления, `setData()` для optimistic updates
- `HomeDataProvider` добавлен в цепочку провайдеров (`main.jsx`)

### Skeleton-загрузчики

- `src/components/ui/Skeleton.jsx` — shimmer-компонент с pulse-анимацией
- `YearHeader`, `ProgrammeHeroSkeleton`, `MonthStatsSkeleton`, `RecentListSkeleton` — на Home-экране
- `WorkoutSkeleton` — на экране тренировки

### Cancel active + Delete past workout

- `DELETE /api/v1/workouts/:id` — удаление тренировки (каскад WorkoutSet)
- `src/components/ui/ConfirmDialog.jsx` — Glass-диалог подтверждения (danger variant)
- WorkoutPage: кнопка "назад" показывает confirm если есть подходы
- HomePage: "Прервать" для активной тренировки с confirm, trash-иконка (позже свайп) для недавних

### Pause/Resume на Home-экране

- Unified `ProgrammeHero` — показывает active/paused/default состояния в одной Glass-карточке
- Live-таймер с учётом пауз (`totalPausedMs`, `pausedAt`)
- Статус: пульсирующая точка (active) / оранжевая точка (paused)
- "Продолжить" из Home вызывает resume + навигацию на /workout

### Day Picker — шторка выбора тренировки

- `src/components/ui/BottomSheet.jsx` — переиспользуемый bottom sheet с анимацией open/close (slide-up/down + backdrop fade)
- "сделать другую вместо этой" → открывает шторку со списком дней из программы
- Клик на день → обновляет `nextWorkout` в контексте (НЕ начинает тренировку)
- "Внеплановая" (dashed border) → начинает freeform тренировку
- Акцентная рамка + бейдж "ПО ПЛАНУ" на текущем дне

### Recent List — редизайн

- Бэкенд: `getRecent` теперь возвращает `dayTitle`, `durationSec`, `programDayIndex`
- Формат строки: "День 2 · Pull" (название из программы) или список упражнений (freeform)
- Подстрока: день недели + относительная дата + длительность + подходы
- Удаление свайпом влево (SwipeRow — touch-based, delete-кнопка выезжает справа)

### Новые UI-компоненты

| Компонент | Файл |
|-----------|------|
| `Skeleton` | `src/components/ui/Skeleton.jsx` |
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.jsx` |
| `BottomSheet` | `src/components/ui/BottomSheet.jsx` |

### Новые i18n-ключи

`workout.cancelWorkoutTitle/Message/Confirm`, `home.deleteWorkoutTitle/Message/Confirm`, `confirm.cancel`, `home.workoutPaused`, `home.cancelWorkout`, `home.workoutDuration`, `home.startedJustNow/MinAgo/HourAgo`, `home.continueWorkoutFull`, `home.startFreeform`, `home.pickDayTitle/Subtitle/Planned`, `home.pickFreeform/Desc`, `home.freeformWorkout`, `home.dayN`, `home.durationMin`

---

## 2026-04-26 (ночь, позже) — Интерактивный Workout UX

Большой набор фич и фиксов для экрана тренировки.

### Раскрытие выполненных упражнений + удаление подходов

- Клик на выполненное упражнение раскрывает список подходов
- Кнопка × на каждом подходе — удаление (DELETE API + optimistic UI)
- "Отменить упражнение" — удаление всех подходов, упражнение уходит из done
- `DELETE /api/v1/workouts/:id/sets/:setId` — новый эндпоинт
- `apiDelete()` — новая утилита в `src/utils/api.js`
- `handleSetDone` сохраняет `set.id` из ответа сервера для последующего удаления

### Раскрытие предстоящих упражнений

- Клик на upcoming упражнение → раскрывается карточка (как активная) с заголовком, схемой, прошлыми результатами и кнопкой "Начать"
- `POST /api/v1/exercises/batch-last-results` — пакетный запрос прошлых результатов
- Кэш результатов `lastResultsCache` загружается при монтировании тренировки, не при каждом раскрытии

### Drag-and-drop порядка упражнений

- Touch-based drag-and-drop для предстоящих упражнений (grip handle ⠿)
- Swap при пересечении 50% высоты элемента, haptic feedback при каждом swap
- Работает на мобильных через touch events
- Иконка `grip` добавлена в Icon.jsx

### Partial progress (незавершённые упражнения)

- Если переключиться на другое упражнение до завершения всех подходов — предыдущее остаётся в "далее" (не уходит в "сделано")
- `partialSets` state — хранит подходы незавершённых упражнений
- Визуальный индикатор: accent-tinted circle + "1/3 подх" вместо "3×8"
- При раскрытии: выполненные подходы (с галочками) + оставшиеся (пунктирные ghost rows)
- Кнопка "Продолжить" вместо "Начать"
- При возврате к упражнению — подходы восстанавливаются
- Явное нажатие "К следующему" — упражнение уходит в done (даже если не все подходы)

### Фиксы

- **Rest timer не считал**: `useEffect` зависел от `[t, onComplete]`, parent re-renders каждую секунду (elapsed timer) → interval recreated. Исправлено через `useRef` для `onComplete` + пустые deps `[]`
- **Rest timer появлялся с лагом**: `setResting(true)` был после `await apiPost`. Перенесён до API вызова (optimistic)
- **Анимация появления RestCard**: `restCardAppear` keyframe (fade-in + slide-up)
- **Rest timer после последнего подхода**: теперь показывается всегда, auto-advance в `handleRestComplete`
- **Упражнения исчезали при клике**: фильтр `i > planIndex` заменён на `!doneExerciseIds.has(pe.exerciseId)`
- **Потеря подходов при переключении**: `handleSelectExercise` (picker) не сохранял `doneSets` — исправлено
- **"All done" при наличии partial**: проверка заменена с `planIndex >= planExercises.length` на `upcomingExercises.length === 0`
- **handleNextExercise**: ищет первое несделанное (не привязано к planIndex), корректно работает после reorder

### Новые i18n-ключи

`workout.startExercise`, `workout.lastTime`, `workout.restSec`, `workout.noHistory`, `workout.cancelExercise`

---

## 2026-04-26 (ночь) — Dev-first workflow

### seedDevData.js

Единый скрипт `server/scripts/seedDevData.js` (`npm run seed:dev`) для настройки dev-окружения:
- Создаёт dev user (telegramId=0, "Dev User")
- Чистит старые данные (idempotent)
- Импортирует 60 тренировок + 1687 подходов из workouts.json
- Создаёт программу PPL+Arms (4 дня) и привязывает 46 тренировок

Dev user теперь имеет те же данные, что и продовый аккаунт.

### Dev-first workflow

Переход от "проверяем на проде после пуша" к "проверяем на деве, потом пушим":
1. `npm run dev` (frontend) + `cd server && npm run dev` (backend)
2. Открыть `localhost:5173` — `dev_bypass` авторизует как Dev User с полной историей
3. Проверить фичу → `npm run build` → коммит → пуш

### Обновление документации

CLAUDE.md, ARCHITECTURE.md, NEXT_PLANS.md, UPDATES.md, implementation-plan.md — синхронизированы с актуальным состоянием проекта (фазы 1-3).

---

## 2026-04-26 (вечер) — Home-экран, программы, полный Workout-редизайн

### Фаза 1 завершена — сквозной скелет

**Seed + resolve + import:**
- `server/scripts/seedExercises.js` — upsert 57 упражнений в Neon по slug
- `server/src/services/exerciseResolver.js` — slug → alias → auto-create pipeline
- `server/scripts/importWorkouts.js` — 60 тренировок, 1687 подходов, 57/57 slug-match (0 auto-created!)
- Prisma: `ExerciseSource` enum, `source`, `gifUrl` на Exercise

**API для тренировок (7 эндпоинтов):**
- `GET /exercises`, `GET /exercises/search?q=`
- `POST /workouts` (create/resume), `GET /workouts/active`, `GET /workouts/:id`
- `POST /workouts/:id/sets`, `PATCH /workouts/:id` (finish/delete)

**Workout-экран (минимальный):**
- BigStepper, TopBar — новые UI-компоненты
- WorkoutPage — exercise picker → stepper → log → finish
- SummaryPage — "Готово!" + stat-tiles (подходов, время, тоннаж)
- Haptic feedback, optimistic updates
- E2E в Telegram — работает

### Фаза 2 — Home-экран

**API:**
- `GET /programs/active` — активная программа с днями
- `GET /programs/active/next-workout` — следующая тренировка (день, упражнения, restSec)
- `GET /stats/month` — `{ workouts, tonnage, streak }`
- `GET /workouts/recent?limit=4` — недавние тренировки с упражнениями

**Home-экран (BRD §12.1):**
- TabLayout с GlassNav (4 таба: Главная, Прогресс, Каталог, Профиль)
- Programme strip + hero card (следующая/продолжить тренировку)
- Active workout state — пульс-точка + live-таймер + "Продолжить"
- Stat-tiles 2×2: тренировок, тоннаж, серия, рекорды
- Недавние тренировки (список с датой, упражнениями, подходами)
- Роутинг: `/` → Home (вместо redirect на /workout)

**Программы:**
- `server/scripts/seedProgram.js` — генерация программы из исторических тренировок
- Programme strip на Home с навигацией по дням

### Program-aware Workout flow

- PlanQueue — показ плана тренировки (список упражнений из программы)
- Авто-навигация: после завершения упражнения → переход к следующему по плану
- Показ запланированного количества подходов ("Подход 1 / 3")
- Pre-fill повторов из программы (repsMin)
- Отмена тренировки (кнопка "Отменить" когда 0 подходов)
- Предотвращение пустых тренировок ("Завершить" только когда есть подходы)

### Workout redesign — glass_v3 prototype

Полный редизайн WorkoutPage по прототипу из Claude Design (3 экрана: активный подход, отдых, прошлые свёрнуты).

**Новые sub-components в WorkoutPage.jsx:**
- `WorkoutTopBar` — Glass strong, live-таймер (mono accent), прогресс "упр 1/9 · 2/3 подх", ГОТОВО/ОТМЕНИТЬ
- `CollapsedExercise` — свёрнутая строка завершённого упражнения (accent check + name + "3×10")
- `DoneSetRow` — компактная строка выполненного подхода внутри карточки
- `ActiveSetInput` — accent-tinted sub-card с BigStepper (вес + повторы) + "СДЕЛАЛ"
- `UpcomingExerciseItem` — предстоящее упражнение (circle number + name + sets×reps + мышцы)

**Rest timer между подходами:**
- После "Сделал" → RestCard (отдых с обратным отсчётом, breathing radial, progress bar)
- `restSec` из плана программы или default 90
- Пропустить / автозавершение → следующий подход
- После всех подходов → авто-переход к следующему упражнению

**Единый scrollable экран:**
- Заменены три отдельных режима (PlanQueue, ExercisePicker, ActiveWorkout) на один layout
- "Сделано" секция: CollapsedExercise для завершённых
- Активная карточка: header + done sets + ActiveSetInput/RestCard
- "Далее" секция: upcoming exercises

**RestCard русифицирован:**
- "rest" → `t('workout.rest')`, "Skip rest" → `t('workout.skipRest')`, breathing text через i18n

**12 новых i18n-ключей:** `workout.now`, `exerciseOf`, `setsProgress`, `ready`, `upcoming`, `addSetExtra`, `targetReps`, `rest`, `skipRest`, `breathe`, `doneLabel`, `setsScheme`

### Багфиксы

- **Lazy workout creation** — тренировка создаётся только при первом "Сделал", не при открытии экрана
- **Одно упражнение вместо списка** — PlanQueue показывается при старте, не авто-выбирается первое
- **Повтор того же дня** — предотвращение завершения пустой тренировки (бэкенд удалял → тот же next-workout)
- **Количество подходов = 1** — добавлен `plannedSets` prop, формат "Подход 1 / 3"
- **Seed программы для wrong user** — привязка к пользователю с наибольшим количеством тренировок

---

## 2026-04-26 — Дизайн-система, план реализации экранов, обогащение базы упражнений

### Дизайн-система

Реализованы UI-компоненты из дизайн-хэндоффа (Claude Design → код):
- `Glass`, `Button`, `Icon` (44 иконки), `StatTile`, `ActivePill`, `GlassNav`, `GlassAINote`, `RestCard`, `Mesh`
- Дизайн-токены (CSS custom properties) в `src/theme/tokens.css`
- Демо-страница: `src/pages/Demo/DesignSystemDemo.jsx` (доступна по `/demo`)

### План реализации экранов (BRD §12)

Создан `docs/implementation-plan.md` — 6 фаз реализации мини-аппа на основе спецификации экранов:
- Фаза 1: Сквозной скелет (seed + resolve + API + минимальный Workout)
- Фаза 2: Home-экран
- Фаза 3: Полный Workout
- Фаза 4: Summary + Progress
- Фаза 5: Programs
- Фаза 6: Cross-cutting + polish

Архитектурные решения в плане:
- **Resolve-слой упражнений (Вариант C):** seed + auto-create через `exerciseResolver.js`
- **Два режима layout:** TabLayout (GlassNav) и FlowLayout (TopBar + back)
- **ActiveWorkoutProvider:** React Context для состояния тренировки
- **planJson формализация:** Zod-схема для структуры программы
- **Новые поля Prisma:** `source` (ExerciseSource enum) и `gifUrl` (String?) на Exercise

### Исследование баз упражнений

Протестированы 4 базы упражнений:
| База | Упражнений | Лицензия | Матч с нашими 57 |
|------|-----------|----------|------------------|
| Free Exercise DB | 873 | Public Domain | 67% (38/57) |
| Exercemus | 872 | MIT | 68% (39/57) |
| ExerciseDB OSS | ~1500 | AGPL-3.0 | Качественные GIF, жёсткий rate limit |
| wger API | ~885 | AGPL | Не тестировали детально |

**Решение:** Free Exercise DB как основа метаданных + ExerciseDB OSS для animated GIF.

### Обогащение 57 упражнений (3-шаговый pipeline)

Все 57 упражнений из реальных тренировок автора (`prototype/mock_data/workouts.json`) прошли полное обогащение:

**Шаг 1 — Матч с Free Exercise DB:**
- Автоматический матч (exact/all-words/key-words): 32/57
- Ручные маппинги для 13 упражнений: 45/57
- Ручное заполнение для 4 оставшихся (RFESS, Machine Shoulder Fly, Side Plank): 57/57

**Шаг 2 — Коррекция + русификация:**
- Исправлены 3 неточных key-words матча (Seated Row Wide, Lateral Raise DB, Incline Row DB)
- Добавлены 57 русских названий (nameRu)
- Добавлены aliases (3–6 синонимов рус/eng на каждое)

**Шаг 3 — GIF из ExerciseDB OSS:**
- 21/57 GIF URL получены (rate limit на free tier ограничил покрытие)
- Скрипт `server/data/fetch-missing-gifs.js` для дозагрузки

**Финальное покрытие:** nameRu 57/57, muscles 57/57, equipment 57/57, instructions 57/57, images 53/57, aliases 57/57, gifUrl 21/57.

**Сохранено:** `server/data/enriched-exercises.json`

### Решения

- **Комбинация баз:** Free Exercise DB для метаданных, ExerciseDB OSS для GIF. К OSS API обращаемся только при seed, не в runtime
- **Plié Squat slug fix:** символ `é` создавал slug `pli-squat` вместо `plie-squat`. Обработан в скрипте обогащения
- **ExerciseDB OSS rate limiting:** free tier блокирует после ~25-50 запросов (503). Стратегия: запросы с паузой 2-4 сек, повторные запуски при сбросе лимита

---

## 2026-04-24 — Итерация 4 MVP: сканирование тренажёра по фото

### Что сделано

Перепрыгнули через итерации 2-3 и реализовали ключевую фичу продукта — распознавание тренажёра по фото через Claude Vision.

**Новые файлы:**
- `server/src/services/aiTrainer/identifyMachine.js` — сервис распознавания (LLM vision → JSON parse → Zod-валидация → сохранение в БД → аналитика)
- `server/src/services/aiTrainer/prompts/identifyMachine.md` — промпт для Claude Vision с JSON-схемой ответа
- `docs/machine-scanning.md` — техническое описание фичи (архитектура, поток данных, ограничения MVP)

**Изменённые файлы:**
- `server/src/bot/index.js` — добавлен хэндлер `on('photo')`: скачивает фото из Telegram → base64 → вызывает `identifyMachine` → форматирует ответ с упражнениями

### Как работает

```
Фото в боте → Telegram API → скачиваем файл → base64 →
→ llm.vision() с промптом → Claude анализирует →
→ JSON-ответ → Zod-валидация → MachineIdentification в БД →
→ аналитика (fire-and-forget) → ответ юзеру с упражнениями
```

### Решения

- **Без R2 на старте:** сохраняем Telegram `file_id` вместо загрузки в Cloudflare R2. Для MVP достаточно.
- **Без привязки к Exercise:** LLM генерирует упражнения из головы, не ссылаясь на `exerciseId`. Привязка — после seed-скрипта.
- **Admin-only:** распознавание ограничено `ADMIN_TELEGRAM_ID` пока фича в тесте. Остальные получают заглушку.
- **3-уровневый JSON-парсинг:** `parseJsonFromLLM()` пробует прямой parse, потом ` ```json ``` ` обёртку, потом `{...}` в тексте — на случай если LLM обернёт ответ.

### Выученные грабли

- **Long polling: один инстанс.** При запуске локального сервера параллельно с Railway — конфликт `409: terminated by other getUpdates request`. Нужно останавливать локальный бот перед тестом прода.
- **Railway redeploy ≠ restart.** После `git push` нужно дождаться нового деплоя, а не рестарта старого контейнера.

### End-to-end проверка пройдена ✅

Отправил фото тренажёра боту → получил название + список упражнений с техникой и рекомендациями по подходам/повторениям.

---

## 2026-04-21 — Деплой инфраструктуры в прод

### End-to-end проверка пройдена ✅

Открываю бота в Telegram → `/start` → жму inline-кнопку → открывается мини-апп → виден экран с приветствием. Цепочка `Telegram → Vercel → Railway → Neon` работает.

### Vercel
- Подключён репо `vvopeshko/ai-trainer`, framework auto-detect = Vite.
- `VITE_API_URL` указывает на Railway URL.
- Прод-URL: `https://ai-trainer-ebon-one.vercel.app`.
- Автодеплой на каждый push в `main`.

### Railway
- Подключён тот же репо, root directory = `/server`.
- Variables: `DATABASE_URL` (Neon), `BOT_TOKEN`, `NODE_ENV=production`, `PORT=8080`, `FRONTEND_URL`/`WEBAPP_URL` (оба = Vercel URL), `ANALYTICS_SECRET`, `ADMIN_TELEGRAM_ID`. Anthropic и R2 пропустили — добавим, когда понадобятся (итерации 2 и 4).
- Прод-URL: `https://ai-trainer-production-fef0.up.railway.app`.
- `/api/health` отвечает.
- Бот в long-polling, в логах `[bot] launched as @...`.

### BotFather
- Menu Button настроен через `/mybots → Bot Settings → Menu Button` на Vercel URL. Команду `/setmenubutton` BotFather убрал из автодополнения, но если набрать руками — работает; через UI `/mybots` тоже работает.

### Маленькие сюрпризы по дороге
- `WEBAPP_URL` в коде бота читается **один раз при запуске процесса** (`const webAppUrl = process.env.WEBAPP_URL`). При смене переменной нужен redeploy Railway. Дополнительно — **inline-клавиатура в уже отправленных сообщениях не обновляется**: после смены URL надо отправить новый `/start`, иначе старая кнопка ведёт на старый URL.
- Menu Button и inline-кнопка `/start` — два независимых места: Menu Button задаётся в BotFather, inline — кодом в боте. Если разъезжаются — проверять отдельно.

### Что осталось до критерия итерации 1
- Бэкенд: роуты `workouts`, `exercises` с контроллерами и Zod-валидацией.
- Минимальный seed упражнений (10 базовых).
- Мини-апп: реальный экран "Тренировка" — выбор упражнения, ввод веса × повторов, кнопка сохранить.
- Сделать первую реальную запись подхода в Neon из мини-аппа.

---

## 2026-04-21 — Подключение инфраструктуры

### Neon Postgres
- Создан проект `ai-trainer` на Neon (Free tier).
- `DATABASE_URL` в `server/.env`.
- `npx prisma db push` отработал — все 9 таблиц созданы в схеме.
- PITR на Free-плане 24 часа, включён по умолчанию (отдельного тумблера нет).

### Telegram bot
- Создан бот через @BotFather (`/newbot`), `BOT_TOKEN` в `server/.env`.
- Зарегистрированы команды через `/setcommands` из `server/src/bot/commands.txt`.
- Бот успешно запускается локально, отвечает на `/start`, `/workout`, `/help`.
- Menu Button у BotFather пока не настроен — ждём HTTPS URL после деплоя на Vercel.

### Багфиксы

**1. Лог запуска бота (`server/src/index.js`):**
В Telegraf v4 `bot.launch()` возвращает промис, который резолвится при **остановке** бота, а не при запуске. Старый код `bot.launch().then(() => console.log('[bot] launched'))` поэтому никогда не печатал лог. Заменил на проверку через `bot.telegram.getMe()` до `launch()` — теперь логируется `[bot] launched as @username`.

**2. WebApp кнопки требуют HTTPS (`server/src/bot/index.js`):**
Telegram отказывает: `Bad Request: inline keyboard button Web App URL '...' is invalid: Only HTTPS links are allowed`. На локалке `http://localhost:5173` не подходит. Добавил проверку `webAppUrl.startsWith('https://')`: если HTTPS — даём кнопку, если нет — отдаём ссылку текстом с пометкой (dev). Полноценные кнопки заработают после Vercel.

### Git
- 3-й коммит: `fix(bot): handle non-https WEBAPP_URL in dev + log on getMe instead of launch`.

### Что осталось до критерия итерации 1
Anthropic API key, push на GitHub, Vercel, Railway, реальный экран логирования + workouts-роуты. Детали — в [NEXT_PLANS.md](NEXT_PLANS.md).

---

## 2026-04-20 — Запуск проекта, документация

Первый день. Собрали документную базу проекта.

### Обсудили и зафиксировали
- Идею продукта: AI Trainer — Telegram-бот + мини-апп для самостоятельных тренировок в зале.
- Целевую аудиторию: новички и любители среднего уровня; силовые в зале.
- Ключевой дифференциатор: подбор упражнения по фото тренажёра.
- Формат проекта: пет, соло-разработка, сначала для себя, потом в коммерцию.
- Монетизацию: подписка с триалом (включаем на коммерческом этапе).

### Проанализировали референс
Изучили кодовую базу и документацию пет-проекта автора — [daily balancer / Life Progress Tracker](../daily%20balancer/life-progress-tracker/). Проект уже в проде, ~6800 строк кода. Решили унаследовать:
- Стек: React 19 + Vite 7 + Tailwind 4 + Express 5 + Prisma 6 + Telegraf + Zod + PostgreSQL (Neon).
- Хостинг: Vercel (фронт) + Railway (бэк+бот) + Neon PostgreSQL с PITR.
- Паттерны: `telegramAuth` middleware с dev-bypass, бот и API в одном процессе, самописная аналитика, i18n с первого дня, skeletons, optimistic updates, haptic feedback.
- Правила работы с `prisma db push` (выученные кровью в даили-баланзер: дроп всех таблиц 2026-03-08).
- Плоскую структуру репозитория (не монорепо).

### Создали документы
- [CLAUDE.md](CLAUDE.md) — входная точка, ключевые правила.
- [BRD.md](BRD.md) — продуктовое описание (v1.0, очищенное от тех.деталей).
- [ARCHITECTURE.md](ARCHITECTURE.md) — все технические решения, стек, паттерны, деплой, env.
- [NEXT_PLANS.md](NEXT_PLANS.md) — живой бэклог, стартовый список задач для итерации 1.
- [UPDATES.md](UPDATES.md) — этот файл.

### Ключевые решения
- **LLM/Vision:** Claude (Anthropic), за абстракцией `utils/llm.js`.
- **Структура репо:** плоская (frontend в корне, `/server` подпапкой), не монорепо.
- **Язык:** JavaScript на старте, TypeScript — рассматриваем для AI-сервисов (открыто).
- **База упражнений:** Free Exercise DB + LLM для пробелов.
- **Видео:** ссылки на YouTube в MVP.
- **Биллинг:** откладываем до коммерческого этапа.

### Дополнение: архитектура сервиса и схема БД

В тот же день проработали:
- **Раздел 2 "Архитектура сервиса"** в ARCHITECTURE.md — Mermaid-диаграмма компонентов (Client / Edge / Backend / External / DB), 5 ключевых потоков данных (логирование подхода, AI-чат, распознавание тренажёра, генерация программы, еженедельная сводка), принципы архитектуры.
- **Раздел 4 "Схема БД"** — ER-диаграмма + Prisma-схема черновика v1 (9 моделей: User, UserProfile, Exercise, Program, Workout, WorkoutSet, ChatMessage, MachineIdentification, AnalyticsEvent), 6 enum-типов, решения и trade-offs, индексы.

### Ключевые архитектурные решения
- **Монолит в одном процессе** (API + бот + шедулер) на Railway — разделяем только когда заболит.
- **Program.planJson как JSON**, не реляционно — проще под LLM-генерацию; аналитика по упражнениям внутри программ пока не нужна.
- **WorkoutSet ссылается прямо на Exercise**, не через ProgramExercise — упрощает замены и внеплановые подходы.
- **MachineIdentification как отдельная таблица** — метрики и потенциальный датасет для улучшения промпта.
- **Exercise глобальная, не per-user** — общая библиотека для всех.
- **`String[]` для мышц/оборудования**, не enum — гибкость без миграций; валидация в Zod.

### Скелет репозитория

Развернули работающий скелет проекта, первый коммит в git (`chore: bootstrap AI Trainer project skeleton`).

**Frontend (корень):**
- `package.json` — React 19, Vite 7, Tailwind 4 (как Vite-плагин), React Router 7, Lucide, Recharts.
- `vite.config.js`, `vercel.json` (SPA rewrites), `eslint.config.js`.
- `index.html` — Telegram WebApp SDK + splash loader на чистом CSS.
- `src/main.jsx` + `App.jsx` + `/workout` роут.
- `src/i18n/` — `TranslationProvider`, `useTranslation`, `translations.js` с ru-словарём.
- `src/components/TelegramProvider.jsx` — обёртка над `window.Telegram.WebApp` с dev-fallback.
- `src/utils/api.js` — fetch-wrapper с авто-атачем `Authorization: tma <initData>`.
- `src/pages/Main/WorkoutPage.jsx` — плейсхолдер первого экрана.

**Backend (`server/`):**
- `package.json` — Express 5, Telegraf, Prisma 6, Zod, node-cron, `@anthropic-ai/sdk`.
- `prisma/schema.prisma` — v1 схема из ARCHITECTURE.md (9 моделей + 6 enum).
- `src/index.js` — Express + `bot.launch()` параллельно, health-check, CORS, graceful shutdown, BigInt.toJSON для сериализации telegramId.
- `src/middleware/telegramAuth.js` — HMAC-SHA256 валидация initData + dev_bypass.
- `src/middleware/errorHandler.js` — централизованный error-handler с обработкой ZodError.
- `src/utils/prisma.js` — Prisma singleton (защита от утечек в dev).
- `src/utils/llm.js` — абстракция `chat()` + `vision()` над Anthropic SDK.
- `src/utils/analytics.js` — fire-and-forget `track()`.
- `src/bot/index.js` — `/start`, `/workout`, `/help` с кнопкой на мини-апп.
- `src/bot/commands.txt` — список для `setMyCommands` в BotFather.
- `src/routes/index.js` + `auth.js` — каркас `/api/v1/` и роута `/auth/init`.
- `.env.example` и `.gitignore` на обоих уровнях.

### Зафиксированное решение
- **Язык:** JavaScript (ESM, `"type": "module"`) — матчим daily balancer, минимум тулинга для соло-разработки. При появлении сложной AI-логики с JSON-схемами — локально добавим TypeScript в `server/src/services/aiTrainer/`.

### Что работает из коробки
- `npm install && npm run dev` в корне — Vite dev-сервер на :5173, мини-апп открывается в обычном браузере (dev-режим TelegramProvider).
- `cd server && npm install && npm run dev` (при заполненном `.env`) — Express на :3001, бот в long-polling при наличии `BOT_TOKEN`.
- `Authorization: tma dev_bypass` работает в dev для тестов API без Telegram.

### Следующий шаг
Оставшийся чеклист итерации 1: подключить Neon (создать проект, включить PITR, скопировать `DATABASE_URL` в `server/.env`), зарегистрировать бота у BotFather, настроить Vercel и Railway. Детали — в [NEXT_PLANS.md](NEXT_PLANS.md#-прямо-сейчас-подготовка-к-итерации-1).
