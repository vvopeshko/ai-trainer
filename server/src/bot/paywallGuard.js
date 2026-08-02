import prisma from '../utils/prisma.js'
import { isPremium } from '../services/billing/billingService.js'
import { track } from '../utils/analytics.js'

// Paywall-гейт бота (product/ARCHITECTURE_PAYMENTS.md §3): API закрыт
// requirePremium, но LLM-хэндлеры бота — отдельный канал без HTTP-мидлвар.
// Ставится в начало каждого LLM-хэндлера (чат, фото, /program).

// Upsert юзера по ctx.from — общий для всех хэндлеров бота.
// Не find+create: параллельные апдейты от одного юзера гоняются и ловят P2002.
export function upsertBotUser(ctx) {
  const telegramId = BigInt(ctx.from.id)
  return prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: {
      telegramId,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name ?? null,
      username: ctx.from.username ?? null,
      languageCode: ctx.from.language_code ?? null,
    },
  })
}

// Возвращает юзера, если доступ есть (подписка активна или гейтинг выключен),
// иначе отвечает paywall-сообщением и возвращает null — хэндлер выходит.
export async function requireBotPremium(ctx) {
  const user = await upsertBotUser(ctx)
  if (process.env.PREMIUM_GATING !== 'on') return user
  if (await isPremium(user.id)) return user

  track(user.id, 'paywall_shown', { surface: 'bot' })

  const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173'
  const paywallUrl = `${webAppUrl}/paywall`
  const text =
    '🔒 AI-тренер доступен по подписке.\n\n' +
    'Оформи её в приложении — и я снова смогу отвечать на вопросы, ' +
    'собирать программы и разбирать тренажёры по фото.'

  // web_app кнопки Telegram требуют https:// — в dev отдаём ссылку текстом
  if (webAppUrl.startsWith('https://')) {
    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [[{ text: '💎 Открыть тарифы', web_app: { url: paywallUrl } }]],
      },
    })
  } else {
    await ctx.reply(`${text}\n\n(dev) тарифы: ${paywallUrl}`)
  }
  return null
}
