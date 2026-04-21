# CLAUDE.md

Входная точка для Claude Code (и любого нового участника проекта). Автоматически подгружается при старте. Держит контекст минимальным, ссылается на остальные доки.

## Что это

**AI Trainer** — Telegram-бот с мини-аппом для самостоятельных тренировок в зале. AI-ассистент + база упражнений + трекинг + аналитика прогресса. Ключевая фишка: сфоткал тренажёр — AI подобрал упражнение. Пет-проект, сначала для себя, потом в коммерцию.

Наследует стек и паттерны из проверенного в проде проекта автора [daily balancer / Life Progress Tracker](../daily%20balancer/life-progress-tracker/).

## Ключевые документы

| Файл | Назначение |
|------|-----------|
| **CLAUDE.md** (этот файл) | Quick start + критичные правила |
| **[BRD.md](BRD.md)** | Продуктовое описание: зачем, для кого, что делаем |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Стек, паттерны, деплой, env-переменные, технические решения |
| **[NEXT_PLANS.md](NEXT_PLANS.md)** | Живой бэклог: приоритеты, фичи, баги, техдолг |
| **[UPDATES.md](UPDATES.md)** | Changelog по датам |

Документы специфичных фич (вроде распознавания тренажёра) заведём по месту, когда начнём прорабатывать.

## Стек (коротко)

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 (как Vite-плагин) + React Router 7 + Lucide + Recharts
- **Backend:** Express 5 + Prisma 6 + PostgreSQL (Neon) + Zod + Telegraf + node-cron
- **AI:** Claude API (`@anthropic-ai/sdk`) — и для чата, и для vision
- **Хостинг:** Vercel (фронт) + Railway (бэк + бот) + Neon PostgreSQL (с PITR) + Cloudflare R2 (фото)
- **Auth:** Telegram initData → HMAC-SHA256 на бэке

Подробности — в [ARCHITECTURE.md](ARCHITECTURE.md).

## Структура репозитория

Плоская (не монорепо), как в daily balancer:

```
/                    # React + Vite в корне (mini-app)
├── src/
├── index.html
├── vite.config.js
├── vercel.json
└── server/          # Express + Telegraf + Prisma
    ├── src/
    └── prisma/schema.prisma
```

## Dev-команды (плейсхолдер, обновим по мере настройки)

```bash
# Frontend (localhost:5173)
npm install && npm run dev

# Backend (localhost:3001)
cd server && npm install && npm run dev

# БД
cd server && npx prisma db push        # ⚠️ см. правила ниже
cd server && npx prisma studio
```

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

Все UI-строки через `t('namespace.key')`, никаких хардкодов в JSX. В MVP поддерживаем только `ru`, но через `t()` сразу — потом не переписывать.

### LLM вызовы

Только через абстракцию `utils/llm.js` (`llm.chat()`, `llm.vision()`). Не импортируем Anthropic SDK напрямую в контроллерах — чтобы легко подменить провайдера или добавить retry/timeout/логирование.

### Аналитика

Fire-and-forget `track(userId, event, payload)` — **без `await`**, не блокирует запрос. Ключевые события: `user_registered`, `onboarding_completed`, `workout_logged`, `exercise_photo_taken`, `ai_chat_message`, `program_generated`.

### Коммиты

- Не коммитим черновики/моки из `src/pages/Draft/`.
- Коммитим только рабочий код.
- Секреты — только в env, никогда в git.

### Деплой

`git push origin main` → Vercel и Railway подхватывают автоматически. Ручной деплой не нужен. Детали — в [ARCHITECTURE.md](ARCHITECTURE.md#деплой).
