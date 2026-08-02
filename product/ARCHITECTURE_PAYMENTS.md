# ARCHITECTURE_PAYMENTS.md — платежи и подписка

Архитектура приёма платежей AI Trainer: мультипровайдерная (разные регионы → разные платёжки),
мультиплатформенная (Telegram Mini App / web / PWA). Адаптация проверенной архитектуры из
[life-progress-tracker/ARCHITECTURE_PAYMENTS.md](../../daily%20balancer/life-progress-tracker/ARCHITECTURE_PAYMENTS.md) —
там же живёт исходное исследование (ЮKassa vs CloudPayments, Telegram Bot Payments, самозанятость)
и орг-гайд **GUIDE_PAYMENTS_ORG.md** (треки R1–R6 и A1–A9 применимы 1:1).

Статус: **фаза 1 (фундамент + mock) — в коде, за флагом `PREMIUM_GATING=off`; фазы 2–5 — план**. Дата: июль 2026.

Зафиксированные решения:
- **Hard paywall: всё приложение по подписке** (решение июль 2026, перебивает мягкий вариант
  из PRODUCT_PLAN §9): без активной подписки недоступно всё — и AI-фичи, и трекинг.
  Гейт: на сервере `requirePremium` на все данные-роуты (кроме auth/billing/admin),
  на фронте — paywall-гейт на уровне маршрутов, в боте — paywallGuard.
- **Бесплатного не даём ничего**: free trial нет, бесплатных сканов нет. Бесплатный период
  существует только как admin-механика — промокод `free_period` или `admin/billing/grant`
  (саппорт, подарки, grandfathering).
- **Тарифы — с публичного лендинга** (gymwithai.me): **неделя 990 ₽ / месяц 3 000 ₽ (главный
  оффер) / lifetime 15 000 ₽**.
- **RU — автопродляемая подписка с первого дня**: web → ЮKassa с рекуррентными списаниями;
  Telegram → **Tribute** (подписки — их ядро). Bot Payments (`provider_token`) отвергнут:
  не умеет рекуррентку. Stars — обязательный контур для TMA-iOS.
- **Месячный план в Stars — нативная Stars-подписка** (`subscription_period: 2592000` — Stars
  умеют только 30 дней, и это ровно наш месяц). Неделя и lifetime через Stars — разовые инвойсы.
- **Не-RU карты: Paddle (merchant of record) на австралийском ABN** — оформление на родителей.
  Орг-трек общий с life-progress-tracker: ABN, банк, Paddle-аккаунт один, продуктов внутри — два.
- **Региональное ценообразование** через регион-корзины (`BillingPlanPrice.region`, резолв по IP)
  для провайдеров, где сумму выставляем мы (Stars, ЮKassa); у Paddle/IAP — per-country
  настройки в кабинете провайдера.
- **Промокоды** в платёжном слое с первого дня: бесплатный период или скидка на покупку.
- **Код фаз 1/3/4/5 переносится из life-progress-tracker почти 1:1** — там billingService,
  провайдеры yookassa/tribute/paddle и вебхуки уже написаны и покрыты тестами на том же стеке
  (Express + Prisma + Telegraf). Адаптация — naming схемы, Vitest, каналы уведомлений (§8).

---

## TL;DR — верхнеуровневый план

**Продукт.** Hard paywall: без активной подписки приложение недоступно целиком. Триала нет.
Планы: неделя 990 ₽ / месяц 3 000 ₽ / lifetime 15 000 ₽. Промокоды (бесплатный период /
скидка) — admin-механика с первого дня. Цены — по регион-корзинам.

**Архитектура одним абзацем.** Entitlement-слой (таблица `Subscription`, единая проверка
`isPremium`) полностью отделён от платёжного: любой провайдер и промокод в итоге
создают/продлевают одну и ту же строку подписки через идемпотентный
`billingService.applySuccessfulPayment()`. Провайдеры — адаптеры (фабрика по образцу
`services/aiTrainer/`). Entitlement висит на `User.id` (общий для TMA и web после Better Auth):
оплатил в Telegram — пользуешься на web/PWA, и наоборот.

**Кто платит как:**

| Аудитория | Провайдер | Подписка |
|---|---|---|
| RU, web/PWA | ЮKassa (самозанятость) | автопродление с первого дня (наш крон) |
| RU, Telegram | Tribute | автопродление на их стороне (вебхуки) |
| TMA на iOS | Telegram Stars | месяц — нативная Stars-подписка; неделя/lifetime — разовые + напоминание |
| не-RU | Stars → затем Paddle (AU ABN, MoR) | Paddle продлевает сам |
| Нативная мобилка (когда будет) | StoreKit 2 / Play Billing | сторы продлевают сами |

**Этапы:**

0. **Орг-подготовка** — общая с life-progress-tracker (два независимых трека RU/AU); для
   AI Trainer добавляются только оферта/Terms на gymwithai.me и второй магазин ЮKassa.
1. **Фундамент** (код без денег): схема, `billingService` + тесты, `requirePremium` на
   данные-роуты + гейт в боте, paywall UI, промокоды — всё за флагом `PREMIUM_GATING=off`.
2. **Stars** — первые живые деньги: iOS-обязательный контур + весь мир без юрлица.
3. **ЮKassa web** — RU-подписка с автопродлением (крон продлений, dunning).
4. **Tribute** — RU-подписка внутри Telegram (вебхуки, `trbt-signature`).
5. **Paddle** — не-RU карты (sandbox-код можно писать параллельно AU-треку).
6. **IAP / оптимизации** — по сигналу спроса.

Критический путь до первых денег: фаза 1 → фаза 2 (ничего организационного не требуют).
Фазы 3–4 ждут только RU-трек фазы 0, фаза 5 — только AU-трек. Если орг-треки уже пройдены
для life-progress-tracker — фазы 3–5 разблокированы почти сразу (нужен только второй магазин
ЮKassa / второй продукт в Tribute и Paddle).

---

## 1. Что продаём (зафиксировано)

**Hard paywall**: подписка открывает всё приложение целиком. Бесплатного тира нет —
без активной подписки юзер видит только paywall (и — на web — страницы логина).
Главный драйвер решения: каждая AI-фича стоит нам живых денег (`LlmUsage` уже считает
косты), а «бесплатный трекинг» не конвертирует, но создаёт нагрузку и саппорт.

**Планы** (цены RU — как на лендинге):

