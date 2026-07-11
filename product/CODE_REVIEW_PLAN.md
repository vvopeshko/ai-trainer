# План исправлений по итогам code review

> Дата ревью: **2026-07-11** (заменяет ревью 2026-06-12). Только план — без правок кода.
> Покрытие: бэкенд-ядро, AI-слой (чат, tool-use, скрипты), фронтенд (корректность + производительность), схема БД, инфраструктура, тесты, доки.
>
> **Прогресс 2026-07-11:** Фазы 0, 1 и 1.5 реализованы полностью (отмечены ниже), из оптимизации фронтенда сделан топ-3 (таймер WorkoutPage, content-visibility Library, статичный Mesh) + graceful shutdown из Фазы 2. Race двух активных тренировок закрыт Serializable-транзакцией (partial unique index остаётся опцией при ручном SQL на проде).
>
> **Статус прошлого ревью:** фазы 0–1 (безопасность, потеря данных, TanStack Query) закрыты ранее и зафиксированы в NEXT_PLANS. Из фаз 2–3 сделано: `progressController` → services, `timingSafeEqual` для HMAC, программное закрытие BottomSheet, фикс fetch-гонки в ExerciseDetailSheet, «фейковые тесты» переписаны на импорт реального кода. Остальное перенесено сюда и перепроверено по коду.

---

## Фаза 0 — Критично: потеря данных, деньги, стабильно ломающиеся фичи

### Потеря данных

- [x] **ProgramEditPage сохраняет план одной программы в другую** — `src/pages/Main/ProgramEditPage.jsx:82-91,161-167,838`. Локальный `program`/`editedPlan` не сбрасываются при смене `:id` (навигация через «Другие программы» не ремонтирует компонент): экран показывает программу A, а `handleSave` PATCH'ит её план в программу B — **план B перезаписывается**. Фикс: сброс локального стейта в `useEffect` по `[id]` или `key={id}` на роуте.
- [x] **Ошибка POST сета не откатывает optimistic-сет** — `WorkoutPage.jsx:394-443`. В catch только toast: сет остаётся в UI без id, выглядит записанным, но на сервере его нет — «пропал подход» после перезахода. Фикс: в catch удалять сет по `tempId` из `doneSets`/`allExercises`/`partialSets`.
- [x] **`handleFinish` не ждёт in-flight POST сетов** — `WorkoutPage.jsx:631-691`. «Последний сет → сразу Готово»: PATCH finish обгоняет POST — сервер посчитает без последнего сета, а при 0 сетов удалит тренировку, в которую потом прилетит сет. Фикс: копить pending-промисы, `await Promise.allSettled()` перед finish.
- [x] **WorkoutPage финиширует/отменяет/создаёт тренировку мимо TanStack-мутаций** — `WorkoutPage.jsx:296,671,696,705`, `HomePage.jsx:66`. Голые `apiPatch/apiDelete/apiPost` без инвалидации: до 30с кэш `workouts.active` показывает завершённую тренировку, «Продолжить» открывает её и пишет сеты в finished workout; stats/recent/next стейлятся до 5 мин. Фикс: перейти на `useFinishWorkout`/`useCancelWorkout` + `setQueryData`/`invalidateQueries` после старта.
- [x] **`matchMovekitVideos.mjs --apply` затирает существующий `gifUrl` на `null`** — `server/scripts/matchMovekitVideos.mjs:222-237`. `videoPreviewUrl` бывает null, а условие перезаписи старых .gif выполнит `update({ gifUrl: null })`. Фикс: `if (!m.videoUrl) continue`; заодно проверить, что фронт рендерит .mp4 в поле gifUrl.

### Стабильно ломающийся чат (ядро продукта)

