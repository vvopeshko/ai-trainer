import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useEvidenceAccess, useEvidenceAction, useEvidenceClaim, useEvidenceRuntime } from '../../hooks/evidence.js'
import { ActionDialog, ErrorState, EvidenceShell, LoadingState, StatusBadge } from './EvidenceShared.jsx'
import { blockerLabel, CERTAINTY_LABELS, errorMessage, formatDate } from './evidenceUtils.js'
import { EvidenceLocaleProvider, useEvidenceLocale } from './evidenceI18n.jsx'

export default function EvidenceClaimPage() {
  return <EvidenceLocaleProvider><EvidenceClaim /></EvidenceLocaleProvider>
}

function EvidenceClaim() {
  const { id } = useParams()
  const { language, t, content, term } = useEvidenceLocale()
  const toast = useToast()
  const access = useEvidenceAccess()
  const claimQuery = useEvidenceClaim(id, access.isSuccess)
  const action = useEvidenceAction()
  const [dialog, setDialog] = useState(null)
  const [assessmentEdit, setAssessmentEdit] = useState(null)
  const [showRuntime, setShowRuntime] = useState(false)
  const claim = claimQuery.data
  const runtime = useEvidenceRuntime(claim?.claim.questionId, '', showRuntime)
  const isApprover = access.data?.role === 'approver'
  const termValue = (value) => term(value)

  const assessmentsByWork = useMemo(() => new Map(
    (claim?.assessments || []).map((assessment) => [assessment.workId, assessment]),
  ), [claim?.assessments])

  if (access.isLoading || (access.isSuccess && claimQuery.isLoading)) return <EvidenceShell><LoadingState /></EvidenceShell>
  if (access.isError) return <EvidenceShell><ErrorState error={access.error} onRetry={access.refetch} /></EvidenceShell>
  if (claimQuery.isError) return <EvidenceShell role={access.data?.role}><ErrorState error={claimQuery.error} onRetry={claimQuery.refetch} /></EvidenceShell>
  if (!claim) return null

  const runAction = async (comment) => {
    try {
      await action.mutateAsync({ method: dialog.method, path: dialog.path, body: { ...dialog.body, comment } })
      toast.show(dialog.success, 'success')
      setDialog(null)
    } catch (error) {
      toast.show(errorMessage(error, language))
    }
  }

  const openTransition = (kind, entity = claim) => {
    const transitions = {
      claimSubmit: { title: t('claimSubmitTitle'), confirmLabel: t('submit'), path: `/claim-versions/${claim.id}/submit`, success: t('claimSubmitSuccess') },
      claimApprove: { title: t('claimApproveTitle'), description: t('claimApproveDesc'), confirmLabel: t('approve'), path: `/claim-versions/${claim.id}/approve`, success: t('claimApproveSuccess') },
      claimDispute: { title: t('claimDisputeTitle'), description: t('claimDisputeDesc'), confirmLabel: t('dispute'), variant: 'danger', path: `/claim-versions/${claim.id}/dispute`, success: t('claimDisputeSuccess') },
      assessmentSubmit: { title: t('assessmentSubmitTitle'), confirmLabel: t('submit'), path: `/assessments/${entity.id}/submit`, success: t('assessmentSubmitSuccess') },
      assessmentApprove: { title: t('assessmentApproveTitle'), confirmLabel: t('approve'), path: `/assessments/${entity.id}/approve`, success: t('assessmentApproveSuccess') },
      recommendationSubmit: { title: t('recommendationSubmitTitle'), confirmLabel: t('submit'), path: `/recommendations/${entity.id}/submit`, success: t('recommendationSubmitSuccess') },
      recommendationApprove: { title: t('recommendationApproveTitle'), confirmLabel: t('approve'), path: `/recommendations/${entity.id}/approve`, success: t('recommendationApproveSuccess') },
    }
    setDialog(transitions[kind])
  }

  return (
    <EvidenceShell role={access.data.role}>
      <Link className="evidence-back" to="/admin/evidence">{t('backQueue')}</Link>
      <section className="evidence-detail-head">
        <div>
          <div className="evidence-detail-labels"><span className="evidence-id">{claim.id}</span><StatusBadge status={claim.status} /></div>
          <h1>{content(claim, 'plainStatement')}</h1>
          <p>{content(claim.claim.question, 'plainQuestion')}</p>
        </div>
        <ClaimActions claim={claim} isApprover={isApprover} open={openTransition} />
      </section>

      <div className="evidence-detail-grid">
        <div className="evidence-detail-main">
          <Section title={t('synthesis')} aside={`${CERTAINTY_LABELS[language]?.[claim.certainty] || claim.certainty} · ${t('certainty')}`}>
            <div className="evidence-scientific-box"><strong>{t('scientificWording')}</strong><p>{content(claim, 'statement')}</p></div>
            <dl className="evidence-definition-grid">
              <div><dt>{t('population')}</dt><dd>{content(claim, 'population')}</dd></div>
              <div><dt>{t('effect')}</dt><dd>{content(claim, 'effect')}</dd></div>
              <div><dt>{t('certaintyRationale')}</dt><dd>{content(claim, 'certaintyRationale')}</dd></div>
              <div><dt>{t('searchCutoff')}</dt><dd>{formatDate(claim.searchCutoff, language)}</dd></div>
            </dl>
            <ListBlock title={t('limitations')} items={content(claim, 'limitations')} />
            <ListBlock title={t('unknowns')} items={content(claim, 'unknowns')} />
          </Section>

          <Section title={t('applicability')}>
            <dl className="evidence-definition-grid">
              <div><dt>{t('muscles')}</dt><dd>{claim.muscles?.length ? claim.muscles.join(', ') : t('notSpecified')}</dd></div>
              <div><dt>{t('muscleRegions')}</dt><dd>{claim.muscleRegions?.length ? claim.muscleRegions.join(', ') : t('notSpecified')}</dd></div>
              <div><dt>{t('exercises')}</dt><dd>{claim.exercises?.length ? claim.exercises.join(', ') : t('notSpecified')}</dd></div>
              <div><dt>{t('romSegments')}</dt><dd>{claim.romSegments?.length ? claim.romSegments.map(termValue).join(', ') : t('notSpecified')}</dd></div>
              <div><dt>{t('measurementMethods')}</dt><dd>{claim.measurementMethods?.length ? claim.measurementMethods.join(', ') : t('notSpecified')}</dd></div>
            </dl>
            <ListBlock title={t('applicabilityNotes')} items={claim.applicabilityNotes} />
          </Section>

          <Section title={t('studiesAssessments')} aside={t('sourceCount', { count: claim.evidenceLinks.length })}>
            <div className="evidence-source-list">
              {claim.evidenceLinks.map((link) => (
                <SourceRow key={link.workId} link={link} assessment={assessmentsByWork.get(link.workId)}
                  isApprover={isApprover} open={openTransition} edit={setAssessmentEdit} setDialog={setDialog} />
              ))}
            </div>
          </Section>

          <Section title={t('recommendations')} aside={`${claim.recommendationLinks.length}`}>
            {claim.recommendationLinks.length ? claim.recommendationLinks.map(({ recommendation }) => (
              <Recommendation key={recommendation.id} recommendation={recommendation} isApprover={isApprover} open={openTransition} />
            )) : <p className="evidence-muted">{t('noRecommendations')}</p>}
          </Section>

          <Section title={t('auditTrail')} aside={t('eventCount', { count: claim.audit.length })}>
            {claim.audit.length ? <div className="evidence-audit-list">{claim.audit.map((event) => (
              <div key={event.id}><span className="evidence-audit-dot" /><div><strong>{event.action}</strong><p>{event.comment || t('noComment')}</p><small>{event.actorId} · {formatDate(event.createdAt, language)}</small></div></div>
            ))}</div> : <p className="evidence-muted">{t('noAudit')}</p>}
          </Section>
        </div>

        <aside className="evidence-detail-aside">
          <Glass padding={20} radius={16} className={claim.approvalBlockers.length ? 'evidence-blockers has-blockers' : 'evidence-blockers'}>
            <div className="evidence-section-title"><h2>{t('approvalReadiness')}</h2><span>{claim.approvalBlockers.length}</span></div>
            {claim.approvalBlockers.length ? (
              <ul>{claim.approvalBlockers.map((blocker) => <li key={blocker}>{blockerLabel(blocker, language)}</li>)}</ul>
            ) : <p className="evidence-ready">{t('ready')}</p>}
          </Glass>

          <Glass padding={20} radius={16} className="evidence-runtime-card">
            <div className="evidence-section-title"><h2>{t('runtimeCheck')}</h2></div>
            <p>{t('runtimeHint')}</p>
            <Button block variant="secondary" loading={runtime.isFetching} onClick={() => setShowRuntime(true)}>{t('runCheck')}</Button>
            {showRuntime && runtime.data && <RuntimeResult result={runtime.data} />}
            {showRuntime && runtime.isError && <p className="evidence-runtime-error">{errorMessage(runtime.error, language)}</p>}
          </Glass>

          <Glass padding={20} radius={16}>
            <div className="evidence-section-title"><h2>{t('reviewMetadata')}</h2></div>
            <dl className="evidence-side-meta">
              <div><dt>{t('reviewDue')}</dt><dd>{formatDate(claim.reviewDueAt, language)}</dd></div>
              <div><dt>{t('createdBy')}</dt><dd>{claim.createdBy}</dd></div>
              <div><dt>{t('reviewedBy')}</dt><dd>{claim.reviewedBy || '—'}</dd></div>
              <div><dt>{t('version')}</dt><dd>v{claim.version}</dd></div>
            </dl>
          </Glass>
        </aside>
      </div>

      {dialog && <ActionDialog {...dialog} busy={action.isPending} onClose={() => setDialog(null)} onConfirm={runAction} />}
      {assessmentEdit && <AssessmentDialog assessment={assessmentEdit} busy={action.isPending} onClose={() => setAssessmentEdit(null)} onSave={async (body) => {
        try {
          await action.mutateAsync({ method: 'PATCH', path: `/assessments/${assessmentEdit.id}`, body })
          toast.show(t('assessmentUpdated'), 'success')
          setAssessmentEdit(null)
        } catch (error) { toast.show(errorMessage(error, language)) }
      }} />}
    </EvidenceShell>
  )
}

