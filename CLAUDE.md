# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

**AI Trainer** — Telegram-бот с мини-аппом для самостоятельных тренировок в зале. AI-ассистент + база упражнений + трекинг + аналитика прогресса. Ключевая фишка: сфоткал тренажёр — AI подобрал упражнение. Пет-проект, сначала для себя, потом в коммерцию.

Наследует стек и паттерны из проверенного в проде проекта автора [daily balancer / Life Progress Tracker](../daily%20balancer/life-progress-tracker/).

## Ключевые документы

Продуктовые и архитектурные доки живут в `/product`:

| Файл | Назначение |
|------|-----------|
| **[product/BRD.md](product/BRD.md)** | Продуктовое описание: зачем, для кого, что делаем |
| **[product/ARCHITECTURE.md](product/ARCHITECTURE.md)** | Стек, паттерны, деплой, env-переменные, технические решения |
| **[product/PRODUCT_PLAN.md](product/PRODUCT_PLAN.md)** | Стратегический план: все фичи по доменам со статусами |
| **[product/NEXT_PLANS.md](product/NEXT_PLANS.md)** | Живой бэклог: приоритеты, фичи, баги, техдолг |
| **[product/UPDATES.md](product/UPDATES.md)** | Changelog по датам |
| **[product/machine-scanning.md](product/machine-scanning.md)** | Сканирование тренажёра: архитектура, поток данных |
| **[product/implementation-plan.md](product/implementation-plan.md)** | План реализации экранов мини-аппа (фазы 1–6) |
| **[product/CODESTYLE.md](product/CODESTYLE.md)** | Code style guide: именование, компоненты, стили, паттерны |
| **[product/design/DESIGN_BRIEF.md](product/design/DESIGN_BRIEF.md)** | Дизайн-бриф (Glass UI) |
| **[product/marketing/](product/marketing/)** | Лендинг-копирайт, позиционирование |
| **[product/competitors/](product/competitors/)** | Анализ конкурентов (Arvo и др.) |
| **[public/landing.html](public/landing.html)** | Лендинг (статический, Liquid Glass дизайн) |

## Стек

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 (`@tailwindcss/vite`, не PostCSS; нет `tailwind.config.js` — тема через `@theme {}` в CSS) + React Router 7 + Lucide + Recharts + body-muscles (анатомическая SVG-карта)
- **Backend:** Express 5 + Prisma 6 + PostgreSQL (Neon) + Zod + Telegraf + node-cron + yt-search
- **AI:** Claude API (`@anthropic-ai/sdk`, модель `claude-sonnet-4-6`) — и для чата, и для vision
- **Хостинг:** Vercel (фронт) + Railway (бэк + бот) + Neon PostgreSQL (с PITR) + Cloudflare R2 (фото)
- **Auth:** Telegram initData → HMAC-SHA256 на бэке
- **Язык:** JavaScript (без TypeScript). ESM everywhere (`"type": "module"` — `import`/`export`, не `require()`). Нет тестового фреймворка.

## Dev-команды

