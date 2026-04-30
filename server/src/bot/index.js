import { Telegraf, Scenes, session } from 'telegraf'
import { identifyMachine } from '../services/aiTrainer/identifyMachine.js'
import { generateProgramScene } from './scenes/generateProgram.js'
import prisma from '../utils/prisma.js'

// Создание Telegraf-бота. Запускается из server/src/index.js параллельно Express.
// Команды задаются через /setcommands у @BotFather из server/src/bot/commands.txt.

export function createBot(token) {
  const bot = new Telegraf(token)
  const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173'
  const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null
  // Telegram разрешает web_app кнопки только с https://. В dev с localhost
  // отдаём просто ссылку текстом — кнопка заработает после деплоя на Vercel.
  const canUseWebAppButton = webAppUrl.startsWith('https://')

  // ─── Session + Scenes ────────────────────────────────────────────
  const stage = new Scenes.Stage([generateProgramScene])
  bot.use(session())
  bot.use(stage.middleware())

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
        'Команды:\n' +
        '/program — составить программу тренировок\n' +
        '/workout — открыть тренировку\n' +
        '/start — открыть мини-апп',
    )
  })

  bot.command('program', (ctx) => ctx.scene.enter('generate-program'))

  // ─── Распознавание тренажёра по фото ──────────────────────────
  // Telegram присылает массив PhotoSize[] — от маленького превью до полного размера.
  // Берём последний элемент — это фото в максимальном разрешении.
  //
  // Поток:
  // 1. sendChatAction('typing') — показать "печатает..." пока ждём LLM (~3-8 сек)
  // 2. Скачать фото из Telegram через getFileLink → fetch → Buffer → base64
  // 3. Найти или создать юзера в БД (для identifyMachine нужен userId)
  // 4. Вызвать сервис identifyMachine
  // 5. Сформировать и отправить ответ

  bot.on('photo', async (ctx) => {
    try {
      // ─── 0. Проверка доступа ──────────────────────────────────
      // Пока фича в тесте — только админ может распознавать тренажёры.
      // Убрать эту проверку, когда откроем для всех.
      if (adminId && ctx.from.id !== adminId) {
        await ctx.reply('🚧 Распознавание тренажёров пока в разработке. Скоро заработает!')
        return
      }

      // ─── 1. Показать индикатор "печатает..." ──────────────────
      // Без этого пользователь 5-10 секунд смотрит в пустой чат.
      // sendChatAction автоматически пропадёт, когда отправим ответ.
      await ctx.sendChatAction('typing')

      // ─── 2. Скачать фото ─────────────────────────────────────
      // ctx.message.photo — массив PhotoSize[], отсортирован по размеру.
      // Последний элемент — максимальное разрешение (обычно ~1280px).
      const photos = ctx.message.photo
      const largest = photos[photos.length - 1]

      // getFileLink возвращает URL вида https://api.telegram.org/file/bot.../photos/...
      const fileLink = await ctx.telegram.getFileLink(largest.file_id)

      // Скачиваем файл в Buffer через fetch (Node 18+ имеет встроенный fetch)
      const response = await fetch(fileLink.href)
      const buffer = Buffer.from(await response.arrayBuffer())
      const imageBase64 = buffer.toString('base64')

      // ─── 3. Найти юзера в БД ─────────────────────────────────
      // telegramAuth middleware работает только для API-роутов.
      // В боте у нас нет middleware — ищем юзера напрямую по telegramId.
      // Если юзер не найден (не заходил в мини-апп), создаём базовую запись.
      const telegramId = BigInt(ctx.from.id)
      let user = await prisma.user.findUnique({ where: { telegramId } })

      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name ?? null,
            username: ctx.from.username ?? null,
            languageCode: ctx.from.language_code ?? null,
          },
        })
      }

      // ─── 4. Вызвать сервис распознавания ──────────────────────
      const result = await identifyMachine(user.id, imageBase64, {
        telegramFileId: largest.file_id,
      })

      // ─── 5. Сформировать и отправить ответ ─────────────────────
      if (!result.success) {
        await ctx.reply(`🤔 ${result.error}`)
        return
      }

      if (result.confidence < 0.5) {
        await ctx.reply(
          `🤔 Не совсем уверен, но похоже на: *${result.machineName}*\n\n` +
            `${result.description}\n\n` +
            '_Попробуй сфоткать тренажёр ближе или с другого ракурса для более точного результата._',
          { parse_mode: 'Markdown' },
        )
        return
      }

      // Формируем текст ответа с упражнениями
      let text =
        `🏋️ *${result.machineName}*\n` +
        `_(${result.machineNameEn})_\n\n` +
        `${result.description}\n\n` +
        `*Упражнения:*\n`

      result.suggestedExercises.forEach((ex, i) => {
        text +=
          `\n${i + 1}. *${ex.name}* (${ex.nameEn})\n` +
          `   Мышцы: ${ex.primaryMuscles.join(', ')}\n` +
          `   ${ex.description}\n` +
          `   📋 ${ex.sets} подходов × ${ex.reps} повторений\n`
      })

      await ctx.reply(text, { parse_mode: 'Markdown' })
    } catch (err) {
      console.error('[bot] photo handler error:', err)
      await ctx.reply('😕 Произошла ошибка при обработке фото. Попробуй ещё раз.')
    }
  })

  bot.catch((err, ctx) => {
    console.error('[bot] error in update', ctx.update?.update_id, err)
  })

  return bot
}
