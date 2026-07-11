# Сервис уведомлений AI Trainer (durable-очередь + Web Push)

**Статус:** реализовано (2026-07-12), выкатывается через feature-флаг `NOTIFICATION_QUEUE`.

Архитектура адаптирована из проверенного в проде сервиса уведомлений Flamy
(`../daily balancer/life-progress-tracker/CDX_NOTIFICATION_SERVICE_ARCHITECTURE.md`).

## 1. Назначение

Планирование, формирование, надёжная доставка и аудит проактивных сообщений тренера:

- не терять уведомления при рестарте/деплое Railway;
- не создавать дубли при нескольких процессах;
- учитывать локальное время юзера (timezone-first + catch-up);
- повторять временные ошибки Telegram/Web Push/сети с backoff;
- **не вызывать LLM повторно при retry** готового сообщения;
- доставлять юзерам без Telegram через **Web Push** (PWA) — раньше они были вне рассылок;
- объяснять каждый пропуск сохранённым статусом;
- безопасный shadow-rollout и мгновенный rollback флагом.

Реализовано внутри текущего Express-бэкенда. Источник правды и durable-очередь —
PostgreSQL (Neon). Redis/BullMQ не используются.

## 2. Поток

```text
node-cron: каждую минуту (scheduler/notificationService.js)
   ├─ Planner  (notificationPlanner.js)  — due-расчёт по TZ + catch-up
   │      createMany(skipDuplicates) → NotificationJob
   └─ Worker   (notificationWorker.js)
          stale locks → CAS-claim → render (сохранить текст) → deliver
                                   Telegram (notify)  |  Web Push (webPushService)
                                                            ↓
                                                     PWA service worker (src/sw.js)
```

## 3. Типы уведомлений v1

| type | Триггер | periodKey | Канал |
|---|---|---|---|
| `weekly` | planner: вс 19:00 локально, catch-up 24ч | ISO-неделя `2026-W28` | telegram / web_push |
| `post_workout` | `enqueueNotification()` из finish-хука workoutController | `workoutId` | telegram / web_push |

Канал выбирается при создании job и фиксируется: `telegramId` → `telegram`, иначе
(при включённом VAPID и наличии подписок) → `web_push`. Канал не входит в unique-ключ —
привязка Telegram внутри окна не создаёт второй сводки за период.

**`reminder` («Готов вернуться?») остаётся на legacy-шедулере** (telegram-only,
почасовой тик + NotificationLog) — кандидат на миграцию следующим шагом.

## 4. Модель данных

`NotificationJob` (см. schema.prisma): state machine
`pending → rendering → sending → sent`, ветки `retry / failed / skipped`;
`@@unique([type, recipientKey, periodKey])`; `payload` (snapshot + pushTitle/url/buttons),
`renderedText`, `attempts/maxAttempts(6)/nextAttemptAt`, `lockedAt/lockedBy` (lease 10 мин),
`providerRef`, `errorCode/errorMessage` (обрезка 500 симв.).

`PushSubscription`: endpoint (unique) + p256dh/auth, несколько устройств на юзера,
404/410 от push service → автоудаление.

## 5. Идемпотентность

- **Планирование:** unique-ключ + `createMany(skipDuplicates)` — N инстансов создают одну строку.
- **Claim:** optimistic CAS — `updateMany WHERE id AND status AND lockedAt` по прочитанным
  значениям; побеждает один worker. Протухшие locks (>10 мин) → retry.
- **Мост с legacy:** перед первой доставкой worker клеймит `NotificationLog`
  (kind=type, periodKey) — включение очереди не продублирует отправленное legacy-шедулером
  и наоборот. ⚠️ Проверка ТОЛЬКО на первой попытке (`attempts <= 1`): на ретраях клейм уже
  собственный (найдено смоуком — иначе job навсегда скипался после первой неудачи).
- **Доставка:** at-least-once; `sent` для Web Push = «push service принял», не показ.

## 6. Retry policy

