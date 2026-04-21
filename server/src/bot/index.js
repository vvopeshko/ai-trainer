import { Telegraf } from 'telegraf'

// Создание Telegraf-бота. Запускается из server/src/index.js параллельно Express.
// Команды задаются через /setcommands у @BotFather из server/src/bot/commands.txt.

export function createBot(token) {
  const bot = new Telegraf(token)
  const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173'
  // Telegram разрешает web_app кнопки только с https://. В dev с localhost
  // отдаём просто ссылку текстом — кнопка заработает после деплоя на Vercel.
  const canUseWebAppButton = webAppUrl.startsWith('https://')

  bot.start(async (ctx) => {
    const base =
      `Привет, ${ctx.from.first_name}! 👋\n\n` +
      'Я AI-тренер. Помогу составить программу, отвечу на вопросы про технику и подберу упражнение, если сфоткаешь тренажёр в зале.'

    if (canUseWebAppButton) {
      await ctx.reply(`${base}\n\nОткрой мини-апп, чтобы начать тренировку:`, {
        reply_markup: {
          inline_keyboard: [[{ text: '🏋️‍♂️ Открыть AI Trainer', web_app: { url: webAppUrl } }]],
        },
      })
    } else {
      await ctx.reply(
        `${base}\n\n(dev) открой мини-апп в браузере: ${webAppUrl}\n` +
          'Кнопка запуска из чата появится после деплоя на Vercel.',
      )
    }
  })

  bot.command('workout', async (ctx) => {
    if (canUseWebAppButton) {
      await ctx.reply('Открываю тренировку…', {
        reply_markup: {
          inline_keyboard: [[{ text: '🏋️‍♂️ Открыть тренировку', web_app: { url: webAppUrl } }]],
        },
      })
    } else {
      await ctx.reply(`(dev) открой в браузере: ${webAppUrl}/workout`)
    }
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'AI Trainer умеет:\n' +
        '• составлять программу под твой уровень и оборудование\n' +
        '• логировать тренировки в зале\n' +
        '• подбирать упражнение по фото тренажёра\n' +
        '• отвечать на вопросы по технике\n\n' +
        'Жми /start, чтобы открыть мини-апп.',
    )
  })

  bot.catch((err, ctx) => {
    console.error('[bot] error in update', ctx.update?.update_id, err)
  })

  return bot
}
