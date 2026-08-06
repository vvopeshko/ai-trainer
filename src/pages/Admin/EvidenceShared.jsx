import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { statusMeta } from './evidenceUtils.js'
import { useEvidenceLocale } from './evidenceI18n.jsx'
import './evidence.css'

export function EvidenceShell({ role, children }) {
  const { language, setLanguage, t } = useEvidenceLocale()
  return (
    <div className="evidence-admin" lang={language}>
      <header className="evidence-header">
        <Link className="evidence-brand" to="/admin/evidence">
          <span className="evidence-brand-mark">E</span>
          <span><strong>Evidence Console</strong><small>{t('knowledgeBase')}</small></span>
        </Link>
        <div className="evidence-header-actions">
          <div className="evidence-language" role="group" aria-label="Language">
            {['ru', 'en'].map((item) => <button key={item} className={language === item ? 'is-active' : ''} onClick={() => setLanguage(item)}>{item.toUpperCase()}</button>)}
          </div>
          {role && <span className="evidence-role">{language === 'ru' ? (role === 'approver' ? 'эксперт' : 'рецензент') : role}</span>}
          <Link className="evidence-app-link" to="/">{t('toApp')}</Link>
        </div>
      </header>
      <main className="evidence-main">{children}</main>
    </div>
  )
}

export function StatusBadge({ status }) {
  const { language } = useEvidenceLocale()
  const meta = statusMeta(status, language)
  return <span className={`evidence-badge evidence-badge--${meta.tone}`}>{meta.label}</span>
}

export function LoadingState({ compact = false }) {
  const { t } = useEvidenceLocale()
  return (
    <div className={compact ? 'evidence-loading evidence-loading--compact' : 'evidence-loading'}>
      <span className="evidence-spinner" />
      <span>{t('loading')}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const { t } = useEvidenceLocale()
  const denied = error?.status === 403 && error?.payload?.code === 'EVIDENCE_ACCESS_DENIED'
  return (
    <div className="evidence-centered">
      <Glass padding={28} radius={18} className="evidence-empty-card">
        <div className={`evidence-empty-icon ${denied ? 'is-denied' : ''}`}>{denied ? '!' : '↻'}</div>
        <h1>{denied ? t('accessDenied') : t('loadFailed')}</h1>
        <p>{denied
          ? t('accessHint')
          : (error?.payload?.error || error?.message || t('connectionHint'))}</p>
        {onRetry && <Button variant="secondary" onClick={onRetry}>{t('retry')}</Button>}
      </Glass>
    </div>
  )
}

export function ActionDialog({ title, description, confirmLabel, variant = 'accent', busy, onClose, onConfirm }) {
  const { t } = useEvidenceLocale()
  return (
    <div className="evidence-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="evidence-modal" onSubmit={(event) => {
        event.preventDefault()
        const comment = new FormData(event.currentTarget).get('comment')?.trim()
        if (comment) onConfirm(comment)
      }}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        <label className="evidence-field">
          <span>{t('decisionComment')}</span>
          <textarea name="comment" minLength={3} maxLength={2000} required autoFocus
            placeholder={t('decisionWhy')} />
        </label>
        <div className="evidence-modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant={variant} loading={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </div>
  )
}
