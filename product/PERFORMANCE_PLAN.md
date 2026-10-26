# План улучшения быстродействия

Аудит от 2026-10-26: код фронта и бэка, анализ бандла и замеры прода (`app.gymwithai.me`, `ai-trainer-production-fef0.up.railway.app`).

## Диагноз в двух словах

Тормоза идут не от размера бандла: main chunk весит 465 KB, или 142 KB в gzip, и это нормально. Причин четыре:

1. **Каждый API-запрос стоит дорого.**
   - CORS preflight не кэшируется, поэтому почти каждый запрос превращается в два round trip.
   - Сжатия ответов нет.
   - `auth` и `requirePremium` делают 2–4 последовательных запроса к БД ещё до хендлера.
   - Сами хендлеры выполняют цепочки из 3–8 последовательных запросов.
   - Если Railway стоит не в EU, каждый запрос к Neon во Франкфурте дополнительно стоит около 100 мс.
2. **Запросов слишком много, и они выстроены в цепочки.**
   - Home при открытии шлёт 7 запросов, App ещё 2–3.
   - Вход в тренировку проходит цепочкой POST → GET active → POST batch-last-results.
3. **Кэш не переживает перезапуск.** Persistence для TanStack Query нет, `gcTime` стоит по умолчанию (5 мин). Поэтому при каждом открытии Mini App все экраны показывают скелетоны.
4. **Рендер и GPU.**
   - `backdrop-filter` висит на каждой карточке списков и вложен сам в себя.
   - На экране отдыха крутится бесконечная анимация.
   - `WorkoutPage` — один компонент на 1400 строк без `memo`.
   - Список Library рендерит около 900 строк внутри одного размытого слоя.

### Замеры

| Что | Значение |
|---|---|
| `/assets/*.js` на Vercel | `cache-control: public, max-age=0, must-revalidate`: хешированные ассеты перепроверяются при каждом открытии, а в Mini App SW нет |
| `OPTIONS` preflight | Нет `Access-Control-Max-Age`, браузер кэширует ответ на 5 с |
| `GET /api/health` (тривиальный) | TTFB ≈ 570 мс, из них TLS ≈ 380 мс |
| Сжатие API | Middleware нет |

---

## Фаза 0 — быстрые инфраструктурные победы (полдня, без риска)

**Статус (2026-10-26):**
- 0.1–0.3, 0.6, 0.7 и `prisma.$connect()` сделаны в коде. На деве каталог весит 88 KB вместо 510 KB, при повторной загрузке preflight не уходит.
- 0.4 и настройки Neon из 0.5 делаются руками в консолях.

| # | Что | Где | Эффект |
|---|---|---|---|
| 0.1 | Иммутабельный кэш для хешированных ассетов: `headers` в `vercel.json` → `/assets/(.*)`: `public, max-age=31536000, immutable` | `vercel.json` | Повторное открытие Mini App обходится без сетевых запросов за JS/CSS |
| 0.2 | `maxAge: 7200` в `cors()` | `server/src/index.js:35` | Минус round trip почти на каждом запросе |
| 0.3 | `app.use(compression())` | `server/src/index.js` | Каталог и `/progress` весят в 4–6 раз меньше |
| 0.4 | Проверить регион Railway: при необходимости перенести в EU West (Amsterdam), рядом с Neon eu-central-1 | Railway console | До −100 мс на каждый запрос к БД |
| 0.5 | Отключить autosuspend у прод-компьюта Neon; добавить `prisma.$connect()` при старте | Neon console, `server/src/utils/prisma.js` | Без холодного старта первого запроса |
| 0.6 | Убрать `refetchInterval: 60_000` и `refetchOnWindowFocus` у `useYearStats` | `src/hooks/queries.js:9-16` | Без фонового поллинга |
| 0.7 | Не гейтить hero на Home ответом `/stats/month`: он нигде не отображается | `HomePage.jsx:37,52` | Hero появляется раньше, на один запрос меньше |

**Альтернатива к 0.2:** rewrite в Vercel `/api/:path*` → Railway. Тогда запросы идут same-origin и preflight пропадает совсем. Но получается лишний хоп через Vercel, поэтому сначала стоит сделать `maxAge` и замерить.