```bash
# Frontend (localhost:5173)
npm install && npm run dev

# Backend (localhost:3001) — node --watch + --env-file=.env (не dotenv, не nodemon)
cd server && npm install && npm run dev

# Первый запуск: seed dev-данных (60 тренировок + PPL+Arms программа)
cd server && npm run seed:exercises && npm run seed:dev

# Seed упражнений (924 штуки, idempotent upsert по slug)
cd server && npm run seed:exercises

# Lint (только фронтенд, ESLint 9 flat config; server/ excluded)
npm run lint

# Проверить билд перед коммитом
npm run build

# Обогащение упражнений медиа (GIF + YouTube видео, pilot mode — только упражнения активной программы)
cd server && npm run enrich:media                          # dev user (telegramId=0)
cd server && npm run enrich:media -- --telegramId=123      # конкретный юзер
cd server && npm run enrich:media -- --skip-gif            # только YouTube
cd server && npm run enrich:media -- --skip-youtube        # только GIF

# БД
cd server && npx prisma db push        # ⚠️ см. правила ниже
cd server && npx prisma studio         # визуальный редактор
cd server && npx prisma generate       # регенерация клиента (обычно не нужна — postinstall делает)
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
├── product/                 # Продуктовые доки (BRD, ARCHITECTURE, UPDATES, NEXT_PLANS, design/, marketing/, competitors/)
├── src/
│   ├── main.jsx             # entry: BrowserRouter > TranslationProvider > TelegramProvider > App
│   ├── App.jsx              # маршруты
│   ├── pages/Main/          # HomePage, WorkoutPage, SummaryPage, ProgressPage, LibraryPage, ProgramEditPage
│   ├── pages/Demo/          # DesignSystemDemo
│   ├── components/ui/       # Glass, Button, Icon, TopBar, BigStepper и др.
│   ├── components/layout/   # TabLayout, GlassNav
│   ├── components/TelegramProvider.jsx
│   ├── contexts/            # HomeDataContext, ProgressDataContext
│   ├── i18n/                # TranslationProvider, useTranslation, translations.js
│   ├── utils/api.js         # apiGet/apiPost/apiPatch — fetch + auth header
│   └── styles/tokens.css    # CSS custom properties (дизайн-токены)
└── server/                  # Express + Telegraf + Prisma (Railway)
    ├── src/
    │   ├── index.js         # entry: Express + bot.launch() + scheduler (один процесс)
    │   ├── routes/          # /api/v1/{auth,exercises,workouts,stats,programs,progress}
    │   ├── controllers/     # auth, exercise, workout, program, stats, progress
    │   ├── middleware/       # telegramAuth.js, errorHandler.js
    │   ├── bot/             # Telegraf bot (long polling) + scenes (WizardScene для /program)
    │   ├── services/aiTrainer/  # LLM-логика: identifyMachine, generateProgram, importProgram
    │   └── utils/           # prisma.js (singleton), llm.js (chat/vision), analytics.js
    ├── prisma/schema.prisma
    ├── scripts/             # seedExercises.js, seedDevData.js, enrichProgramMedia.js и др.
    └── data/                # enriched-exercises.json (924 упражнения)
```

### Фронтенд: маршрутизация

Два типа экранов: **таб-экраны** (внутри `TabLayout` с `GlassNav`) и **полноэкранные flow** (без навигации):

- Табы: `/` (Home), `/progress`, `/library`, `/me`
- Flow: `/workout`, `/program/:id`, `/summary/:id`
- Dev: `/demo` (дизайн-система)

Ленивая загрузка через `lazy()` для `ProgressPage`, `LibraryPage`, `ProgramEditPage`, `SummaryPage` и `DesignSystemDemo`.

### Фронтенд: провайдеры

Цепочка в `main.jsx`: `BrowserRouter` → `TranslationProvider` → `TelegramProvider` → `HomeDataProvider` → `ProgressDataProvider` → `App`.

- **TelegramProvider** — `useTelegram()` → `{ user, webApp, isDev }`. В dev-режиме отдаёт мок-юзера. Устанавливает CSS-переменные `--safe-top` / `--safe-bottom` для safe area insets Telegram и слушает `safeAreaChanged`/`contentSafeAreaChanged`.
- **TranslationProvider** — `useTranslation()` → `{ t, language, setLanguage }`.
- **HomeDataProvider** (`src/contexts/HomeDataContext.jsx`) — `useHomeData()` → `{ yearStats, monthStats, recent, activeWorkout, program, nextWorkout, loaded, refresh, setData }`. Кэш Home-данных выше Routes, stale-while-revalidate, optimistic updates через `setData`.
- **ProgressDataProvider** (`src/contexts/ProgressDataContext.jsx`) — `useProgressData()`. Кэш прогресс-данных, stale-while-revalidate, аналогично HomeDataProvider.

### Фронтенд: API-клиент (`src/utils/api.js`)

