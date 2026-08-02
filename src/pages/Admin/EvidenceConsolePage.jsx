import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glass } from '../../components/ui/Glass.jsx'
import { useEvidenceAccess, useEvidenceClaims, useEvidenceQuestions } from '../../hooks/evidence.js'
import { EvidenceShell, ErrorState, LoadingState, StatusBadge } from './EvidenceShared.jsx'
import { CERTAINTY_LABELS, formatDate } from './evidenceUtils.js'

const FILTERS = [
  ['', 'Все'],
  ['in_review', 'На ревью'],
  ['draft', 'Черновики'],
  ['approved', 'Одобренные'],
  ['disputed', 'Оспоренные'],
]

export default function EvidenceConsolePage() {
  const [status, setStatus] = useState('in_review')
  const [questionId, setQuestionId] = useState('')
  const [view, setView] = useState('claims')
  const access = useEvidenceAccess()
  const allowed = access.isSuccess
  const questions = useEvidenceQuestions(allowed)
  const claims = useEvidenceClaims({ status, questionId, take: 100 }, allowed)

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
          <span className="evidence-eyebrow">Editorial workspace</span>
          <h1>База доказательств</h1>
          <p>Исследования → assessments → claims → рекомендации для AI-тренера и контента.</p>
        </div>
        <div className="evidence-stat-grid">
          <Metric value={stats.visible} label="claims в выборке" />
          <Metric value={stats.sources} label="источников" />
          <Metric value={stats.overdue} label="просрочено" danger={stats.overdue > 0} />
        </div>
      </section>

      <div className="evidence-toolbar">
        <div className="evidence-tabs" role="tablist">
          <button className={view === 'claims' ? 'is-active' : ''} onClick={() => setView('claims')}>Claims</button>
          <button className={view === 'questions' ? 'is-active' : ''} onClick={() => setView('questions')}>Questions</button>
        </div>
        {view === 'claims' && (
          <select className="evidence-select" value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
            <option value="">Все research questions</option>
            {(questions.data || []).map((question) => <option key={question.id} value={question.id}>{question.id} · {question.topic}</option>)}
          </select>
        )}
      </div>

      {view === 'claims' ? (
        <>
          <div className="evidence-filter-row">
            {FILTERS.map(([value, label]) => (
              <button key={value || 'all'} className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>{label}</button>
            ))}
          </div>
          {claims.isLoading && <LoadingState compact />}
          {claims.isError && <ErrorState error={claims.error} onRetry={claims.refetch} />}
          {claims.data && <ClaimGrid claims={claims.data} />}
        </>
      ) : (
        <QuestionGrid questions={questions.data || []} loading={questions.isLoading} />
      )}
    </EvidenceShell>
  )
}

function Metric({ value, label, danger }) {
  return <Glass padding={16} radius={14} className={danger ? 'evidence-metric is-danger' : 'evidence-metric'}><strong>{value}</strong><span>{label}</span></Glass>
}

function ClaimGrid({ claims }) {
  if (!claims.length) return <div className="evidence-no-results">В этой выборке claims пока нет.</div>
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
            <h2>{claim.statement}</h2>
            <p className="evidence-question">{claim.claim.question.question}</p>
            <div className="evidence-card-meta">
              <span>{CERTAINTY_LABELS[claim.certainty] || claim.certainty} certainty</span>
              <span>{claim.evidenceLinks?.length || 0} sources</span>
              <span className={overdue ? 'is-overdue' : ''}>review {formatDate(claim.reviewDueAt)}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function QuestionGrid({ questions, loading }) {
  if (loading) return <LoadingState compact />
  return (
    <div className="evidence-question-grid">
      {questions.map((question) => (
        <Glass key={question.id} padding={20} radius={16} className="evidence-question-card">
          <div className="evidence-card-top"><span className="evidence-id">{question.id}</span>{question.critical && <span className="evidence-critical">critical</span>}</div>
          <h2>{question.question}</h2>
          <p>{question.scope}</p>
          <div className="evidence-card-meta"><span>{question.topic}</span><span>{question._count.claims} claims</span><span>{question._count.assessments} assessments</span></div>
          <span className="evidence-inline-link">Review every {question.reviewIntervalMonths} months</span>
        </Glass>
      ))}
    </div>
  )
}