## Фаза 1 — дешевле каждый запрос на бэке (1–2 дня)

**Статус (2026-10-26):** всё сделано, кроме двух пунктов. Без изменений остались: TTL-кэш web-юзера строится не из `session.user` (по-прежнему перечитывание, но только на промахе кэша) и Telegram upsert (тоже только на промахе). Замер на деве (Москва → Neon Frankfurt, ~95 мс RTT): после прогрева большинство эндпоинтов ≈ 1 round trip, каталог 9 мс.

1. **Auth без лишних запросов к БД.**
   - Telegram (`telegramAuth.js:46`): заменить upsert на каждом запросе на `findUnique` и делать `create` только при промахе.
   - Web (`auth.js:37`): брать пользователя из `session.user`, а не перечитывать его.
   - Добавить in-memory TTL-кэш на 30–60 с: `telegramId/token → user`.
2. **Кэш премиум-статуса.** В `requirePremium` (`billingService.js:85`) кэшировать `userId → isPremium` на 60 с. Инвалидировать в `applySuccessfulPayment`, `redeemPromo` и `cancelAutoRenew`.
3. **`GET /exercises` (каталог).**
   - `exercisePopularity()` сейчас сканирует все сеты и все программы всех юзеров на каждый запрос. Кэшировать её в памяти на 1 ч.
   - Ответ каталога хранить в памяти и отдавать с `Cache-Control` и ETag.
4. **`/insights/today` не должен ждать LLM.**
   - Сразу отдавать шаблонный текст, а генерацию запускать в фоне. Ещё лучше — генерировать при финише тренировки.
   - Дедуплицировать параллельные генерации через in-flight Map.
   - Таймаут 8–10 с, без ретраев.
5. **Распараллелить цепочки и сузить выборки.**
   - Убрать `getBoundaries()`: границы недели и месяца считать в JS. Сейчас это отдельный запрос в каждой ветке `/progress`.
   - `computeStreak`: «today» считать в JS, историю ограничить.
   - `/workouts/active`: program, override и hints запрашивать через `Promise.all`.
   - `/programs/active/next-workout`: тоже `Promise.all`.
   - Заменить `include: { exercise: true }` на узкий `select` (сейчас тянутся `description`, `instructions`, `videos` на каждый сет) в `workoutController.js:34,232,288,416` и в `logSet`.
   - Включить `previewFeatures = ["relationJoins"]`, чтобы include шли одним JOIN.

## Фаза 2 — меньше запросов и мгновенные экраны (2–3 дня)

1. **Персистентный кэш.**
   - `gcTime: 24h` по умолчанию.
   - `@tanstack/react-query-persist-client` + sync storage persister с whitelist небольших ключей: stats, programs, progress, insights, billing, workouts.
   - Холодный старт сразу показывает прошлые данные и обновляет их в фоне.
2. **Каталог упражнений.** Idle-prefetch в `App.jsx:56` создаёт query без `initialData` из localStorage, поэтому около 320 KB качаются заново при каждом старте.
   - Вынести общие `catalogQueryOptions()` и использовать их в App и в `useExerciseCatalog`.
   - Парсить localStorage один раз (сейчас это происходит дважды в рендере, `queries.js:173-174`).
3. **Вход в тренировку без скелетона.**
   - `WorkoutPage` рендерится сразу из кэша `workouts.active` и `ActiveWorkoutContext.restore()`, а сверка с сервером идёт в фоне. Сейчас `staleTime: 0` в `activeWorkoutQuery.js:23` плюс `loading = true`.
   - `POST /workouts` (start) возвращает ту же форму, что `GET /active`, и результат кладётся в кэш через `setQueryData` до навигации.
   - Resume: навигация сразу, без ожидания PATCH (optimistic уже есть).
   - `batch-last-results` либо включить в ответ active workout, либо перевести в `useQuery`. Так вес не будет прыгать в `ActiveSetInput`.