`apiGet(path)`, `apiPost(path, body)`, `apiPatch(path, body)`, `apiDelete(path)` — thin wrappers над `fetch`. Автоматически аттачат `Authorization: tma <initData>` (или `dev_bypass` без Telegram). Базовый URL из `VITE_API_URL`. При ошибке возвращает кастомный объект с JSON-payload сервера.

### Бэкенд: архитектура

Монолит в одном процессе: Express API + Telegraf бот (шедулер пока не реализован). `BigInt.prototype.toJSON` monkey-patch в `server/src/index.js` — Prisma возвращает `telegramId` как BigInt, без патча `JSON.stringify` падает. JSON body limit — 10MB (`express.json({ limit: '10mb' })`).

- Все роуты под `/api/v1/*`, защищены `telegramAuth` middleware.
- Health-check: `GET /api/health` (без авторизации).
- **Контроллеры тонкие, сервисы толстые.** LLM-логика — в `services/aiTrainer/`, промпты — в git как `.md`-файлы.
- `services/exerciseResolver.js` — резолвит названия упражнений от LLM в ID (slug → alias → auto-create). Использует raw SQL (`unnest(aliases)`) для поиска по массиву алиасов.
- `utils/parseJsonFromLLM.js` — извлечение JSON из LLM-ответов (markdown code fences, etc.).
- LLM-промпты хранятся как `.md`-файлы в `services/aiTrainer/prompts/` и читаются `readFileSync` при импорте модуля (не динамически).
- Импорт программы (`importProgram.js`) запускает два LLM-вызова параллельно (структура + гайдлайны) для ускорения.
- Сложные аналитические запросы (прогресс, статы, стрики) написаны raw SQL (CTE, агрегации), не через Prisma query builder.
- Zod для валидации тел запросов (схемы определяются inline в контроллерах).
- Централизованный `errorHandler` middleware (ловит ZodError → 400).
- **Бизнес-логика тренировок:** при старте новой тренировки пустая существующая (0 сетов) автоматически удаляется. При финише с 0 сетов — тренировка удаляется вместо сохранения. Пауза/возобновление (`pausedAt`/`totalPausedMs`) отслеживает чистое время.
- `enrichPlanExercises()` в `programController` гидратирует exercises из `planJson` данными мышц/оборудования из таблицы Exercise на лету (не денормализовано).

## Дизайн-система (Glass)

Тёмная glassmorphism-тема. Все токены — CSS custom properties в `src/styles/tokens.css`. Единственная "ручка" для смены палитры — `--accent-h` (по умолчанию `158`, mint-teal).

Ключевые группы токенов: Accent, Surface (`--bg-base`, `--surface-0`..`1`), Text (`--fg-primary`..`--fg-disabled`), Semantic (`--success`/`--warning`/`--danger`), Spacing (`--space-1`…`--space-10`, 4px-based), Radius, Typography, Motion.

### UI-компоненты (`src/components/ui/`)

Все компоненты — **named exports** через barrel `src/components/ui/index.js`. **Исключения:** `TopBar` и `BigStepper` — default export, импортировать напрямую.

```js
import { Glass, Button, Icon, Skeleton, ConfirmDialog, BottomSheet, BodyMap, ExerciseDetailSheet } from '../../components/ui/index.js'
import TopBar from '../../components/ui/TopBar.jsx'
import BigStepper from '../../components/ui/BigStepper.jsx'
```

**BodyMap** — React-обёртка над `body-muscles` (70+ SVG-зон, front+back вид). Принимает `muscles={[{ muscle, setsActual, setsTarget }]}`, автоматически рассчитывает интенсивность. Маппинг 20 внутренних muscle ID → зоны библиотеки в `MUSCLE_ZONE_MAP`. Используется на 5 экранах (Progress, Home, ProgramEdit, Workout, ProgrammeHero).

### Правила

