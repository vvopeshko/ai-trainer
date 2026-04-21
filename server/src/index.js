import express from 'express'
import cors from 'cors'
import { createBot } from './bot/index.js'
import apiRoutes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'

// Настройка сериализации BigInt в JSON: Prisma возвращает telegramId как BigInt,
// а стандартный JSON.stringify на нём падает с TypeError.
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const PORT = Number(process.env.PORT) || 3001
const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

app.use('/api/v1', apiRoutes)

app.use(errorHandler)

// ─── Запуск ─────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`)
})

// Telegram-бот запускается параллельно Express при наличии BOT_TOKEN.
// В dev без токена сервер всё равно работает — можно тестировать API по dev-bypass.
let bot = null
if (process.env.BOT_TOKEN) {
  bot = createBot(process.env.BOT_TOKEN)
  bot.launch().then(() => console.log('[bot] launched'))
} else {
  console.warn('[bot] BOT_TOKEN not set — bot is disabled')
}

// Graceful shutdown.
function shutdown(signal) {
  console.log(`[app] ${signal} — shutting down`)
  if (bot) bot.stop(signal)
  server.close(() => process.exit(0))
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
