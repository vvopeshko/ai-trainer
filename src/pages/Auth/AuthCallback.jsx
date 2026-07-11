import { useEffect, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation.js'
import { authClient } from '../../utils/authClient.js'
import { tokenStorage } from '../../utils/tokenStorage.js'
import { AuthShell, AuthNote } from './AuthShell.jsx'

// Возврат из OAuth-редиректа (handoff, §6.2): ?ott= — одноразовый короткоживущий
// код. Session-токены в URL не ездят никогда: меняем ott на сессию и чистим URL.

export default function AuthCallback() {
  const { t } = useTranslation()
  const ran = useRef(false) // StrictMode: эффект дважды, ott одноразовый

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(window.location.search)
    const ott = params.get('ott')
    const returnTo = safeReturnTo(params.get('returnTo'))

    if (!ott) {
      window.location.replace('/login?hint=oauth_failed')
      return
    }

    authClient.oneTimeToken
      .verify({ token: ott })
      .then(({ data }) => {
        const token = data?.session?.token
        if (token) {
          tokenStorage.set(token)
          // replace: вычищаем ott из URL и истории
          window.location.replace(returnTo)
        } else {
          window.location.replace('/login?hint=oauth_failed')
        }
      })
      .catch(() => window.location.replace('/login?hint=oauth_failed'))
  }, [])

  return (
    <AuthShell>
      <AuthNote>{t('auth.loggingIn')}</AuthNote>
    </AuthShell>
  )
}

function safeReturnTo(raw) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}
