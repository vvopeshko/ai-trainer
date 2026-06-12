import rateLimit from 'express-rate-limit'

// Ключ — Authorization header (уникален для каждого юзера).
// Все /api/v1 запросы требуют Authorization, поэтому fallback на 'anonymous'.
const keyGenerator = (req) => req.header('authorization') || 'anonymous'

// Глобальный лимит: 100 req/мин на юзера.
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
})

// Строгий лимит для LLM-эндпоинтов: 5 req/мин на юзера.
export const llmLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  validate: { ip: false },
})
