// Возвращает данные текущего юзера. req.user уже подставлен middleware'ом telegramAuth.
export async function initAuth(req, res) {
  const user = req.user
  res.json({
    user: {
      id: user.id,
      telegramId: user.telegramId.toString(), // BigInt → string для JSON
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      languageCode: user.languageCode,
      photoUrl: user.photoUrl,
      sessionsCount: user.sessionsCount,
    },
  })
}
