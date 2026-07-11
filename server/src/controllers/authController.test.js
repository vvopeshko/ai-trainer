import { describe, it, expect } from 'vitest'
import { initAuth } from './authController.js'

function mockRes() {
  const res = {
    body: null,
    json(data) { res.body = data; return res },
  }
  return res
}

describe('initAuth', () => {
  it('TG-юзер: telegramId сериализуется строкой', async () => {
    const res = mockRes()
    await initAuth({ user: { id: 'u1', telegramId: 123456789n, firstName: 'Vik', sessionsCount: 5 } }, res)
    expect(res.body.user.telegramId).toBe('123456789')
    expect(res.body.user.firstName).toBe('Vik')
  })

  it('web-only юзер (telegramId=null) → не падает, отдаёт null + email', async () => {
    const res = mockRes()
    await initAuth(
      {
        user: {
          id: 'u2',
          telegramId: null,
          firstName: 'Web',
          email: 'w@example.com',
          emailVerified: true,
          sessionsCount: 1,
        },
      },
      res,
    )
    expect(res.body.user.telegramId).toBeNull()
    expect(res.body.user.email).toBe('w@example.com')
    expect(res.body.user.emailVerified).toBe(true)
  })
})