function ClaimActions({ claim, isApprover, open }) {
  const { t } = useEvidenceLocale()
  return <div className="evidence-detail-actions">
    {claim.status === 'draft' && <Button variant="accent" onClick={() => open('claimSubmit')}>{t('submitReview')}</Button>}
    {claim.status === 'in_review' && isApprover && <Button variant="success" disabled={claim.approvalBlockers.length > 0} onClick={() => open('claimApprove')}>{t('approve')}</Button>}
    {['in_review', 'approved'].includes(claim.status) && isApprover && <Button variant="danger" onClick={() => open('claimDispute')}>{t('dispute')}</Button>}
  </div>
}

function Section({ title, aside, children }) {
  return <Glass padding={22} radius={16} className="evidence-section"><div className="evidence-section-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>{children}</Glass>
}

function ListBlock({ title, items }) {
  if (!items?.length) return null
  return <div className="evidence-list-block"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
}

function SourceRow({ link, assessment, isApprover, open, edit, setDialog }) {
  const { t, term } = useEvidenceLocale()
  const work = link.work
  return <article className="evidence-source-row">
    <div className="evidence-source-body">
      <div className="evidence-source-labels"><span className={`evidence-relation is-${link.relation}`}>{term(link.relation)}</span><span>{term(work.workType)} · {work.year}</span></div>
      <h3>{work.title}</h3>
      <p>{t('sourceState', { id: work.id, status: term(work.status), correction: term(work.correctionStatus) })}</p>
      {assessment ? <div className="evidence-assessment-summary">
        <StatusBadge status={assessment.status} />
        <span>{term(assessment.reviewScope)}</span><span>{t('riskOfBias')}: {term(assessment.riskOfBias)}</span>
      </div> : <p className="evidence-warning-text">{t('assessmentMissing')}</p>}
    </div>
    <div className="evidence-row-actions">
      {assessment && ['draft', 'in_review'].includes(assessment.status) && <button onClick={() => edit(assessment)}>{t('edit')}</button>}
      {assessment?.status === 'draft' && <button onClick={() => open('assessmentSubmit', assessment)}>{t('submit')}</button>}
      {assessment?.status === 'in_review' && isApprover && <button onClick={() => open('assessmentApprove', assessment)}>{t('approve')}</button>}
      {isApprover && work.correctionStatus !== 'current' && <button onClick={() => setDialog({
        title: t('workCurrentTitle'), confirmLabel: t('workCurrentConfirm'), success: t('workCurrentSuccess'),
        path: `/works/${work.id}/status`, body: { correctionStatus: 'current' },
      })}>{t('markCurrent')}</button>}
    </div>
  </article>
}