- [x] **Окно истории чата может начинаться с `assistant` → 400 на каждом сообщении** — `server/src/services/aiTrainer/chat.js:59-75`. `take: 20` + reverse: после ~10 обменов первое сообщение — assistant, API отклоняет запрос → чат стабильно падает в fallback. Фикс: после reverse отбрасывать ведущие assistant-сообщения.
- [x] **Финальный раунд tool-петли без `tools` → 400 от API** — `server/src/utils/llm.js:106-117`. Когда модель зовёт инструменты все maxRounds раундов, последний запрос шлёт историю с tool-блоками без параметра `tools` — invalid_request_error. Сценарий: длинный рефайн программы (search → details → replace) → юзер получает «туплю», хотя правка уже применена в БД. Фикс: оставлять `tools` + `tool_choice: { type: 'none' }`.

### Деньги и abuse

- [x] **LLM-чат бота вообще без rate limiting** — `server/src/bot/index.js:253-283`. `express-rate-limit` висит только на HTTP; любой Telegram-юзер (хендлер сам создаёт User) шлёт неограниченно сообщений, каждое = до 4 LLM-вызовов с полным контекстом. Фикс: in-memory троттл per telegramId (например 5 сообщений/мин) перед `handleChatMessage`.
- [x] **Rate limiter обходится: ключ = сырой `Authorization`-заголовок** — `server/src/middleware/rateLimiter.js:5` + `index.js:36`. Лимитер стоит ДО auth: каждый новый мусорный заголовок = новый бакет; валидные initData ротируются (все живут 24ч) — обходится и глобальный, и `llmLimiter` на `/programs/import`. Фикс: `llmLimiter` после `telegramAuth` с ключом `req.user.id`; глобальный — IP-фолбэк.
- [x] **Админ-проверки fail-open** — `bot/index.js:137,163`. `if (adminId && ...)`: не задан/опечатан `ADMIN_TELEGRAM_ID` → `/cost` и vision-распознавание доступны всем. Фикс: `if (!adminId || ctx.from.id !== adminId) return`.

---

## Фаза 1 — High: корректность и устойчивость

### Бэкенд

- [x] **Две активные тренировки (race)** — `workoutController.js:21-54`. Interactive-транзакция на ReadCommitted не сериализует параллельные create. Фикс: partial unique index `ON "Workout"("userId") WHERE "finishedAt" IS NULL` (вручную, SQL) + ловить P2002.
- [x] **P2003/P2002 → 500 вместо 400** — `workoutController.js:238-250`, `errorHandler.js`. logSet с несуществующим exerciseId падает 500. Фикс: маппинг кодов Prisma в errorHandler.
- [x] **Невалидированный `X-Timezone` валит статистику** — `utils/dateUtils.js:5-7` + `statsService.js:138-231`. `AT TIME ZONE 'мусор'` → ошибка Postgres → 500 на `/progress`, `/stats/*`, tool-вызовах. Фикс: валидация через `Intl.DateTimeFormat` с фолбэком UTC (как в insightsController).
- [x] **llm.js: двойной слой ретраев + таймаут-зомби** — `llm.js:20,27-32,46-62`. SDK ретраит сам (2) + `createWithRetry` ещё 2 = до 9 попыток; `withTimeout` не абортит запрос — после «таймаута» он живёт и тратит токены (usage не пишется). Фикс: `timeout`/`maxRetries` средствами SDK, убрать самодельное. Заодно: `vision()` без retry и берёт `content[0]` вместо `find(type === 'text')` (`llm.js:165-189`).
- [x] **Markdown/HTML-инъекции в боте** — `bot/index.js:79-94,219-242,278`. `/workout` и фото-хендлер на `parse_mode: 'Markdown'` с неэкранированными названиями (непарный `*` → Telegram 400); ответ LLM-чата шлётся как HTML без санитизации (незакрытый тег → «Что-то пошло не так», при этом ответ уже в ChatMessage — история и экран расходятся). Фикс: HTML + escapeHtml (как в notifier) везде; для чата — retry без parse_mode при 400.
- [x] **Падение long polling оставляет процесс жить с мёртвым ботом** — `index.js:61`. `/api/health` зелёный, бот мёртв до ручного рестарта. Фикс: retry с backoff или `process.exit(1)` → Railway перезапустит.
- [x] **`batchLastResults` тянет всю историю сетов** — `exerciseController.js:167-211`. Для 50 упражнений грузятся все сеты за всё время. Фикс: raw SQL `DISTINCT ON ("exerciseId")`.
- [x] **exerciseResolver: три проблемы разом** — `exerciseResolver.js:70-92`. (1) check-then-create → P2002 при гонке — нужен upsert по slug; (2) `slugify('Жим лёжа')` → `''` — все кириллические имена без nameEn коллапсируют в одно упражнение со slug `''` — нужна транслитерация + отказ от auto-create при пустом slug; (3) auto-create из importProgram загрязняет глобальный каталог (виден всем через search_exercises, вектор косвенной инъекции чужих чатов) — пометить/скоупить ai_generated по userId.
- [x] **`/insights/today` без `llmLimiter`** — `routes/insights.js:9`. Плюс dayKey зависит от подконтрольного X-Timezone; параллельные первые запросы дня дублируют LLM-вызов.
- [x] **finish: `count` и `delete` вне транзакции; `feltRating` затирается null** — `workoutController.js:356-368`. Параллельный logSet между count=0 и delete теряет сет; `feltRating: data.feltRating ?? null` вместо `?? workout.feltRating`.
- [x] **N+1 при резолве упражнений** — `importProgram.js:137-174`, `generateProgram.js:167-205`. Последовательные await в цикле (2 запроса на упражнение + на каждый alternative). Фикс: батч-резолв.
- [x] **findOrCreate юзера в боте без upsert** — `bot/index.js:45-47,192-204,264-275`, `scenes/generateProgram.js:72-87`. Гонка → P2002 → ошибка хендлера. Фикс: `prisma.user.upsert` (как в telegramAuth).

