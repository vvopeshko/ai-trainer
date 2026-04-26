# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

**AI Trainer** — Telegram-бот с мини-аппом для самостоятельных тренировок в зале. AI-ассистент + база упражнений + трекинг + аналитика прогресса. Ключевая фишка: сфоткал тренажёр — AI подобрал упражнение. Пет-проект, сначала для себя, потом в коммерцию.

Наследует стек и паттерны из проверенного в проде проекта автора [daily balancer / Life Progress Tracker](../daily%20balancer/life-progress-tracker/).

## Ключевые документы

| Файл | Назначение |
|------|-----------|
| **[BRD.md](BRD.md)** | Продуктовое описание: зачем, для кого, что делаем |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Стек, паттерны, деплой, env-переменные, технические решения |
| **[NEXT_PLANS.md](NEXT_PLANS.md)** | Живой бэклог: приоритеты, фичи, баги, техдолг |
| **[UPDATES.md](UPDATES.md)** | Changelog по датам |
| **[docs/machine-scanning.md](docs/machine-scanning.md)** | Сканирование тренажёра: архитектура, поток данных |
| **[docs/implementation-plan.md](docs/implementation-plan.md)** | План реализации экранов мини-аппа (фазы 1–6) |

## Стек

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 (Vite-плагин, не PostCSS) + React Router 7 + Lucide + Recharts
- **Backend:** Express 5 + Prisma 6 + PostgreSQL (Neon) + Zod + Telegraf + node-cron
- **AI:** Claude API (`@anthropic-ai/sdk`) — и для чата, и для vision
- **Хостинг:** Vercel (фронт) + Railway (бэк + бот) + Neon PostgreSQL (с PITR) + Cloudflare R2 (фото)
- **Auth:** Telegram initData → HMAC-SHA256 на бэке
- **Язык:** JavaScript (без TypeScript). Нет тестового фреймворка.

## Dev-команды

```bash
# Frontend (localhost:5173)
npm install && npm run dev

# Backend (localhost:3001) — uses node --watch, no nodemon
cd server && npm install && npm run dev

# Первый запуск: seed dev-данных (60 тренировок + PPL+Arms программа)
cd server && npm run seed:exercises && npm run seed:dev

# Seed упражнений (57 штук, idempotent)
cd server && npm run seed:exercises

# Lint (только фронтенд, ESLint 9 flat config; server/ excluded)
npm run lint

# Проверить билд перед коммитом
npm run build

# БД
cd server && npx prisma db push        # ⚠️ см. правила ниже
cd server && npx prisma studio
```

### Dev-first workflow

**Проверяем на деве, потом пушим в прод.** Не наоборот.

1. Поднять фронт (`npm run dev`) + бэк (`cd server && npm run dev`)
2. Открыть `http://localhost:5173` — `dev_bypass` авторизует как Dev User (telegramId=0)
3. Проверить фичу / фикс на деве
4. `npm run build` — убедиться что нет ошибок
5. Коммит → пуш → Vercel + Railway подхватят

## Архитектура

### Структура репозитория

Плоская (не монорепо). React + Vite в корне, сервер в `/server`:

```
/                    # React mini-app (Vercel)
├── src/
│   ├── main.jsx             # entry: BrowserRouter > TranslationProvider > TelegramProvider > App
│   ├── App.jsx              # маршруты
│   ├── pages/Main/          # HomePage, WorkoutPage, SummaryPage
│   ├── pages/Demo/          # DesignSystemDemo
│   ├── components/ui/       # Glass, Button, Icon, TopBar, BigStepper и др.
│   ├── components/layout/   # TabLayout, GlassNav
│   ├── i18n/                # TranslationProvider, useTranslation, translations.js
│   ├── utils/api.js         # apiGet/apiPost/apiPatch — fetch + auth header
│   └── styles/tokens.css    # CSS custom properties (дизайн-токены)
└── server/                  # Express + Telegraf + Prisma (Railway)
    ├── src/
    │   ├── index.js         # entry: Express + bot.launch() + scheduler (один процесс)
    │   ├── routes/          # /api/v1/{auth,exercises,workouts,stats,programs}
    │   ├── controllers/     # exercise, workout, program, stats
    │   ├── middleware/       # telegramAuth.js, errorHandler.js
    │   ├── bot/             # Telegraf bot (long polling)
    │   ├── services/aiTrainer/  # LLM-логика: identifyMachine, generateProgram, chatWithContext
    │   └── utils/           # prisma.js (singleton), llm.js (chat/vision), analytics.js
    ├── prisma/schema.prisma
    ├── scripts/             # seedExercises.js, seedDevData.js
    └── data/                # enriched-exercises.json (57 упражнений)
```

### Фронтенд: маршрутизация

Два типа экранов: **таб-экраны** (внутри `TabLayout` с `GlassNav`) и **полноэкранные flow** (без навигации):

- Табы: `/` (Home), `/progress`, `/library`, `/me`
- Flow: `/workout`, `/summary/:id`
- Dev: `/demo` (дизайн-система)

Ленивая загрузка через `lazy()` для `SummaryPage` и `DesignSystemDemo`.

