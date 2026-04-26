# NEXT_PLANS — AI Trainer

Живой бэклог приоритетов, фич, техдолга. Обновляется на каждой итерации.
Продукт — в [BRD.md](BRD.md). Техника — в [ARCHITECTURE.md](ARCHITECTURE.md).

**Последнее обновление:** 2026-04-26 (ночь)

---

## 🎯 Следующий заход: Фаза 3 (остаток) + Фаза 4

Полный план реализации — в [docs/implementation-plan.md](docs/implementation-plan.md).

**Цель:** доделать Workout-экран (edit/delete sets, альтернативы, суперсеты) + Summary + Progress-аналитика.

### Фаза 3 (остаток) — Workout полный

- [x] `DELETE /api/v1/workouts/:id/sets/:setId` — удалить подход
- [x] Удаление подходов в UI (кнопка × на каждом подходе)
- [x] Раскрытие выполненных упражнений (просмотр подходов + отмена)
- [x] Раскрытие предстоящих упражнений (прошлые результаты + "Начать")
- [x] `POST /api/v1/exercises/batch-last-results` — пакетный запрос прошлых результатов
- [x] Drag-and-drop reorder предстоящих упражнений (touch)
- [x] Partial progress — незавершённые упражнения остаются в "далее"
- [x] Фикс rest timer (не считал, лаг, анимация, после последнего подхода)
- [x] Фикс исчезающих упражнений при клике
- [ ] `PATCH /api/v1/workouts/:id/sets/:setId` — редактировать подход (вес/повторы)
- [ ] `POST /api/v1/workouts/:id/exercises` — внеплановое упражнение (через exerciseResolver)
- [ ] `POST /api/v1/exercises/:id/replace-suggest` — AI-предложения замены
- [ ] BottomSheet: альтернативы, суперсет, AI-замена
- [ ] Quick actions: "Спросить тренера", "Фото тренажёра"
- [ ] Автоподстановка веса/повторов из прошлой тренировки

### Фаза 4 — Summary + Progress

- [ ] Progress API: plan-adherence, muscle-volume, insights, imbalances, records
- [ ] Summary-экран: улучшить (сейчас минимальный)
- [ ] Progress-экран (BRD §12.4): графики, плато, дисбалансы

### Параллельно: инфра и улучшения

- [ ] Railway автодеплой — починить (GitHub Repo not found)
- [ ] Дозагрузить GIF (36 упражнений без анимации)
- [ ] `ActiveWorkoutProvider` (React Context) — тренировка должна переживать навигацию
- [ ] Loading states — скелетоны при загрузке данных

---

## 📋 Последующие фазы (из implementation-plan.md)

| Фаза | Что | Зависит от |
|------|-----|-----------|
| **5** | Programs (редактор, библиотека, AI-генерация) | 2 |
| **6** | Cross-cutting + polish (deep-links, toast, empty/loading/error states, offline) | 3-5 |

---

## ✅ Выполнено

### Фаза 3 (большая часть) — Workout interactive UX (2026-04-26) ✅

**Glass_v3 prototype + интерактив:**
- [x] WorkoutTopBar (Glass strong, live-таймер, прогресс, ГОТОВО/ОТМЕНИТЬ)
- [x] Единый scrollable layout (вместо трёх отдельных режимов)
- [x] CollapsedExercise — раскрываемые завершённые упражнения с подходами
- [x] ActiveSetInput (accent-tinted stepper)
- [x] UpcomingExerciseItem — раскрываемые с прошлыми результатами + "Начать"
- [x] Rest timer между подходами (RestCard) — фикс счётчика, анимация, после последнего подхода
- [x] DoneSetRow с кнопкой удаления (×)
- [x] RestCard русифицирован через i18n
- [x] Удаление подходов + отмена упражнений (`DELETE` API)
- [x] Drag-and-drop reorder предстоящих упражнений (touch, grip handle)
- [x] Partial progress — незавершённые упражнения остаются в "далее" с индикатором
- [x] Batch-fetch прошлых результатов (`POST /exercises/batch-last-results`)
- [x] Pending sets ghost rows в активной карточке
- [x] 17 i18n-ключей

### Фаза 2 — Home-экран (2026-04-26) ✅

- [x] `GET /programs/active` + `GET /programs/active/next-workout`
- [x] `GET /stats/month` + `GET /workouts/recent?limit=4`
- [x] TabLayout с GlassNav (4 таба)
- [x] HomePage — programme strip + hero + stat-tiles + недавние
- [x] Active workout state (пульс + live-таймер + "Продолжить")
- [x] Programme strip с навигацией по дням
- [x] Роутинг: `/` → Home

### Программы (2026-04-26)

- [x] Programs API (`GET /programs/active`, `GET /programs/active/next-workout`)
- [x] `seedProgram.js` — генерация из исторических тренировок
- [x] Program-aware Workout flow (PlanQueue, auto-навигация, planned sets)

### Фаза 1 — Сквозной скелет (2026-04-26) ✅

**Критерий:** открываю мини-апп в Telegram → выбираю упражнение → ввожу вес × повторы → "Сделал" → данные в Neon. **Пройден.**