### AI-слой

- [x] **Write-инструмент выполнен, но при фейле финального текста след не сохраняется** — `chat.js:82-118`. Правка программы применена молча: юзер видит fallback, в истории следа нет → модель на следующем ходе может применить правку повторно. Фикс: сохранять факт выполненных write-инструментов в ChatMessage независимо от исхода.
- [x] **programEditor: read-modify-write `planJson` без транзакции** — `programEditor.js:180-228`. Параллельная правка (чат + PATCH из мини-аппа) — lost update. Фикс: `$transaction` или условный update по `updatedAt`.
- [x] **Модель не знает, какой день «следующий», для `scope: 'next'`** — `chatTools.js`/`programEditor.js`. Оверрайд может лечь не на тот день и молча ждать его по циклу. Фикс: `nextDayIndex` в ответ `get_program_details` (вычисление уже есть в programController:79).
- [x] **`add_exercise` не проверяет дубли в дне** — `programEditor.js:137-153`. Ретрай модели/двойное «да» → упражнение дважды. Фикс: проверка `findExerciseIndex` перед push.
- [x] **pending-контекст consume'ится до успешного ответа + не атомарно** — `chatContext.js:79-94`. LLM упал → юзер повторяет вопрос, контекста уже нет; findFirst+update — двойной подхват при гонке. Фикс: consume после успеха, `updateMany({ where: { id, consumedAt: null } })`.
- [x] **`generateProgram` maxTokens 4096 — мало** — `generateProgram.js:137-144`. 5–6 дней × 6–7 упражнений ≈ 5К+ токенов JSON → обрезка → Zod fail → «Попробуй ещё раз» без шансов. Фикс: 8192 (как в importProgram).
- [ ] **Сироты WorkoutPlanOverride** — `workoutController.js:377-390`. Не чистятся при деактивации/смене программы; при реактивации через месяцы всплывёт устаревшая правка. Фикс: чистка при деактивации + TTL.

### Фронтенд

