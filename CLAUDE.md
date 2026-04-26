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
| **[docs/machine-scanning.md](docs/machine-scanning.md)** | Сканирование тренажёра: архитектура, поток данных |
| **[docs/implementation-plan.md](docs/implementation-plan.md)** | План реализации экранов мини-аппа (фазы 1–6) |

## Стек (коротко)

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 (как Vite-плагин) + React Router 7 + Lucide + Recharts
- **Backend:** Express 5 + Prisma 6 + PostgreSQL (Neon) + Zod + Telegraf + node-cron
- **AI:** Claude API (`@anthropic-ai/sdk`) — и для чата, и для vision
- **Хостинг:** Vercel (фронт) + Railway (бэк + бот) + Neon PostgreSQL (с PITR) + Cloudflare R2 (фото)
- **Auth:** Telegram initData → HMAC-SHA256 на бэке

Подробности — в [ARCHITECTURE.md](ARCHITECTURE.md).

## Дизайн-система (Glass)

Тёмная glassmorphism-тема. Все токены — CSS custom properties в `src/styles/tokens.css`. Единственная "ручка" для смены палитры — `--accent-h` (по умолчанию `158`, mint-teal).

### Токены

| Группа | Примеры переменных |
|--------|--------------------|
| Accent | `--accent-color`, `--accent-color-soft`, `--accent-fg-on-light` |
| Surface | `--bg-base` (#050507), `--bg-app`, `--surface-0`, `--surface-1` |
| Text | `--fg-primary`, `--fg-secondary`, `--fg-tertiary`, `--fg-disabled` |
| Semantic | `--success` / `--warning` / `--danger` + `-soft` варианты |
| Spacing | `--space-1`…`--space-10` (4px-based) |
| Radius | `--radius-xs`…`--radius-2xl`, `--radius-pill` |
| Typography | `--font-sans`, `--font-display`, `--font-mono`; `--text-xs`…`--text-display` |
| Motion | `--ease-out`, `--duration-fast`…`--duration-slow` |

### Компоненты (`src/components/ui/`)

Все компоненты — **named exports** (не default). Импорт: `import { Glass } from '…/Glass.jsx'` или через barrel `import { Glass, Button, Icon } from '…/ui/index.js'`. Исключения: `TopBar` и `BigStepper` — default export.

| Компонент | Назначение | Ключевые пропсы |
|-----------|-----------|----------------|
| `Glass` | Базовая стеклянная карточка | `variant`: default / strong / tint; `padding`, `radius` |
| `Button` | Кнопка действия | `variant`: primary / accent / secondary / ghost / danger / success / warning; `size`: sm/md/lg; `block`, `icon`, `loading` |
| `Icon` | SVG-иконки 24×24 | `name` (из `ICON_PATHS`), `size` |
| `StatTile` | Числовая плитка (монo-цифры) | `label`, `value`, `sub`, `icon` |
| `ActivePill` | Пульсирующий индикатор | `label` |
| `GlassAINote` | AI-инсайт карточка | `emoji`, `tag`, `title`, `body`, `cta`, `onCta` |
| `RestCard` | Таймер отдыха | `seconds`, `onSkip` |
| `GlassNav` | Bottom-nav (4 таба) | `items[]`, `activeIndex`, `onTap` |
| `Mesh` | Фоновый gradient mesh | — |
| `TopBar` _(default)_ | Sticky шапка flow-экранов | `title`, `onBack`, `rightLabel`/`rightIcon`, `onRight` |
| `BigStepper` _(default)_ | ± ввод числа | `label`, `value`, `onChange`, `step`, `min`, `max`, `format` |

### Правила использования

1. **Не хардкодить цвета** — использовать токены (`var(--fg-primary)`, `var(--success)` и т.д.).
2. **Named imports** для большинства компонентов, default только для TopBar и BigStepper.
3. **Glass — основа** для всех карточек. Не создавать `<div>` с ручным `background + backdrop-filter`.
4. **Визуальная спецификация экранов** — в [BRD.md §12](BRD.md#12-спецификация-экранов-мини-аппа), дизайн-бриф — в [DESIGN_BRIEF.md](prototype/DESIGN_BRIEF.md).

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
    ├── data/        # seed-данные (enriched-exercises.json)
    └── prisma/schema.prisma
```

## Dev-команды

```bash
# Frontend (localhost:5173)
npm install && npm run dev

# Backend (localhost:3001)
cd server && npm install && npm run dev

# Настройка dev-данных (60 тренировок + PPL+Arms программа для dev user)
cd server && npm run seed:dev

# Seed упражнений (57 штук, idempotent)
cd server && npm run seed:exercises

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

**Первый запуск:** после клона репо выполнить `cd server && npm run seed:exercises && npm run seed:dev` — это наполнит dev user данными (60 тренировок, 1687 подходов, программа PPL+Arms).

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

**Dev-first:** сначала проверяем на `localhost`, потом пушим. `git push origin main` → Vercel и Railway подхватывают автоматически. Ручной деплой не нужен. Детали — в [ARCHITECTURE.md](ARCHITECTURE.md#деплой).
