# NEXT_PLANS — AI Trainer

Живой бэклог приоритетов, фич, техдолга. Обновляется на каждой итерации.
Продукт — в [BRD.md](BRD.md). Техника — в [ARCHITECTURE.md](ARCHITECTURE.md).

**Последнее обновление:** 2026-04-26

---

## 🎯 Следующий заход: Фаза 1 — сквозной скелет

Полный план реализации — в [docs/implementation-plan.md](docs/implementation-plan.md).

**Цель:** открываю бота в зале → мини-апп → логирую реальный подход → данные в Neon.

### Фаза 1a — Seed + resolve + import

- [x] Обогатить 57 упражнений из workouts.json (Free Exercise DB + ExerciseDB OSS + русификация)
- [x] Сохранить `server/data/enriched-exercises.json` (57/57 muscles, equipment, instructions, nameRu, aliases; 21/57 gifUrl)
- [ ] Добавить `ExerciseSource` enum + поле `source` + `gifUrl` в `Exercise` модель (Prisma)
- [ ] `prisma db push`
- [ ] Создать `server/scripts/seedExercises.js` — upsert по slug из enriched-exercises.json
- [ ] Создать `server/src/services/exerciseResolver.js` — slug match → alias search → auto-create
- [ ] Запустить seed (57 упражнений → таблица Exercise в Neon)
- [ ] Создать `server/scripts/importWorkouts.js` — импорт 60 тренировок из workouts.json через resolveExercise
- [ ] Запустить import, проверить resolve-отчёт (цель: 80%+ match)
- [ ] Дозагрузить GIF (запустить `server/data/fetch-missing-gifs.js` при сбросе rate limit)

### Фаза 1b — API для тренировок

- [ ] `GET /api/v1/exercises` — список упражнений (фильтр по muscle group)
- [ ] `GET /api/v1/exercises/search?q=...` — текстовый поиск
- [ ] `POST /api/v1/workouts` — создать тренировку
- [ ] `GET /api/v1/workouts/:id` — тренировка с подходами
- [ ] `GET /api/v1/workouts/active` — незавершённая тренировка
- [ ] `POST /api/v1/workouts/:id/sets` — залогировать подход
- [ ] `PATCH /api/v1/workouts/:id` — завершить тренировку

### Фаза 1c — Минимальный Workout-экран

- [ ] `BigStepper` компонент (± кнопки для веса/повторов)
- [ ] `TopBar` компонент (← back + title + action)
- [ ] `FlowLayout` обёртка (TopBar, без GlassNav)
- [ ] `WorkoutPage` — выбор упражнения, ввод веса × повторов, кнопка "Сделал"
- [ ] Интеграция с api.js — реальные запросы
- [ ] Haptic feedback

**Критерий готовности:** открываю мини-апп → выбираю упражнение → ввожу 60×10 → "Сделал" → данные в Neon.

---

## 📋 Последующие фазы (из implementation-plan.md)

| Фаза | Что | Зависит от |
|------|-----|-----------|
| **2** | Home-экран (программа, статистика, AI-инсайт, недавние) | 1 |
| **3** | Полный Workout (rest timer, альтернативы, suперсет, AI-замена) | 1 |
| **4** | Summary + Progress (завершение тренировки, аналитика прогресса) | 1, нужны данные |
| **5** | Programs (редактор, библиотека, AI-генерация) | 2 |
| **6** | Cross-cutting + polish (deep-links, toast, empty/loading/error states, offline) | 3-5 |

---

## ✅ Выполнено

### Дизайн-система + план + база упражнений (2026-04-26)

- [x] UI-компоненты из дизайн-хэндоффа (Glass, Button, Icon, StatTile, ActivePill, GlassNav, GlassAINote, RestCard, Mesh)
- [x] Дизайн-токены (CSS custom properties)
- [x] Демо-страница `/demo`
- [x] План реализации экранов (`docs/implementation-plan.md`) — 6 фаз, API-карта, Prisma-изменения
- [x] Исследование баз упражнений (Free Exercise DB, Exercemus, ExerciseDB OSS, wger)
- [x] 3-шаговое обогащение 57 упражнений → `server/data/enriched-exercises.json`

### Итерация 4 MVP — сканирование тренажёра (2026-04-24)

- [x] Промпт для `llm.vision()` — `services/aiTrainer/prompts/identifyMachine.md`
- [x] Сервис `identifyMachine.js` — LLM vision → JSON → Zod → БД → аналитика
- [x] Telegraf-хэндлер `on('photo')` — скачать фото → base64 → сервис → ответ
- [x] Запись `MachineIdentification` в БД
- [x] Ограничение admin-only
- [x] Деплой в прод, end-to-end пройден

### Инфра (2026-04-21)

- [x] Vercel (фронт) + Railway (бэк+бот) + Neon (БД) — автодеплой на push
- [x] BotFather: команды, Menu Button
- [x] End-to-end: `/start` → inline-кнопка → мини-апп в Telegram

### Скелет проекта (2026-04-20)

- [x] Документация: CLAUDE.md, BRD.md, ARCHITECTURE.md, NEXT_PLANS.md, UPDATES.md
- [x] Frontend: React 19 + Vite 7 + Tailwind 4 + Router + i18n + TelegramProvider
- [x] Backend: Express 5 + Prisma 6 + Telegraf + auth middleware + LLM абстракция
- [x] Prisma-схема: 9 моделей, `db push` в Neon

---

## 🐞 Баги

- ExerciseDB OSS rate limiting: GIF покрытие 21/57, скрипт дозагрузки готов (`server/data/fetch-missing-gifs.js`)

---

## 💸 Техдолг

- Дизайн-система и демо-страница ещё не закоммичены в git
- `server/data/enriched-exercises.json` ещё не закоммичен
- Seed-скрипт и exerciseResolver ещё не написаны (Фаза 1a)
- Prisma-схема не обновлена (нет `source`, `gifUrl` на Exercise)
- Дополнить aliases в seed по результатам import-валидации

---

## 🔧 Улучшения сканирования (отложено до после Фазы 1)

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
