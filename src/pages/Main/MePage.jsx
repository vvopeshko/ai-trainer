import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Glass, Button } from '../../components/ui/index.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { usePlatform } from '../../contexts/PlatformContext.jsx'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPost } from '../../utils/api.js'
import { authClient } from '../../utils/authClient.js'
import { tokenStorage } from '../../utils/tokenStorage.js'

// Профиль (/me). Фаза 1 web-версии: блок «Вход через браузер» — мост из
// Mini App в веб (set-password, §6.3 ARCHITECTURE_WEB_AUTH.md). На web —
// плюс кнопка «Выйти». Фаза 2 добавит сюда полный AccountSettings.

export default function MePage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { isWeb } = usePlatform()
  const queryClient = useQueryClient()

  const { data: initData } = useQuery({
    queryKey: ['auth', 'init'],
    queryFn: () => apiPost('/api/v1/auth/init'),
  })
  const { data: providersData } = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => apiGet('/api/v1/auth/providers'),
    staleTime: 60 * 60_000,
  })
  const me = initData?.user
  const emailEnabled = providersData?.providers?.includes('email')

  const [formOpen, setFormOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiPost('/api/v1/auth/set-password', { email, password })
      setNotice(res.verificationSent ? t('me.webAccessVerifySent') : t('me.webAccessDone'))
      setFormOpen(false)
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['auth', 'init'] })
    } catch (err) {
      setError(err.status === 409 ? t('me.webAccessEmailTaken') : t('me.webAccessError'))
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    authClient.signOut().finally(() => {
      tokenStorage.clear()
      window.location.replace('/login')
    })
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'

  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>
        {t('me.title')}
      </h1>

      {/* Карточка профиля */}
      <Glass specular radius={16} padding="var(--space-4)" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'hsla(var(--accent-h,158),55%,45%,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
              }}
            >
              {(user?.firstName || '?')[0]}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>{displayName}</div>
            {user?.username && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)' }}>@{user.username}</div>
            )}
          </div>
        </div>
      </Glass>

      {/* Вход через браузер (set-password) */}
      {emailEnabled && (
        <Glass radius={16} padding="var(--space-4)" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{t('me.webAccessTitle')}</div>

          {me?.email && !formOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>{me.email}</span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: me.emailVerified ? 'hsla(140,55%,40%,0.2)' : 'hsla(38,90%,55%,0.18)',
                  color: me.emailVerified ? 'hsl(140,55%,75%)' : 'hsl(38,90%,72%)',
                }}
              >
                {me.emailVerified ? t('me.webAccessVerified') : t('me.webAccessPending')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => { setEmail(me.email); setFormOpen(true) }}>
                {t('me.webAccessChange')}
              </Button>
            </div>
          ) : !formOpen ? (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', lineHeight: 1.4 }}>
                {t('me.webAccessSubtitle')}
              </p>
              <Button variant="secondary" size="md" onClick={() => setFormOpen(true)}>
                {t('me.webAccessCta')}
              </Button>
            </>
          ) : null}

          {formOpen && (
            <form onSubmit={submit} style={{ marginTop: 'var(--space-3)' }}>
              <input
                type="email"
                required
                placeholder={t('auth.emailLabel')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={inputStyle}
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder={t('auth.passwordLabel')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{ ...inputStyle, marginTop: 'var(--space-2)' }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Button type="submit" variant="accent" size="md" loading={busy}>
                  {t('me.webAccessSave')}
                </Button>
                <Button type="button" variant="ghost" size="md" onClick={() => { setFormOpen(false); setError(null) }}>
                  {t('a11y.back')}
                </Button>
              </div>
            </form>
          )}

          {error && (
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{error}</p>
          )}
          {notice && (
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)' }}>{notice}</p>
          )}
        </Glass>
      )}

      {/* Выход — только web (в Mini App сессией управляет Telegram) */}
      {isWeb && (
        <Button variant="danger" size="md" block onClick={logout}>
          {t('me.logout')}
        </Button>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--fg-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
}
