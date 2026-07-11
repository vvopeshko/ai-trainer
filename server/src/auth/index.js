import crypto from 'node:crypto'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { bearer, oneTimeToken, genericOAuth } from 'better-auth/plugins'
import prisma from '../utils/prisma.js'
import { sendMail } from '../utils/mailer.js'
import { track } from '../utils/analytics.js'
import { trackSeen } from '../utils/sessionTracking.js'
import { FRONTEND_URL, FRONTEND_URLS } from '../utils/origins.js'

// Конфиг Better Auth — web-авторизация (см. product/ARCHITECTURE_WEB_AUTH.md).
//
// Собирается динамически из AUTH_PROVIDERS: провайдер не в списке → его эндпоинты
// отвечают 404 силами самого BA. Провайдер активен только если указан И заданы
// его credentials. Без BETTER_AUTH_SECRET web-auth выключен целиком (auth = null):
// сервер работает как раньше, Mini App не затронут.
//
// Отличие от LPT: requireEmailVerification=true — вход по email ВСЕГДА требует
// подтверждённый адрес. Одно правило закрывает и обычную регистрацию, и захват
// чужого адреса через set-password из Mini App. После регистрации BA не создаёт
// сессию — фронт показывает «подтвердите почту».

const API_URL = process.env.API_URL || 'http://localhost:3001'

// apple — мобильная фаза; появится здесь при реализации
const SUPPORTED_PROVIDERS = ['email', 'google', 'yandex', 'telegram_widget']

/**
 * Активные web-провайдеры: AUTH_PROVIDERS ∩ наличие credentials.
 * Для 'email' в dev достаточно ALLOW_DEV_BYPASS=true (mailer логирует ссылки в консоль).
 * telegram_widget — наш код (не BA), требует BOT_TOKEN + /setdomain в BotFather.
 */
export function enabledProviders() {
  if (!process.env.BETTER_AUTH_SECRET) return []
  const requested = (process.env.AUTH_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return requested.filter((p) => {
    if (!SUPPORTED_PROVIDERS.includes(p)) {
      console.warn(`[auth] провайдер "${p}" не поддерживается — пропущен`)
      return false
    }
    const missing =
      (p === 'email' && !process.env.RESEND_API_KEY && process.env.ALLOW_DEV_BYPASS !== 'true') ||
      (p === 'google' && !(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)) ||
      (p === 'yandex' && !(process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET)) ||
      (p === 'telegram_widget' && !process.env.BOT_TOKEN)
    if (missing) {
      console.warn(`[auth] провайдер "${p}" указан в AUTH_PROVIDERS, но credentials не заданы — выключен`)
      return false
    }
    return true
  })
}

function buildAuth() {
  if (!process.env.BETTER_AUTH_SECRET) {
    console.warn('[auth] BETTER_AUTH_SECRET не задан — web-авторизация выключена')
    return null
  }
  const providers = enabledProviders()
  console.log(`[auth] web-провайдеры: ${providers.length ? providers.join(', ') : '(нет)'}`)

  const plugins = [
    bearer(), // session-токен в Authorization: Bearer (cross-domain Vercel↔Railway)
    oneTimeToken(), // возврат из OAuth-редиректа в SPA (handoff)
  ]
  if (providers.includes('yandex')) {
    plugins.push(
      genericOAuth({
        config: [
          {
            providerId: 'yandex',
            clientId: process.env.YANDEX_CLIENT_ID,
            clientSecret: process.env.YANDEX_CLIENT_SECRET,
            authorizationUrl: 'https://oauth.yandex.ru/authorize',
            tokenUrl: 'https://oauth.yandex.ru/token',
            userInfoUrl: 'https://login.yandex.ru/info',
            scopes: ['login:email', 'login:info', 'login:avatar'],
            mapProfileToUser: (profile) => ({
              email: profile.default_email,
              name: profile.display_name || profile.real_name || profile.login || 'User',
              emailVerified: true,
              image: profile.is_avatar_empty
                ? null
                : `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`,
            }),
          },
        ],
      }),
    )
  }

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    baseURL: API_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: FRONTEND_URLS,
    telemetry: { enabled: false },

    // Маппинг на нашу таблицу User (BA-поля name/image → firstName/photoUrl)
    user: {
      modelName: 'User',
      fields: { name: 'firstName', image: 'photoUrl' },
      additionalFields: {
        languageCode: { type: 'string', required: false, input: false },
        timezone: { type: 'string', required: false, input: false },
      },
    },
    session: {
      modelName: 'Session',
      expiresIn: 60 * 60 * 24 * 30, // 30 дней
      updateAge: 60 * 60 * 24, // sliding: активный юзер не разлогинивается
    },
    account: {
      modelName: 'Account',
      accountLinking: { enabled: true },
    },
    verification: { modelName: 'Verification' },

    advanced: {
      // uuid как у существующих юзеров (BA по умолчанию генерит nanoid)
      database: { generateId: () => crypto.randomUUID() },
      // Cookie живёт только на API-домене и используется единственный раз —
      // в OAuth handoff; все API-запросы ходят с Bearer.
      defaultCookieAttributes: { sameSite: 'none', secure: true },
    },

    ...(providers.includes('email') && {
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        // Вход по email только после верификации (см. шапку файла)
        requireEmailVerification: true,
        sendResetPassword: async ({ user, token }) => {
          await sendMail('reset', user, `${FRONTEND_URL}/auth/reset?token=${token}`)
        },
        onPasswordReset: async ({ user }) => {
          // Сброс пароля = чужие сессии умирают
          await prisma.session.deleteMany({ where: { userId: user.id } })
          track(user.id, 'password_reset_done')
        },
      },
    }),
    emailVerification: {
      sendOnSignUp: true, // письмо уходит сразу при регистрации
      sendVerificationEmail: async ({ user, url }) => {
        // Форсим callbackURL на страницу фронта — иначе BA после клика
        // редиректит на корень API-домена («Cannot GET /»)
        const link = new URL(url)
        link.searchParams.set('callbackURL', `${FRONTEND_URL}/auth/verify`)
        await sendMail('verify', user, link.toString())
      },
      onEmailVerification: async (user) => {
        track(user.id, 'email_verified')
      },
    },

    ...(providers.includes('google') && {
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      },
    }),

    rateLimit: {
      // Встроенный лимитер BA, хранение в БД (переживает рестарт Railway).
      // req.ip корректен благодаря app.set('trust proxy', 1) в index.js.
      enabled: true,
      storage: 'database',
      modelName: 'RateLimit',
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        // Каждый запрос = письмо, бережём квоту Resend.
        // ⚠️ Имя эндпоинта в BA 1.6 — request-password-reset (не forget-password)
        '/request-password-reset': { window: 60, max: 3 },
      },
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            track(user.id, 'web_user_registered')
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            track(session.userId, 'web_login')
            trackSeen({ id: session.userId }) // web-юзеры тоже попадают в DAU/WAU
          },
        },
      },
    },

    plugins,
  })
}

export const auth = buildAuth()
