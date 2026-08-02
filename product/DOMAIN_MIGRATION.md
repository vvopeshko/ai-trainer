# Переезд доменов: аппка → app.gymwithai.me, корень → сайт + блог

**Статус:** план (июль 2026). Решения приняты: сайт+блог на **Astro** в `site/` того же репо;
разлогин web/PWA-пользователей при переезде **принимаем** (без токен-handoff между доменами).

## Целевая картина

| Сейчас | Станет |
|---|---|
| `gymwithai.me/` — SPA аппки (Vercel, репо-корень) | `gymwithai.me/` — маркетинговый сайт + `/blog` (Astro, второй Vercel-проект из `site/`) |
| `gymwithai.me/landing.html` — статический лендинг | лендинг становится главной страницей сайта |
| PWA/web-логин на origin `gymwithai.me` | аппка целиком на `app.gymwithai.me` |

Бэкенд (Railway) и почта (Resend, `noreply@gymwithai.me`) не переезжают.

## Точки привязки к домену (аудит кода)

- `FRONTEND_URL` (список, первый — канонический) → CORS + `trustedOrigins` Better Auth +
  ссылки в письмах + OAuth-редиректы. Код `server/src/utils/origins.js` уже поддерживает
  несколько origin'ов — правок не нужно, только env.
- `WEBAPP_URL` → ссылки бота / inline-клавиатуры / Menu Button.
- BotFather `/setdomain` → Telegram Login Widget. **Один домен** — старый отвалится сразу
  после переключения.
- PWA: SW со scope `/`, precache; установленные приложения и push-подписки привязаны
  к origin `gymwithai.me`.
- Web-логин: bearer-токен в localStorage — per-origin, на новый домен не переносится.
- `public/landing.html` + `gym-machine.jpg` — живут в бандле аппки, исключены из precache
  через `globIgnores` в `vite.config.js`.
- Mini App от домена не зависит (initData), переезжает сменой env + Menu Button.

## Фаза 1 — app.gymwithai.me параллельно (ничего не ломаем) — ✅ 2026-07-24

- [x] Vercel (проект аппки): добавить домен `app.gymwithai.me`; DNS CNAME.
- [x] Railway: `FRONTEND_URL=https://app.gymwithai.me,https://gymwithai.me,https://ai-trainer-ebon-one.vercel.app`
      (новый — канонический, старый остаётся для CORS на переходный период).
- [x] Смоук на `app.*`: health 200, SPA и email-форма открываются, CORS пускает
      app.*/старый домен и режет чужой origin.

## Фаза 2 — Telegram → app.*

- [x] Railway: `WEBAPP_URL=https://app.gymwithai.me` (2026-07-24; до этого указывал
      на `ai-trainer-ebon-one.vercel.app`).
- [x] BotFather: Menu Button → новый URL; `/setdomain` → `app.gymwithai.me`.
- [x] Смоук: Login Widget рендерится на `app.gymwithai.me/login` (2026-07-24).

## Фаза 3+4 — корневой сайт (одно переключение DNS)

Сайт: Astro в `site/`, отдельный Vercel-проект (root directory = `site`), домены
`gymwithai.me` + `www.gymwithai.me`.

Состав сайта (✅ каркас готов, июль 2026):
- [x] Главная = портированный `landing.html` → `site/public/index.html` (CTA ведут на
      `app.gymwithai.me`, добавлены SEO/OG-теги и ссылка на блог в футере).
- [x] `/blog` — content collections (markdown в `site/src/content/blog/`), RSS
      (`/rss.xml`), sitemap (`/sitemap-index.xml`, главная через `customPages`),
      `robots.txt`, OG-теги. Первый пост опубликован.
- [x] **Kill-switch SW** в `site/public/sw.js`: самоуничтожающийся воркер
      (`registration.unregister()` + `caches.delete(...)`) — иначе установленные PWA
      offline-first вечно показывают закэшированный app shell со старого origin.
- [x] Standalone-детект на главной: `matchMedia('(display-mode: standalone)')` →
      `location.replace('https://app.gymwithai.me/')`.
- [x] 301-редиректы app-путей в `site/vercel.json` с сохранением пути:
      `/workout`, `/progress`, `/library`, `/me`, `/paywall`, `/login`, `/demo`,
      `/summary/:id`, `/program/:id`, `/auth/*` → `app.gymwithai.me/<path>`;
      `/landing.html` → `/`.

Переключение — ✅ 2026-07-30:
- [x] Сайт проверен на `gymwithai-site.vercel.app` (страницы, редиректы, SW).
- [x] Домены `gymwithai.me`/`www` перенесены на Vercel-проект `gymwithai-site`.
- [x] Смоук по проду: корень 200 (лендинг), `/blog`/RSS/sitemap/robots 200,
      `/sw.js` отдаёт kill-switch, app-пути 308 → `app.*` с сохранением пути и query,
      `www` 308 → апекс, аппка на `app.*` 200.

Грабли переключения (важно для будущих переездов):
1. При переносе домена между Vercel-проектами апекс **выпал из обоих проектов**,
   и DNS-запись апекса пропала — корень не резолвился, пока домен не добавили
   в проект сайта заново (Add Existing) и не создали A-запись в Cloudflare
   (`@` → `216.198.79.1`, DNS only).
2. Vercel по умолчанию сделал основным `www`, а апекс — редиректом. Это ломает
   kill-switch: браузер проверяет обновление SW строго по
   `https://gymwithai.me/sw.js` и **не принимает редирект** на запрос SW-скрипта —
   старый precache остался бы навсегда. Правильно: апекс — Production,
   `www` → 308 на апекс.

Принято: web/PWA-юзеров разлогинит, push-подписки старого origin умрут (сервер сам чистит
их по 404/410 при доставке) — пользователи логинятся и включают уведомления заново на `app.*`.

## Фаза 5 — зачистка (через 2–4 недели)

- [ ] Убрать `landing.html`, `gym-machine.jpg` из `public/` аппки + `globIgnores`
      в `vite.config.js`.
- [ ] Убрать `https://gymwithai.me` из `FRONTEND_URL` (закрыть CORS для корня).
- [ ] Обновить доки: ARCHITECTURE.md, ARCHITECTURE_WEB_AUTH.md, NOTIFICATIONS.md (origin
      push-подписок), CLAUDE.md, `.env.example`, UPDATES.md.

## Порядок критичен

1 → 2 → 3+4 → 5. Корень нельзя отдавать сайту, пока канонический URL и Telegram не
переехали на `app.*` и kill-switch SW не готов в сборке сайта.
