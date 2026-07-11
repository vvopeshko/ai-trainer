import { describe, it, expect, vi, beforeEach } from 'vitest'

// enabledProviders(): AUTH_PROVIDERS ∩ наличие credentials.
// Модуль строит auth при импорте — на каждый кейс свежий импорт через resetModules.

vi.mock('../utils/prisma.js', () => ({ default: {} }))
vi.mock('../utils/analytics.js', () => ({ track: vi.fn() }))
vi.mock('../utils/sessionTracking.js', () => ({ trackSeen: vi.fn() }))
vi.mock('../utils/mailer.js', () => ({ sendMail: vi.fn() }))

async function importFresh(env) {
  vi.resetModules()
  vi.unstubAllEnvs()
  // Базовые env вычищаем, чтобы локальный .env не влиял на тест
  for (const key of [
    'BETTER_AUTH_SECRET', 'AUTH_PROVIDERS', 'RESEND_API_KEY', 'ALLOW_DEV_BYPASS',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET',
    'BOT_TOKEN',
  ]) {
    vi.stubEnv(key, env[key] ?? '')
  }
  return import('./index.js')
}

describe('enabledProviders', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('без BETTER_AUTH_SECRET → пусто и auth=null', async () => {
    const mod = await importFresh({ AUTH_PROVIDERS: 'email' })
    expect(mod.enabledProviders()).toEqual([])
    expect(mod.auth).toBeNull()
  })

  it('email включается при RESEND_API_KEY', async () => {
    const mod = await importFresh({
      BETTER_AUTH_SECRET: 's'.repeat(64),
      AUTH_PROVIDERS: 'email',
      RESEND_API_KEY: 're_123',
    })
    expect(mod.enabledProviders()).toEqual(['email'])
    expect(mod.auth).not.toBeNull()
  })

  it('email включается в dev без Resend (ALLOW_DEV_BYPASS=true)', async () => {
    const mod = await importFresh({
      BETTER_AUTH_SECRET: 's'.repeat(64),
      AUTH_PROVIDERS: 'email',
      ALLOW_DEV_BYPASS: 'true',
    })
    expect(mod.enabledProviders()).toEqual(['email'])
  })

  it('email без credentials → выключен', async () => {
    const mod = await importFresh({
      BETTER_AUTH_SECRET: 's'.repeat(64),
      AUTH_PROVIDERS: 'email',
    })
    expect(mod.enabledProviders()).toEqual([])
  })

  it('google/yandex/widget без credentials и неизвестные провайдеры фильтруются', async () => {
    const mod = await importFresh({
      BETTER_AUTH_SECRET: 's'.repeat(64),
      AUTH_PROVIDERS: 'email,google,yandex,telegram_widget,whatever',
      RESEND_API_KEY: 're_123',
    })
    expect(mod.enabledProviders()).toEqual(['email'])
  })

  it('telegram_widget включается при BOT_TOKEN', async () => {
    const mod = await importFresh({
      BETTER_AUTH_SECRET: 's'.repeat(64),
      AUTH_PROVIDERS: 'email,telegram_widget',
      RESEND_API_KEY: 're_123',
      BOT_TOKEN: '123:abc',
    })
    expect(mod.enabledProviders()).toEqual(['email', 'telegram_widget'])
  })

  it('google включается при полных credentials', async () => {
    const mod = await importFresh({
      BETTER_AUTH_SECRET: 's'.repeat(64),
      AUTH_PROVIDERS: 'email,google',
      RESEND_API_KEY: 're_123',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    })
    expect(mod.enabledProviders()).toEqual(['email', 'google'])
  })
})