Backoff 1 → 5 → 15 → 60 → 180 мин, максимум 6 попыток. Классификация
(`classifyDeliveryError`): tg 403/chat not found → permanent; tg 429 → retry через
`retry_after`; 5xx/сеть → retry; исчезли все push-подписки → permanent; LLM-фейл —
не ошибка доставки (рендер деградирует до числовой сводки).

## 7. Рендер

`renderWeeklySummary` / `renderPostWorkoutSummary` (services/aiTrainer) — общие для
очереди и legacy-пути: числа кодом, LLM только формулирует наблюдение, деградация без AI.
Возвращают `{ html, pushTitle, pushBody, url, buttons }` или `{ skip: code }`
(`digest_disabled`, `no_activity`, `empty_workout`). Worker сохраняет результат в job
до доставки — **retry не вызывает LLM повторно**.

Telegram получает полный HTML + inline-кнопки; Web Push — короткий title + наблюдение
и deep link (`/progress`), который SW открывает только внутри своего origin.

## 8. Флаги и env

| Переменная | Значение |
|---|---|
| `NOTIFICATION_QUEUE` | `off` (default) — только legacy; `shadow` — planner создаёт `skipped:SHADOW_MODE`, шлёт legacy; `on` — очередь доставляет, legacy weekly подавлен |
| `NOTIFICATION_WORKER` | `off` — аварийная пауза доставки (jobs копятся) |
| `NOTIFICATION_BATCH_SIZE` / `NOTIFICATION_CONCURRENCY` | batch claim (20) / параллелизм (5, cap 10) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push; без ключей канал web_push выключен |

Rollback: `NOTIFICATION_QUEUE=off` — legacy-шедулер снова шлёт weekly напрямую,
недоставленные jobs остаются в таблице как аудит.

## 9. Наблюдаемость

- Логи: `[notifications][planner] users=N due=N created=N`, `[notifications][worker] claimed=N`,
  `[notifications] job=<id> type=<t> status=sent|retry|failed|skipped code=<c>`.
- `GET /api/v1/admin/notifications?key=ANALYTICS_SECRET` — счётчики по статусам, самый
  старый queued job, последние 20 failed/skipped (payload/renderedText не раскрываются).
- Retention: терминальные jobs (sent/skipped/failed) удаляются через 60 дней (scheduler/retention.js).

## 10. Web Push (фронт)

- SW: `src/sw.js` (vite-plugin-pwa `injectManifest`) — precache + runtime-кэши PWA +
  `push`/`notificationclick` хендлеры; только web-платформа, Mini App без SW.
- Подписка: `/me` → «Уведомления» → разрешение → `pushManager.subscribe` (VAPID public key
  с `GET /api/v1/push/key`) → `POST /api/v1/push/subscribe`. Отписка — тумблер там же.
- iOS: push только в установленном PWA (standalone, iOS 16.4+) — в браузере показывается
  подсказка об установке.

## 11. Активация

1. Railway: `VAPID_*` (сгенерировать `npx web-push generate-vapid-keys`), `NOTIFICATION_QUEUE=shadow`.
2. Понаблюдать 1–2 дня: `admin/notifications` — jobs создаются `skipped:SHADOW_MODE`, legacy шлёт.
3. `NOTIFICATION_QUEUE=on` — очередь доставляет; мост NotificationLog защищает от дублей на переключении.
4. Проверить: воскресная weekly в Telegram; post_workout после тренировки; push на подписанном
   web-устройстве (`/me` → включить уведомления).

## 12. Известные ограничения / следующие шаги

1. `reminder` вне очереди (legacy, telegram-only) — мигрировать следующим.
2. Доставка at-least-once; Web Push `sent` ≠ показ юзеру.
3. Канал фиксируется при создании: fallback telegram → web_push после permanent не реализован.
4. Optimistic CAS вместо `FOR UPDATE SKIP LOCKED` — достаточно до заметной конкуренции.
5. Алертов нет — только логи и admin endpoint.
6. Email-канал предусмотрен строкой `channel`, адаптер не реализован (mailer уже есть).
