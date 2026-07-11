import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

// Глобальный лимит: 100 req/мин по IP.
// Стоит ДО telegramAuth, поэтому заголовку Authorization доверять нельзя:
// каждый новый (в т.ч. мусорный) заголовок создавал бы отдельный бакет
// и обнулял лимит. req.ip корректен за прокси Railway благодаря
// app.set('trust proxy', 1) в index.js.
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

// Строгий лимит для LLM-эндпоинтов: 5 req/мин на юзера.
// Монтируется ПОСЛЕ telegramAuth — ключ = проверенный userId. Ключевать по
// заголовку нельзя: initData обновляется при каждом открытии мини-аппа
// (и все валидны 24ч), ротация обходила бы лимит.
export const llmLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