function Recommendation({ recommendation, isApprover, open }) {
  const { language, t, content, term } = useEvidenceLocale()
  return <article className="evidence-recommendation">
    <div className="evidence-card-top"><span className="evidence-id">{recommendation.id}</span><StatusBadge status={recommendation.status} /></div>
    <h3>{content(recommendation, 'guidance')}</h3>
    <p>{content(recommendation, 'implementationHeuristic')}</p>
    <div className="evidence-card-meta"><span>{term(recommendation.strength)}</span><span>{recommendation.surfaces.map(term).join(', ')}</span><span>{t('reviewLabel', { date: formatDate(recommendation.reviewDueAt, language) })}</span></div>
    <div className="evidence-row-actions">
      {recommendation.status === 'draft' && <button onClick={() => open('recommendationSubmit', recommendation)}>{t('submit')}</button>}
      {recommendation.status === 'in_review' && isApprover && <button onClick={() => open('recommendationApprove', recommendation)}>{t('approve')}</button>}
    </div>
  </article>
}

function RuntimeResult({ result }) {
  const { t, content, term } = useEvidenceLocale()
  return <div className={`evidence-runtime-result is-${result.answerability}`}>
    <strong>{term(result.answerability)}</strong>
    <span>{t('eligibleSummary', { claims: result.claims.length, recommendations: result.recommendations.length })}</span>
    {result.recommendations.map((recommendation) => <p key={recommendation.id}>{content(recommendation, 'guidance')}</p>)}
  </div>
}