4. **Агрегированный `GET /home`**, или хотя бы объединить `programs/active` и `next-workout`. Вместо 7 запросов на Home остаются 1–2.
5. **Засеивать кэш, а не перезапрашивать.**
   - `programs.detail(id)` брать через `placeholderData` из `programs.active`.
   - `ProgramEditPage`: не копировать данные в local state через эффект (`:101-110`). Сейчас скелетон мигает даже при тёплом кэше.
   - `exercises/:id/history` брать через `placeholderData` из `progress-overview`.
   - `ProgressPage`: детали тренировки получать через `useWorkoutDetail` и делать prefetch на `pointerdown`.
6. **Prefetch по намерению.**
   - Чанки `SummaryPage` (при монтировании WorkoutPage), `ExerciseDetailSheet`, `MePage`, `BodyMap` — в idle.
   - `ProgramEditPage` — на `pointerdown` по «Мой план».
   - У `ExerciseDetailSheetLazy` и `BodyMapLazy` fallback сейчас `null`. Нужен блок фиксированной высоты, без layout shift.
7. **Web/PWA старт.**
   - При наличии токена рендерить приложение оптимистично и валидировать сессию параллельно.
   - Сплэш скрывать, когда реально есть контент (сейчас скрывается на первом rAF, и пользователь видит пустой экран).
   - `telegram-web-app.js` блокирует рендер в `<head>` и на вебе тоже. Подключать его условно.

## Фаза 3 — плавность рендера (2–3 дня)

1. **Glass без blur в списках.**
   - Добавить `variant="flat"` (полупрозрачный фон без `backdrop-filter`) для элементов списков, вложенных и непрозрачных карточек: `UpcomingExerciseItem`, `CollapsedExercise`, `ExerciseStatusSection`, список Library, `RestCard` внутри Glass, кнопки дней в BottomSheet.
   - Blur оставить только для фиксированного chrome: TopBar, GlassNav, BottomSheet.
2. **RestCard.**
   - Убрать бесконечную анимацию `trainerRestBreath`.
   - Прогресс-бар анимировать через `transform: scaleX()` вместо `width`.
3. **Library.**
   - Виртуализация через `@tanstack/react-virtual`, или как минимум `memo(ExerciseRow)` со стабильным `onClick`.
   - Состояние инпута держать внутри SearchBar либо использовать `useDeferredValue`.
   - Добавить debounce в `AlternativesPanel`.
4. **WorkoutPage.**
   - `memo` для `UpcomingExerciseItem`, `CollapsedExercise`, `DoneSetRow`, `ExerciseProgress`.
   - `getExerciseSettings` (сейчас `JSON.parse` localStorage на каждую строку при каждом рендере) заменить кэшем в памяти.
   - Не считать `exerciseProgress()` дважды.
5. **Мелочи.**
   - `Toast`: `useMemo` для value.
   - Таймер в `HeroBlock` вынести в отдельный компонент.
   - `@keyframes` вынести из инстансов `Skeleton` и других компонентов в `index.css`.
   - `TelegramProvider` не должен делать лишний setState при mount.
   - Для img добавить `loading="lazy"` и `decoding="async"`.

## Фаза 4 — масштаб и гигиена (по мере роста)

- Rate limit считать по userId после auth, а не по IP: за NAT мобильного оператора 100 req/мин на IP легко выбрать.
- Добавить индекс `WorkoutSet(exerciseId, workoutId)`. Проверить, что ручные индексы из `prisma/manual/2026-07-11-indexes-fk.neon.sql` есть на проде.
- Prisma pool: `connection_limit=10&pool_timeout=10`.
- Добавить прунинг `userLastSeen` Map (`sessionTracking.js:8`).
- `/workouts/recent` не должен тянуть весь `planJson`. `progress-overview` перенести агрегацию в SQL.
- Вынести бота, LLM и шедулер в отдельный worker (уже есть в SCALING_PLAN).

## Как мерить

До и после каждой фазы:

1. Время до hero на Home: холодный и тёплый старт в Telegram на Android.
2. Число запросов и общее время на Home (DevTools → Network).
3. Время от тапа «Начать/Продолжить» до интерактивного WorkoutPage.
4. FPS при скролле Library и на экране отдыха (Performance panel, CPU throttle ×4).
5. Серверное время по эндпоинтам: добавить `Server-Timing` или лог длительности в middleware.