#### 1a — Seed + resolve + import
- [x] Enriched exercises JSON (57 упр., 21/57 GIF)
- [x] Prisma schema: `ExerciseSource` enum, `source`, `gifUrl`
- [x] `seedExercises.js` — 57 упражнений в Neon
- [x] `exerciseResolver.js` — slug → alias → auto-create
- [x] `importWorkouts.js` — 60 тренировок, 1687 подходов, 57/57 slug-match

#### 1b — API для тренировок
- [x] `GET /exercises` + `GET /exercises/search?q=`
- [x] `POST /workouts` (create/resume) + `GET /workouts/active` + `GET /workouts/:id`
- [x] `POST /workouts/:id/sets` + `PATCH /workouts/:id` (finish)

#### 1c — Workout-экран
- [x] BigStepper, TopBar компоненты
- [x] WorkoutPage — полный flow (picker → stepper → log → finish)
- [x] SummaryPage — "Готово!" + stat-tiles
- [x] Роутинг: `/workout`, `/summary/:id`
- [x] Haptic feedback, optimistic updates
- [x] **E2E в Telegram — работает** ✅

### Дизайн-система (2026-04-26)

- [x] 11 UI-компонентов (Glass, Button, Icon, StatTile, ActivePill, GlassNav, GlassAINote, RestCard, Mesh, TopBar, BigStepper)
- [x] CSS-токены (`src/styles/tokens.css`)
- [x] Демо-страница `/demo`

### Итерация 4 MVP — сканирование тренажёра (2026-04-24)

- [x] Claude Vision → JSON → Zod → БД → ответ в боте
- [x] Деплой в прод, E2E пройден (admin-only)

### Инфра (2026-04-21)

- [x] Vercel + Railway + Neon — автодеплой на push
- [x] BotFather, Menu Button, `/start` → мини-апп

### Скелет проекта (2026-04-20)

- [x] Документация, React + Vite + Tailwind, Express + Prisma + Telegraf
- [x] Prisma-схема: 9 моделей, `db push` в Neon

---

## 🐞 Баги

- Railway автодеплой сломан ("GitHub Repo not found") — нужно переподключить репо
- ExerciseDB OSS rate limiting: GIF покрытие 21/57, скрипт дозагрузки готов

---

## 💸 Техдолг

- Дополнить aliases в seed по результатам реального использования
- `ActiveWorkoutProvider` (React Context) — тренировка должна переживать навигацию Home ↔ Workout
- Error handling в WorkoutPage — сейчас ошибки молча глотаются (пустой экран при сбое API)
- Loading states — нет скелетонов/спиннеров при загрузке данных
- Автоподстановка веса/повторов из прошлого подхода того же упражнения
- ~~Редактирование/удаление отдельных подходов~~ ✅ удаление реализовано
- Partial progress не сохраняется при перезаходе (только в рамках сессии)

---

## 🔧 Улучшения сканирования (отложено)

- [ ] Потестить на 10-20 реальных фото тренажёров, итерировать промпт
- [ ] Загрузка фото в Cloudflare R2
- [ ] Привязка `suggestedExercises` к реальным `exerciseId` (через resolveExercise)
- [ ] Inline-кнопка "Начать упражнение" → создаёт Workout
- [ ] Кнопка "Не то" → уточняющий диалог
- [ ] Убрать ограничение admin-only

---

## ❓ Открытые вопросы

| # | Вопрос | Когда решаем |
|---|--------|-------------|
| ~~1~~ | ~~JavaScript vs TypeScript~~ | ✅ 2026-04-20: JavaScript |
| 2 | Нужен ли Redis | Когда появится реальная проблема с кэшем |
| 3 | Схема биллинга (Stars vs Stripe) | Коммерческий запуск |
| 4 | Источник видео: свои или YouTube | После теста на друзьях |
| ~~5~~ | ~~Дизайн-палитра~~ | ✅ 2026-04-26: дизайн-система из Claude Design |
| 6 | Длительность триала: 7 vs 14 дней | Перед коммерческим запуском |
| ~~7~~ | ~~База упражнений: какой источник~~ | ✅ 2026-04-26: Free Exercise DB + ExerciseDB OSS (комбинация) |

---

## 🚀 Возможные фичи на будущее (без приоритета)

- **Персона тренера** — выбор типажа в онбординге (угрюмый качок / фитоняшка / норм паренёк), отдельные system prompts
- **"Идеальная форма"** — фан-фича, AI-генерация фото "ты в идеальной форме"
- Голосовой ввод логов (Whisper + Telegram voice)
- Видеоанализ техники
- Интеграция с Apple Health / Google Fit / Whoop
- Питание и БЖУ
- Друзья, челленджи, лидерборды
- Кардио, йога, домашние тренировки
- Экспорт тренировок в PDF/CSV
- Светлая тема
- Английский язык
- AI-подсказка "пора повысить вес"

---

## 📚 Ссылки

- [Референс-проект: daily balancer](../daily%20balancer/life-progress-tracker/)
- [Free Exercise DB (GitHub, Public Domain)](https://github.com/yuhonas/free-exercise-db)
- [ExerciseDB OSS](https://oss.exercisedb.dev)
- [Anthropic API docs](https://docs.anthropic.com/)
- [Telegraf docs](https://telegraf.js.org/)
- [Telegram WebApp docs](https://core.telegram.org/bots/webapps)
