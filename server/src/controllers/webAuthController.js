import { z } from 'zod'
import { fromNodeHeaders } from 'better-auth/node'
import prisma from '../utils/prisma.js'
import { auth as betterAuth, enabledProviders } from '../auth/index.js'
import { track } from '../utils/analytics.js'
import { FRONTEND_URL } from '../utils/origins.js'
import { validateWidgetData } from '../utils/telegramWidget.js'
import { getBotUsername } from '../bot/notifier.js'

// Наша часть web-авторизации — то, чего Better Auth не умеет
// (см. product/ARCHITECTURE_WEB_AUTH.md §4.4): Telegram Login Widget,
// канон User.telegramId, adoption пустого аккаунта, set-password из Mini App.

/**
 * GET /api/v1/auth/providers — публичный.
 * LoginPage рендерит только доступные способы входа, набор не хардкодится.
 * botUsername нужен фронту для Telegram Login Widget.
 */
export function listProviders(req, res) {
  const providers = enabledProviders()
  res.json({
    providers,
    ...(providers.includes('telegram_widget') && { botUsername: getBotUsername() }),
  })
}

// ─── Общие помощники ─────────────────────────────────────────────

/**
 * «Пустой» аккаунт для adoption: ни тренировок, ни программ.
 * Аналог seasons/purchases в LPT (§6.5 ARCHITECTURE_WEB_AUTH.md).
 */
async function isUserEmpty(userId) {
  const [workouts, programs] = await Promise.all([
    prisma.workout.count({ where: { userId } }),
    prisma.program.count({ where: { userId } }),
  ])
  return workouts === 0 && programs === 0
}

/** BA-сессия для юзера вне BA-флоу (widget-вход, adoption) → bearer-токен. */
async function createSessionFor(userId) {
  const ctx = await betterAuth.$context
  const session = await ctx.internalAdapter.createSession(userId)
  return session.token
}

/** Кол-во способов входа: BA-аккаунты + Telegram (канон — User.telegramId). */
async function methodsCount(user) {
  const accounts = await prisma.account.count({ where: { userId: user.id } })
  return accounts + (user.telegramId ? 1 : 0)
}

const setPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
})

/**
 * POST /api/v1/auth/set-password — под auth, работает и под `tma`!
 * Мост из Mini App в веб: TG-юзер задаёт email+пароль → credential-account.
 * Вход по email активируется только после верификации адреса
 * (requireEmailVerification в конфиге BA) — чужой адрес застолбить нельзя.
 */
export async function setPassword(req, res, next) {
  try {
    if (!betterAuth || !enabledProviders().includes('email')) {
      return res.status(503).json({ error: 'Email sign-in is not enabled' })
    }
    const { email, password } = setPasswordSchema.parse(req.body)
    const userId = req.user.id

    // Email занят другим юзером → generic-код без деталей (анти-enumeration)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== userId) {
      return res.status(409).json({ error: 'email_unavailable' })
    }

    // Хеш и запись credential-аккаунта — через внутренний контекст BA,
    // чтобы формат был неотличим от обычной регистрации.
    const ctx = await betterAuth.$context
    const hash = await ctx.password.hash(password)
    const accounts = await ctx.internalAdapter.findAccounts(userId)
    const credential = accounts.find((a) => a.providerId === 'credential')
    if (credential) {
      await ctx.internalAdapter.updatePassword(userId, hash)
    } else {
      await ctx.internalAdapter.linkAccount({
        userId,
        providerId: 'credential',
        accountId: userId,
        password: hash,
      })
    }

    // Установка/смена email сбрасывает верификацию
    if (req.user.email !== email) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { email, emailVerified: false },
        })
      } catch (err) {
        // Гонка на unique(email) — тот же generic-ответ
        if (err.code === 'P2002') {
          return res.status(409).json({ error: 'email_unavailable' })
        }
        throw err
      }
    }

    // Письмо верификации (в dev без RESEND_API_KEY ссылка уходит в консоль сервера)
    const fresh = await prisma.user.findUnique({ where: { id: userId } })
    let verificationSent = false
    if (!fresh.emailVerified) {
      await betterAuth.api.sendVerificationEmail({
        body: { email, callbackURL: `${FRONTEND_URL}/auth/verify` },
      })
      verificationSent = true
    }

    track(userId, 'account_linked', { provider: 'credential' })
    res.json({ ok: true, email, verificationSent })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/auth/handoff?to=/path — публичный, топ-уровневый переход
 * после OAuth-callback. Cookie здесь first-party (API-домен) → одноразовый
 * токен (TTL ~60 c) → редирект на фронт. Session-токены в redirect-URL
 * не ездят никогда. Активен при включённых OAuth-провайдерах (Google/Yandex).
 */
