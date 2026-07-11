# FRONTEND_CACHE_PLAN — мгновенные табы и кэш-слой данных

Цель: переключение табов **мгновенное и без сетевых запросов**, данные кэшируются и обновляются **только по реальным изменениям** (мутации) или по истечении срока свежести.

**Создан:** 2026-06-12. Основа — аудит загрузки данных по экранам (факты ниже). Связанные доки: [CODE_REVIEW_PLAN.md](CODE_REVIEW_PLAN.md) (гонки контекстов — пп. 4–6, 8, 10), [ARCHITECTURE.md](ARCHITECTURE.md) §5.6.

---

## 1. Диагноз (по аудиту кода и реального билда)

| Экран | Повторный заход на таб | Проблема |
|---|---|---|
| `/` Home | **8 GET** (7 HomeData + `/progress`), безусловно | refresh без staleness-проверки; кэш показывается, но сеть дёргается всегда |
| `/progress` | те же **8 GET** | тянет все 7 Home-запросов ради `monthStats` и `recent` |
| `/library` | `GET /exercises?limit=1500` (**~66 KB gzip**) + **скелетон каждый раз** | каталог в локальном state — умирает при уходе с таба |
| `/program/:id` | `GET /programs/:id` + `GET /programs` + скелетон | `planJson` активной программы уже лежит в HomeData — не переиспользуется |
| Первый заход на lazy-таб | пустой экран | `Suspense fallback={null}` |
| ExerciseDetailSheet | `GET /exercises/:id` при каждом открытии | даже только что открытого |

Системные причины: (1) инвалидация заменена тотальным рефетчем на каждый mount; (2) `api.js` без дедупликации/HTTP-кэша; (3) данные дублируются (каталог: Library + ExercisePicker; программа: HomeData + ProgramEdit; muscleVolume: ProgressData + локальный расчёт в ProgramEdit); (4) после мутаций точечно не обновляется ничего (флеш старых данных на Home после finish workout).

Что уже правильно: кэш живёт выше Routes (контексты переживают табы), optimistic updates в Workout, единственный пример reuse — WorkoutPage берёт `activeWorkout` из HomeData.

---

## 2. Решение: TanStack Query

**Рекомендация — `@tanstack/react-query`** (~13 KB gzip, прибавка к main-чанку 118 KB gzip — приемлемо):

- из коробки закрывает всё, что нужно: дедупликация одинаковых GET, `staleTime` (свежесть без рефетча), точечная инвалидация по ключам, optimistic updates с откатом, persist в localStorage;
- **заменяет оба самописных контекста** (HomeDataContext 7-в-1, ProgressDataContext) и попутно чинит их гонки из CODE_REVIEW_PLAN (last-writer-wins, воскрешение отменённой тренировки, отсутствие abort) — там это отдельные ручные фиксы, здесь — поведение по умолчанию;
- девтулзы (`@tanstack/react-query-devtools`, только dev) — видно кэш и инвалидации.

*Альтернатива — достроить свои контексты* (TTL + общий store по ключам + шина инвалидации): без новой зависимости, но это ~повторная реализация четверти react-query со своими багами, и гонки придётся чинить руками. Не рекомендуется; план ниже написан под react-query, но структура ключей/инвалидаций от выбора не зависит.

### Структура ключей и свежесть

Один запрос = один ключ = один источник истины. Экраны подписываются на нужные ключи; пересечение (Home и Progress оба хотят `stats.month`) дедуплицируется автоматически.

| Ключ | Endpoint | staleTime | Комментарий |
|---|---|---|---|
| `['stats','year']` | `/stats/year` | 5 мин | меняется только после тренировки → инвалидация мутацией |
| `['stats','month']` | `/stats/month` | 5 мин | то же |
| `['workouts','recent']` | `/workouts/recent?limit=4` | 5 мин | то же |
| `['workouts','active']` | `/workouts/active` | 30 сек | критичный для resume; плюс optimistic |
| `['workouts','detail',id]` | `/workouts/:id` | ∞ | завершённая тренировка не меняется |
| `['programs','active']` | `/programs/active` | 10 мин | меняется только мутациями программ |
| `['programs','next']` | `/programs/active/next-workout` | 5 мин | |
| `['programs','list']` | `/programs` | 10 мин | |
| `['programs','detail',id]` | `/programs/:id` | 10 мин | `initialData` из `['programs','active']`, если id совпал — **ProgramEdit открывается мгновенно** |
| `['progress']` | `/progress` | 5 мин | |
| `['exercises','catalog']` | `/exercises?limit=1500` | **24 ч + persist** | каталог почти статичен; см. 3.2 |
| `['exercises','detail',id]` | `/exercises/:id` | 24 ч | `placeholderData` из каталога (карточка рисуется сразу, детали дозагружаются) |
| `['exercises','settings']` | `/exercises/settings` | 30 мин | сайд-эффект syncSettings — в `onSuccess` |
| `['exercises','lastResults',ids]` | `batch-last-results` | 5 мин | инвалидация после finish |

Глобальные настройки: `refetchOnWindowFocus: false` (Telegram WebView дёргает focus при каждом сворачивании), `refetchOnMount: false` при свежих данных (это и есть «без лишних обращений»), `retry: 1`.

---

## 3. План работ

### Этап 1 — каркас + Home/Progress (главный эффект)