function AssessmentDialog({ assessment, busy, onClose, onSave }) {
  const { t } = useEvidenceLocale()
  const list = (value) => (value || []).join('\n')
  return <div className="evidence-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="evidence-modal evidence-modal--wide" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const lines = (name) => String(data.get(name) || '').split('\n').map((item) => item.trim()).filter(Boolean)
      onSave({
        reviewScope: data.get('reviewScope'), directness: data.get('directness'), riskOfBias: data.get('riskOfBias'),
        population: data.get('population').trim(), outcomes: lines('outcomes'), mainResults: lines('mainResults'),
        limitations: lines('limitations'), cannotSupport: lines('cannotSupport'), comment: data.get('comment').trim(),
      })
    }}>
      <h2>{t('editAssessment')}</h2>
      <p>{assessment.id}</p>
      <div className="evidence-form-grid">
        <Select name="reviewScope" label={t('reviewScope')} value={assessment.reviewScope} options={['abstract_only', 'full_text', 'full_text_and_supplements']} />
        <Select name="directness" label={t('directness')} value={assessment.directness} options={['high', 'some_concerns', 'low']} />
        <Select name="riskOfBias" label={t('riskOfBias')} value={assessment.riskOfBias} options={['low', 'some_concerns', 'high', 'not_assessed']} />
      </div>
      <Field name="population" label={t('population')} value={assessment.population} required />
      <Field name="outcomes" label={t('outcomesLines')} value={list(assessment.outcomes)} required />
      <Field name="mainResults" label={t('mainResultsLines')} value={list(assessment.mainResults)} required />
      <Field name="limitations" label={t('limitations')} value={list(assessment.limitations)} />
      <Field name="cannotSupport" label={t('cannotSupport')} value={list(assessment.cannotSupport)} />
      <Field name="comment" label={t('changeComment')} value="" required />
      <div className="evidence-modal-actions"><Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button type="submit" variant="accent" loading={busy}>{t('save')}</Button></div>
    </form>
  </div>
}

function Field({ name, label, value, required }) {
  return <label className="evidence-field"><span>{label}</span><textarea name={name} defaultValue={value} required={required} /></label>
}

function Select({ name, label, value, options }) {
  const { term } = useEvidenceLocale()
  return <label className="evidence-field"><span>{label}</span><select name={name} defaultValue={value}>{options.map((option) => <option key={option} value={option}>{term(option)}</option>)}</select></label>
}
