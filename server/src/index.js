import express from 'express'
import cors from 'cors'
import { toNodeHandler } from 'better-auth/node'
import { auth as betterAuth } from './auth/index.js'
import { FRONTEND_URLS } from './utils/origins.js'
import { createBot } from './bot/index.js'
import { setBot, setBotUsername } from './bot/notifier.js'
import { startScheduler, stopScheduler } from './scheduler/index.js'
import { startRetention, stopRetention } from './scheduler/retention.js'
import { registerJobs } from './scheduler/jobs.js'
import apiRoutes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { globalLimiter } from './middleware/rateLimiter.js'
import prisma from './utils/prisma.js'

// BigInt → JSON monkey-patch.
//
// Prisma возвращает telegramId как BigInt, а стандартный JSON.stringify на нём
// падает с TypeError. Патч конвертирует BigInt в строку при сериализации.
// Альтернатива — JSON.stringify replacer в каждом res.json() — менее практична.
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const PORT = Number(process.env.PORT) || 3001
const app = express()

// Railway ставит бэкенд за один прокси-хоп: без trust proxy req.ip — это IP
// прокси, и глобальный rate limiter лимитировал бы всех юзеров одним бакетом.
app.set('trust proxy', 1)

app.use(
  cors({
    origin: FRONTEND_URLS, // список: кастомный домен + vercel.app (см. utils/origins.js)
    credentials: true,
    // Клиент Better Auth читает bearer-токен из заголовка ответа —
    // без exposedHeaders браузер его молча спрячет (net::ERR_FAILED без ошибок)
    exposedHeaders: ['set-auth-token'],
  }),
)

// Better Auth (web-авторизация): монтаж строго ДО express.json() —
// BA сам читает body своих запросов. Без BETTER_AUTH_SECRET выключен.
if (betterAuth) {
  app.all('/api/auth/{*any}', toNodeHandler(betterAuth))
}

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

app.use('/api/v1', globalLimiter)
app.use('/api/v1', apiRoutes)

app.use(errorHandler)

// ─── Запуск ─────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`)
})

// Telegram-бот запускается параллельно Express при наличии BOT_TOKEN.
// В dev без токена сервер всё равно работает — можно тестировать API по dev-bypass.
// Nota bene: в Telegraf v4 bot.launch() резолвится только при остановке бота,
// поэтому факт запуска подтверждаем через getMe() до вызова launch().
// BOT_DISABLED=1 — сервер без Telegraf-поллинга: локальные смоуки с реальным
// BOT_TOKEN (нужен для HMAC виджета/initData) не конфликтуют с прод-ботом,
// который держит getUpdates на том же токене.
let bot = null
if (process.env.BOT_TOKEN && process.env.BOT_DISABLED !== '1') {
  bot = createBot(process.env.BOT_TOKEN)
  setBot(bot) // даём notifier ссылку на бота для проактивных сообщений
  bot.telegram
    .getMe()
    .then((me) => {
      setBotUsername(me.username) // для t.me-ссылок (handoff из мини-аппа, фаза 2.2)
      console.log(`[bot] launched as @${me.username}`)
    })
    .catch((err) => console.error('[bot] failed to connect:', err.message))
  // Упавший long polling иначе оставляет процесс жить с мёртвым ботом
  // (health-check зелёный, бот молчит). exit(1) → Railway перезапустит.
  // NB: в Telegraf v4 launch() резолвится при ОСТАНОВКЕ бота — exit только в catch.
  bot.launch().catch((err) => {
    console.error('[bot] crashed:', err)
    process.exit(1)
  })

  // Шедулер проактивных сообщений запускается только при наличии бота
  // (без него notify() некуда слать).
  registerJobs() // weekly-сводка + напоминания (фаза 3)
  startScheduler()
} else {
  console.warn('[bot] BOT_TOKEN not set — bot is disabled')
}

// Суточная чистка тех-таблиц — независима от бота (это обслуживание БД).
startRetention()

// Graceful shutdown.
function shutdown(signal) {
  console.log(`[app] ${signal} — shutting down`)
  stopScheduler()
  stopRetention()
  if (bot) bot.stop(signal)
  server.close(() => {
    // Закрываем пул соединений Prisma после того, как Express дообработал запросы
    prisma.$disconnect().finally(() => process.exit(0))
  })
  // Keep-alive соединения могут держать server.close() бесконечно — force-exit.
  // unref(): таймер не мешает процессу завершиться раньше штатно.
  setTimeout(() => {
    console.error('[app] forced exit: shutdown timed out after 10s')
    process.exit(1)
  }, 10_000).unref()
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

// Незамеченный rejection (fire-and-forget промис без .catch) по умолчанию
// роняет весь процесс (Node 15+). Логируем вместо падения: единичный забытый
// .catch в track()/notify() не должен убивать API и бота.
process.on('unhandledRejection', (reason) => {
  console.error('[app] unhandled rejection:', reason)
})
