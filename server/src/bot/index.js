import { Telegraf, Scenes, session } from 'telegraf'
import { identifyMachine } from '../services/aiTrainer/identifyMachine.js'
import { handleChatMessage } from '../services/aiTrainer/chat.js'
import { buildUsageReportHtml } from '../services/aiTrainer/usageReport.js'
import { generateProgramScene } from './scenes/generateProgram.js'
import { escapeHtml } from './notifier.js'
import prisma from '../utils/prisma.js'

// Создание Telegraf-бота. Запускается из server/src/index.js параллельно Express.
// Команды задаются через /setcommands у @BotFather из server/src/bot/commands.txt.

// ─── Троттлинг LLM-чата: N сообщений/мин на юзера ──────────────────
// express-rate-limit защищает только HTTP-роуты; текст в бота — отдельный
// канал, где каждое сообщение = до 4 LLM-вызовов. Любой Telegram-юзер может
// писать боту, поэтому без лимита это открытый кран в бюджет Anthropic.
const CHAT_LIMIT_PER_MIN = 5
const CHAT_WINDOW_MS = 60_000
const chatHits = new Map() // telegramId -> [timestamps]

function chatAllowed(telegramId) {
  const now = Date.now()
  // Попутная уборка: не даём Map расти бесконечно.
  if (chatHits.size > 10_000) {
    for (const [id, hits] of chatHits) {
      if (now - hits[hits.length - 1] > CHAT_WINDOW_MS) chatHits.delete(id)
    }
  }
  const hits = (chatHits.get(telegramId) ?? []).filter((t) => now - t < CHAT_WINDOW_MS)
  if (hits.length >= CHAT_LIMIT_PER_MIN) {
    chatHits.set(telegramId, hits)
    return false
  }
  hits.push(now)
  chatHits.set(telegramId, hits)
  return true
}

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
    try {
      const telegramId = BigInt(ctx.from.id)
      const user = await prisma.user.findUnique({ where: { telegramId } })

      if (user) {
        const program = await prisma.program.findFirst({
          where: { userId: user.id, isActive: true },
          select: { id: true, name: true, planJson: true },
        })

        if (program) {
          const days = program.planJson?.days || []

          if (days.length > 0) {
            const lastWorkout = await prisma.workout.findFirst({
              where: {
                userId: user.id,
                programId: program.id,
                finishedAt: { not: null },
                programDayIndex: { not: null },
              },
              orderBy: { finishedAt: 'desc' },
              select: { programDayIndex: true },
            })

            const nextDayIndex = lastWorkout
              ? (lastWorkout.programDayIndex + 1) % days.length
              : 0

            const day = days[nextDayIndex]
            // HTML + escapeHtml (не Markdown): непарный `*`/`_` в названии
            // программы/упражнения роняет Markdown-парсер Telegram с 400
            const exerciseList = day.exercises
              .map((ex, i) => `${i + 1}. ${escapeHtml(ex.nameRu)}`)
              .join('\n')

            const text =
              `📋 <b>${escapeHtml(program.name)}</b>\n` +
              `Следующая: <b>${escapeHtml(day.title)}</b>\n\n` +
              `${exerciseList}`

            const workoutUrl = `${webAppUrl}/workout`
            if (canUseWebAppButton) {
              await ctx.reply(text, {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🏋️‍♂️ Начать тренировку', web_app: { url: workoutUrl } }],
                  ],
                },
              })
            } else {
              await ctx.reply(`${text}\n\n(dev) открой: ${workoutUrl}`, { parse_mode: 'HTML' })
            }
            return
          }
        }
      }

      // Нет активной программы или юзера
      await ctx.reply(
        'У тебя пока нет активной программы.\nСоздай её командой /program',
      )
    } catch (err) {
      console.error('[bot] /workout error:', err)
      if (canUseWebAppButton) {
        await ctx.reply('Открываю тренировку…', {
          reply_markup: {
            inline_keyboard: [[{ text: '🏋️‍♂️ Открыть тренировку', web_app: { url: webAppUrl } }]],
          },
        })
      } else {
        await ctx.reply(`(dev) открой в браузере: ${webAppUrl}/workout`)
      }
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

  // ─── /cost: расход токенов LLM в деньгах (только админ) ───────────
  bot.command('cost', async (ctx) => {
    // Fail-closed: без ADMIN_TELEGRAM_ID команда недоступна никому.
    if (!adminId || ctx.from.id !== adminId) return
    try {
      const html = await buildUsageReportHtml()
      await ctx.reply(html, { parse_mode: 'HTML', disable_web_page_preview: true })
    } catch (err) {
      console.error('[bot] /cost error:', err)
      await ctx.reply('😕 Не удалось собрать отчёт по расходу.')
    }
  })

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
      // Fail-closed: без ADMIN_TELEGRAM_ID недоступна никому (vision — дорогой вызов).
      // Убрать эту проверку, когда откроем для всех.
      if (!adminId || ctx.from.id !== adminId) {
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
      if (!response.ok) {
        throw new Error(`failed to download photo: HTTP ${response.status}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const imageBase64 = buffer.toString('base64')

      // ─── 3. Найти юзера в БД ─────────────────────────────────
      // telegramAuth middleware работает только для API-роутов.
      // В боте у нас нет middleware — upsert по telegramId (не find+create:
      // параллельные апдейты от одного юзера гоняются и ловят P2002).
      const telegramId = BigInt(ctx.from.id)
      const user = await prisma.user.upsert({
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

      // ─── 4. Вызвать сервис распознавания ──────────────────────
      const result = await identifyMachine(user.id, imageBase64, {
        telegramFileId: largest.file_id,
      })

      // ─── 5. Сформировать и отправить ответ ─────────────────────
      if (!result.success) {
        await ctx.reply(`🤔 ${result.error}`)
        return
      }

      // HTML + escapeHtml: названия приходят из LLM, непарный `*`/`_`
      // в Markdown роняет отправку с Telegram 400
      if (result.confidence < 0.5) {
        await ctx.reply(
          `🤔 Не совсем уверен, но похоже на: <b>${escapeHtml(result.machineName)}</b>\n\n` +
            `${escapeHtml(result.description)}\n\n` +
            '<i>Попробуй сфоткать тренажёр ближе или с другого ракурса для более точного результата.</i>',
          { parse_mode: 'HTML' },
        )
        return
      }

      // Формируем текст ответа с упражнениями
      let text =
        `🏋️ <b>${escapeHtml(result.machineName)}</b>\n` +
        `<i>(${escapeHtml(result.machineNameEn)})</i>\n\n` +
        `${escapeHtml(result.description)}\n\n` +
        `<b>Упражнения:</b>\n`

      result.suggestedExercises.forEach((ex, i) => {
        text +=
          `\n${i + 1}. <b>${escapeHtml(ex.name)}</b> (${escapeHtml(ex.nameEn)})\n` +
          `   Мышцы: ${escapeHtml(ex.primaryMuscles.join(', '))}\n` +
          `   ${escapeHtml(ex.description)}\n` +
          `   📋 ${ex.sets} подходов × ${ex.reps} повторений\n`
      })

      await ctx.reply(text, { parse_mode: 'HTML' })
    } catch (err) {
      console.error('[bot] photo handler error:', err)
      await ctx.reply('😕 Произошла ошибка при обработке фото. Попробуй ещё раз.')
    }
  })

  // ─── AI-чат: свободный текст (AI_TRAINER_PLAN фаза 2.1) ───────────
  // Fallback-хендлер: ловит любой текст, который не перехватили команды/сцены.
  // Команды (bot.command) и активные сцены (stage.middleware) не вызывают next(),
  // поэтому сюда долетает только обычный текст. Доп. гарды на всякий случай.
  bot.on('text', async (ctx) => {
    // В активной сцене (например /program) — не вмешиваемся.
    if (ctx.scene?.current) return
    // Неизвестные команды (/foo) не отдаём тренеру — это не вопрос.
    if (ctx.message.text.startsWith('/')) return

    // Троттлинг: каждое сообщение — LLM-вызовы, лимитируем per-user.
    if (!chatAllowed(ctx.from.id)) {
      await ctx.reply('Слишком много сообщений подряд — дай мне минутку и продолжим 🙏')
      return
    }

    try {
      await ctx.sendChatAction('typing')

      // У бота нет telegramAuth middleware — upsert юзера по telegramId
      // (не find+create: параллельные сообщения гоняются и ловят P2002).
      const telegramId = BigInt(ctx.from.id)
      const user = await prisma.user.upsert({
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

      const { reply } = await handleChatMessage(user, ctx.message.text)
      try {
        await ctx.reply(reply, { parse_mode: 'HTML', disable_web_page_preview: true })
      } catch (sendErr) {
        // LLM может выдать невалидный HTML (незакрытый тег) → Telegram 400.
        // Ретраим без parse_mode: лучше plain text, чем «что-то пошло не так»,
        // тем более что ответ уже сохранён в ChatMessage.
        console.warn('[bot] HTML reply failed, retrying as plain text:', sendErr.message)
        await ctx.reply(reply, { disable_web_page_preview: true })
      }
    } catch (err) {
      console.error('[bot] chat handler error:', err)
      await ctx.reply('😕 Что-то пошло не так. Попробуй ещё раз.')
    }
  })

  bot.catch((err, ctx) => {
    console.error('[bot] error in update', ctx.update?.update_id, err)
  })

  return bot
}