- [x] **muscleMapping рассинхронизирован с сервером** — `src/utils/muscleMapping.js:8-10` держит `front_delts/side_delts/rear_delts/middle_back`, сервер шлёт `front_delt`/`middle back` (BodyMap уже совпадает с сервером): `getMuscleName('front_delt')` → сырой ID в чипах, группа «middle back» выпадает из SummaryPage. Фикс: единый словарь + алиасы + тест на соответствие серверному списку.
- [x] **SummaryPage при прямом открытии — нули** — `SummaryPage.jsx:21-25`. Данные только из `location.state`, `:id` не используется. Фикс: подключить готовый `useWorkoutDetail(id)`.
- [x] **Partial progress не восстанавливается при перезапуске** — `WorkoutPage.jsx:227-248`. `applyData` сгружает все серверные сеты в «сделано»: упражнение с 2/4 подходами помечается завершённым. Фикс: сравнивать число сетов с `planExercises[].sets`, неполные — в `partialSets`.
- [x] **Удаления сетов — `.catch(() => {})`** — `WorkoutPage.jsx:460,484,511,522,548,738,784`. Сет исчез из UI, остался на сервере — портит статистику молча. Фикс: toast + возврат в стейт.
- [x] **SwipeRow + `key={i}`: открытая «корзина» переезжает на соседний сет** — `SwipeRow.jsx:14`, `WorkoutPage.jsx:996,1101`. После удаления DOM переиспользуется, случайный тап удаляет не тот сет. Фикс: key по `tempId ?? id` + сброс transform.
- [x] **Summary: мышцы почти всегда пустые в plan-flow** — `WorkoutPage.jsx:652-666`. `collectMuscles` читает `primaryMuscles` у объектов, где их нет (план даёт только `{id, nameRu, slug}`). Фикс: брать из `planExercises`.
- [x] **ProgressPage: ошибка деталей тренировки → вечный скелетон** — `ProgressPage.jsx:465-476`. Фикс: toast + закрытие шита.
- [x] **`handleResume`: navigate до применения оптимистики** — `HomePage.jsx:77-82`. WorkoutPage может увидеть `pausedAt != null` → второй PATCH resume. Фикс: `mutateAsync` перед navigate.
- [x] **`useResumeWorkout`/`useCancelWorkout` без `onSettled`-ресинка** — `mutations.js:33-61`. Оптимистичный `totalPausedMs` из `Date.now()` (clock skew) не ресинкается с сервером. Фикс: `onSettled → invalidate(workouts.active)`; в `useDeleteWorkout` добавить `programs.next` и `workouts.detail(id)`.
- [x] **PUT настроек на каждый тик степпера** — `ExerciseDetailSheet.jsx:962-969`. Fire-and-forget без debounce и порядка — последний ответ может не соответствовать последнему значению. Фикс: debounce 500мс или сохранение по закрытию.
- [x] **Missing i18n-ключи `library.cat.*`** — `ExerciseDetailSheet.jsx:661`. Реальные категории (`strength`, `cardio`…) не имеют переводов — в UI светится «library.cat.strength». Фикс: добавить ключи/маппинг.

---

## Фаза 1.5 — Стоимость LLM (деньги, быстрые победы)

- [x] **Prompt caching не используется нигде.** `SYSTEM_BASE` (~10КБ) + схемы 12 инструментов оплачиваются полным прайсом до 4 раз за сообщение; `generateProgram` шлёт каталог 924 упражнений (~15–20К токенов) без кэша. Фикс: `cache_control: { type: 'ephemeral' }` на стабильном префиксе (tools + SYSTEM_BASE до динамического контекста). Ожидаемо −50–90% input-токенов самой частой операции (перекликается со SCALING_PLAN §1.2).
- [x] **Usage теряется при ошибке посреди tool-петли** — `llm.js:119-151`. `maybeRecordUsage` только на успехе → `/cost` систематически недоучитывает самые дорогие (многораундовые) вызовы. Фикс: запись в finally/catch.
- [x] **`enrichProgramMedia` зовёт `llm.chat()` без `meta`** — расход невидим для `/cost`. Фикс: `meta: { feature: 'enrich_media' }`.
- [x] **`llmCost.js:19-25`: прайс opus устарел** (указан $15/$75); **`usageReport.js:23-28`: «сегодня» по UTC** — для МСК-админа день с 03:00. Обновить прайс, считать от полуночи TZ админа.
- [x] **`tool_result` с ошибкой без `is_error: true`** — `llm.js:143`. Модель хуже распознаёт сбой инструмента.
- [x] **Обновить `@anthropic-ai/sdk`** — ^0.33 при актуальной 0.111: год отставания для проекта, чьё ядро — LLM; заодно разблокирует prompt caching и SDK-таймауты. Прогнать чат/vision после апдейта.