export async function handoff(req, res, next) {
  try {
    if (!betterAuth) return res.redirect(`${FRONTEND_URL}/login`)

    const headers = fromNodeHeaders(req.headers)
    const session = await betterAuth.api.getSession({ headers })
    if (!session?.user) {
      return res.redirect(`${FRONTEND_URL}/login?hint=oauth_failed`)
    }

    const { token } = await betterAuth.api.generateOneTimeToken({ headers })
    const to =
      typeof req.query.to === 'string' && req.query.to.startsWith('/') && !req.query.to.startsWith('//')
        ? req.query.to
        : '/'
    res.redirect(
      `${FRONTEND_URL}/auth/callback?ott=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(to)}`,
    )
  } catch (err) {
    next(err)
  }
}

// ─── Фаза 2: Telegram Login Widget + adoption ────────────────────

/**
 * POST /api/v1/auth/telegram-widget — публичный. Вход в веб через Login Widget.
 * Существующий TG-юзер получает все свои данные (главный сценарий);
 * новый — создаётся по канону: telegramId на User, запись в Account НЕ создаётся.
 */
export async function telegramWidget(req, res, next) {
  try {
    if (!betterAuth || !enabledProviders().includes('telegram_widget')) {
      return res.status(503).json({ error: 'Telegram sign-in is not enabled' })
    }
    const parsed = validateWidgetData(req.body, process.env.BOT_TOKEN)
    if (!parsed.ok) return res.status(401).json({ error: parsed.error })
    const tg = parsed.user

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tg.id) },
      create: {
        telegramId: BigInt(tg.id),
        firstName: tg.first_name || 'User',
        lastName: tg.last_name ?? null,
        username: tg.username ?? null,
        photoUrl: tg.photo_url ?? null,
      },
      update: {},
    })

    const token = await createSessionFor(user.id)
    track(user.id, 'web_login_widget')
    res.json({ token })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/telegram/link — под auth. Привязать Telegram (данные виджета)
 * к текущему аккаунту. Конфликт «telegramId у другого юзера» → 409 с флагом
 * adoptable (текущий аккаунт пуст → фронт предлагает adoption, §6.5).
 */
