import { Telegraf } from 'telegraf'

// Создание Telegraf-бота. Запускается из server/src/index.js параллельно Express.
// Команды задаются через /setcommands у @BotFather из server/src/bot/commands.txt.

export function createBot(token) {
  const bot = new Telegraf(token)
  const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173'

  bot.start(async (ctx) => {
    await ctx.reply(
      `Привет, ${ctx.from.first_name}! 👋\n\n` +
        'Я AI-тренер. Помогу составить программу, отвечу на вопросы про технику и подберу упражнение, если сфоткаешь тренажёр в зале.\n\n' +
        'Открой мини-апп, чтобы начать тренировку:',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🏋️‍♂️ Открыть AI Trainer', web_app: { url: webAppUrl } }]],
        },
      },
    )
  })

  bot.command('workout', async (ctx) => {
    await ctx.reply('Открываю тренировку…', {
      reply_markup: {
        inline_keyboard: [[{ text: '🏋️‍♂️ Открыть тренировку', web_app: { url: webAppUrl } }]],
      },
    })
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
