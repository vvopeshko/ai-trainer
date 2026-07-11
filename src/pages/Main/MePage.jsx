import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Glass, Button, ConfirmDialog } from '../../components/ui/index.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { usePlatform } from '../../contexts/PlatformContext.jsx'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPost, apiDelete } from '../../utils/api.js'
import { authClient } from '../../utils/authClient.js'
import { tokenStorage } from '../../utils/tokenStorage.js'
import { TelegramLoginWidget } from '../../components/web/TelegramLoginWidget.jsx'
import { canInstall, subscribeInstall, promptInstall, isStandalone, isIOS } from '../../utils/installPrompt.js'
import { isPushSupported, getPushSubscription, subscribePush, unsubscribePush } from '../../utils/pushNotifications.js'

// Профиль (/me). Web-версия, фазы 1–2 (product/ARCHITECTURE_WEB_AUTH.md):
// «Вход через браузер» (set-password — мост из Mini App), способы входа
// (Telegram привязка/отвязка + adoption, §6.5), «выйти на всех устройствах».

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
  const widgetEnabled = providersData?.providers?.includes('telegram_widget') && Boolean(providersData?.botUsername)
  // Кол-во способов входа для guard'а отвязки (сервер проверяет всё равно)
  const methodsCount = (me?.telegramId ? 1 : 0) + (me?.email ? 1 : 0)

  const [formOpen, setFormOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  // Установка PWA (только браузер, не standalone)
  const [installable, setInstallable] = useState(() => canInstall())
  const [installed, setInstalled] = useState(false)
  useEffect(() => subscribeInstall((can) => {
    setInstallable(can)
    if (!can) setInstalled(true) // appinstalled
  }), [])
  const showInstall = isWeb && !isStandalone() && (installable || installed || isIOS())

  async function install() {
    const ok = await promptInstall()
    if (ok) setInstalled(true)
  }

  // Push-уведомления (web/PWA). iOS в браузере пуши не умеет — только standalone.
  const pushAvailable = isWeb && isPushSupported() && (!isIOS() || isStandalone())
  const [pushState, setPushState] = useState('unknown') // unknown|on|off|denied|busy
  useEffect(() => {
    if (!pushAvailable) return
    getPushSubscription()
      .then((sub) => setPushState(sub ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off'))
      .catch(() => setPushState('off'))
  }, [pushAvailable])

  async function togglePush() {
    setPushState('busy')
    if (pushState === 'on') {
      await unsubscribePush()
      setPushState('off')
    } else {
      const result = await subscribePush()
      if (result === 'subscribed') setPushState('on')
      else if (result === 'denied') setPushState('denied')
      else {
        setPushState('off')
        setAccError(t('me.pushError'))
      }
    }
  }

  // Способы входа (фаза 2)
  const [accNotice, setAccNotice] = useState(null)
  const [accError, setAccError] = useState(null)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [adoptWidgetData, setAdoptWidgetData] = useState(null) // payload виджета для /adopt

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
      if (err.status === 409) {
        // Email занят — возможно, это собственный пустой веб-аккаунт юзера.
        // Молча пробуем adoption с теми же кредами (§6.5, зеркальный флоу).
        try {
          const adopted = await apiPost('/api/v1/auth/adopt-by-password', { email, password })
          setNotice(t('me.adoptedFromWeb', { email: adopted.email }))
          setFormOpen(false)
          setPassword('')
          queryClient.invalidateQueries({ queryKey: ['auth', 'init'] })
          return
        } catch {
          setError(t('me.webAccessEmailTaken'))
        }
      } else {
        setError(t('me.webAccessError'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function linkTelegram(widgetUser) {
    setAccError(null)
    setAccNotice(null)
    try {
      await apiPost('/api/v1/auth/telegram/link', widgetUser)
      setAccNotice(t('accounts.linked'))
      queryClient.invalidateQueries({ queryKey: ['auth', 'init'] })
    } catch (err) {
      if (err.status === 409 && err.payload?.adoptable) {
        setAdoptWidgetData(widgetUser) // текущий аккаунт пуст → предлагаем перенос
      } else if (err.payload?.error === 'telegram_linked_elsewhere') {
        setAccError(t('accounts.telegramLinkedElsewhere'))
      } else if (err.payload?.error === 'another_telegram_linked') {
        setAccError(t('accounts.anotherTelegramLinked'))
      } else {
        setAccError(t('accounts.error'))
      }
    }
  }

  async function confirmAdopt() {
    try {
      const { token } = await apiPost('/api/v1/auth/adopt', adoptWidgetData)
      tokenStorage.set(token)
      window.location.replace('/') // перезагрузка: приложение откроется под старым аккаунтом с данными
    } catch {
      setAdoptWidgetData(null)
      setAccError(t('accounts.error'))
    }
  }

  async function confirmUnlink() {
    setUnlinkOpen(false)
    try {
      await apiDelete('/api/v1/auth/telegram')
      queryClient.invalidateQueries({ queryKey: ['auth', 'init'] })
    } catch (err) {
      setAccError(err.payload?.error === 'last_method' ? t('accounts.lastMethodError') : t('accounts.error'))
    }
  }

  async function logoutAll() {
    setAccError(null)
    try {
      await apiDelete('/api/v1/auth/sessions')
      if (isWeb) {
        tokenStorage.clear()
        window.location.replace('/login')
      } else {
        setAccNotice(t('accounts.logoutAllDone'))
      }
    } catch {
      setAccError(t('accounts.error'))
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

      {/* Способы входа (фаза 2) */}
      {me && (
        <Glass radius={16} padding="var(--space-4)" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>{t('accounts.title')}</div>

          {/* Telegram */}
          <MethodRow
            label={t('accounts.telegram')}
            value={me.telegramId ? (user?.username ? `@${user.username}` : t('accounts.connected')) : null}
            action={
              me.telegramId ? (
                isWeb && methodsCount > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => setUnlinkOpen(true)}>
                    {t('accounts.disconnect')}
                  </Button>
                ) : null
              ) : isWeb && widgetEnabled ? (
                <TelegramLoginWidget
                  botUsername={providersData.botUsername}
                  size="medium"
                  onAuth={linkTelegram}
                />
              ) : null
            }
          />

          {/* Email — статус дублирует блок выше, здесь только строка-сводка */}
          {emailEnabled && (
            <MethodRow
              label={t('accounts.email')}
              value={me.email || null}
              badge={me.email ? (me.emailVerified ? t('me.webAccessVerified') : t('me.webAccessPending')) : null}
              badgeOk={me.emailVerified}
            />
          )}

          {accError && (
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{accError}</p>
          )}
          {accNotice && (
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)' }}>{accNotice}</p>
          )}

          {/* Сессии браузера есть у обоих платформ (если юзер входил через веб) */}
          {me.email && (
            <Button variant="ghost" size="sm" onClick={logoutAll} style={{ marginTop: 'var(--space-3)' }}>
              {t('accounts.logoutAll')}
            </Button>
          )}
        </Glass>
      )}

      {/* Push-уведомления (web/PWA; в Mini App уведомления шлёт бот) */}
      {pushAvailable && (
        <Glass radius={16} padding="var(--space-4)" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{t('me.pushTitle')}</div>
          {pushState === 'on' ? (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)' }}>
                {t('me.pushEnabled')}
              </p>
              <Button variant="ghost" size="sm" onClick={togglePush}>
                {t('me.pushDisable')}
              </Button>
            </>
          ) : pushState === 'denied' ? (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', lineHeight: 1.4 }}>
              {t('me.pushDenied')}
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', lineHeight: 1.4 }}>
                {t('me.pushSubtitle')}
              </p>
              <Button variant="accent" size="md" loading={pushState === 'busy'} onClick={togglePush}>
                {t('me.pushEnable')}
              </Button>
            </>
          )}
        </Glass>
      )}
      {isWeb && isPushSupported() && isIOS() && !isStandalone() && (
        <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', lineHeight: 1.4 }}>
          {t('me.pushIosHint')}
        </p>
      )}

      {/* Установка PWA на телефон (браузер, не standalone) */}
      {showInstall && (
        <Glass radius={16} padding="var(--space-4)" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{t('me.installTitle')}</div>
          {installed ? (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)' }}>
              {t('me.installDone')}
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', lineHeight: 1.4 }}>
                {t('me.installSubtitle')}
              </p>
              {installable ? (
                <Button variant="accent" size="md" onClick={install}>
                  {t('me.installCta')}
                </Button>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)' }}>
                  {t('me.installIosHint')}
                </p>
              )}
            </>
          )}
        </Glass>
      )}

      {/* Выход — только web (в Mini App сессией управляет Telegram) */}
      {isWeb && (
        <Button variant="danger" size="md" block onClick={logout}>
          {t('me.logout')}
        </Button>
      )}

      {/* Отвязка Telegram: предупреждение об отваливающихся бот-фичах */}
      <ConfirmDialog
        open={unlinkOpen}
        title={t('accounts.unlinkTelegramTitle')}
        message={t('accounts.unlinkTelegramWarning')}
        confirmLabel={t('accounts.disconnect')}
        variant="danger"
        onConfirm={confirmUnlink}
        onCancel={() => setUnlinkOpen(false)}
      />

      {/* Adoption: пустой веб-аккаунт → перенос входов на аккаунт с данными */}
      <ConfirmDialog
        open={Boolean(adoptWidgetData)}
        title={t('accounts.adoptionTitle')}
        message={t('accounts.adoptionText')}
        confirmLabel={t('accounts.adoptionConfirm')}
        cancelLabel={t('accounts.adoptionCancel')}
        onConfirm={confirmAdopt}
        onCancel={() => setAdoptWidgetData(null)}
      />
    </div>
  )
}

function MethodRow({ label, value, badge, badgeOk, action }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        padding: 'var(--space-2) 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', minWidth: 72 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)', wordBreak: 'break-all' }}>
        {value ?? '—'}
      </span>
      {badge && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            padding: '2px 8px',
            borderRadius: 999,
            background: badgeOk ? 'hsla(140,55%,40%,0.2)' : 'hsla(38,90%,55%,0.18)',
            color: badgeOk ? 'hsl(140,55%,75%)' : 'hsl(38,90%,72%)',
          }}
        >
          {badge}
        </span>
      )}
      {action}
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