export async function linkTelegram(req, res, next) {
  try {
    const parsed = validateWidgetData(req.body, process.env.BOT_TOKEN)
    if (!parsed.ok) return res.status(401).json({ error: parsed.error })
    const telegramId = BigInt(parsed.user.id)

    const holder = await prisma.user.findUnique({ where: { telegramId } })
    if (holder && holder.id !== req.user.id) {
      const adoptable = await isUserEmpty(req.user.id)
      return res.status(409).json({ error: 'telegram_linked_elsewhere', adoptable })
    }
    if (req.user.telegramId && req.user.telegramId !== telegramId) {
      return res.status(409).json({ error: 'another_telegram_linked' })
    }

    if (!holder) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          telegramId,
          username: req.user.username ?? parsed.user.username ?? null,
          photoUrl: req.user.photoUrl ?? parsed.user.photo_url ?? null,
        },
      })
      track(req.user.id, 'account_linked', { provider: 'telegram' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/auth/telegram — под auth. Отвязать Telegram.
 * Guard «не последний метод входа». UI обязан предупредить: бот-чат,
 * уведомления тренера и handoff «Спросить тренера» перестанут работать.
 */
export async function unlinkTelegram(req, res, next) {
  try {
    if (!req.user.telegramId) {
      return res.status(400).json({ error: 'telegram_not_linked' })
    }
    if ((await methodsCount(req.user)) <= 1) {
      return res.status(400).json({ error: 'last_method' })
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { telegramId: null } })
    track(req.user.id, 'account_unlinked', { provider: 'telegram' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/adopt — под auth (web-сессия пустого аккаунта).
 * Перенос способов входа ПУСТОГО текущего аккаунта на аккаунт с данными,
 * которым владеет этот же человек в Telegram (доказательство — HMAC виджета).
 * Merge аккаунтов С ДАННЫМИ не делаем (§6.5).
 */
export async function adoptAccount(req, res, next) {
  try {
    const parsed = validateWidgetData(req.body, process.env.BOT_TOKEN)
    if (!parsed.ok) return res.status(401).json({ error: parsed.error })

    const donor = await prisma.user.findUnique({ where: { telegramId: BigInt(parsed.user.id) } })
    if (!donor || donor.id === req.user.id) {
      return res.status(400).json({ error: 'nothing_to_adopt' })
    }
    if (!(await isUserEmpty(req.user.id))) {
      return res.status(409).json({ error: 'account_not_empty' })
    }
    // Email и credential переносятся на аккаунт с данными; конфликт двух
    // разных email / двух credential-аккаунтов — вырожденный случай, отказ.
    if (donor.email && req.user.email && donor.email !== req.user.email) {
      return res.status(409).json({ error: 'email_conflict' })
    }
    const donorHasCredential = await prisma.account.count({
      where: { userId: donor.id, providerId: 'credential' },
    })
    const currentHasCredential = await prisma.account.count({
      where: { userId: req.user.id, providerId: 'credential' },
    })
    if (donorHasCredential && currentHasCredential) {
      return res.status(409).json({ error: 'email_conflict' })
    }

    const { email, emailVerified, id: emptyId } = req.user
    await prisma.$transaction(async (tx) => {
      // email уникален: сначала освобождаем на пустом, потом пишем на донора
      if (email) await tx.user.update({ where: { id: emptyId }, data: { email: null } })
      await tx.account.updateMany({ where: { userId: emptyId }, data: { userId: donor.id } })
      if (email && !donor.email) {
        await tx.user.update({ where: { id: donor.id }, data: { email, emailVerified } })
      }
      await tx.session.deleteMany({ where: { userId: emptyId } })
      await tx.user.delete({ where: { id: emptyId } })
    })

    const token = await createSessionFor(donor.id)
    track(donor.id, 'account_adopted', { from: 'web' })
    res.json({ token })
  } catch (err) {
    next(err)
  }
}

const adoptByPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
})

/**
 * POST /api/v1/auth/adopt-by-password — под auth (обычно tma, Mini App).
 * Зеркальный adoption: юзер начал с веба (пустой аккаунт с email+паролем),
 * потом открыл Mini App (аккаунт с данными). Вводит пароль веб-аккаунта →
 * его входы переезжают на текущий аккаунт, пустой удаляется.
 * Доказательство владения: пароль (веб) + initData/сессия (текущий).
 */
export async function adoptByPassword(req, res, next) {
  try {
    if (!betterAuth) return res.status(503).json({ error: 'Web auth is not configured' })
    const { email, password } = adoptByPasswordSchema.parse(req.body)

    // Все отказы — generic 401 (анти-enumeration)
    const donor = await prisma.user.findUnique({ where: { email } })
    if (!donor || donor.id === req.user.id) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    const credential = await prisma.account.findFirst({
      where: { userId: donor.id, providerId: 'credential' },
    })
    if (!credential?.password) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    const ctx = await betterAuth.$context
    const valid = await ctx.password.verify({ hash: credential.password, password })
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' })

    if (!(await isUserEmpty(donor.id))) {
      return res.status(409).json({ error: 'account_not_empty' })
    }
    if (req.user.email && req.user.email !== donor.email) {
      return res.status(409).json({ error: 'email_conflict' })
    }
    const currentHasCredential = await prisma.account.count({
      where: { userId: req.user.id, providerId: 'credential' },
    })
    if (currentHasCredential) {
      return res.status(409).json({ error: 'email_conflict' })
    }

    const donorEmail = donor.email
    const donorVerified = donor.emailVerified
    const targetId = req.user.id
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: donor.id }, data: { email: null } })
      await tx.account.updateMany({ where: { userId: donor.id }, data: { userId: targetId } })
      await tx.user.update({ where: { id: targetId }, data: { email: donorEmail, emailVerified: donorVerified } })
      await tx.session.deleteMany({ where: { userId: donor.id } })
      await tx.user.delete({ where: { id: donor.id } })
    })

    track(targetId, 'account_adopted', { from: 'miniapp' })
    res.json({ ok: true, email: donorEmail })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/auth/sessions — под auth. «Выйти на всех устройствах»:
 * сервер удаляет все BA-сессии юзера (Mini App не задет — он живёт на initData).
 */
export async function revokeSessions(req, res, next) {
  try {
    const { count } = await prisma.session.deleteMany({ where: { userId: req.user.id } })
    res.json({ ok: true, revoked: count })
  } catch (err) {
    next(err)
  }
}