---

## Оптимизация фронтенда

> Замеры реального билда (vite build + sourcemap): main-чанк **438.5 KB (132.2 KB gzip)** = react-dom 176.6 + app 138.1 + react-router 35.3 + query-core 32.4 + body-muscles 25.9 + react 8.1. Lazy-чанки работают (Progress 12.7, ProgramEdit 21.4, Library 5.7, Summary 3.1). Целевая среда — слабые Android WebView: 132 KB gzip ≈ 400+ мс parse/execute.
>
> **Топ-3 по соотношению эффект/усилия:** (1) секундный таймер из корня WorkoutPage → внутрь WorkoutTopBar; (2) `content-visibility: auto` на строки LibraryPage; (3) статичный Mesh вместо анимированного blur(70px).

### Ре-рендеры (в проекте ни одного `React.memo`)

- [x] **Live-таймер ре-рендерит весь WorkoutPage (1371 строка) каждую секунду** — `WorkoutPage.jsx:171-177`. `elapsedSec` нужен только WorkoutTopBar (:855). Фикс: перенести interval внутрь WorkoutTopBar, передавая `startedAt/pausedAt/totalPausedMs` — паттерн уже есть в `HeroBlock.jsx:53-59`.
- [ ] **Drag-reorder: `setDragDelta` на каждый touchmove** — `WorkoutPage.jsx:126-155`. Полный ре-рендер страницы с частотой тача (~60–120 Гц) → лаги перетаскивания. Фикс: `transform` напрямую в DOM через ref, state — только на touchend.
- [ ] Точечно обернуть в `memo` тяжёлые поддеревья WorkoutPage (списки done/upcoming) после выноса таймера.

### Списки

- [x] **LibraryPage рендерит все 924 упражнения без виртуализации** — `LibraryPage.jsx:328-337`. ~5000+ DOM-нод внутри Glass с backdrop-filter; каждый фильтр-чип — полная пересборка. Фикс-минимум: `content-visibility: auto; contain-intrinsic-size: 0 57px` на строке; лучше — виртуализация или «показать ещё» после ~100. (Поиск с debounce 300мс и useMemo-фильтрация уже сделаны правильно.)
- [ ] **ExercisePicker игнорирует закэшированный каталог** — `ExercisePicker.jsx:14-31`. Грузит `?limit=57` + сеть на каждый ввод ≥2 символов — в зале с плохой сетью задержки на ровном месте. Фикс: `useExerciseCatalog()` + клиентская фильтрация (как LibraryPage), серверный search — фоллбек.

### Бандл и стартовый путь

- [ ] **Lazy для ExerciseDetailSheet** (18.3 KB, 1068 строк, всегда за интеракцией) — сейчас статически в main через WorkoutPage. −20+ KB из критического пути.
- [ ] **Динамический импорт BodyMap** (body-muscles 25.9 KB) — на HomePage рендерится только внутри BottomSheet после тапа. −26 KB из main.
- [ ] **Google Fonts — render-блокирующий запрос** — `index.html:11-12`. Self-host JetBrains Mono или `media="print" onload`-трюк.
- [ ] **Удалить `recharts` и `lucide-react` из package.json** — не импортируются нигде (в бандл не попадают, но тормозят install/CI и врут в CLAUDE.md).
- [ ] **Кэшировать timezone в api.js** — `api.js:14-17`. `Intl.DateTimeFormat().resolvedOptions()` на каждый запрос — небесплатно на Android WebView. Module-level константа.

### Данные и кэш

