# NEXT_PLANS — AI Trainer

Живой бэклог приоритетов, фич, техдолга. Обновляется на каждой итерации.
Продукт — в [BRD.md](BRD.md). Техника — в [ARCHITECTURE.md](ARCHITECTURE.md).

**Последнее обновление:** 2026-04-26

---

## 🎯 Следующий заход: Фаза 2 — Home-экран

Полный план реализации — в [docs/implementation-plan.md](docs/implementation-plan.md).

**Цель:** полноценная главная страница — "что делать дальше", статистика, недавние тренировки.

### Фаза 2a — API для Home

- [ ] `GET /api/v1/programs/active` — активная программа с днями
- [ ] `GET /api/v1/programs/active/next-workout` — следующая тренировка
- [ ] `GET /api/v1/stats/month` — `{ workouts, tonnage, streak }`
- [ ] `GET /api/v1/workouts/recent?limit=4` — недавние тренировки

### Фаза 2b — Home-экран (BRD §12.1)

- [ ] `TabLayout` обёртка с GlassNav (bottom-nav)
- [ ] `HomePage` — programme strip + hero + stat-tiles + недавние
- [ ] Роутинг: `/` → Home (вместо redirect на /workout)
- [ ] Default / Active workout / Empty state

### Параллельно: улучшения Workout

- [ ] Railway автодеплой — починить (GitHub Repo not found)
- [ ] Автоподстановка веса/повторов из прошлой тренировки
- [ ] Rest timer между подходами
- [ ] Дозагрузить GIF (36 упражнений без анимации)

---

## 📋 Последующие фазы (из implementation-plan.md)

| Фаза | Что | Зависит от |
|------|-----|-----------|
| **3** | Полный Workout (rest timer, альтернативы, суперсет, AI-замена) | 1 |
| **4** | Progress (аналитика прогресса, плато, дисбалансы) | 1, нужны данные |
| **5** | Programs (редактор, библиотека, AI-генерация) | 2 |
| **6** | Cross-cutting + polish (deep-links, toast, empty/loading/error states, offline) | 3-5 |

---

## ✅ Выполнено

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