- **Неделя** — RU: **990 ₽** («попробовать всерьёз», цена одной тренировки с тренером)
- **Месяц** — RU: **3 000 ₽** (главный оффер, featured на лендинге)
- **Lifetime** — RU: **15 000 ₽** (разовый платёж, подписка не нужна)
- **Триала нет.** Бесплатный период — только промокод `free_period` или admin-грант
  (саппорт, подарки, блогеры, grandfathering).
- **Промокоды** — бесплатный период или скидка; механизм в платёжном слое сразу (§4, §5),
  UI-поле на paywall'е с первого дня, раздача — вручную.

Цены других регионов — по корзинам (§4/§5.2). Гейтится всё через единый `isPremium`.

---

## 2. Главный принцип: entitlements ≠ payments

Два независимых слоя:

1. **Entitlement-слой** — «у юзера есть Premium до даты X (или бессрочно)». Единственный
   источник правды, не знает, откуда пришли деньги. Всё гейтится только через него.
2. **Payment-слой** — провайдер-специфичные адаптеры (фабрика по образцу `services/aiTrainer/`
   и `llm.js`), которые в итоге дергают одну идемпотентную функцию
   `billingService.applySuccessfulPayment(...)`.

Это развязывает руки: юзер платит Stars в Telegram, а пользуется Premium в PWA на iPhone
(entitlement висит на `User.id` — TMA и web уже сведены к одному юзеру через
`auth` middleware и linking из ARCHITECTURE_WEB_AUTH.md). Добавление нового провайдера
(Stripe, IAP) не трогает ни гейтинг, ни UI статуса.

⚠️ Особенность AI Trainer: `User.telegramId` — **nullable** (web-only юзеры). Stars и Tribute
для них недоступны by design (нет Telegram), ЮKassa/Paddle — доступны. Вебхуки Tribute мапят
юзера по `telegram_user_id → User.telegramId`; весь billing-код обязан не предполагать
non-null `telegramId` (правило из CLAUDE.md).

---

## 3. Матрица «платформа × регион → способ оплаты»

Платформа определяется по непустоте `initData` (telegram / web) — паттерн уже в проде;
внутри TMA доступен `Telegram.WebApp.platform` (`ios` / `android` / `tdesktop` / `weba`...).

| Платформа | Регион | Способ (v1) | Способ (позже) |
|---|---|---|---|
| TMA на **iOS** | любой | **только Telegram Stars** (требование Apple, реально энфорсится именно тут) | — |
| TMA на Android/Desktop | RU | **Tribute** (автоподписка, RU-карты) **+ Stars** как альтернатива | — |
| TMA на Android/Desktop | не-RU | Telegram Stars | + «оплатить картой» → Paddle hosted checkout во внешнем браузере |
| Web/PWA (gymwithai.me) | RU | **ЮKassa с рекуррентной подпиской с первого дня** (сохранение метода при первом платеже); lifetime — разовый платёж | — |
| Web/PWA | не-RU | ссылка «оплатить в Telegram» (Stars) до фазы 5 | **Paddle** (карты, MoR, подписки из коробки) |
| Нативная мобилка (будущее) | любой | — | StoreKit 2 / Google Play Billing (обязательны для цифровых товаров в сторах) |

Ключевые следствия:

- **Stars — универсальный контур**: работают везде, где есть Telegram, не требуют юрлица,
  оферты и модерации, закрывают iOS-требование и весь не-RU мир на старте. Поэтому они —
  фаза 2, до ЮKassa. Бонус AI Trainer: месячный план идеально ложится на нативные
  Stars-подписки (30 дней) — автопродление делает Telegram, не мы.
- **Регион нужен и для набора методов, и для цены**. Детекция server-side по IP
  (`geoip-lite` от `req.ip`; `trust proxy` уже настроен в `server/src/index.js`) с fallback
  на `User.languageCode`; результат — грубая ценовая корзина, не точная страна.
  На TMA-iOS список методов жёстко режется до Stars.
- **Не-RU карты — через Paddle на австралийском ABN** (аккаунт родителей, общий с
  life-progress-tracker). Paddle — merchant of record: юридический продавец — Paddle,
  GST/VAT/sales tax считает и платит он. Комиссия ~5% + 50¢ — дороже Stripe, но ноль
  налоговой возни и весь subscription-стек (dunning, прорация, customer portal) из коробки.
- **Paywall живёт на двух поверхностях**: мини-апп/web (страница + sheet) **и бот** — AI-чат
  находится в Telegram, поэтому бот сам должен уметь ответить «подписка кончилась» с кнопками
  «⭐ Оплатить» (Stars-инвойс прямо в чате) и «Тарифы» (WebApp-кнопка на `/paywall`;
  в dev — plain-text ссылка, HTTPS-паттерн уже есть в боте).

---

## 4. Схема данных (Prisma)

Все таблицы новые → `db push` безопасен (правило №1 из CLAUDE.md). Стиль — как в остальной
схеме AI Trainer: camelCase, без `@map`, id — uuid.

