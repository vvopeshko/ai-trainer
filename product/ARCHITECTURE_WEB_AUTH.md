# Архитектура Web-версии — AI Trainer (Better Auth)

> Целевое состояние после добавления web app с мульти-провайдерной авторизацией.
> Telegram Mini App остаётся без изменений — это дополнение, не замена.
>
> План адаптирован из проверенного в проде решения daily balancer / Life Progress Tracker
> (`../daily balancer/life-progress-tracker/ARCHITECTURE_WEB_AUTH.md`, v3). Спайк Better Auth
> и фазы 1–2 там уже реализованы и работают на Railway + Vercel + Neon — все найденные
> при той реализации грабли вшиты сюда как требования (помечены «⚠️ урок LPT»).

---

## Статус

**Фазы 1 и 2 — код реализован (2026-07-11).** Фаза 1 активирована и на проде
(https://gymwithai.me, Resend-домен верифицирован). Что сделано — см. [UPDATES.md](UPDATES.md).

Чеклист активации фазы 2 (ручные шаги):

1. **BotFather:** `/setdomain` → выбрать бота → `gymwithai.me` (без него виджет не рисуется).
2. **Railway:** `AUTH_PROVIDERS=email,telegram_widget` (BOT_TOKEN уже есть).
3. Проверка: https://gymwithai.me/login — кнопка «Log in with Telegram»; вход существующим
   TG-юзером → его данные; `/me` на вебе — способы входа, отвязка, «выйти на всех устройствах».

Отклонения фазы 2:

- **`BOT_DISABLED=1`** — запуск сервера без Telegraf-поллинга (локальные смоуки с реальным
  BOT_TOKEN не конфликтуют с прод-ботом; урок LPT №10 подтвердился и здесь).
- **«Выйти на всех устройствах»** — наш `DELETE /api/v1/auth/sessions` (server-side deleteMany),
  а не BA revoke API: работает и из-под `tma`, где BA-сессии у клиента нет.
- **Детект email-дублей на LoginPage** — покрыт generic-сообщением `auth.emailTaken`
  (отдельный `?hint=account_exists` флоу отложен до OAuth-провайдеров).

Чеклист активации (ручные шаги):

1. **Neon:** зафиксировать timestamp (PITR) → выполнить `server/prisma/manual/2026-07-11-web-auth.sql` в SQL Editor → `cd server && npx prisma db push` (создаст Session/Account/Verification/RateLimit).
2. **Локально (`server/.env`):** `BETTER_AUTH_SECRET` (openssl rand -base64 48), `AUTH_PROVIDERS=email`, `API_URL=http://localhost:3001`. Без Resend письма логируются в консоль (ALLOW_DEV_BYPASS=true).
3. **Railway** (домен веб-версии — https://gymwithai.me, привязан к Vercel):
   - `BETTER_AUTH_SECRET` — новый (не локальный!), `openssl rand -base64 48`
   - `AUTH_PROVIDERS=email`
   - `API_URL=https://<railway-домен>` — публичный адрес бэкенда
   - `FRONTEND_URL=https://gymwithai.me,https://<проект>.vercel.app` — список через запятую;
     первый — канонический (ссылки в письмах, OAuth-редиректы), весь список — CORS + trustedOrigins
   - `WEBAPP_URL=https://gymwithai.me` — если Menu Button мини-аппа тоже переводим на домен
   - `RESEND_API_KEY` + `EMAIL_FROM=AI Trainer <noreply@gymwithai.me>` — домен gymwithai.me
     верифицировать в Resend (DNS-записи DKIM/SPF)
4. Проверка на деве: `/login` (регистрация → письмо-в-консоли → verify → вход), `/me` → «Вход через браузер» из мини-аппа.

Отклонения от плана, принятые при реализации:

- **`requireEmailVerification: true` глобально** (LPT не блокировал вход) — вход по email всегда требует подтверждённый адрес; после регистрации BA не создаёт сессию, фронт показывает «подтвердите почту». Одно правило вместо двух закрывает и захват адреса через set-password (§6.3).
- **BA-таблицы — PascalCase без `@map`** (как весь проект), маппинг через `modelName` в конфиге; схему пишем руками, BA CLI не используем (parity-тест остаётся страховкой).
- **Наши эндпоинты живут в `routes/auth.js`** (не отдельный webAuth.js — их пока три).
- **Dev-фолбэк почты:** без `RESEND_API_KEY` при `ALLOW_DEV_BYPASS=true` провайдер email активен, ссылки verify/reset — в консоль сервера.
- **WebProvider — lazy:** клиент better-auth не попадает в бандл мини-аппа.
- **В DEV-браузере без токена — прежний dev-мок** (dev_bypass), а не редирект на /login; web-флоу тестируется заходом на /login напрямую.

Принятые решения (без изменений):

- **Фаза 1:** `AUTH_PROVIDERS=email` — email+пароль как единственный web-провайдер на старте.
- **Фаза 2:** + `telegram_widget` (Login Widget) + adoption + AccountSettings + десктопный лэйаут.
- **Google/Yandex:** код готов с фазы 1 (конфиг собирается динамически), включаются добавлением
  credentials в env — отдельной разработки не требуют.
- **Фаза 3 (отдельный этап, вне скоупа этого документа):** продуктовый паритет веба —
  веб-чат с тренером, генерация программы с веба, email-уведомления. См. §12.

---

## 1. Обзор

| Режим | Где открыт | Авторизация | UI |
|-------|-----------|-------------|-----|
| **Telegram Mini App** | Внутри Telegram | `initData` (HMAC-SHA256) — существующий flow, без изменений | Мобильный, Telegram SDK (safe area) |
| **Web App** | Браузер (десктоп/мобильный) | Better Auth: email/пароль (+ Widget с фазы 2) → session-токен (Bearer) | Тот же UI + WebLayout (фаза 2: сайдбар на десктопе) |

Оба режима: **один React-проект**, **один Express-бэкенд**, **одна БД (Neon)**. Данные юзера доступны с любой платформы.

**Разделение ответственности:**

- **Better Auth** (`better-auth@^1.6`, монтируется на `/api/auth/*`): email+пароль (scrypt,
  верификация, сброс), OAuth Google/Yandex (когда включим), DB-сессии (sliding expiration),
  account linking, rate limiting своих эндпоинтов, CSRF/state. Хранит данные в наших таблицах
  через Prisma-адаптер.
- **Наш код**: Telegram initData (`telegramAuth.js`, без изменений), Telegram Login Widget,
  канон `User.telegramId`, adoption пустого аккаунта, set-password из Mini App,
  `GET /providers`, session-tracking, письма (Resend через fetch).

## 2. Провайдеры

| Провайдер | Реализация | Фаза | Примечания |
|-----------|-----------|------|------------|
| **Telegram initData** | Наш `telegramAuth.js` | есть | Не отключается — базовый режим |
| **Email + пароль** | BA `emailAndPassword` | **1** | Требует Resend (API key + верифицированный домен отправителя) |
| **Telegram Login Widget** | Наш код (HMAC + `telegramId`) | **2** | Требует `/setdomain` в BotFather. Главный вход для существующих TG-юзеров |
| **Google** | BA `socialProviders.google` | код в 1, вкл. по credentials | Google Cloud Console, scope `openid email profile` |
| **Yandex ID** | BA `genericOAuth` | код в 1, вкл. по credentials | Конфиг проверен спайком LPT |
| **Apple** | BA `socialProviders.apple` | мобильная фаза | Обязателен только при iOS-приложении |

### 2.1 Feature flags

```bash
# Railway: фаза 1
AUTH_PROVIDERS=email
# Railway: фаза 2
AUTH_PROVIDERS=email,telegram_widget
# Google/Yandex: добавить в список + задать GOOGLE_/YANDEX_CLIENT_ID+SECRET
```

Правила (как в LPT):

- Конфиг BA собирается динамически из `AUTH_PROVIDERS`: провайдера нет в списке → его
  эндпоинты 404 силами самого BA.
- Провайдер активен только если указан **и** заданы его credentials (`RESEND_API_KEY` для
  email). Указан без credentials → выключается с `console.warn` при старте.
- `GET /api/v1/auth/providers` (публичный) → `{ providers: [...] }`. LoginPage рендерит только
  доступное — набор не хардкодится на фронте.
- Отключение провайдера не рвёт сессии и не удаляет `account`-записи — скрывается только вход.

## 3. Модель данных

### 3.1 User (изменения)

```prisma
model User {
  id            String   @id @default(uuid())

  // ИЗМЕНЕНИЕ: BigInt @unique → BigInt? @unique (nullable)
  // Web-only юзеры не имеют telegramId; без nullable BA не может создать юзера
  telegramId    BigInt?  @unique

  firstName     String            // BA-поле name маппится сюда
  photoUrl      String?           // BA-поле image маппится сюда

  // НОВЫЕ ПОЛЯ (требование Better Auth)
  email         String?  @unique  // ⚠️ урок LPT: BA-codegen генерит String NOT NULL —
                                  //    руками правим на String? после КАЖДОГО generate
  emailVerified Boolean  @default(false)

  // ...остальные поля без изменений (lastName, username, languageCode, timezone,
  //    firstSeenAt, lastSeenAt, sessionsCount и все relations)

  // НОВЫЕ RELATIONS (генерит BA CLI)
  sessions  Session[]
  accounts  Account[]
}
```

Маппинг в конфиге BA: `user: { modelName: 'User', fields: { name: 'firstName', image: 'photoUrl' }, additionalFields: { languageCode, timezone } }`.

Postgres допускает несколько NULL в unique-колонке — все TG-юзеры без email не конфликтуют.

### 3.2 Таблицы Better Auth

`Session` (opaque `token` — его клиент носит как Bearer; sliding `expiresAt`), `Account`
(`providerId`: `credential`|`google`|`yandex`; `password` — scrypt-хеш для credential),
`Verification` (verify-email, reset-password, OAuth state). Генерятся `@better-auth/cli generate`.

**Канон Telegram-идентичности — `User.telegramId`.** Запись в `account` для Telegram НЕ
создаётся ни Mini App'ом, ни Login Widget'ом. Подсчёт методов входа:
`accounts.count + (telegramId ? 1 : 0)`.

**ID юзеров:** BA генерит nanoid — принудительно uuid:
`advanced: { database: { generateId: () => crypto.randomUUID() } }`.

### 3.3 Миграция БД (по правилам проекта: db push + ручной SQL)

```sql
-- Шаг 0: зафиксировать timestamp (Neon PITR)
-- Шаг 1: ручной SQL в Neon Console
ALTER TABLE "User" ALTER COLUMN "telegramId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Шаг 2: npx @better-auth/cli generate --output prisma/schema.prisma
--   (CLI мержит аккуратно — проверено спайком LPT; наши модели не трогает)

-- Шаг 3: ⚠️ РУЧНАЯ ПРАВКА после codegen: email String → String?
--   (повторять после каждого regenerate; ловится parity-тестом, см. §10)

-- Шаг 4: npx prisma db push — новые таблицы Session/Account/Verification безопасны,
--   по User увидит "already in sync"
```

⚠️ NB: в этом проекте Prisma-модели без `@map` — имена таблиц/колонок PascalCase/camelCase
(`"User"`, `"telegramId"`), не snake_case как в LPT. SQL выше — под нашу схему.

### 3.4 Код, который сломается на `telegramId = null` (чинится в фазе 1)

Найдено грепом по `server/src`, полный список:

| Место | Проблема | Фикс |
|-------|----------|------|
| `controllers/authController.js:7` | `user.telegramId.toString()` → TypeError | `user.telegramId?.toString() ?? null` |
| `scheduler/index.js` `tick()` | `findMany` по всем юзерам → джобы зовут `notify(null)` | `where: { telegramId: { not: null } }` |
| `controllers/chatController.js:34` | `notify(req.user.telegramId, nudge)` для web-only юзера | Guard `if (req.user.telegramId)`; ссылку на бота вернуть в любом случае |
| `services/aiTrainer/{reminder,weeklySummary,postWorkoutSummary}.js` | Получают `user` и зовут `notify(user.telegramId)` | Закрывается фильтром в scheduler + guard в postWorkout (он зовётся из API-запроса) |
| `bot/**` (index.js, scenes, notifier) | Работают только от `ctx.from.id` — телеграмный контекст | Изменений не требуют: web-юзер сюда не попадает |

## 4. Серверная архитектура

### 4.1 Монтирование

```js
// server/src/index.js
import { toNodeHandler } from 'better-auth/node'
import { auth } from './auth/index.js'

app.all('/api/auth/{*any}', toNodeHandler(auth))  // ⚠️ строго ДО app.use(express.json())
app.use(express.json({ limit: '1mb' }))
// ...остальное как раньше
```

Нюансы этого проекта (проще, чем в LPT):

- `app.set('trust proxy', 1)` — **уже стоит** (index.js:28).
- BigInt→JSON monkey-patch — **уже стоит**.
- Грабля LPT с `env.js`/dotenv **не существует**: dev-запуск через `node --env-file=.env`,
  на Railway — реальные env. Модульный конфиг BA читает env корректно без доп. мер.
- Аналог `BOT_DISABLED` не нужен — сервер уже штатно живёт без `BOT_TOKEN`.

⚠️ урок LPT — CORS: клиент BA (better-fetch) шлёт `credentials: include`; `credentials: true`
у нас уже стоит, **добавить `exposedHeaders: ['set-auth-token']`** — иначе bearer-токен из
ответа не читается (симптом: молчаливый `net::ERR_FAILED`).

### 4.2 Конфиг Better Auth (`server/src/auth/index.js`)

```js
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: process.env.API_URL,               // https://...railway.app
  secret: process.env.BETTER_AUTH_SECRET,     // 64+ случайных символов, отдельно от BOT_TOKEN
  trustedOrigins: [process.env.FRONTEND_URL],

  user: {
    modelName: 'User',
    fields: { name: 'firstName', image: 'photoUrl' },
    additionalFields: { languageCode: {...}, timezone: {...} },
  },

  advanced: {
    database: { generateId: () => crypto.randomUUID() },
    defaultCookieAttributes: { sameSite: 'none', secure: true }, // cookie живёт только на API-домене (OAuth handoff)
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,   // 30 дней
    updateAge: 60 * 60 * 24,        // sliding: активный юзер не разлогинивается
  },

  emailAndPassword: {               // если 'email' в AUTH_PROVIDERS
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: ({ user, url }) => sendMail('reset', user, url),
    onPasswordReset: ({ user }) => revokeOtherSessions(user.id),
  },
  emailVerification: {
    sendOnSignUp: true,             // вход не блокируется, письмо уходит сразу
    sendVerificationEmail: ({ user, url }) => sendMail('verify', user, url),
    // ⚠️ урок LPT: форсить callbackURL={FRONTEND_URL}/auth/verify —
    // иначе BA после клика редиректит на корень API-домена («Cannot GET /»)
  },

  socialProviders: { /* google — при появлении credentials */ },
  account: { accountLinking: { enabled: true } },

  rateLimit: {                      // встроенный, хранение в БД (переживает рестарт Railway)
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
      // ⚠️ урок LPT: эндпоинт в BA 1.6 — /request-password-reset (НЕ /forget-password)
      '/request-password-reset': { window: 60, max: 3 },  // каждый запрос = письмо Resend
    },
  },

  databaseHooks: {                  // аналитика + session-tracking (см. §9)
    user:    { create: { after: (u) => track(u.id, 'web_user_registered') } },
    session: { create: { after: (s) => { track(s.userId, 'web_login'); trackSeen(s.userId) } } },
  },

  plugins: [
    bearer(),                       // session-токен в Authorization: Bearer
    oneTimeToken(),                 // возврат из OAuth-редиректа в SPA (§6.2)
    // genericOAuth({ config: [yandexConfig] }) — при появлении credentials
  ],
})
```

### 4.3 Единый auth middleware

```
server/src/middleware/
├── auth.js            # НОВЫЙ: единый middleware
├── telegramAuth.js    # без изменений (session-tracking вынесен в общую утилиту)
└── ...
```

```
Authorization header
  ├── "tma ..."     → telegramAuth (существующий): HMAC → upsert User по telegramId → req.user
  ├── "Bearer ..."  → auth.api.getSession({ headers }) → prisma User по session.user.id → req.user
  └── иначе         → 401
```

- Route-файлы меняют `import { telegramAuth }` → `import { auth }` — единственное изменение.
- Session-tracking (debounce lastSeenAt 5 мин + `X-Timezone` + `track('user_seen')`) — сейчас
  зашит в telegramAuth (:64–76) → выносится в `utils/sessionTracking.js`, зовётся из обеих
  веток. Иначе web-юзеры выпадут из DAU/WAU.
- ⚠️ урок LPT — если появится кэш `req.user`: `set-password`/`adopt` обязаны мутировать/сбрасывать
  закэшированный объект, иначе `/auth/init` до минуты отдаёт данные без email.

### 4.4 Кастомные контроллеры (`controllers/webAuthController.js`)

| Метод | Логика |
|-------|--------|
| `listProviders` | Публичный. `AUTH_PROVIDERS` ∩ наличие credentials → `{ providers: [...] }` |
| `telegramWidget` | Фаза 2. HMAC-валидация Widget-данных (ключ = SHA256(bot_token), `auth_date` < 1 день) → поиск/создание User по `telegramId` (account НЕ создаётся) → BA-сессия через `internalAdapter.createSession(userId)` → `{ token }` |
| `linkTelegram` | Фаза 2, под auth. Widget-данные → HMAC → `telegramId` свободен → пишем на текущего User. Занят другим → adoption-проверка (§6.5) |
| `unlinkTelegram` | Фаза 2, под auth. `telegramId = null`. Guard «не последний метод входа»: `accounts.count + (telegramId ? 1 : 0) > 1`. UI предупреждает: отвалятся бот-чат, уведомления тренера, handoff «Спросить тренера» из мини-аппа |
| `adoptAccount` | Фаза 2, под auth. Перенос входов пустого аккаунта на аккаунт с данными (§6.5): транзакция — `account.updateMany(userId)`, удаление пустого User, новая BA-сессия |
| `adoptByPassword` | Фаза 2. ⚠️ урок LPT: зеркальный флоу из Mini App по паролю донора — для юзеров, начавших с веба. При занятом email фронт молча пробует перенос с уже введённым паролем, второй экран — фолбэк |
| `setPassword` | **Фаза 1**, под auth (работает и под `tma`!). `{ email, password }` → `auth.$context`: `internalAdapter.linkAccount({ providerId: 'credential', password: await ctx.password.hash(pw) })` + `User.email` + письмо верификации. **Вход по email активируется только после верификации** — иначе можно застолбить чужой адрес |
| `handoff` | OAuth → SPA: cookie (first-party на API-домене) → one-time token → редирект на фронт (§6.2). Нужен и для Widget-фазы не нужен, только для OAuth |

**«Пустой» аккаунт** (для adoption): `workouts.count === 0 && programs.count === 0`
(аналог `seasons/purchases` в LPT).

**Утилита `utils/mailer.js`**: Resend HTTP API нативным fetch (без SDK — как llm.js), шаблоны
**только ru** (MVP), язык из `User.languageCode` — задел на en. Без `RESEND_API_KEY`
email-провайдер не включается вовсе.

### 4.5 API эндпоинты

```
# ─── Better Auth (/api/auth/*, управляет сам BA) ───
POST   /api/auth/sign-up/email                # { email, password, name } → session + set-auth-token
POST   /api/auth/sign-in/email
POST   /api/auth/request-password-reset       # ⚠️ имя в BA 1.6 (не forget-password)
POST   /api/auth/reset-password               # { token, newPassword }
GET    /api/auth/verify-email                 # ?token= (ссылка из письма)
GET    /api/auth/get-session
POST   /api/auth/sign-out
GET    /api/auth/list-accounts
POST   /api/auth/unlink-account
POST   /api/auth/one-time-token/verify        # возврат из OAuth-редиректа
POST   /api/auth/sign-in/social               # Google — когда включим
POST   /api/auth/sign-in/oauth2               # Yandex — когда включим

# ─── Наши (/api/v1/auth/*) ───
GET    /api/v1/auth/providers                 # публичный, активные провайдеры → LoginPage
POST   /api/v1/auth/set-password              # фаза 1: web-сессия ИЛИ tma (мост из Mini App)
GET    /api/v1/auth/handoff                   # OAuth → SPA (когда включим Google/Yandex)
POST   /api/v1/auth/telegram-widget           # фаза 2: вход через Login Widget
POST   /api/v1/auth/telegram/link             # фаза 2
DELETE /api/v1/auth/telegram                  # фаза 2
POST   /api/v1/auth/adopt                     # фаза 2
POST   /api/v1/auth/adopt-by-password         # фаза 2

# ─── Существующие /api/v1/* — без изменений (только auth вместо telegramAuth) ───
POST   /api/v1/auth/init                      # фикс: telegramId?.toString() ?? null, + email/emailVerified в ответ
```

Rate limit наших кастомных эндпоинтов (`/telegram-widget`, `/set-password`, `/adopt*`):
10 req/min per IP через существующий `express-rate-limit`.

### 4.6 Структура файлов сервера (целевая)

```
server/src/
├── auth/index.js                # НОВЫЙ: конфиг BA (4.2), сборка по AUTH_PROVIDERS
├── middleware/
│   ├── auth.js                  # НОВЫЙ: единый auth (tma | Bearer→BA)
│   └── telegramAuth.js          # session-tracking вынесен, остальное без изменений
├── controllers/webAuthController.js   # НОВЫЙ
├── routes/webAuth.js            # НОВЫЙ (наша часть 4.5)
├── utils/
│   ├── mailer.js                # НОВЫЙ: Resend через fetch, шаблоны ru
│   └── sessionTracking.js       # НОВЫЙ: trackSeen() — зовут telegramAuth, auth.js и BA-хук
└── bot/, services/, scheduler/  # без изменений (кроме фильтра telegramId в scheduler/tick)
```

## 5. Фронтенд-архитектура

### 5.1 Определение платформы

```
window.Telegram?.WebApp?.initData — НЕПУСТАЯ строка?
  ├── ДА → platform = 'telegram'
  └── НЕТ → platform = 'web'
```

⚠️ Проверка именно на **непустоту**: `telegram-web-app.js` подключён в index.html безусловно,
в браузере `initData === ''`. Сейчас `TelegramProvider` в браузере молча подставляет
мок-юзера, а `api.js` шлёт `tma dev_bypass` из **любого** браузера (включая прод-домен, где
он отвергается). Web-режим это чинит: dev-мок остаётся только под `import.meta.env.DEV`.

### 5.2 Провайдеры

Web живёт на **тех же URL**, что и Telegram — платформа определяет провайдера, не префикс пути.
Слой данных уже платформо-независим (TanStack Query поверх `apiGet`) — в отличие от LPT,
дублировать контексты данных не нужно. Меняется только auth-слой:

```
main.jsx: BrowserRouter → ErrorBoundary → TranslationProvider
  → PlatformProvider                        # НОВЫЙ: { platform, isTelegram, isWeb }
    → { telegram: TelegramProvider (как сейчас) | web: WebProvider (НОВЫЙ) }
      → ToastProvider → QueryClientProvider → ActiveWorkoutProvider → App
```

- **PlatformProvider** — детект по 5.1; `useTelegram()` остаётся как обёртка (webApp: null
  для web) — существующие компоненты не переписываются.
- **WebProvider** — при mount: токена нет → `/login?returnTo={путь}`; есть →
  `authClient.getSession()`; невалиден → очистка + `/login`; валиден → рендер детей
  (TanStack Query дальше сам грузит данные как обычно).

### 5.3 Auth-клиент и токен

```js
// src/utils/authClient.js — клиент Better Auth (пакет better-auth добавляется и в корневой package.json)
import { createAuthClient } from 'better-auth/client'
import { oneTimeTokenClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [oneTimeTokenClient()],
  fetchOptions: {
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get('set-auth-token')
      if (token) tokenStorage.set(token)
    },
    auth: { type: 'Bearer', token: () => tokenStorage.get() },
  },
})
```

- **tokenStorage** — один session-токен BA в `localStorage` (cross-domain Vercel↔Railway;
  XSS-риск смягчён серверной инвалидацией). Никакого refresh-флоу: один opaque-токен,
  сервер продлевает сессию сам (sliding).
- **api.js**: `authHeader()` становится платформо-зависимым:
  - telegram: `tma ${initData}` (как сейчас)
  - web: `Bearer ${tokenStorage.get()}`
  - dev fallback `tma dev_bypass` — **только** `import.meta.env.DEV`
- Клиентский метод сброса пароля — `authClient.requestPasswordReset()` (⚠️ урок LPT).

### 5.4 Роутинг и файлы

```jsx
<Routes>
  <Route path="/login" element={<LoginPage />} />              {/* публичные */}
  <Route path="/auth/callback" element={<AuthCallback />} />   {/* ott → сессия (OAuth) */}
  <Route path="/auth/reset" element={<ResetPasswordPage />} />
  <Route path="/auth/verify" element={<VerifyEmailPage />} />
  {/* остальные роуты — как сейчас, под платформенным гейтом */}
</Routes>
```

```
src/
├── contexts/PlatformContext.jsx            # НОВЫЙ
├── components/web/WebProvider.jsx           # НОВЫЙ
├── components/web/WebLayout.jsx              # фаза 2: сайдбар (десктоп)
├── utils/authClient.js, tokenStorage.js     # НОВЫЕ
├── pages/Auth/
│   ├── LoginPage.jsx           # email-форма + кнопки из GET /providers + подсказка TG-юзерам
│   ├── EmailAuthForm.jsx       # табы вход/регистрация + «Забыли пароль?»
│   ├── AuthCallback.jsx        # ?ott= → verify → токен → returnTo (для OAuth)
│   ├── ResetPasswordPage.jsx
│   └── VerifyEmailPage.jsx
└── pages/Main/MePage.jsx       # /me перестаёт быть заглушкой: «Вход через браузер»
                                # (фаза 1, set-password) + методы входа (фаза 2)
```

Auth-страницы — lazy (как Progress/Library): web-only код не попадает в бандл мини-аппа.

## 6. Auth flows

### 6.1 Mini App — без изменений

`initData` → `telegramAuth.js` → `req.user`. Mini App продолжает слать `tma {initData}`
на каждый запрос — BA-сессия ему не нужна.

### 6.2 Web — email: регистрация, вход, сброс (фаза 1)

```
Регистрация: authClient.signUp.email({ email, password, name })
  → BA: scrypt-хеш в account(credential), письмо верификации (вход НЕ блокируется),
    session + set-auth-token → tokenStorage
Вход:        authClient.signIn.email(...) → generic-ошибка (анти-enumeration в BA)
Сброс:       requestPasswordReset (всегда «письмо отправлено») → {FRONTEND}/auth/reset?token=
  → resetPassword → onPasswordReset → отзыв остальных сессий юзера
```

### 6.3 TG-юзер открывает доступ к вебу из Mini App (фаза 1) — основной мост

```
Mini App → /me → «Вход через браузер»
  ↓
POST /api/v1/auth/set-password { email, password }   (Authorization: tma ...)
  → credential-account + User.email + письмо верификации
  ↓
Подтвердил email → вход по почте активен → web → тот же аккаунт со всеми тренировками
```

До включения Widget это единственный способ существующему юзеру попасть в веб —
UI-точка входа на /me обязательна в фазе 1.

### 6.4 Web — Telegram Login Widget (фаза 2)

```
Кнопка «Войти через Telegram» → виджет → { id, first_name, ..., hash }
  ↓ POST /api/v1/auth/telegram-widget
  1. HMAC-SHA256 (ключ = SHA256(bot_token)), auth_date < 1 день
  2. User по telegramId: найден → все свои данные | не найден → создаём (account НЕ создаётся)
  3. internalAdapter.createSession(userId) → { token }
  ↓ фронт: tokenStorage.set(token) → navigate('/')
```

Ops: перед включением — `/setdomain` в BotFather (домен фронтенда).

### 6.5 Adoption пустого аккаунта (фаза 2)

Существующий TG-юзер зарегистрировался на вебе по email → новый пустой User → своих
тренировок не видит. Merge аккаунтов **с данными** не делаем (как в LPT). Если одна из
сторон пуста (`0 workouts && 0 programs`) — переносим способы входа:

```
Пустой веб-аккаунт → «Привязать Telegram» → виджет → telegramId занят ДРУГИМ User'ом
  └── текущий User пуст → диалог «Нашли ваш аккаунт с данными. Перенести вход по почте на него?»
        └── Да → POST /adopt: транзакция (account.updateMany → delete пустого User →
                 новая сессия для старого) → фронт перезагружает данные
```

Плюс зеркальный `adopt-by-password` из Mini App (⚠️ урок LPT №5–6). Безопасность: доказано
владение обеими сторонами — паролем (сессия) и Telegram (HMAC виджета).

⚠️ урок LPT №7 (онбординг-гейт): у нас web-only юзер без программы видит пустой Home —
это валидное состояние (не блокирует навигацию), но экран «Привязать Telegram»/«/me» должен
быть достижим без активной программы. Проверить при реализации фазы 2.

### 6.6 Web — OAuth (Google/Yandex, при включении)

Флоу из LPT §6.2 без изменений: `signIn.social({ callbackURL: API_URL + '/api/v1/auth/handoff?to=/' })`
→ OAuth → callback на API-домене → cookie (first-party) → one-time token (TTL ~60 c) →
`{FRONTEND}/auth/callback?ott=` → `verify` → токен. Проверен в проде LPT на реальных
доменах Vercel/Railway — риска handoff'а больше нет.

## 7. Web UI

### 7.1 LoginPage (фаза 1)

Тёмная страница на дизайн-токенах (Glass), состав — из `GET /providers`:
лого, табы Вход/Регистрация, email+пароль, «Забыли пароль?», внизу — подсказка
«Уже занимаетесь с ботом в Telegram? Ваши данные доступны в мини-аппе» (пока Widget выключен;
с фазы 2 вместо неё кнопка «Войти через Telegram»). Все строки через `t('auth.*')`.

### 7.2 /me (фаза 1 → 2)

- Фаза 1: профиль + блок «Вход через браузер» (set-password) в Mini App; в web — кнопка «Выйти».
- Фаза 2: полный AccountSettings — методы входа (Telegram по `telegramId`, Email с бейджем
  «не подтверждён», Google/Yandex), [Привязать]/[Отвязать] с guard'ом последнего метода,
  «Выйти на всех устройствах».

### 7.3 WebLayout (фаза 2)

Как в LPT: сайдбар слева + колонка контента ~560px по центру, брейкпоинт `lg` (1024px),
только `platform === 'web'`. Мобильный браузер — существующий `GlassNav` bottom-nav
(без haptic/safe-area Telegram). Мини-апп не затрагивается.

## 8. Безопасность

**Закрывает Better Auth:** scrypt, анти-enumeration, PKCE+state, DB-сессии + инвалидация,
одноразовые reset/verify-токены, rate limiting своих эндпоинтов, CSRF (`trustedOrigins`).

**Остаётся на нас:**
- `BETTER_AUTH_SECRET` 64+ символов, отдельно от `BOT_TOKEN`
- Telegram HMAC: initData (< 24 ч, как сейчас) и Widget (< 1 день) — наш код, покрыт тестами
- Cookie только на API-домене (`SameSite=None; Secure`), единственное применение — OAuth handoff
- Верификация email до активации входа в `set-password` (§6.3)
- Guard «не последний метод входа» с учётом telegramId
- Adoption: транзакция + доказательство владения обеими сторонами
- Rate limit кастомных эндпоинтов: 10 req/min per IP
- XSS-гигиена (токен в localStorage): не рендерим непроверенный HTML

## 9. Аналитика

Fire-and-forget через существующий `track()`; для BA-событий — `databaseHooks`:
`web_user_registered`, `web_login`, `email_verified`, `password_reset_done`,
`account_linked`/`account_unlinked`, `account_adopted`. Session-tracking (lastSeen/DAU)
для web — из хука `session.create.after` + Bearer-ветки middleware.

## 10. Тесты (Vitest, как весь проект)

Внутренности BA не тестируем — тестируем наш код и швы:

| Модуль | Что покрыть |
|--------|-------------|
| Единый middleware | `tma` → telegramAuth; `Bearer` валидный/просроченный/мусор; без заголовка → 401 |
| Widget-валидация | HMAC ок / подмена поля / старый auth_date (фикстуры с известным bot_token) |
| `setPassword` | под tma создаёт credential + email; вход до верификации отклонён; занятый email → generic |
| Отвязка | арифметика «последнего метода» с учётом telegramId |
| `adoptAccount` | транзакция; отказ при непустом (workouts/programs); идемпотентность |
| `enabledProviders()` | провайдер без credentials выключается |
| Схема | parity-тест: после `@better-auth/cli generate` поле `email` осталось `String?` |
| Существующее | фиксы §3.4: initAuth с null telegramId; scheduler-фильтр; chatController guard |

## 11. Env variables

```bash
# Railway — существующие без изменений; новые:
AUTH_PROVIDERS=email                        # фаза 2: email,telegram_widget
BETTER_AUTH_SECRET=<случайная строка 64+>
API_URL=https://<railway-домен>             # baseURL для BA
RESEND_API_KEY=...                          # обязателен при 'email'
EMAIL_FROM=noreply@<домен>                  # верифицированный отправитель в Resend

# При включении OAuth:
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
YANDEX_CLIENT_ID / YANDEX_CLIENT_SECRET

# Vercel — без изменений (VITE_API_URL)
```

Зависимости: `better-auth@^1.6` в `server/package.json` **и** в корневом `package.json`
(клиент импортируется из `better-auth/client`); `@better-auth/cli` — dev-зависимость сервера.
НЕ нужны: jsonwebtoken, bcryptjs, Resend SDK.

## 12. Продуктовый gap веба (→ фаза 3, отдельный этап)

У web-only юзера (регистрация по email без Telegram) нет ядра продукта:

| Чего нет | Где живёт сейчас | Фаза 3 |
|----------|------------------|--------|
| AI-чат с тренером | Telegram-бот (`bot/index.js`) | Веб-чат UI + endpoint поверх готового `services/aiTrainer/chat` |
| Создание программы | Бот (`/program` WizardScene, generate/import) | Веб-визард поверх `generateProgram`/`importProgram` |
| Проактивные уведомления | Бот через `notify()` | Email-дайджесты через mailer |
| Скан тренажёра | Бот (admin) | — |

Пока фаза 3 не сделана, веб позиционируется как **десктоп-компаньон для юзеров бота**
(аналитика, библиотека, редактор программы на большом экране), а не как самостоятельная
точка входа. На LoginPage email-регистрация доступна, но лендинг зовёт в Telegram.

## 13. Фазы внедрения

**Фаза 1 — рабочий web-вход (`AUTH_PROVIDERS=email`):**
1. Миграция БД (§3.3) + фиксы non-null `telegramId` (§3.4) + тесты на них
2. `better-auth` + конфиг (§4.2) с динамической сборкой по `AUTH_PROVIDERS`
   (Google/Yandex-ветки кода сразу, включение — credentials'ами)
3. Единый middleware (§4.3) + `sessionTracking` + `mailer` (Resend) + CORS `exposedHeaders`
4. `set-password` из Mini App (§6.3) + блок «Вход через браузер» на `/me`
5. Фронт: PlatformProvider + WebProvider + tokenStorage + authClient + LoginPage +
   Reset/Verify страницы + платформо-зависимый `authHeader()` (dev_bypass только в DEV)
6. i18n-ключи `auth.*`/`accounts.*` (ru), аналитика, тесты (§10)
7. Ops: Resend (домен отправителя), `BETTER_AUTH_SECRET`, `API_URL`, `AUTH_PROVIDERS` на Railway

**Фаза 2 — существующие юзеры и привязки (`+telegram_widget`):**
- Login Widget (`/setdomain` в BotFather) + adoption в обе стороны (§6.4–6.5)
- AccountSettings на `/me`: linking/unlinking, «выйти на всех устройствах»,
  отвязка Telegram с предупреждением (бот-чат + уведомления + handoff отвалятся)
- Детект email-дублей (`/login?hint=account_exists`)
- WebLayout: десктопный сайдбар (§7.3)

**Фаза 3 — веб-паритет фич (отдельный этап, см. §12).**

**Включение Google/Yandex (в любой момент после фазы 1):** завести credentials →
добавить в `AUTH_PROVIDERS` → проверить handoff-флоу (§6.6) на реальных доменах.
