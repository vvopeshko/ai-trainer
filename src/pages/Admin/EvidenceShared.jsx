import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { statusMeta } from './evidenceUtils.js'
import './evidence.css'

export function EvidenceShell({ role, children }) {
  return (
    <div className="evidence-admin">
      <header className="evidence-header">
        <Link className="evidence-brand" to="/admin/evidence">
          <span className="evidence-brand-mark">E</span>
          <span><strong>Evidence Console</strong><small>AI Trainer knowledge base</small></span>
        </Link>
        <div className="evidence-header-actions">
          {role && <span className="evidence-role">{role}</span>}
          <Link className="evidence-app-link" to="/">В приложение</Link>
        </div>
      </header>
      <main className="evidence-main">{children}</main>
    </div>
  )
}

export function StatusBadge({ status }) {
  const meta = statusMeta(status)
  return <span className={`evidence-badge evidence-badge--${meta.tone}`}>{meta.label}</span>
}

export function LoadingState({ compact = false }) {
  return (
    <div className={compact ? 'evidence-loading evidence-loading--compact' : 'evidence-loading'}>
      <span className="evidence-spinner" />
      <span>Загружаем evidence base…</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const denied = error?.status === 403 && error?.payload?.code === 'EVIDENCE_ACCESS_DENIED'
  return (
    <div className="evidence-centered">
      <Glass padding={28} radius={18} className="evidence-empty-card">
        <div className={`evidence-empty-icon ${denied ? 'is-denied' : ''}`}>{denied ? '!' : '↻'}</div>
        <h1>{denied ? 'Нет доступа к Evidence Console' : 'Не удалось загрузить данные'}</h1>
        <p>{denied
          ? 'Добавьте UUID пользователя или tg:<telegramId> в EVIDENCE_REVIEWER_IDS / EVIDENCE_APPROVER_IDS на сервере.'
          : (error?.payload?.error || error?.message || 'Проверьте соединение с API и попробуйте ещё раз.')}</p>
        {onRetry && <Button variant="secondary" onClick={onRetry}>Повторить</Button>}
      </Glass>
    </div>
  )
}

export function ActionDialog({ title, description, confirmLabel, variant = 'accent', busy, onClose, onConfirm }) {
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
          <span>Комментарий к решению</span>
          <textarea name="comment" minLength={3} maxLength={2000} required autoFocus
            placeholder="Почему принимаем это решение?" />
        </label>
        <div className="evidence-modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
          <Button type="submit" variant={variant} loading={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </div>
  )
}