```prisma
// Тарифный план. Каталог маленький — сидируется, кешируется в памяти.
model BillingPlan {
  id        String   @id @default(uuid())
  code      String   @unique            // 'premium_week' | 'premium_month' | 'premium_lifetime'
  period    String                      // 'week' | 'month' | 'lifetime'
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  prices        BillingPlanPrice[]
  payments      Payment[]
  subscriptions Subscription[]
}

// Цена плана: провайдер × регион. Цены в МИНИМАЛЬНЫХ единицах (копейки / целые Stars).
//
// region — ценовая корзина (bucket), НЕ страна: 'default' (мир), 'ru', дальше по мере
// надобности. Маппинг страна → bucket живёт в pricing.js — добавление корзины = строки
// в каталоге + маппинг, без миграций.
//
// Региональность по-разному у провайдеров:
//  - stars / yookassa — цену выставляем МЫ в момент инвойса → регион важен, строка на bucket;
//  - paddle / IAP — per-country цены в кабинете провайдера → одна строка 'default'
//    с базовой ценой + providerPriceId, источник правды по сумме — провайдер.
model BillingPlanPrice {
  id              String  @id @default(uuid())
  planId          String
  provider        String                  // 'stars' | 'yookassa' | 'paddle' | 'apple_iap' | 'google_play'
  region          String  @default("default")
  currency        String                  // 'XTR' | 'RUB' | 'USD'
  amount          Int                     // 99000 (990 ₽) | 300000 (3000 ₽) | 1500000 (15000 ₽) | Stars/USD-эквиваленты
  providerPriceId String?                 // pri_... (Paddle) / productId (IAP); null для stars/yookassa

  plan BillingPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@unique([planId, provider, region, currency])
}

// Одна попытка/факт оплаты. providerPaymentId — ключ идемпотентности.
model Payment {
  id                String        @id @default(uuid())
  userId            String
  planId            String
  provider          String
  providerPaymentId String        @unique // yookassa payment.id | telegram_payment_charge_id | transaction_id (Paddle)
  status            PaymentStatus @default(pending)
  amount            Int
  currency          String
  meta              Json?                 // сырой payload провайдера (без карточных данных)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  user User        @relation(fields: [userId], references: [id])
  plan BillingPlan @relation(fields: [planId], references: [id])
  @@index([userId])
  @@index([status])
}

enum PaymentStatus {
  pending
  succeeded
  canceled
  refunded
}

// Entitlement: подписка юзера.
// АКТИВНОСТЬ = status active|canceled И (currentPeriodEnd == null ИЛИ currentPeriodEnd + grace > now()).
// currentPeriodEnd == null — lifetime (бессрочно).
// canceled = автопродление выключено, но оплаченный период дохаживается.
// provider: платёжные ('stars'|'yookassa'|'tribute'|'paddle'|...) + БЕСПЛАТНЫЕ источники:
// 'promo' (бесплатный период по промокоду) и 'admin' (ручной грант) —
// та же таблица, тот же isPremium, никакой отдельной логики гейтинга.
model Subscription {
  id                     String    @id @default(uuid())
  userId                 String
  planId                 String
  provider               String                  // кто «владеет» продлением ('promo'/'admin'/lifetime — не продлеваются)
  status                 SubStatus @default(active)
  currentPeriodEnd       DateTime?               // null = lifetime
  autoRenew              Boolean   @default(false)
  providerSubscriptionId String?                 // Stars sub id | Tribute subscription_id | Paddle sub_...
  paymentMethodId        String?                 // сохранённый метод ЮKassa (рекуррентка)
  recurrentConsentAt     DateTime?               // ФЗ-376: когда юзер согласился на автосписания
  renewalAttempts        Int       @default(0)   // dunning-счётчик крона ЮKassa
  lastRenewalAttemptAt   DateTime?
  canceledAt             DateTime?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  user User        @relation(fields: [userId], references: [id])
  plan BillingPlan @relation(fields: [planId], references: [id])
  @@index([userId, status])
  @@index([status, currentPeriodEnd])            // для крона продлений
}

enum SubStatus {
  active
  past_due   // не удалось списать, идут ретраи (grace)
  canceled   // автопродление выключено, период дохаживается
  expired
}

// ===== ПРОМОКОДЫ =====
// Два вида: free_period (бесплатные N дней — entitlement сразу, provider='promo')
// и discount (процент со следующей покупки — применяется в checkout).
model PromoCode {
  id             String    @id @default(uuid())
  code           String    @unique               // нормализованный UPPERCASE
  kind           String                          // 'free_period' | 'discount'
  freeDays       Int?                            // для free_period: 7, 14, 30...
  discountPct    Int?                            // для discount: 1-100
  planCode       String?                         // null = любой план
  maxRedemptions Int?                            // null = без лимита
  expiresAt      DateTime?
  isActive       Boolean   @default(true)
  comment        String?                         // для себя: «блогер X», «друзья из зала»
  createdAt      DateTime  @default(now())

  redemptions PromoRedemption[]
}

// Активация промокода юзером. Для discount: status pending → applied (снапшот скидки
// живёт здесь, checkout берёт ровно одну pending-активацию).
model PromoRedemption {
  id          String    @id @default(uuid())
  promoCodeId String
  userId      String
  status      String    @default("applied")     // free_period: сразу 'applied'; discount: 'pending' → 'applied'
  paymentId   String?                           // какой платёж получил скидку
  createdAt   DateTime  @default(now())
  appliedAt   DateTime?

  promoCode PromoCode @relation(fields: [promoCodeId], references: [id])
  user      User      @relation(fields: [userId], references: [id])
  @@unique([promoCodeId, userId])               // один код — один раз на юзера
  @@index([userId, status])
}

// Журнал вебхуков/событий провайдеров — идемпотентность и отладка.
model BillingEvent {
  id          String    @id @default(uuid())
  provider    String
  eventId     String                            // id события у провайдера (или синтетический)
  type        String                            // 'payment.succeeded' | 'successful_payment' | ...
  payload     Json
  processedAt DateTime?                         // null = принято, но не обработано
  error       String?
  createdAt   DateTime  @default(now())

  @@unique([provider, eventId])
}
```

В `User` добавляются только обратные relations (`payments`, `subscriptions`,
`promoRedemptions`) — колонок нет, `db push` безопасен. Кеш-поле
`premiumUntil` на User **не заводим**: активность считается запросом по `Subscription`
(индекс есть) — при необходимости добавим 60s-кеш в памяти, как каталог планов.

Retention (`scheduler/retention.js`): `BillingEvent` можно чистить (90+ дней), финансовые
таблицы (`Payment`, `Subscription`, `PromoRedemption`) — **никогда**.

---

## 5. Структура кода на сервере

По образцу `services/aiTrainer/` + `utils/llm.js` (адаптеры за фабрикой):

```
server/src/services/billing/
├── provider/
│   ├── index.js       # createPaymentProvider(name) — фабрика, PAYMENT_PROVIDERS как AUTH_PROVIDERS
│   ├── stars.js       # Telegram Stars: createInvoiceLink (XTR; месяц — subscription_period), refundStarPayment
│   ├── yookassa.js    # REST API ЮKassa: create payment, get payment, recurring charge
│   ├── tribute.js     # Tribute: deep link подписки, верификация trbt-signature (HMAC по raw body)
│   ├── paddle.js      # Paddle Billing API: транзакция/checkout-link, cancel subscription, верификация вебхука
│   └── mock.js        # для Vitest: мгновенный grant, весь флоу без реальных платёжек
├── billingCore.js     # чистые функции (периоды, активность+grace, регион, промокоды) — юнит-тесты
├── billingService.js  # ЯДРО: applySuccessfulPayment(), isPremium(), cancelAutoRenew(), revokeForRefund()
├── pricing.js         # каталог планов+цен (кеш в памяти), resolvePriceRegion(), availableMethods()
└── webhooks.js        # обработчики вебхуков → billingService

server/src/middleware/requirePremium.js      # 403 { code: 'PREMIUM_REQUIRED' }, за флагом PREMIUM_GATING
server/src/controllers/billingController.js  # Zod-схемы inline, тонкий (правило CLAUDE.md)
server/src/routes/billing.js                 # /api/v1/billing/* (кроме raw-body вебхуков, см. §7.5)
server/src/bot/payments.js                   # pre_checkout_query + successful_payment (Telegraf)
server/src/bot/paywallGuard.js               # гейт LLM-хэндлеров бота → paywall-сообщение с кнопками
server/src/scheduler/subscriptionRenewal.js  # крон рекуррентки ЮKassa + переводы active→expired
```