1. **Не хардкодить цвета** — использовать токены (`var(--fg-primary)`, `var(--success)` и т.д.).
2. **Glass — основа** для всех карточек. Не создавать `<div>` с ручным `background + backdrop-filter`.
3. **Визуальная спецификация экранов** — в [BRD.md §12](product/BRD.md#12-спецификация-экранов-мини-аппа), дизайн-бриф — в [DESIGN_BRIEF.md](product/design/DESIGN_BRIEF.md).

## Критичные правила

### Prisma / БД

9 моделей: `User`, `UserProfile`, `Exercise` (924 seed'а, enum `source`: seed/ai_generated/user_created, поля `gifUrl`, `videos` Json), `Program` (planJson — JSON с неделями/днями/упражнениями), `Workout` (`pausedAt`/`totalPausedMs` — пауза/возобновление), `WorkoutSet`, `ChatMessage`, `MachineIdentification`, `AnalyticsEvent`. Полная схема — `server/prisma/schema.prisma`.

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

### Бот: машинное распознавание

Фото-распознавание тренажёров через Claude Vision в боте доступно только админу (`ADMIN_TELEGRAM_ID`). HTTPS обязателен для WebApp-кнопок в Telegram — в dev-режиме бот отправляет plain-text ссылки вместо кнопок.

### i18n

Все UI-строки через `t('namespace.key')`, никаких хардкодов в JSX. Параметры через `{{param}}`: `t('workout.hello', { name })`. В MVP поддерживаем только `ru`, но через `t()` сразу — потом не переписывать.

### LLM вызовы

Только через абстракцию `server/src/utils/llm.js` (`llm.chat()`, `llm.vision()`). Не импортируем Anthropic SDK напрямую в контроллерах — чтобы легко подменить провайдера или добавить retry/timeout/логирование. `chat()` включает retry с backoff (до 2 повторов при Connection error / ECONNRESET). Клиент инициализируется лениво (lazy init).

### Аналитика

Fire-and-forget `track(userId, event, payload)` — **без `await`**, не блокирует запрос.

### Коммиты

- Не коммитим черновики/моки из `src/pages/Draft/`.
- Коммитим только рабочий код.
- Секреты — только в env, никогда в git.

### Деплой

**Dev-first:** сначала проверяем на `localhost`, потом пушим. `git push origin main` → Vercel и Railway подхватывают автоматически. Ручной деплой не нужен. Детали — в [ARCHITECTURE.md](product/ARCHITECTURE.md#деплой).

### Env-переменные

Примеры — в `.env.example` (фронт) и `server/.env.example` (бэк).

**Фронт:** `VITE_API_URL` (локально `http://localhost:3001`).

**Бэк:** `DATABASE_URL`, `BOT_TOKEN`, `FRONTEND_URL`, `WEBAPP_URL`, `ANTHROPIC_API_KEY`, `R2_ACCESS_KEY`/`R2_SECRET_KEY`/`R2_BUCKET`/`R2_ENDPOINT` (Cloudflare R2 для фото тренажёров), `ANALYTICS_SECRET`, `ADMIN_TELEGRAM_ID`.

`postinstall` в server/package.json автоматически запускает `prisma generate`.

## Осознанные решения

1. **Inline styles вместо Tailwind-классов.** Проект подключает Tailwind 4, но ~90% стилей — inline `style={}`. Это не техдолг: CSS custom properties (дизайн-токены) удобнее передавать через `style`, а компоненты не используют responsive-утилиты Tailwind. Tailwind используется точечно (`.min-h-screen`, `.flex`).

2. **BigInt.prototype.toJSON monkey-patch.** Prisma возвращает `telegramId` как BigInt, JSON.stringify на нём падает. Патч в `server/src/index.js` конвертирует BigInt → string. Альтернатива (replacer в каждом `res.json()`) менее практична.

3. **Нет тестов.** MVP-этап, один разработчик. Тесты запланированы как отдельная инициатива. Build (`npm run build`) и lint проверяются перед коммитом.

4. **DesignSystemDemo (`/demo`)** — dev-утилита, lazy-loaded, не попадает в основной бандл. Оставлена намеренно для визуальной проверки UI-компонентов.
