import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/index.js'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet } from '../../utils/api.js'
import { authClient } from '../../utils/authClient.js'
import { tokenStorage } from '../../utils/tokenStorage.js'
import { AuthShell, AuthInput, AuthError, AuthNote } from './AuthShell.jsx'

// Вход в web-версию. Состав формы определяется GET /api/v1/auth/providers —
// набор способов входа не хардкодится (см. product/ARCHITECTURE_WEB_AUTH.md §7.1).

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function LoginPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))

  const [providers, setProviders] = useState(null) // null = загрузка
  const [mode, setMode] = useState('login') // login | register | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(params.get('hint') === 'oauth_failed' ? t('auth.oauthFailed') : null)
  const [unverified, setUnverified] = useState(false)

  useEffect(() => {
    // Уже залогинен → на главную (полная перезагрузка переинициализирует WebProvider)
    if (tokenStorage.get()) {
      window.location.replace(returnTo)
      return
    }
    apiGet('/api/v1/auth/providers')
      .then((d) => setProviders(d.providers || []))
      .catch(() => setProviders([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasEmail = providers?.includes('email')
  const hasOAuth = providers?.includes('google') || providers?.includes('yandex')

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setUnverified(false)
    if (password && password.length < 8 && mode !== 'forgot') {
      setError(t('auth.passwordTooShort'))
      return
    }
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        setNotice(t('auth.forgotSent'))
      } else if (mode === 'register') {
        const { error: err } = await authClient.signUp.email({ email, password, name: name.trim() || 'User' })
        if (err) {
          setError(err.code === 'USER_ALREADY_EXISTS' ? t('auth.emailTaken') : t('auth.loginError'))
        } else {
          // requireEmailVerification: сессия не создаётся — сначала подтверждение почты
          setNotice(t('auth.registered'))
          setMode('login')
        }
      } else {
        const { data, error: err } = await authClient.signIn.email({ email, password })
        if (err) {
          if (err.status === 403) {
            setUnverified(true)
            setError(t('auth.emailNotVerified'))
          } else {
            setError(t('auth.emailAuthError'))
          }
        } else if (data) {
          // Токен сохранён onSuccess-хуком authClient; полная перезагрузка
          // переинициализирует WebProvider с валидной сессией
          window.location.replace(returnTo)
          return
        }
      }
    } catch {
      setError(t('errors.network'))
    } finally {
      setBusy(false)
    }
  }

  async function resendVerification() {
    setBusy(true)
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/auth/verify`,
      })
      setNotice(t('auth.verificationResent'))
      setUnverified(false)
      setError(null)
    } catch {
      setError(t('errors.network'))
    } finally {
      setBusy(false)
    }
  }

  function oauth(provider) {
    const callbackURL = `${API_URL}/api/v1/auth/handoff?to=${encodeURIComponent(returnTo)}`
    if (provider === 'yandex') {
      authClient.signIn.oauth2({ providerId: 'yandex', callbackURL })
    } else {
      authClient.signIn.social({ provider, callbackURL })
    }
  }

  return (
    <AuthShell>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>{t('auth.loginTitle')}</h1>
        <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>
          {t('auth.loginSubtitle')}
        </p>
      </div>

      {providers === null && null}

      {providers !== null && !hasEmail && !hasOAuth && (
        <AuthNote>{t('auth.noProviders')}</AuthNote>
      )}

      {hasEmail && mode !== 'forgot' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          {['login', 'register'].map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? 'accent' : 'ghost'}
              size="sm"
              block
              onClick={() => {
                setMode(m)
                setError(null)
              }}
            >
              {m === 'login' ? t('auth.tabLogin') : t('auth.tabRegister')}
            </Button>
          ))}
        </div>
      )}

      {hasEmail && (
        <form onSubmit={submit}>
          {mode === 'register' && (
            <AuthInput
              label={t('auth.nameLabel')}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <AuthInput
            label={t('auth.emailLabel')}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {mode !== 'forgot' && (
            <AuthInput
              label={t('auth.passwordLabel')}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          )}

          <AuthError>{error}</AuthError>
          <AuthNote>{notice}</AuthNote>

          {unverified && (
            <Button type="button" variant="secondary" size="sm" block loading={busy} onClick={resendVerification} style={{ marginBottom: 'var(--space-3)' }}>
              {t('auth.resendVerification')}
            </Button>
          )}

          <Button type="submit" variant="accent" size="lg" block loading={busy}>
            {mode === 'login' ? t('auth.submitLogin') : mode === 'register' ? t('auth.submitRegister') : t('auth.forgotSubmit')}
          </Button>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
            {mode === 'login' && (
              <LinkButton onClick={() => { setMode('forgot'); setError(null) }}>{t('auth.forgotPassword')}</LinkButton>
            )}
            {mode === 'forgot' && (
              <LinkButton onClick={() => { setMode('login'); setError(null); setNotice(null) }}>{t('auth.backToLogin')}</LinkButton>
            )}
          </div>
        </form>
      )}

      {hasEmail && hasOAuth && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            margin: 'var(--space-4) 0',
            color: 'var(--fg-tertiary)',
            fontSize: 'var(--text-xs)',
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          {t('auth.orDivider')}
          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>
      )}

      {providers?.includes('google') && (
        <Button type="button" variant="secondary" size="lg" block onClick={() => oauth('google')} style={{ marginBottom: 'var(--space-2)' }}>
          {t('auth.signInGoogle')}
        </Button>
      )}
      {providers?.includes('yandex') && (
        <Button type="button" variant="secondary" size="lg" block onClick={() => oauth('yandex')}>
          {t('auth.signInYandex')}
        </Button>
      )}

      <p
        style={{
          margin: 'var(--space-5) 0 0',
          fontSize: 'var(--text-xs)',
          color: 'var(--fg-tertiary)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {t('auth.tgUserHint')}
      </p>
    </AuthShell>
  )
}

function LinkButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--fg-secondary)',
        fontSize: 'var(--text-xs)',
        cursor: 'pointer',
        textDecoration: 'underline',
      }}
    >
      {children}
    </button>
  )
}

// Только внутренние пути — токены/редиректы наружу не уводим
function safeReturnTo(raw) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}