⚠️ `subscriptionRenewal` стартует в `index.js` **независимо от бота** (как `startRetention` /
`startNotificationService`), а не внутри `startScheduler()` — продления должны работать
и при `BOT_DISABLED=1`.

### 5.1 billingService — контракт

```js
// Идемпотентно: повторный вызов с тем же (provider, providerPaymentId) — no-op.
// Продление: newPeriodEnd = max(now, sub.currentPeriodEnd) + period — периоды складываются.
// План lifetime: currentPeriodEnd = null, autoRenew = false; поглощает любую активную подписку.
async function applySuccessfulPayment({ userId, planCode, provider, providerPaymentId, amount, currency, meta })

// Единственная точка проверки Premium (и для requirePremium, и для paywallGuard бота,
// и для ответа POST /auth/init).
async function isPremium(userId) // → { active, plan, periodEnd, autoRenew, provider }

async function cancelAutoRenew(userId)            // status → canceled, период дохаживается
async function revokeForRefund(providerPaymentId) // refund → срезать период

// Бесплатные источники entitlement'а (те же Subscription-строки):
async function redeemPromo(userId, code)        // free_period → entitlement сразу (provider='promo');
                                                // discount → PromoRedemption(pending), вернёт { kind, ... }
async function grantManual({ userId, days })    // admin-грант (provider='admin')
```

`cancelAutoRenew` ветвится по `Subscription.provider`: `yookassa` — гасим локальный
`autoRenew` (списываем мы сами); `paddle` — зовём их API cancel, локальный статус обновит
вебхук; `tribute` — отмена в интерфейсе Tribute (UI даёт ссылку на их бот); `stars` —
для месячной нативной подписки юзер отменяет в Telegram (UI показывает инструкцию),
неделя/lifetime — нечего отменять; `promo`/`admin` — нечего отменять.

Правила:
- **Идемпотентность** — через `Payment.providerPaymentId @unique`: `create` в транзакции,
  на P2002 молча выходим. Вебхуки и апдейты Telegram приходят повторно — это норма.
- `track(userId, 'payment_succeeded', {...})` — fire-and-forget (без `await`, правило
  CLAUDE.md) на все переходы статусов.
- Уведомления (продлили / не списалось / подписка кончилась) — через существующий
  notifier/`NotificationJob`-очередь: Telegram-юзерам — бот, web-only — Web Push
  (`PushSubscription`) + email (`utils/mailer.js`, Resend). В отличие от
  life-progress-tracker, канал для web-only юзеров уже готов.

### 5.2 pricing.js — регион и цены

```js
// Страна по IP (geoip-lite) → ценовая корзина. Fallback-цепочка:
// ipCountry → User.languageCode → 'default'. Результат кладём в req (не в БД).
function resolvePriceRegion({ ip, languageCode }) // → 'ru' | 'default' | ...

// Цена с fallback на 'default', если для корзины нет строки.
function getPrice(planCode, provider, region) // → { amount, currency, providerPriceId }

// Матрица §3: platform из initData/заголовков, tmaClient = Telegram.WebApp.platform (шлёт фронт).
function availableMethods({ platform, tmaClient, region }) // → ['tribute', 'stars', ...]

// Итоговая сумма: цена по региону минус pending-скидка промокода (если есть).
// Для stars/yookassa скидку применяем мы (сумма в инвойсе); для paddle промокод
// маппится на Paddle discount_id.
function resolveCheckoutAmount({ planCode, provider, region, userId }) // → { amount, currency, redemptionId? }
```

Правила регионального ценообразования:
- **Цена фиксируется в момент создания инвойса/чекаута** (сервером, из каталога) и
  снапшотится в `Payment.amount/currency`. Смена региона юзером ничего не ломает.
- **`pre_checkout_query` сверяет сумму с той, что сами выставили в инвойсе** (payload несёт
  сумму), а не пересчитывает регион заново — иначе юзер в роуминге получит ложный отказ.
- Для Paddle/IAP регион-корзины не применяются: per-country цены живут в кабинете провайдера.
- VPN-арбитраж цен принимаем как некритичный (стандартная практика).

### 5.3 API