- [ ] Подключить `QueryClientProvider` в `main.jsx` (вместо HomeDataProvider/ProgressDataProvider).
- [ ] `src/utils/queries.js` — фабрики ключей и query-функций поверх существующего `api.js` (сам api.js не меняется).
- [ ] Хуки-замены: `useYearStats()`, `useMonthStats()`, `useActiveWorkout()`, `useActiveProgram()` и т.д. — страницы переходят с `useHomeData()` на точечные подписки. **Progress перестаёт тянуть 7 Home-запросов** — подписывается только на `stats.month` + `workouts.recent` + `progress`.
- [ ] Удалить HomeDataContext/ProgressDataContext после миграции всех потребителей (HomePage, ProgressPage, WorkoutPage, ProgramEditPage, HeroBlock и др.).
- [ ] Скелетоны — только на `isLoading` (нет данных вообще); фоновая ревалидация (`isFetching`) UI не трогает.

**Результат этапа:** Home↔Progress — 0 запросов при свежем кэше вместо 16.

### Этап 2 — каталог упражнений

- [ ] `['exercises','catalog']` со `staleTime: 24ч` + **persist в localStorage** (`@tanstack/query-persist-client` или вручную для одного ключа: ~320 KB raw — в лимит localStorage помещается; ключ с версией `catalog-v1` + telegramId).
- [ ] LibraryPage: убрать локальный state → `useQuery(catalog)`. Повторный заход — **мгновенно, без скелетона и без 66 KB**. Холодный старт приложения — каталог из localStorage сразу, ревалидация фоном.
- [ ] ExercisePicker (WorkoutPage): тот же ключ каталога + клиентская фильтрация вместо отдельного `GET /exercises?limit=57`; серверный `search` оставить только как фоллбек для пустых результатов.
- [ ] ExerciseDetailSheet: `placeholderData` из каталога (имя/мышцы/GIF есть в списке) + дозагрузка `detail` — шит открывается без ожидания сети; заодно закрывает гонку из CODE_REVIEW_PLAN п. «ExerciseDetailSheet».

### Этап 3 — мутации и точечная инвалидация

Каждая мутация объявляет, что она меняет — никаких «refresh всего на всякий случай»:

| Мутация | Optimistic | Инвалидирует |
|---|---|---|
| finish workout | `workouts.active → null` | `stats.*`, `workouts.recent`, `progress`, `exercises.lastResults` |
| cancel workout | `workouts.active → null` | — (больше ничего не менялось) |
| log/delete set | локальный state WorkoutPage (как сейчас) | `workouts.active` — пометить stale без рефетча (refetch при следующем заходе) |
| start workout / pick day | `workouts.active` | — |
| save program | `programs.detail(id)` | `programs.active`, `programs.next`, `programs.list`, `progress` *(закрывает стейл-баг: planAdherence/цели мышц сейчас не обновляются после правки программы)* |
| activate program | — | все `programs.*`, `progress`, `workouts.recent` |
| delete workout (Progress) | `workouts.recent` | `stats.*`, `progress` |
| настройки упражнения | localStorage (как сейчас) | `exercises.settings` |

- [ ] Откаты: `onError` → восстановление снапшота + toast (синергия с CODE_REVIEW_PLAN «ошибки молча глотаются»).

### Этап 4 — мгновенный первый заход (JS-чанки)

- [ ] `Suspense fallback` → скелетон страницы вместо `null` (убрать «пустой экран»).
- [ ] **Prefetch lazy-чанков после первой отрисовки Home:** `requestIdleCallback(() => { import('./pages/Main/ProgressPage'); import('./pages/Main/LibraryPage'); ... })` — чанки крошечные (1–5 KB gzip), к моменту первого тапа уже загружены.
- [ ] Prefetch данных: после отрисовки Home — `prefetchQuery(progress)` и `prefetchQuery(catalog)` в idle. Первый заход на любой таб становится мгновенным и по JS, и по данным.

### Этап 5 — добивка

- [ ] SummaryPage: брать тоннаж/сеты из `['workouts','detail',id]` (сейчас — только из location.state; прямое открытие показывает нули).
- [ ] `['workouts','detail',id]` для шита деталей в Progress (повторный тап — из кэша).
- [ ] Тесты: jsdom + testing-library (по CODE_REVIEW_PLAN) — инвалидация мутаций как основная зона тестирования (таблица выше = чек-лист кейсов).
- [ ] Обновить ARCHITECTURE.md §5.6 и CLAUDE.md (контексты → react-query; убрать упоминание recharts — в коде его нет).

---

## 4. Что НЕ делаем

- **ETag/If-None-Match на бэке** — не нужно: staleTime решает задачу без сетевых roundtrip'ов вообще; ETag всё равно стоит RTT. Вернуться к идее, если появится требование real-time свежести между устройствами.
- **WebSocket/SSE-пуши инвалидации** — единственный клиент мутаций это сам мини-апп; кросс-девайс стейл (изменил программу в боте) закрывается коротким staleTime + инвалидацией при `programs.*`-мутациях из бота позже (фаза AI-слоя: бот меняет программу → при следующем открытии mini-app staleTime 10 мин истёк либо `workouts.active` 30 сек подтянет).
- **IndexedDB** — localStorage хватает (один большой ключ — каталог).
- **Виртуализация Library** — отдельный пункт CODE_REVIEW_PLAN (рендер 924 строк), не входит в кэш-слой, но после этапа 2 станет главным остаточным тормозом Library.

## 5. Метрики «получилось»

- Переключение любых табов при тёплом кэше: **0 сетевых запросов**, отрисовка < 100 мс (замер: Network-вкладка + Performance в Telegram Desktop WebView).
- Холодный старт: Library из localStorage без скелетона; Home — 1 волна запросов вместо повторных на каждый таб.
- После finish workout возврат на Home показывает обновлённый hero **без флеша старых данных** (optimistic + инвалидация).
- В коде не осталось вызовов «refresh всего» (`grep refresh()` по страницам = 0).
