import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/index.js'
import { useTranslation } from '../../i18n/useTranslation.js'
import { authClient } from '../../utils/authClient.js'
import { AuthShell, AuthInput, AuthError, AuthNote } from './AuthShell.jsx'

// Новый пароль по токену из письма (ссылка {FRONTEND}/auth/reset?token=).
// После успеха сервер отзывает остальные сессии юзера (onPasswordReset).

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(token ? null : t('auth.resetExpired'))
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await authClient.resetPassword({ newPassword: password, token })
      if (err) {
        setError(t('auth.resetExpired'))
      } else {
        setDone(true)
      }
    } catch {
      setError(t('errors.network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {t('auth.resetTitle')}
      </h1>

      {done ? (
        <>
          <AuthNote>{t('auth.resetSuccess')}</AuthNote>
          <Button variant="accent" size="lg" block onClick={() => navigate('/login')}>
            {t('auth.goToLogin')}
          </Button>
        </>
      ) : (
        <form onSubmit={submit}>
          <AuthInput
            label={t('auth.resetPasswordLabel')}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <AuthError>{error}</AuthError>
          <Button type="submit" variant="accent" size="lg" block loading={busy} disabled={!token}>
            {t('auth.resetSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
