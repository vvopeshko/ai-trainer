# UPDATES — AI Trainer

Хронологический changelog. Новые записи — сверху. Фиксируем всё, что реально сделано (не планы — для них [NEXT_PLANS.md](NEXT_PLANS.md)).

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