### Фронтенд: провайдеры

Цепочка в `main.jsx`: `BrowserRouter` → `TranslationProvider` → `TelegramProvider` → `HomeDataProvider` → `App`.

- **TelegramProvider** — `useTelegram()` → `{ user, webApp, isDev }`. В dev-режиме отдаёт мок-юзера.
- **TranslationProvider** — `useTranslation()` → `{ t, language, setLanguage }`.
- **HomeDataProvider** — `useHomeData()` → `{ yearStats, monthStats, recent, activeWorkout, program, nextWorkout, loaded, refresh, setData }`. Кэш Home-данных выше Routes, stale-while-revalidate, optimistic updates через `setData`.

### Фронтенд: API-клиент (`src/utils/api.js`)

`apiGet(path)`, `apiPost(path, body)`, `apiPatch(path, body)`, `apiDelete(path)` — thin wrapper над `fetch`. Автоматически аттачит `Authorization: tma <initData>` (или `dev_bypass` без Telegram). Базовый URL из `VITE_API_URL`.

### Бэкенд: архитектура

Монолит в одном процессе: Express API + Telegraf бот + node-cron шедулер.

- Все роуты под `/api/v1/*`, защищены `telegramAuth` middleware.
- Health-check: `GET /api/health` (без авторизации).
- **Контроллеры тонкие, сервисы толстые.** LLM-логика — в `services/aiTrainer/`, промпты — в git как `.md`-файлы.
- Zod для валидации тел запросов.
- Централизованный `errorHandler` middleware (ловит ZodError → 400).

## Дизайн-система (Glass)

Тёмная glassmorphism-тема. Все токены — CSS custom properties в `src/styles/tokens.css`. Единственная "ручка" для смены палитры — `--accent-h` (по умолчанию `158`, mint-teal).

Ключевые группы токенов: Accent, Surface (`--bg-base`, `--surface-0`..`1`), Text (`--fg-primary`..`--fg-disabled`), Semantic (`--success`/`--warning`/`--danger`), Spacing (`--space-1`…`--space-10`, 4px-based), Radius, Typography, Motion.

### UI-компоненты (`src/components/ui/`)

Все компоненты — **named exports** через barrel `src/components/ui/index.js`. **Исключения:** `TopBar` и `BigStepper` — default export, импортировать напрямую.

```js
import { Glass, Button, Icon, Skeleton, ConfirmDialog, BottomSheet } from '../../components/ui/index.js'
import TopBar from '../../components/ui/TopBar.jsx'
import BigStepper from '../../components/ui/BigStepper.jsx'
```

### Правила

1. **Не хардкодить цвета** — использовать токены (`var(--fg-primary)`, `var(--success)` и т.д.).
2. **Glass — основа** для всех карточек. Не создавать `<div>` с ручным `background + backdrop-filter`.
3. **Визуальная спецификация экранов** — в [BRD.md §12](BRD.md#12-спецификация-экранов-мини-аппа), дизайн-бриф — в [DESIGN_BRIEF.md](prototype/DESIGN_BRIEF.md).

## Критичные правила

### Prisma / БД

**Миграций НЕТ, только `prisma db push`.** В референсном проекте `db push` однажды дропнул все таблицы (2026-03-08) при добавлении NOT NULL колонки. Спасла Neon PITR.

Правила:
1. Nullable колонки (`String?`, `Int?`) — безопасно через `db push`.
2. NOT NULL колонки в непустую таблицу — СНАЧАЛА `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT '...'` вручную, ПОТОМ `db push` (увидит "already in sync").
3. Rename/delete колонки — только SQL вручную.
4. Перед любым `db push` на проде — зафиксировать timestamp (для PITR-отката).
5. Если `db push` предупреждает о потере данных — **СТОП**.

### Telegram auth

Все защищённые роуты под `/api/v1/*` используют middleware `telegramAuth` (HMAC-SHA256 валидация initData). Без него — `TypeError: Cannot read properties of undefined (reading 'id')`.

Dev-bypass: в dev-окружении заголовок `Authorization: tma dev_bypass` разрешает тестирование без Telegram WebApp.

### i18n

Все UI-строки через `t('namespace.key')`, никаких хардкодов в JSX. Параметры через `{{param}}`: `t('workout.hello', { name })`. В MVP поддерживаем только `ru`, но через `t()` сразу — потом не переписывать.

### LLM вызовы

Только через абстракцию `server/src/utils/llm.js` (`llm.chat()`, `llm.vision()`). Не импортируем Anthropic SDK напрямую в контроллерах — чтобы легко подменить провайдера или добавить retry/timeout/логирование.

### Аналитика

Fire-and-forget `track(userId, event, payload)` — **без `await`**, не блокирует запрос.

### Коммиты

- Не коммитим черновики/моки из `src/pages/Draft/`.
- Коммитим только рабочий код.
- Секреты — только в env, никогда в git.

### Деплой

**Dev-first:** сначала проверяем на `localhost`, потом пушим. `git push origin main` → Vercel и Railway подхватывают автоматически. Ручной деплой не нужен. Детали — в [ARCHITECTURE.md](ARCHITECTURE.md#деплой).