- [ ] **Персист каталога в localStorage не реализован** (заявлен в FRONTEND_CACHE_PLAN этап 2, в коде отсутствует) — каждый холодный старт заново качает ~66 KB gzip. Фикс: ручной персист ключа `catalog-v1` + гидрация через `initialData`. Заодно уберёт конкуренцию idle-префетча каталога с критическими запросами на 3G.
- [ ] *Проверено и в порядке:* `refetchOnWindowFocus: false`, staleTime по типам данных, optimistic + точечная инвалидация, префетч lazy-чанков и данных в `requestIdleCallback` (этап 4 плана реально реализован), HTML-splash до гидрации.

### Медиа

- [ ] **GIF упражнений: хотлинк + нет `decoding="async"`** — `ExerciseDetailSheet.jsx:197-204`. GIF-декодирование — из самых дорогих операций на слабых телефонах. Среднесрочно: перегнать в mp4 на своём R2 (в 5–10× легче; `DemoMedia` уже умеет `isVideo`) — синергия со SCALING_PLAN §2.3 и movekit-пайплайном.
- [ ] **YouTube-превью без `loading="lazy"`** — `ExerciseDetailSheet.jsx:260-265`.

### CSS / анимации (glassmorphism на слабых WebView)

- [x] **Mesh: три блоба с `blur(70px)` и бесконечной 18с-анимацией на каждом таб-экране** — `Mesh.jsx:8-37`. Три постоянно живых GPU-слоя, конкурируют со скроллом, жгут батарею. Фикс: статичный пре-блюренный radial-gradient (визуально почти неотличимо) + `prefers-reduced-motion`.
- [ ] **backdrop-filter — 11 использований в 8 файлах**; worst case: fixed GlassNav (blur 14px) поверх скролла поверх анимированного Mesh; под Glass на Library — 924 строки. Фикс: токен `--glass-blur` с возможностью обнулить для слабых устройств; у GlassNav фон уже 0.92 — блюр можно просто убрать.
- [ ] RestCard: `transition: width` → `transform: scaleX()` (мелочь; остальные анимации — transform/opacity, ок).

---

## Фаза 2 — Архитектура, БД, инфраструктура

### Схема и данные

- [ ] **Индекс `Workout(userId, finishedAt)`** — сейчас только `[userId, startedAt]`, а горячие запросы (recent, stats, buildUserContext, reminder) фильтруют/сортируют по finishedAt.
- [ ] **FK для `WorkoutPlanOverride.programId`** (`onDelete: Cascade`) — сейчас голая строка, сироты при будущем удалении программ.
- [ ] **`UserExerciseSettings.exerciseSlug` без FK** — при дедупликации slug'ов (скрипт dedupeExercises есть) настройки осиротеют молча. FK или явный комментарий «осознанно денормализовано».
- [ ] **Retention:** `AnalyticsEvent`, `LlmUsage`, `ChatMessage`, `NotificationLog`, consumed `PendingChatContext` копятся вечно. Cron-джоб чистки (шедулер уже есть).
- [ ] **Zod-парс `planJson` при чтении** в местах мёржа (`enrichPlanExercises`, оверрайды) — сейчас структуре доверяют слепо.

### Процесс и шедулер

- [x] **Graceful shutdown** — `index.js:72-77`: нет `prisma.$disconnect()`, нет force-exit таймаута (keep-alive висит до SIGKILL), нет `unhandledRejection`-хендлера.
- [ ] **Окно вместо точного часа для сводок** — `weeklySummary.js:190`, `reminder.js:134`: `hour === 19` — деплой в момент тика → сводка пропущена на неделю. `NotificationLog.periodKey` уже даёт идемпотентность — безопасно `hour >= N`.
- [ ] **claim-then-send = at-most-once** — `scheduler/index.js:134-141`: упавший `job.run` после claim теряет уведомление за период. Осознать или логировать после успешной отправки.
- [ ] **Утечки in-memory:** `userLastSeen` Map (`telegramAuth.js:14`) растёт без чистки; reminder пишет gate-строку в NotificationLog каждому юзеру каждый день (`reminder.js:131-139`).
- [ ] **Мелочи auth:** сортировка dataCheckString по строкам `key=value`, а не по ключам (`telegramAuth.js:100-103`) — хрупко относительно спецификации.

