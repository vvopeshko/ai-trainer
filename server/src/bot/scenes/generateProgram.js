/**
 * Wizard-сцена генерации тренировочной программы.
 *
 * Поток:
 * 1. Проверка UserProfile — если есть, предложить использовать или заполнить заново
 * 2. Сбор данных: цель → уровень → дни → оборудование → ограничения
 * 3. Вызов generateProgram сервиса
 * 4. Отправка результата с кнопкой открытия в мини-аппе
 */
import { Scenes, Markup } from 'telegraf'
import prisma from '../../utils/prisma.js'
import { generateProgram } from '../../services/aiTrainer/generateProgram.js'

// ─── Опции для шагов ─────────────────────────────────────────────────

const GOALS = [
  { value: 'muscle_gain', label: '💪 Набор массы' },
  { value: 'strength', label: '🏋️ Сила' },
  { value: 'weight_loss', label: '🔥 Снижение веса' },
  { value: 'tone', label: '✨ Тонус и рельеф' },
  { value: 'general_fitness', label: '🏃 Общая форма' },
  { value: 'endurance', label: '⏱ Выносливость' },
]

const LEVELS = [
  { value: 'beginner', label: '🟢 Новичок (< 6 мес)' },
  { value: 'intermediate', label: '🟡 Средний (6 мес – 2 года)' },
  { value: 'advanced', label: '🔴 Продвинутый (2+ года)' },
]

const DAYS = [
  { value: 2, label: '2 дня' },
  { value: 3, label: '3 дня' },
  { value: 4, label: '4 дня' },
  { value: 5, label: '5 дней' },
  { value: 6, label: '6 дней' },
]

const EQUIPMENT = [
  { value: 'gym', label: '🏢 Полный зал' },
  { value: 'home', label: '🏠 Дом (гантели, резинки)' },
  { value: 'minimal', label: '🎒 Минимум (только гантели)' },
]

const CONSTRAINTS = [
  { value: 'lower_back', label: '🔸 Поясница' },
  { value: 'knee', label: '🔸 Колени' },
  { value: 'shoulder', label: '🔸 Плечи' },
  { value: 'none', label: '✅ Нет ограничений' },
]

// ─── Вспомогательные функции ─────────────────────────────────────────

function inlineButtons(options, prefix) {
  return options.map(opt =>
    [Markup.button.callback(opt.label, `${prefix}:${opt.value}`)]
  )
}

async function findOrCreateUser(ctx) {
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
  return user
}

// ─── Сцена ───────────────────────────────────────────────────────────