Все под единой `auth`-мидлварой (tma | Bearer — оба типа юзеров), кроме вебхуков.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/v1/billing/status` | `{ active, plan, periodEnd, autoRenew, provider, gatingEnabled }` — также подмешивается в ответ `POST /api/v1/auth/init` (не плодим round-trip) |
| GET | `/api/v1/billing/plans` | планы + цены для резолвнутого региона + методы из `availableMethods()`; серверный `track('paywall_shown')` |
| POST | `/api/v1/billing/checkout` | `{ planCode, method }` → `{ type: 'invoice_link', url }` (Stars) / `{ type: 'telegram_link', url }` (Tribute) / `{ type: 'redirect', url }` (ЮKassa, Paddle) |
| POST | `/api/v1/billing/cancel` | выключить автопродление |
| POST | `/api/v1/billing/promo/redeem` | `{ code }` → free_period: entitlement сразу; discount: `{ kind: 'discount', discountPct }` — paywall перерисовывает цены |
| POST | `/api/v1/billing/webhook/yookassa` | вебхук ЮKassa (§7). Вне auth, свой rate limit |
| POST | `/api/v1/billing/webhook/tribute` | вебхук Tribute. Вне auth; ⚠️ подпись `trbt-signature` по **raw body** → монтаж в `index.js` ДО `express.json()` |
| POST | `/api/v1/billing/webhook/paddle` | вебхук Paddle. Вне auth; ⚠️ `Paddle-Signature` по **raw body** → монтаж ДО `express.json()` |
| POST | `/api/v1/admin/billing/grant` | ручная выдача Premium — в существующем `routes/admin.js` (гейт по `ANALYTICS_SECRET`): саппорт, подарки, grandfathering |

**Hard paywall на сервере**: `requirePremium` вешается в `routes/index.js` на все
данные-роуты (`/exercises`, `/workouts`, `/stats`, `/programs`, `/progress`, `/chat`,
`/insights`, `/push`); свободными остаются `/auth/*` (вход и статус), `/billing/*`
(paywall должен работать без подписки) и `/admin` (свой гейт). В боте — `paywallGuard`
перед LLM-хэндлерами (чат, скан тренажёра, `/program`-визард).
Флаг `PREMIUM_GATING=off|on` — продажа и гейтинг включаются независимо.

### 5.4 Фронтенд

- **Данные — через TanStack Query** (не контекст): `queryKeys.billing`,
  `useBillingStatus()` в `hooks/queries.js` (источник — ответ `/auth/init` или
  `/billing/status`), мутации checkout/promo в `hooks/mutations.js` с инвалидацией
  `queryKeys.billing`. Рефетч: колбэк `openInvoice` (`invoiceClosed`), `visibilitychange` +
  короткий поллинг, пока открыт paywall (для оплат во внешнем браузере/Tribute).
- **Paywall-гейт в `App.jsx`** — hard paywall: при `billing.gatingEnabled && !billing.active`
  все маршруты, кроме web-auth-страниц (`/login`, `/auth/*`) и `/demo`, рендерят
  `PaywallPage`. Рубильник приходит с сервера (`PREMIUM_GATING`) — старый фронт без ключа
  `billing` молчит.
- **`PaywallPage`** — lazy (вне бандла критического пути, как `pages/Auth/`):
  свитчер неделя/месяц/lifetime (месяц — featured, как на лендинге), поле промокода
  (free_period → доступ сразу; discount → зачёркнутые цены), список методов из
  `/billing/plans`. Кнопка → `checkout` → `Telegram.WebApp.openInvoice(url)` (Stars) /
  `openTelegramLink` (Tribute) / redirect или `openLink` (ЮKassa, Paddle).
- Сервер дублирует гейт мидлварой `requirePremium` (403 `{ code: 'PREMIUM_REQUIRED' }`) —
  при таком ответе фронт инвалидирует `queryKeys.billing`, гейт срабатывает сам.
- **`/me`** — блок «Подписка»: статус (план, дата, источник), отмена
  автопродления с `ConfirmDialog`, «продлить» → `/paywall`. Для provider='tribute' —
  ссылка «управлять в боте Tribute», для stars-месяца — инструкция отмены в Telegram.
- **`/billing/return`** — страница возврата с ЮKassa (поллинг статуса 2с×30с).
- i18n: namespace `billing.*` через `t()` — ru (MVP-правило), структура ключей готова к en.
- Glass UI: paywall строится из `Glass`/`Button`/токенов, никаких хардкод-цветов.

---

## 6. Флоу по провайдерам

### 6.1 Telegram Stars (валюта XTR)

Работает в TMA на **всех** платформах и в чате бота. Без юрлица, оферты и модерации.

```
Frontend: POST /billing/checkout { planCode, method: 'stars' }
Server:   bot.telegram.createInvoiceLink({ currency: 'XTR', prices: [{ amount }],
            payload: JSON({ userId, planCode, amount }),
            subscription_period: 2592000 })            // ← только для premium_month
Frontend: Telegram.WebApp.openInvoice(link, cb)        // или бот шлёт инвойс прямо в чат
Bot:      pre_checkout_query  → валидация payload/цены → answerPreCheckoutQuery(true)  // ≤10 секунд!
Bot:      message.successful_payment → applySuccessfulPayment({
            providerPaymentId: telegram_payment_charge_id, ... })
```

- **Месяц — нативная Stars-подписка** (`subscription_period: 2592000`, единственный
  поддерживаемый период — и это ровно наш план): Telegram продлевает сам, повторные
  `successful_payment` приходят той же веткой (с `is_recurring`/`subscription_expiration_date`),
  `providerSubscriptionId` = `telegram_payment_charge_id` первого платежа. Отмена — юзером
  в настройках Telegram; истечение ловим по `currentPeriodEnd` (крон переводов в `expired`).
- **Неделя и lifetime — разовые инвойсы**: entitlement на 7 дней / бессрочно. Для недели —
  напоминание за сутки до конца через существующую очередь уведомлений с кнопкой «продлить»
  (тот же checkout) — главный retention-механизм недельки.
- ⚠️ Lifetime в Stars: 15 000 ₽ ≈ ~12 000 ⭐ — **проверить максимальную сумму инвойса**
  (лимит Telegram); если упрёмся — lifetime доступен только через ЮKassa/Paddle (открытый вопрос §10).
- Возвраты: `refundStarPayment(userId, chargeId)` → админ-эндпоинт.
- Цена в Stars выравнивается по курсу (~$0.013/⭐), хранится в `BillingPlanPrice` по корзинам
  (Telegram не даёт страну — регион резолвим по IP запроса к нашему API, §5.2).
- Бот на long polling — апдейты платежей приходят в существующий Telegraf-инстанс, вебхук
  не нужен. Обработчики — `bot/payments.js`, регистрируются в `bot/index.js`.
  ⚠️ При `BOT_DISABLED=1` апдейты Stars не обрабатываются — прод-бот должен быть единственным
  поллером (уже так).

### 6.2 Tribute (RU-подписка внутри Telegram)

Tribute — сервис монетизации в Telegram: подписка живёт у них (списания, продления, отмена),
мы слушаем вебхуки. Периоды: разовая/неделя/месяц/год — наши неделя и месяц покрыты;
lifetime через Tribute не продаём (Stars/ЮKassa). Комиссия ~10%, выплаты на карту РФ
самозанятому.

```
Подготовка (разово): продукты-подписки в дашборде Tribute (weekly 990 ₽ / monthly 3000 ₽)
  → deep links; API key (Settings → API Keys) + webhook URL

checkout { method: 'tribute' } → { type: 'telegram_link', url: <tribute deep link> }
  → Telegram.WebApp.openTelegramLink(url) — юзер оформляет, не покидая Telegram

Вебхуки (подпись trbt-signature = HMAC-SHA256 по raw body, ключ = API key;
ретраи ~24ч — идемпотентность обязательна):
  newSubscription       → applySuccessfulPayment({ provider: 'tribute', ... });
                           юзер по telegram_user_id → User.telegramId;
                           периодом правит их expires_at (periodEndOverride)
  renewedSubscription   → та же ветка (продление)
  cancelledSubscription → автопродление выключено, период дохаживается
```

- Отмена — в интерфейсе Tribute: наш экран подписки даёт ссылку на их бот.
- Их триал не используем — бесплатных периодов не даём (только промокод/admin-грант).
- Готовый оттестированный код (провайдер + вебхук + eventId-схема
  `имя:subscription_id:expires_at`) — в life-progress-tracker, переносится 1:1.

### 6.3 ЮKassa напрямую (web/PWA RU) — подписка с первого дня

Первый платёж сразу сохраняет платёжный метод; продление — наш крон. Никакой фазы
«сначала разовые, потом рекуррентка». Lifetime — обычный разовый платёж без
`save_payment_method`.

```
checkout { method: 'yookassa' } →
  POST https://api.yookassa.ru/v3/payments  (Basic auth shopId:secretKey, Idempotence-Key: uuid)
  { amount, capture: true, confirmation: { type: 'redirect', return_url },
    metadata: { userId, planCode }, receipt: {...},
    save_payment_method: true }                    // week/month; lifetime — false
→ redirect на confirmation_url → юзер платит → возвращается на /billing/return
→ вебхук payment.succeeded → applySuccessfulPayment(); из платежа забираем
  payment_method.id (saved=true) → Subscription: paymentMethodId, autoRenew: true,
  recurrentConsentAt (ФЗ-376: на paywall'е — явный текст «подписка продлевается
  автоматически, отмена в любой момент»)
```

Продления: `scheduler/subscriptionRenewal.js` раз в час (node-cron, независимо от бота)
выбирает `Subscription(autoRenew, provider='yookassa', currentPeriodEnd < now+24h)` →
`POST /payments { payment_method_id, amount, capture: true }` (без 3-DS).
Fail → `past_due`, ретраи раз в 24ч (счётчик `renewalAttempts`), 3 неудачи → `expired`.
Idempotence-Key продления = `renewal_{subId}_{periodEnd}_{attempt}`; сумма продления =
последний успешный платёж юзера (регион не пересчитывается). Уведомления о каждом переходе —
через notifier/очередь (бот / Web Push / email).

⚠️ Вебхук ЮKassa не подписан → доверяем не телу, а API: журналируем `BillingEvent`,
отвечаем 200, **перечитываем платёж** `GET /v3/payments/{id}` и применяем статус из API.
Плюс allowlist IP-подсетей ЮKassa как первый фильтр.

### 6.4 Paddle (не-RU карты; web + внешний браузер из TMA)

Merchant of record на австралийском ABN (общий аккаунт с life-progress-tracker, отдельные
продукты). Подписочный стек целиком у Paddle: списания, dunning, customer portal — наш
крон продлений для Paddle не нужен. Lifetime — one-time price (Paddle умеет).

```
Подготовка (разово): продукты/цены в кабинете Paddle → price_id (pri_...)
  → BillingPlanPrice.providerPriceId; country price overrides — там же

checkout { method: 'paddle' } →
  сервер создаёт transaction (items: [{ price_id }], custom_data: { userId, planCode })
  → { type: 'redirect', url }
web: редирект на hosted checkout;  TMA (Android/Desktop): Telegram.WebApp.openLink(url)
  — оплата во внешнем браузере, юзер возвращается в TMA сам (рефетч по visibilitychange)

Вебхуки (Paddle-Signature = HMAC-SHA256 по `ts:rawBody`, окно реплея 15 мин):
  transaction.completed  → applySuccessfulPayment (юзер: custom_data → fallback по
                            subscription_id через providerSubscriptionId — продления
                            приходят без custom_data; период — их billing_period.ends_at)
  subscription.canceled  → период дохаживается
  adjustment.* (refund)  → revokeForRefund
```

- `cancelAutoRenew` для paddle: их API cancel (`effective_from: next_billing_period`) +
  локальное гашение сразу (вебхук продублирует — no-op).
- Discount-промокоды маппятся на Paddle Discounts (`discount_id`); free_period Paddle
  не касается — entitlement выдаём сами.
- Sandbox-окружение (`PADDLE_ENV=sandbox`) — полноценный e2e до боевого KYC.
- Готовый код (провайдер + вебхук + подпись/реплей) — в life-progress-tracker, 1:1.

### 6.5 Платформенные платежи (нативная мобилка, будущая фаза)

Если появится нативное приложение — Apple/Google обязывают продавать цифровую подписку
через IAP. Архитектура готова: ещё два адаптера.

```
Клиент покупает через StoreKit 2 / Play Billing → шлёт receipt/purchaseToken
POST /billing/iap/verify → серверная валидация → applySuccessfulPayment({ provider: 'apple_iap', ... })
Продления/рефанды: App Store Server Notifications V2 / Google RTDN → webhooks.js → тот же billingService
```

---

## 7. Безопасность и надёжность

1. **Вебхук ЮKassa не подписан** → re-fetch платежа из API перед применением (§6.3) +
   allowlist IP-подсетей.
2. **Идемпотентность везде**: `BillingEvent(provider, eventId) @unique` на входе
   (`processedAt` ставится только при успехе — упавшая обработка ретраится, а не отсекается),
   `Payment.providerPaymentId @unique` на применении. Повторная доставка = no-op.
3. **`pre_checkout_query` ≤ 10 сек**: обработчик не ходит в тяжёлые запросы — валидирует
   payload (userId существует, planCode активен, сумма совпадает с выставленной) и отвечает.
4. **Цены только из каталога на сервере**. Клиент передаёт `planCode`, никогда — сумму.
5. **Raw-body вебхуки (Tribute, Paddle) монтируются в `index.js` ДО `app.use(express.json())`**
   с `express.raw({ type: 'application/json' })` — ровно тот же паттерн, что действующий
   монтаж Better Auth (`app.all('/api/auth/{*any}', ...)` до json-парсера). Вебхук ЮKassa —
   обычный JSON, живёт в `routes/billing.js`. Все вебхуки — вне auth, под своим rate limit
   (паттерн `middleware/rateLimiter.js`).
6. **Секреты** (`YOOKASSA_SECRET_KEY`, `TRIBUTE_API_KEY`, `PADDLE_*`) — только на Railway;
   в логи не попадают, `Payment.meta` — без карточных данных.
7. **ФЗ-376**: автосписание — только после явного согласия; факт фиксируем
   (`recurrentConsentAt`), текст — в оферте на gymwithai.me. Отмена — в один тап из `/me`.
8. **Grace period 24ч** после `currentPeriodEnd` до фактического отключения — сглаживает
   лаги вебхуков и ретраев (`BILLING_GRACE_HOURS`).
9. **Гейт — на обеих сторонах**: `requirePremium` на API (LLM-роуты уже под LLM rate limit
   5 req/мин — requirePremium встаёт рядом) и `paywallGuard` в боте. Клиентский
   `PremiumGate` — UX, не безопасность.

---

## 8. Пошаговый план реализации

### Фаза 0 — организационная (общая с life-progress-tracker)

> Пошаговые инструкции — **GUIDE_PAYMENTS_ORG.md** в life-progress-tracker (треки R1–R6,
> A1–A9). Самозанятость, ABN, банк, аккаунты — одни на оба продукта; ниже только дельта
> AI Trainer.

**Трек RU (критический путь для фаз 3–4):**
- [ ] Самозанятость — общая (если уже оформлена для life-progress-tracker — готово).
      ⚠️ Лимит НПД 2,4 млн ₽/год — общий на все продукты, следить суммарно
- [ ] Публичная оферта на gymwithai.me: подписка, тарифы, блок про автосписания (ФЗ-376),
      порядок возврата. Лендинг с ценами уже есть — добавить страницу оферты + ссылку
- [ ] **Отдельный магазин ЮKassa под gymwithai.me** (у одного самозанятого может быть
      несколько магазинов) → тестовый `shopId`/`secretKey` → модерация → живые ключи
- [ ] Второй продукт-подписка в Tribute (или второй проект в их дашборде)

**Трек AU / Paddle (критический путь для фазы 5):**
- [ ] ABN/банк/Paddle-аккаунт — общие (см. GUIDE, A1–A4)
- [ ] Англоязычная страница продукта на gymwithai.me: описание, Terms, refund policy —
      Paddle ревьюит домен
- [ ] Продукты/цены AI Trainer в кабинете Paddle → `price_id` → `BillingPlanPrice.providerPriceId`;
      country price overrides — там же

### Фаза 1 — фундамент биллинга (код, ещё без денег) — ✅ сделано (июль 2026)

Порт из life-progress-tracker: `billingCore`/`billingService`/`pricing`/`provider/*`.
Адаптация: prisma-схема без `@map` (camelCase), Vitest вместо node:test, планы
week/month/lifetime (+ `currentPeriodEnd: null`), без триала, hard-гейт вместо LLM-гейта,
`User.telegramId` nullable.

**Бэкенд — сделано:**
- [x] Prisma: 7 моделей из §4 → `db push` применён к Neon, сид `server/scripts/seedBilling.js`
      (`npm run seed:billing`; планы week/month/lifetime, цены ru/default)
- [x] `services/billing/billingCore.js` — чистая логика (периоды/lifetime, активность+grace,
      регион, промокоды, machine рекуррентки) + 39 юнит-тестов Vitest
- [x] `billingService.js`: applySuccessfulPayment (идемпотентно, P2002→no-op) / isPremium /
      redeemPromo / resolveCheckoutAmount / cancelAutoRenew / cancelFromProvider /
      revokeForRefund / grantManual + хелперы рекуррентки для фазы 3.
      Lifetime: грант обнуляет `currentPeriodEnd`, активный lifetime поглощает периодные гранты,
      рефанд lifetime закрывает доступ сразу
- [x] `provider/index.js` + `mock.js` (`PAYMENT_PROVIDERS=mock` — весь paywall-флоу на деве)
- [x] Роуты `/billing/status|plans|checkout|promo/redeem|cancel` (+ authLimiter),
      `POST /admin/billing/grant` в `routes/admin.js` (гейт по ANALYTICS_SECRET)
- [x] `middleware/requirePremium.js` за `PREMIUM_GATING` — в каждом данные-роутере сразу
      после `auth` (exercises, workouts, stats, programs, progress, chat, insights, push);
      `AppError(status, code)` добавлен в errorHandler (клиент ветвится по `payload.code`)
- [x] `bot/paywallGuard.js`: `requireBotPremium(ctx)` (upsert юзера + проверка) в чате,
      фото-хэндлере и /program; кнопка «💎 Открыть тарифы» (web_app; в dev — plain link)
- [x] Аналитика: `paywall_shown / checkout_started / payment_succeeded / payment_refunded /
      promo_redeemed / subscription_canceled / subscription_expired / premium_granted`
- [x] Смоук на деве: гейт 403 → mock-покупка → доступ; периоды складываются; lifetime
      поглощает; discount −50% (redemption pending→applied) → 409 повторно; free_period +7д;
      admin grant; 401 на левом ключе

**Фронт — сделано:**
- [x] `useBillingStatus()`/`useBillingPlans()` + мутации checkout/promo/cancel
      (TanStack Query, `queryKeys.billing`)
- [x] `BillingGate` в `App.jsx` (редирект на `/paywall`; public: /login, /auth, /demo)
      + `PaywallPage` (lazy): свитчер неделя/месяц/lifetime (месяц featured), промокод,
      выбор метода при >1, `openInvoice`/`openTelegramLink`/redirect по типу ответа
- [x] Блок «Подписка» в `/me`: статус/дата/источник, отмена автопродления с ConfirmDialog
      (только локальные провайдеры), «продлить»/«оформить» → `/paywall`
- [x] 403 `PREMIUM_REQUIRED` в `utils/api.js` → инвалидация `queryKeys.billing` (гейт сам)
- [x] i18n `billing.*` (ru, включая карту кодов ошибок), Glass-токены; lint/build/тесты чистые
- [x] e2e в браузере: гейт → paywall → mock-оплата → приложение → блок подписки в `/me`

### Фаза 2 — Telegram Stars (первые живые деньги; без юрлица, покрывает iOS и не-RU)

- [ ] `provider/stars.js`: `createInvoiceLink` — месяц с `subscription_period: 2592000`
      (нативная подписка), неделя/lifetime разовые; `refundStarPayment`
- [ ] Проверить лимит суммы Stars-инвойса для lifetime (~12 000 ⭐); не влезает →
      lifetime только картой (скрыть метод)
- [ ] `bot/payments.js`: `pre_checkout_query` (≤10с) + `successful_payment` →
      `applySuccessfulPayment` (включая рекуррентные апдейты Stars-подписки)
- [ ] Checkout `method: 'stars'` (с discount-промокодом в сумме) + `openInvoice`,
      `invoiceClosed` → рефетч
- [ ] Напоминание за сутки до конца недельного периода через `NotificationJob`-очередь
      с кнопкой «продлить»
- [ ] На TMA-iOS paywall показывает **только** Stars (`Telegram.WebApp.platform`)
- [ ] e2e на себе: покупка week/month, промокод, рефанд

### Фаза 3 — ЮKassa на web/PWA: RU-подписка с первого дня (ждёт RU-трек фазы 0)

- [ ] Порт `provider/yookassa.js` из life-progress-tracker (create/get/recurring, Idempotence-Key,
      `save_payment_method` для week/month; `YOOKASSA_API_URL` — переопределение для стаба;
      чек самозанятого `YOOKASSA_RECEIPT=on` — нужен email покупателя, у web-юзеров есть)
- [ ] Порт `webhooks.js`-ветки ЮKassa: журнал → **re-fetch платежа из API** → apply;
      `payment.succeeded` / `refund.succeeded`
- [ ] `scheduler/subscriptionRenewal.js`: чистая `planRenewalAction()` (окно 24ч, ретраи,
      3 неудачи → expired) + запуск в `index.js` независимо от бота
- [ ] Dunning-уведомления через notifier/очередь: бот / Web Push / email (web-only)
- [ ] `/billing/return` (SPA, поллинг), ФЗ-376-текст на paywall'е
- [ ] Операционка: боевые ключи на Railway, вебхук в ЛК (`payment.succeeded`,
      `payment.canceled`, `refund.succeeded`), автоотправка чеков НПД, тестовый прогон

### Фаза 4 — Tribute: RU-подписка внутри Telegram (ждёт самозанятость)

- [ ] Порт `provider/tribute.js` + вебхука (raw body ДО `express.json()`, eventId =
      `имя:subscription_id:expires_at`, период — их `expires_at`, юзер по
      `telegram_user_id → User.telegramId`)
- [ ] Маппинг `period → planCode` (weekly/monthly; lifetime через Tribute не продаём)
- [ ] Фронт: `{ type: 'telegram_link' }` → `openTelegramLink`; «управлять в боте Tribute» в `/me`
- [ ] Операционка: продукты в дашборде → `TRIBUTE_SUBSCRIPTION_URL_*`, API key, webhook URL;
      сверить на первом реальном событии имена полей/единицы суммы/кодировку подписи

### Фаза 5 — Paddle: не-RU карты (код — хоть сейчас, live — после AU-трека)

- [ ] Порт `provider/paddle.js` + вебхука (подпись `ts:rawBody`, окно реплея, дедуп по
      `event_id`, fallback-маппинг юзера по `subscription_id`)
- [ ] Lifetime как one-time price; week/month — подписки
- [ ] Операционка: sandbox → `pri_...` в сид, default payment link, notification destination
      (`transaction.completed`, `subscription.canceled`, `adjustment.updated`), country
      overrides, `PADDLE_ENV=live` после KYC

### Фаза 6 — платформенные платежи и оптимизации (по сигналу спроса)

- [ ] Нативная мобилка: адаптеры `apple_iap` / `google_play`, `POST /billing/iap/verify`,
      вебхуки ASN V2 / RTDN
- [ ] Опционально при масштабе: CloudPayments вместо ЮKassa-рекуррентки, Stripe AU рядом
      с Paddle — благодаря provider-слою это замена одного адаптера

---

## 9. Env-переменные

```bash
# server/.env (+ server/.env.example)
PAYMENT_PROVIDERS=stars              # stars,yookassa,tribute,paddle — фиче-флаги методов (паттерн AUTH_PROVIDERS)
PREMIUM_GATING=off                   # off|on — гейтинг LLM-фич отдельно от продажи
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_RECEIPT=off                 # on = слать receipt (чеки самозанятого, нужен email)
# YOOKASSA_API_URL=...               # переопределение для тестов/стаба
TRIBUTE_API_KEY=...                  # ключ API Tribute = ключ подписи trbt-signature
TRIBUTE_SUBSCRIPTION_URL_WEEK=...    # deep links продуктов из дашборда Tribute
TRIBUTE_SUBSCRIPTION_URL_MONTH=...
PADDLE_ENV=sandbox                   # sandbox | live
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
BILLING_GRACE_HOURS=24
```

---

## 10. Открытые вопросы

1. **Lifetime vs год.** Лендинг продаёт lifetime 15 000 ₽, BRD упоминает годовую подписку.
   Lifetime проще (нет продлений) и уже публично обещан — берём его; годовой план можно
   добавить позже (строка каталога, без миграций).
2. **Лимит Stars-инвойса для lifetime** (~12 000 ⭐) — проверить максимум Telegram;
   если не влезает, lifetime продаём только картой (ЮKassa/Paddle), метод скрываем.
3. **Ценовая матрица по регионам** — `ru` зафиксирована лендингом; заполнить `default`
   (BRD: аудитория готова платить $10–20/мес → месяц ~$14.99? неделя ~$4.99?
   lifetime ~$99?). Корзины сверх `ru`/`default` — по факту аудитории.
4. ~~Триал~~ — решено (июль 2026): триала нет, бесплатного не даём. Вернуть триал можно
   одной функцией `startTrial` (референс в life-progress-tracker), если конверсия без
   него окажется мёртвой.
5. ~~Границы free tier~~ — решено (июль 2026): hard paywall, free tier'а нет.
6. **Grandfathering текущих юзеров** при включении `PREMIUM_GATING=on`: активной базе —
   бесплатный период через `admin/billing/grant` или промокод. Решить длительность
   перед включением.
7. ~~Бесплатные сканы~~ — решено (июль 2026): нет, скан тренажёра только по подписке.
8. **Лимит НПД 2,4 млн ₽/год общий** на life-progress-tracker + AI Trainer — при росте
   выручки решать переход (ИП/УСН) заранее, суммарно по обоим продуктам.
9. **Комиссия Tribute** (~10% против ~3% ЮKassa) — цена за «подписку под ключ» в Telegram;
   при заметном объёме TMA-RU можно перевешивать трафик на web-paywall ссылкой из TMA.
10. **Web-only юзеры**: dunning и «подписка кончилась» — Web Push + email (mailer.js/Resend
    уже в проде). Проверить, что у email-юзеров без верификации письма уходят корректно.
