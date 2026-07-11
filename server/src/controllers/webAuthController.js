import { z } from 'zod'
import { fromNodeHeaders } from 'better-auth/node'
import prisma from '../utils/prisma.js'
import { auth as betterAuth, enabledProviders } from '../auth/index.js'
import { track } from '../utils/analytics.js'
import { FRONTEND_URL } from '../utils/origins.js'

// Наша часть web-авторизации — то, чего Better Auth не умеет
// (см. product/ARCHITECTURE_WEB_AUTH.md §4.4). Фаза 2 добавит сюда
// telegram-widget / link / unlink / adopt.

/**
 * GET /api/v1/auth/providers — публичный.
 * LoginPage рендерит только доступные способы входа, набор не хардкодится.
 */
export function listProviders(req, res) {
  res.json({ providers: enabledProviders() })
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
