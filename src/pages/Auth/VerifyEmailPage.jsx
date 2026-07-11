import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/index.js'
import { useTranslation } from '../../i18n/useTranslation.js'
import { AuthShell, AuthError, AuthNote } from './AuthShell.jsx'

// Финал верификации email: BA обрабатывает GET /api/auth/verify-email?token=
// на API-домене и редиректит сюда (callbackURL). При ошибке добавляет ?error=.

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const error = params.get('error')

  return (
    <AuthShell>
      {error ? (
        <>
          <AuthError>{t('auth.verifyExpired')}</AuthError>
          <Button variant="secondary" size="lg" block onClick={() => navigate('/login')}>
            {t('auth.backToLogin')}
          </Button>
        </>
      ) : (
        <>
          <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            {t('auth.verifySuccess')}
          </h1>
          <AuthNote>{t('auth.verifySuccessHint')}</AuthNote>
          <Button variant="accent" size="lg" block onClick={() => navigate('/login')}>
            {t('auth.goToLogin')}
          </Button>
        </>
      )}
    </AuthShell>
  )
}