### Зависимости и конфиги

- [ ] `yt-search` → devDependencies (используется только в ручном скрипте, ставится на Railway зря).
- [ ] `engines.node` в оба package.json — Node 24 закреплён только в railpack.json; Vercel/локалка могут собирать другой версией.
- [ ] `vercel.json`: `rm -rf node_modules && npm install` отключает кэш зависимостей на каждый деплой — убрать или задокументировать причину.
- [ ] eslint-глобы не покрывают `server/scripts/`, `scripts/*.mjs` — все скрипты вне линта.
- [ ] Закоммитить `test.include` в vite.config.js + `server/vitest.config.js` (сейчас M/untracked).

---

## Фаза 2.5 — Тесты

> Позитив: фейковых тестов больше нет — все 11 покрытых файлов импортируют реальный код.

- [ ] **Закоммитить 4 новых тест-файла** (formatters, muscleMapping, weightUnit, parseJsonFromLLM) — pre-push сейчас защищает только локально.
- [ ] **`workoutController`** — самая хрупкая непокрытая логика: авто-удаление пустой тренировки, математика паузы `totalPausedMs`, consume оверрайда при финише, удаление при 0 сетов. Мок-prisma, в первую очередь.
- [ ] **Chat tool-use цикл** (`chat.js` + `chatTools.js`) с мок-`llm` — многошаговый loop, ошибки видны только в проде (см. Фазу 0).
- [ ] **`scheduler`: `getLocalTime`/`isoWeekKey`/`claimNotification`** — чистые функции с ловушками (hour===24, границы ISO-недель).
- [ ] **`hooks/mutations.js`** — таблица инвалидаций из FRONTEND_CACHE_PLAN этап 3 = готовый чек-лист кейсов; неверный queryKey = тихо протухший кэш (см. Фазу 0, WorkoutPage).
- [ ] Тест-инвариант: серверный список muscle ID ↔ `muscleMapping.js` ↔ `BodyMap.MUSCLE_ZONE_MAP` (ловит рассинхрон типа front_delt/front_delts навсегда).

---

## Фаза 3 — Low: гигиена, косметика, доки

### Гигиена репо

- [ ] `.gitignore`: `server/data/free-exercise-db.json` (1MB) и `movekit-*.json` (~480KB) — регенерируемые дампы, в ignore; закоммиченным остаётся только `enriched-exercises.json`. Также `.env*` + `!.env.example`; решить судьбу черновиков `server/scripts/_*.mjs`; убрать `prototype/bodymap/*.tar.gz` из git.
- [ ] `product/Программа_тренировок.md` — кириллическое имя ломает часть тулинга + личные данные в репо: переименовать в ASCII или вынести.
- [ ] `server/data/fetch-missing-gifs.js` → `server/scripts/`.
- [ ] Хардкод личного telegramId как fallback в `enrichProgramMedia.js:69`.

### Скрипты (movekit/enrich — до запуска `--apply`)

