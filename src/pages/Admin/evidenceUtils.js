export const STATUS_META = {
  ru: { draft: 'Черновик', in_review: 'На ревью', approved: 'Одобрено', disputed: 'Оспорено', superseded: 'Устарело' },
  en: { draft: 'Draft', in_review: 'In review', approved: 'Approved', disputed: 'Disputed', superseded: 'Superseded' },
}

export const CERTAINTY_LABELS = {
  ru: { high: 'Высокая', moderate: 'Средняя', low: 'Низкая', very_low: 'Очень низкая' },
  en: { high: 'High', moderate: 'Moderate', low: 'Low', very_low: 'Very low' },
}

export const BLOCKER_LABELS = {
  ru: { claim_not_in_review: 'Тезис ещё не отправлен на ревью', claim_review_expired: 'Дата пересмотра тезиса истекла', claim_has_no_supporting_evidence: 'Нет поддерживающих исследований', claim_muscle_scope_missing: 'Не указаны мышцы для мышечно-специфичного вывода', claim_measurement_scope_missing: 'Для локального результата не указан метод измерения' },
  en: { claim_not_in_review: 'Claim is not in review', claim_review_expired: 'Claim review is overdue', claim_has_no_supporting_evidence: 'Claim has no supporting evidence', claim_muscle_scope_missing: 'Muscles are missing for a muscle-specific claim', claim_measurement_scope_missing: 'Measurement method is missing for a regional result' },
}

const TONES = { in_review: 'warning', approved: 'success', disputed: 'danger' }

export function statusMeta(status, language = 'ru') {
  return { label: STATUS_META[language]?.[status] || status || (language === 'ru' ? 'Неизвестно' : 'Unknown'), tone: TONES[status] || 'neutral' }
}

export function blockerLabel(blocker, language = 'ru') {
  if (BLOCKER_LABELS[language]?.[blocker]) return BLOCKER_LABELS[language][blocker]
  const [code, id] = blocker.split(':')
  const labels = language === 'ru'
    ? { work_retracted: 'Источник отозван', work_status_unverified: 'Статус источника не проверен', assessment_not_approved: 'Оценка исследования не одобрена' }
    : { work_retracted: 'Source is retracted', work_status_unverified: 'Source status is not verified', assessment_not_approved: 'Assessment is not approved' }
  return `${labels[code] || code}${id ? ` · ${id}` : ''}`
}

export function formatDate(value, language = 'ru') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export function errorMessage(error, language = 'ru') {
  return error?.payload?.error || error?.message || (language === 'ru' ? 'Не удалось выполнить действие' : 'Could not complete the action')
}
