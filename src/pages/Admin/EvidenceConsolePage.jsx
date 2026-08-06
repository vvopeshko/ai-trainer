import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glass } from '../../components/ui/Glass.jsx'
import { useEvidenceAccess, useEvidenceClaims, useEvidenceQuestions } from '../../hooks/evidence.js'
import { EvidenceShell, ErrorState, LoadingState, StatusBadge } from './EvidenceShared.jsx'
import { CERTAINTY_LABELS, formatDate } from './evidenceUtils.js'
import { EvidenceLocaleProvider, useEvidenceLocale } from './evidenceI18n.jsx'

export default function EvidenceConsolePage() {
  return <EvidenceLocaleProvider><EvidenceConsole /></EvidenceLocaleProvider>
}

function EvidenceConsole() {
  const { language, t, content, term } = useEvidenceLocale()
  const [status, setStatus] = useState('in_review')
  const [questionId, setQuestionId] = useState('')
  const [view, setView] = useState('claims')
  const access = useEvidenceAccess()
  const allowed = access.isSuccess
  const questions = useEvidenceQuestions(allowed)
  const claims = useEvidenceClaims({ status, questionId, take: 100 }, allowed)
  const filters = [['', t('all')], ['in_review', statusLabel('in_review', language)], ['draft', statusLabel('draft', language)], ['approved', statusLabel('approved', language)], ['disputed', statusLabel('disputed', language)]]

  const stats = useMemo(() => {
    const rows = claims.data || []
    return {
      visible: rows.length,
      overdue: rows.filter((row) => new Date(row.reviewDueAt) < new Date()).length,
      sources: new Set(rows.flatMap((row) => row.evidenceLinks?.map((link) => link.workId) || [])).size,
    }
  }, [claims.data])

  if (access.isLoading) return <EvidenceShell><LoadingState /></EvidenceShell>
  if (access.isError) return <EvidenceShell><ErrorState error={access.error} onRetry={access.refetch} /></EvidenceShell>

  return (
    <EvidenceShell role={access.data.role}>
      <section className="evidence-hero">
        <div>
          <span className="evidence-eyebrow">{t('editorialWorkspace')}</span>
          <h1>{t('evidenceBase')}</h1>
          <p>{t('evidenceFlow')}</p>
        </div>
        <div className="evidence-stat-grid">
          <Metric value={stats.visible} label={t('claimsVisible')} />
          <Metric value={stats.sources} label={t('sources')} />
          <Metric value={stats.overdue} label={t('overdue')} danger={stats.overdue > 0} />
        </div>
      </section>

      <div className="evidence-toolbar">
        <div className="evidence-tabs" role="tablist">
          <button className={view === 'claims' ? 'is-active' : ''} onClick={() => setView('claims')}>{t('claims')}</button>
          <button className={view === 'questions' ? 'is-active' : ''} onClick={() => setView('questions')}>{t('questions')}</button>
        </div>
        {view === 'claims' && (
          <select className="evidence-select" value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
            <option value="">{t('allQuestions')}</option>
            {(questions.data || []).map((question) => <option key={question.id} value={question.id}>{question.id} · {term(question.topic)}</option>)}
          </select>
        )}
      </div>

      {view === 'claims' ? (
        <>
          <div className="evidence-filter-row">
            {filters.map(([value, label]) => (
              <button key={value || 'all'} className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>{label}</button>
            ))}
          </div>
          {claims.isLoading && <LoadingState compact />}
          {claims.isError && <ErrorState error={claims.error} onRetry={claims.refetch} />}
          {claims.data && <ClaimGrid claims={claims.data} language={language} t={t} content={content} />}
        </>
      ) : (
        <QuestionGrid questions={questions.data || []} loading={questions.isLoading} t={t} content={content} term={term} />
      )}
    </EvidenceShell>
  )
}

function Metric({ value, label, danger }) {
  return <Glass padding={16} radius={14} className={danger ? 'evidence-metric is-danger' : 'evidence-metric'}><strong>{value}</strong><span>{label}</span></Glass>
}

function ClaimGrid({ claims, language, t, content }) {
  if (!claims.length) return <div className="evidence-no-results">{t('noClaims')}</div>
  return (
    <div className="evidence-claim-grid">
      {claims.map((claim) => {
        const overdue = new Date(claim.reviewDueAt) < new Date()
        return (
          <Link to={`/admin/evidence/claims/${claim.id}`} key={claim.id} className="evidence-claim-card">
            <div className="evidence-card-top">
              <span className="evidence-id">{claim.id}</span>
              <StatusBadge status={claim.status} />
            </div>
            <h2>{content(claim, 'plainStatement')}</h2>
            <p className="evidence-question">{content(claim.claim.question, 'plainQuestion')}</p>
            <div className="evidence-card-meta">
              <span>{CERTAINTY_LABELS[language]?.[claim.certainty] || claim.certainty} · {t('certainty')}</span>
              <span>{t('sourceCount', { count: claim.evidenceLinks?.length || 0 })}</span>
              <span className={overdue ? 'is-overdue' : ''}>{t('reviewDate', { date: formatDate(claim.reviewDueAt, language) })}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function QuestionGrid({ questions, loading, t, content, term }) {
  if (loading) return <LoadingState compact />
  return (
    <div className="evidence-question-grid">
      {questions.map((question) => (
        <Link key={question.id} to={`/admin/evidence/questions/${question.id}`} className="evidence-question-link">
        <Glass padding={20} radius={16} className="evidence-question-card">
          <div className="evidence-card-top"><span className="evidence-id">{question.id}</span>{question.critical && <span className="evidence-critical">{t('critical')}</span>}</div>
          <h2>{content(question, 'plainQuestion')}</h2>
          <p className="evidence-scientific-caption">{content(question, 'question')}</p>
          <p>{content(question, 'scope')}</p>
          <div className="evidence-card-meta"><span>{term(question.topic)}</span><span>{t('claimCount', { count: question._count.claims })}</span><span>{t('assessmentCount', { count: question._count.assessments })}</span></div>
          <span className="evidence-inline-link">{t('openQuestion')} · {t('reviewEvery', { count: question.reviewIntervalMonths })}</span>
        </Glass>
        </Link>
      ))}
    </div>
  )
}

function statusLabel(status, language) {
  const labels = {
    ru: { draft: 'Черновики', in_review: 'На ревью', approved: 'Одобренные', disputed: 'Оспоренные' },
    en: { draft: 'Draft', in_review: 'In review', approved: 'Approved', disputed: 'Disputed' },
  }
  return labels[language][status]
}