- [ ] Жадный матчинг в порядке файла, не по score — `matchMovekitVideos.mjs:140-177`: ранний кандидат 0.56 забирает упражнение у позднего 0.9. Сортировать пары по score до назначения.
- [ ] `scrapeMovekit.mjs:80-90` — хрупкий unescape цепочкой replace (искажает легитимные `\` в инструкциях) + fetch без таймаута.
- [ ] `enrichProgramMedia.js`: `JSON.parse` без try/catch (:130-138) роняет прогон; `rankVideos` не валидирует диапазон индексов от LLM (:274-295).

### Мелкие баги

- [x] `identifyMachine.js:140-177`: `confidence: 0` («не тренажёр») возвращает `success: true`; при Zod-фейле в БД пишется сырой LLM-JSON (:117-124).
- [ ] `%`/`_` не экранируются в LIKE/ILIKE — `exerciseController.js:69-80`, `chatTools.js:226-242` («жим 100%» матчится как wildcard → тихий резолв не того упражнения).
- [ ] `PUT /exercises/settings/:slug` — нет валидации slug и `minWeight <= maxWeight` (`exerciseController.js:118-129`).
- [x] `workoutController.js:42` — 403 вместо 404 на «Program not found»; `programDayIndex` без проверки границ.
- [ ] BottomSheet: `setTimeout` без cleanup; вложенные оверлеи ломают body scroll-lock (`ExerciseDetailSheet.jsx:995-1000`); `setExpandedDoneIndex` внутри updater (`WorkoutPage.jsx:464-475`); BodyMap click-хендлер фиксируется на mount; мёртвый тернарник в `ActiveSetInput.jsx:44-48`.
- [ ] `chatTrainer.md` обещает сброс `scope: next` после тренировки, но при финише с 0 сетов оверрайд не consume'ится — выровнять код или промпт.

### i18n и токены (нарушения правил проекта)

- [ ] Хардкоды мимо `t()`: «кг/КГ/повт/подход/упр» (WorkoutPage, ActiveSetInput, DoneSetRow, ExerciseDetailSheet), «ч/м/мин/т» (SummaryPage, ProgressPage), «День N» (HomePage, HeroBlock), дни недели/«СЕГОДНЯ» (WeekCalendar, formatters.js), месяцы (MyPlanSection), сырые английские muscle ID в ExercisePicker:66.
- [ ] Цвета мимо токенов: `#08080B` (WorkoutPage:852), **вся hero-палитра HeroBlock:18-24 захардкожена и игнорирует `--accent-h`**, `hsl(140,…)` вместо `--success` (SummaryPage:73-80). Системные `rgba(236,…)` вместо `--fg-*` — решить: узаконить или мигрировать.

### Доступность

- [ ] `aria-label` на иконочные кнопки (WorkoutTopBar, info-кнопки, back/swap в ExerciseDetailSheet, bell, крестик поиска); кнопка удаления в SwipeRow — `div` → `button`; `role="dialog"`/`aria-modal`/focus trap/Escape в BottomSheet и ConfirmDialog.

### Доки vs код

- [ ] CLAUDE.md: «шедулер пока не реализован» — реализован; «11 моделей» — 15 (нет NotificationLog, PendingChatContext, Insight, LlmUsage); «server/ excluded из ESLint» — линтуется; Recharts/Lucide в стеке — не используются; pre-push порядок — фактически `lint → build → fe → be`.
- [ ] R2 заявлен в CLAUDE.md/ARCHITECTURE.md — в коде не используется (фото = Telegram file_id): пометить «планируется».
- [ ] ARCHITECTURE.md:182 — cron weekly описан как `'0 10 * * 1'`, фактически почасовой тик + вс 19:00 в TZ юзера.

---

## Рекомендуемый порядок

1. **Фаза 0 целиком** (~1–2 дня): два бага, стабильно ломающих чат (assistant-first история + tool-петля), abuse-дыры (бот без лимитов, обходимый rate limiter, fail-open админ), потеря данных (ProgramEditPage cross-save, откат сетов, finish-гонка, WorkoutPage → мутации), guard в movekit `--apply` перед его запуском.
2. **Фаза 1.5 (LLM-стоимость)** — маленькая и денежная: prompt caching + честный usage + обновление SDK. Прямо по SCALING_PLAN §1.2.
3. **Фаза 1** — корректность (частично параллелится с 1.5, т.к. llm.js общий).
4. **Оптимизация фронтенда** — начать с топ-3 (таймер, content-visibility, Mesh) — три маленькие правки с самым заметным эффектом на телефоне; остальное — по мере работы над экранами.
5. **Фазы 2–3** — фоном: индекс + shutdown + окно шедулера — быстрые и важные; тесты workoutController — перед любым рефакторингом WorkoutPage; гигиена и доки — по пути.