export const generateProgramScene = new Scenes.WizardScene(
  'generate-program',

  // Step 0: Проверка профиля
  async (ctx) => {
    const user = await findOrCreateUser(ctx)
    ctx.wizard.state.userId = user.id

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (profile) {
      ctx.wizard.state.existingProfile = profile
      const goalLabel = GOALS.find(g => g.value === profile.goal)?.label || profile.goal
      const levelLabel = LEVELS.find(l => l.value === profile.experienceLevel)?.label || profile.experienceLevel

      await ctx.reply(
        `У тебя уже есть профиль:\n\n` +
        `Цель: ${goalLabel}\n` +
        `Уровень: ${levelLabel}\n` +
        `Дней: ${profile.sessionsPerWeek || profile.availableDays?.length || '?'}\n\n` +
        `Использовать его для генерации программы?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Да, используем', 'profile:use')],
          [Markup.button.callback('🔄 Заполнить заново', 'profile:new')],
        ]),
      )
      return ctx.wizard.next()
    }

    // Нет профиля — сразу к выбору цели
    await ctx.reply(
      'Давай составим программу! Какая у тебя цель?',
      Markup.inlineKeyboard(inlineButtons(GOALS, 'goal')),
    )
    ctx.wizard.state.step = 'goal'
    return ctx.wizard.selectStep(2) // skip profile step, go to data collection
  },

  // Step 1: Обработка ответа "использовать профиль / заново"
  async (ctx) => {
    if (!ctx.callbackQuery) return
    await ctx.answerCbQuery()

    const action = ctx.callbackQuery.data

    if (action === 'profile:use') {
      // Используем существующий профиль — сразу генерируем
      const profile = ctx.wizard.state.existingProfile
      ctx.wizard.state.profile = {
        goal: profile.goal,
        experienceLevel: profile.experienceLevel,
        sessionsPerWeek: profile.sessionsPerWeek || profile.availableDays?.length || 3,
        equipmentPreset: profile.equipment?.length > 0 ? 'gym' : 'gym',
        constraints: profile.constraints || [],
      }
      return ctx.wizard.selectStep(6) // jump to generation step
    }

    if (action === 'profile:new') {
      await ctx.reply(
        'Хорошо, заполним заново. Какая у тебя цель?',
        Markup.inlineKeyboard(inlineButtons(GOALS, 'goal')),
      )
      ctx.wizard.state.step = 'goal'
      return ctx.wizard.next()
    }
  },

  // Step 2: Цель
  async (ctx) => {
    if (!ctx.callbackQuery) return
    await ctx.answerCbQuery()

    const match = ctx.callbackQuery.data.match(/^goal:(.+)$/)
    if (!match) return

    ctx.wizard.state.goal = match[1]

    await ctx.reply(
      'Какой у тебя уровень подготовки?',
      Markup.inlineKeyboard(inlineButtons(LEVELS, 'level')),
    )
    return ctx.wizard.next()
  },

  // Step 3: Уровень
  async (ctx) => {
    if (!ctx.callbackQuery) return
    await ctx.answerCbQuery()

    const match = ctx.callbackQuery.data.match(/^level:(.+)$/)
    if (!match) return

    ctx.wizard.state.experienceLevel = match[1]

    await ctx.reply(
      'Сколько дней в неделю готов тренироваться?',
      Markup.inlineKeyboard(inlineButtons(DAYS, 'days')),
    )
    return ctx.wizard.next()
  },

  // Step 4: Дни
  async (ctx) => {
    if (!ctx.callbackQuery) return
    await ctx.answerCbQuery()

    const match = ctx.callbackQuery.data.match(/^days:(.+)$/)
    if (!match) return

    ctx.wizard.state.sessionsPerWeek = parseInt(match[1], 10)

    await ctx.reply(
      'Какое оборудование доступно?',
      Markup.inlineKeyboard(inlineButtons(EQUIPMENT, 'equip')),
    )
    return ctx.wizard.next()
  },

  // Step 5: Оборудование
  async (ctx) => {
    if (!ctx.callbackQuery) return
    await ctx.answerCbQuery()

    const match = ctx.callbackQuery.data.match(/^equip:(.+)$/)
    if (!match) return

    ctx.wizard.state.equipmentPreset = match[1]

    await ctx.reply(
      'Есть ли ограничения по здоровью?',
      Markup.inlineKeyboard(inlineButtons(CONSTRAINTS, 'constraint')),
    )
    return ctx.wizard.next()
  },

  // Step 6: Ограничения + генерация
  async (ctx) => {
    // Если пришли из "использовать профиль" — profile уже в state
    if (!ctx.wizard.state.profile) {
      if (!ctx.callbackQuery) return
      await ctx.answerCbQuery()

      const match = ctx.callbackQuery.data.match(/^constraint:(.+)$/)
      if (!match) return

      const constraint = match[1]
      ctx.wizard.state.constraints = constraint === 'none' ? [] : [constraint]

      ctx.wizard.state.profile = {
        goal: ctx.wizard.state.goal,
        experienceLevel: ctx.wizard.state.experienceLevel,
        sessionsPerWeek: ctx.wizard.state.sessionsPerWeek,
        equipmentPreset: ctx.wizard.state.equipmentPreset,
        constraints: ctx.wizard.state.constraints,
      }
    }

    // Генерация
    await ctx.reply('⏳ Генерирую программу...')
    await ctx.sendChatAction('typing')

    try {
      const result = await generateProgram(
        ctx.wizard.state.userId,
        ctx.wizard.state.profile,
      )

      if (!result.success) {
        await ctx.reply(`❌ ${result.error}`)
        return ctx.scene.leave()
      }

      const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173'
      const programUrl = `${webAppUrl}/program/${result.program.id}`
      const canUseWebAppButton = webAppUrl.startsWith('https://')

      let text = `✅ Программа создана!\n\n${result.summary}`

      if (canUseWebAppButton) {
        await ctx.reply(text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏋️ Открыть в приложении', web_app: { url: programUrl } }],
            ],
          },
        })
      } else {
        text += `\n\n(dev) открой: ${programUrl}`
        await ctx.reply(text)
      }
    } catch (err) {
      console.error('[generateProgram scene] error:', err)
      await ctx.reply('😕 Произошла ошибка при генерации программы. Попробуй ещё раз через /program')
    }

    return ctx.scene.leave()
  },
)
