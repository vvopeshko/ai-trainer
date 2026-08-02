export const STATUS_META = {
  draft: { label: 'Черновик', tone: 'neutral' },
  in_review: { label: 'На ревью', tone: 'warning' },
  approved: { label: 'Одобрено', tone: 'success' },
  disputed: { label: 'Оспорено', tone: 'danger' },
  superseded: { label: 'Устарело', tone: 'neutral' },
}

export const CERTAINTY_LABELS = {
  high: 'Высокая',
  moderate: 'Средняя',
  low: 'Низкая',
  very_low: 'Очень низкая',
}

export const BLOCKER_LABELS = {
  claim_not_in_review: 'Claim ещё не отправлен на ревью',
  claim_review_expired: 'Дата пересмотра claim истекла',
  claim_has_no_supporting_evidence: 'Нет поддерживающих исследований',
}

export function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Неизвестно', tone: 'neutral' }
}

export function blockerLabel(blocker) {
  if (BLOCKER_LABELS[blocker]) return BLOCKER_LABELS[blocker]
  const [code, id] = blocker.split(':')
  const labels = {
    work_retracted: 'Источник отозван',
    work_status_unverified: 'Статус источника не проверен',
    assessment_not_approved: 'Assessment не одобрен',
  }
  return `${labels[code] || code}${id ? ` · ${id}` : ''}`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value))
}

export function errorMessage(error) {
  return error?.payload?.error || error?.message || 'Не удалось выполнить действие'
}
