// Почтовые письма web-авторизации: Resend HTTP API нативным fetch, без SDK
// (тот же подход, что llm.js с Anthropic). Шаблоны — только ru (MVP).
//
// Без RESEND_API_KEY:
//   - при ALLOW_DEV_BYPASS=true (локалка) ссылка логируется в консоль —
//     можно пройти verify/reset флоу без почты;
//   - иначе письмо молча не уходит (email-провайдер в auth/index.js в этом
//     случае вообще не включается — сюда попадать не должны).

const RESEND_URL = 'https://api.resend.com/emails'
const APP_NAME = 'AI Trainer'

const templates = {
  verify: (url) => ({
    subject: `${APP_NAME} — подтвердите email`,
    html: wrap(
      'Подтвердите email',
      'Вы указали этот адрес для входа в AI Trainer через браузер. Подтвердите его, чтобы активировать вход по почте.',
      url,
      'Подтвердить email',
    ),
  }),
  reset: (url) => ({
    subject: `${APP_NAME} — сброс пароля`,
    html: wrap(
      'Сброс пароля',
      'Вы запросили сброс пароля. Если это были не вы — просто проигнорируйте письмо.',
      url,
      'Задать новый пароль',
    ),
  }),
}

function wrap(title, text, url, cta) {
  // Простой тёмный шаблон в духе приложения; инлайн-стили — требование почтовых клиентов
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#0d1117;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#161b22;border:1px solid #2d333b;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#e6edf3;">${title}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#9da7b3;">${text}</p>
    <a href="${url}" style="display:inline-block;padding:12px 24px;background:#2dd4a7;color:#08110d;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;">${cta}</a>
    <p style="margin:24px 0 0;font-size:12px;color:#6b7480;">Если кнопка не работает, откройте ссылку: <br><a href="${url}" style="color:#2dd4a7;word-break:break-all;">${url}</a></p>
  </div>
</body></html>`
}

/**
 * Отправить письмо. Fire-and-forget-friendly: не бросает, возвращает boolean.
 * @param {'verify'|'reset'} kind
 * @param {{ email: string }} user
 * @param {string} url — ссылка действия (уже с нужным callbackURL)
 * @returns {Promise<boolean>} true если письмо принято Resend (или залогировано в dev)
 */
export async function sendMail(kind, user, url) {
  const template = templates[kind]
  if (!template || !user?.email) return false

  if (!process.env.RESEND_API_KEY) {
    if (process.env.ALLOW_DEV_BYPASS === 'true') {
      console.log(`[mailer] DEV ${kind} → ${user.email}: ${url}`)
      return true
    }
    console.warn('[mailer] RESEND_API_KEY not set — mail skipped')
    return false
  }

  const { subject, html } = template(url)
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`,
        to: user.email,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[mailer] resend ${res.status}:`, body.slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error('[mailer] send failed:', err.message)
    return false
  }
}
