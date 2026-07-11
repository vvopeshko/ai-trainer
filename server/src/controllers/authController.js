// Возвращает данные текущего юзера. req.user уже подставлен auth middleware'ом
// (telegram initData или Bearer-сессия Better Auth).
export async function initAuth(req, res) {
  const user = req.user
  res.json({
    user: {
      id: user.id,
      // BigInt → string для JSON; null у web-only юзеров (Better Auth)
      telegramId: user.telegramId?.toString() ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      languageCode: user.languageCode,
      photoUrl: user.photoUrl,
      email: user.email ?? null,
      emailVerified: user.emailVerified ?? false,
      sessionsCount: user.sessionsCount,
    },
  })
}
