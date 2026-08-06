import { Link, useParams } from 'react-router-dom'
import { Glass } from '../../components/ui/Glass.jsx'
import { useEvidenceAccess, useEvidenceQuestion } from '../../hooks/evidence.js'
import { ErrorState, EvidenceShell, LoadingState, StatusBadge } from './EvidenceShared.jsx'
import { CERTAINTY_LABELS, formatDate } from './evidenceUtils.js'
import { EvidenceLocaleProvider, useEvidenceLocale } from './evidenceI18n.jsx'

export default function EvidenceQuestionPage() {
  return <EvidenceLocaleProvider><EvidenceQuestion /></EvidenceLocaleProvider>
}

function EvidenceQuestion() {
  const { id } = useParams()
  const { language, t, content, term } = useEvidenceLocale()
  const access = useEvidenceAccess()
  const query = useEvidenceQuestion(id, access.isSuccess)
  const question = query.data

  if (access.isLoading || (access.isSuccess && query.isLoading)) return <EvidenceShell><LoadingState /></EvidenceShell>
  if (access.isError) return <EvidenceShell><ErrorState error={access.error} onRetry={access.refetch} /></EvidenceShell>
  if (query.isError) return <EvidenceShell role={access.data?.role}><ErrorState error={query.error} onRetry={query.refetch} /></EvidenceShell>
  if (!question) return null

  const coverage = question.coverage
  const recommendations = uniqueBy(question.claims.flatMap((claim) =>
    claim.recommendationLinks.map(({ recommendation }) => recommendation)), 'id')

  return (
    <EvidenceShell role={access.data.role}>
      <Link className="evidence-back" to="/admin/evidence">{t('backQuestions')}</Link>
      <section className="evidence-detail-head evidence-question-head">
        <div>
          <div className="evidence-detail-labels"><span className="evidence-id">{question.id}</span>{question.critical && <span className="evidence-critical">{t('critical')}</span>}</div>
          <h1>{content(question, 'plainQuestion')}</h1>
          <p>{content(question, 'scope')}</p>
        </div>
      </section>

      <div className="evidence-question-metrics">
        <Metric value={coverage.linkedPublications} label={t('linkedPublications')} />
        <Metric value={coverage.decisionPublications} label={t('decisionPublications')} />
        <Metric value={coverage.assessedPublications} label={t('assessedPublications')} />
        <Metric value={coverage.fullTextReviewed} label={t('fullTextReviewed')} />
      </div>

      <div className="evidence-detail-grid">
        <div className="evidence-detail-main">
          <Section title={t('researchCoverage')}>
            <div className="evidence-scientific-box"><strong>{t('scientificQuestion')}</strong><p>{content(question, 'question')}</p></div>
            <dl className="evidence-definition-grid">
              <div><dt>{t('reportedReviewStudies')}</dt><dd>{coverage.includedStudiesReported || '—'}</dd></div>
              <div><dt>{t('currentVerified')}</dt><dd>{coverage.currentStatusVerified} / {coverage.linkedPublications}</dd></div>
              <div><dt>{t('notDeduplicated')}</dt><dd>{coverage.includedStudiesDeduplicated ?? t('notSpecified')}</dd></div>
              <div><dt>{t('searchCutoff')}</dt><dd>{formatDate(coverage.searchCutoff, language)}</dd></div>
            </dl>
            <div className="evidence-caveat"><strong>{t('coverageCaveat')}</strong><p>{t('coverageCaveatText')}</p></div>
          </Section>

          <Section title={t('claims')} aside={`${question.claims.length}`}>
            <div className="evidence-compact-list">
              {question.claims.map((claim) => (
                <Link key={claim.id} to={`/admin/evidence/claims/${claim.id}`} className="evidence-compact-card">
                  <div className="evidence-card-top"><span className="evidence-id">{claim.id}</span><StatusBadge status={claim.status} /></div>
                  <h3>{content(claim, 'plainStatement')}</h3>
                  <div className="evidence-card-meta"><span>{CERTAINTY_LABELS[language]?.[claim.certainty]}</span><span>{claim.muscles?.length ? claim.muscles.join(', ') : t('notSpecified')}</span><span>{claim.approvalBlockers.length} · {t('approvalReadiness')}</span></div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title={t('works')} aside={`${question.works.length}`}>
            <div className="evidence-source-list">
              {question.works.map((work) => {
                const assessment = question.assessments.find((item) => item.workId === work.id)
                return <article className="evidence-source-row" key={work.id}>
                  <div className="evidence-source-body">
                    <div className="evidence-source-labels"><span className="evidence-relation">{term(work.workType)}</span><span>{work.year}</span></div>
                    <h3>{work.title}</h3>
                    <p>{work.id} · {term(work.reviewScope)} · {term(work.correctionStatus)}</p>
                    {work.includedStudiesCount && <p className="evidence-source-count">{t('includedStudies', { count: work.includedStudiesCount })}</p>}
                    {assessment?.mainResults?.length > 0 && <ul className="evidence-inline-results">{assessment.mainResults.map((result) => <li key={result}>{result}</li>)}</ul>}
                  </div>
                  {assessment ? <StatusBadge status={assessment.status} /> : <span className="evidence-warning-text">{t('assessmentMissing')}</span>}
                </article>
              })}
            </div>
          </Section>

          <Section title={t('recommendations')} aside={`${recommendations.length}`}>
            {recommendations.length ? recommendations.map((item) => <article className="evidence-recommendation" key={item.id}>
              <div className="evidence-card-top"><span className="evidence-id">{item.id}</span><StatusBadge status={item.status} /></div>
              <h3>{content(item, 'guidance')}</h3><p>{content(item, 'implementationHeuristic')}</p>
            </article>) : <p className="evidence-muted">{t('noItems')}</p>}
          </Section>

          <Section title={t('usages')} aside={`${question.aiTests.length + question.blogOutlines.length}`}>
            <div className="evidence-usage-grid">
              <div><h3>{t('aiTests')}</h3>{question.aiTests.length ? <ul>{question.aiTests.map(({ id: testId, payload }) => <li key={testId}><span className="evidence-id">{testId}</span>{payload.question}</li>)}</ul> : <p className="evidence-muted">{t('noItems')}</p>}</div>
              <div><h3>{t('blogOutlines')}</h3>{question.blogOutlines.length ? <ul>{question.blogOutlines.map(({ id: outlineId, payload }) => <li key={outlineId}><span className="evidence-id">{outlineId}</span>{payload.workingTitle}</li>)}</ul> : <p className="evidence-muted">{t('noItems')}</p>}</div>
            </div>
          </Section>

          <Section title={t('auditTrail')} aside={t('eventCount', { count: question.audit.length })}>
            {question.audit.length ? <div className="evidence-audit-list">{question.audit.map((event) => <div key={event.id}><span className="evidence-audit-dot" /><div><strong>{event.action}</strong><p>{event.comment || t('noComment')}</p><small>{event.entityType} · {event.entityId} · {formatDate(event.createdAt, language)}</small></div></div>)}</div> : <p className="evidence-muted">{t('noAudit')}</p>}
          </Section>
        </div>

        <aside className="evidence-detail-aside">
          <Glass padding={20} radius={16}>
            <div className="evidence-section-title"><h2>{t('collectionMethod')}</h2></div>
            <dl className="evidence-side-meta">
              <div><dt>{t('searchDate')}</dt><dd>{formatDate(question.searchDate, language)}</dd></div>
              <div><dt>{t('databases')}</dt><dd>{question.searchStrategy.databases.join(', ')}</dd></div>
              <div><dt>{t('searchQueries')}</dt><dd>{question.searchStrategy.queries.join('; ')}</dd></div>
            </dl>
            {question.searchNotes && <p className="evidence-side-note">{question.searchNotes}</p>}
          </Glass>
        </aside>
      </div>
    </EvidenceShell>
  )
}

function Metric({ value, label }) {
  return <Glass padding={16} radius={14} className="evidence-metric"><strong>{value}</strong><span>{label}</span></Glass>
}

function Section({ title, aside, children }) {
  return <Glass padding={22} radius={16} className="evidence-section"><div className="evidence-section-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>{children}</Glass>
}

function uniqueBy(items, key) {
  return [...new Map(items.map((item) => [item[key], item])).values()]
}
