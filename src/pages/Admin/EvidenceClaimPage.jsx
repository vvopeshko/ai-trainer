import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useEvidenceAccess, useEvidenceAction, useEvidenceClaim, useEvidenceRuntime } from '../../hooks/evidence.js'
import { ActionDialog, ErrorState, EvidenceShell, LoadingState, StatusBadge } from './EvidenceShared.jsx'
import { blockerLabel, CERTAINTY_LABELS, errorMessage, formatDate } from './evidenceUtils.js'

export default function EvidenceClaimPage() {
  const { id } = useParams()
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
      toast.show(errorMessage(error))
    }
  }

  const openTransition = (kind, entity = claim) => {
    const transitions = {
      claimSubmit: { title: 'Отправить claim на ревью?', confirmLabel: 'Отправить', path: `/claim-versions/${claim.id}/submit`, success: 'Claim отправлен на ревью' },
      claimApprove: { title: 'Одобрить claim?', description: 'После одобрения он сможет участвовать в runtime guidance.', confirmLabel: 'Одобрить', path: `/claim-versions/${claim.id}/approve`, success: 'Claim одобрен' },
      claimDispute: { title: 'Оспорить claim?', description: 'Связанные рекомендации перестанут быть доступны runtime.', confirmLabel: 'Оспорить', variant: 'danger', path: `/claim-versions/${claim.id}/dispute`, success: 'Claim помечен как disputed' },
      assessmentSubmit: { title: 'Отправить assessment на ревью?', confirmLabel: 'Отправить', path: `/assessments/${entity.id}/submit`, success: 'Assessment отправлен на ревью' },
      assessmentApprove: { title: 'Одобрить assessment?', confirmLabel: 'Одобрить', path: `/assessments/${entity.id}/approve`, success: 'Assessment одобрен' },
      recommendationSubmit: { title: 'Отправить рекомендацию на ревью?', confirmLabel: 'Отправить', path: `/recommendations/${entity.id}/submit`, success: 'Рекомендация отправлена на ревью' },
      recommendationApprove: { title: 'Одобрить рекомендацию?', confirmLabel: 'Одобрить', path: `/recommendations/${entity.id}/approve`, success: 'Рекомендация одобрена' },
    }
    setDialog(transitions[kind])
  }

  return (
    <EvidenceShell role={access.data.role}>
      <Link className="evidence-back" to="/admin/evidence">← Назад к очереди</Link>
      <section className="evidence-detail-head">
        <div>
          <div className="evidence-detail-labels"><span className="evidence-id">{claim.id}</span><StatusBadge status={claim.status} /></div>
          <h1>{claim.statement}</h1>
          <p>{claim.claim.question.question}</p>
        </div>
        <ClaimActions claim={claim} isApprover={isApprover} open={openTransition} />
      </section>

      <div className="evidence-detail-grid">
        <div className="evidence-detail-main">
          <Section title="Evidence synthesis" aside={`${CERTAINTY_LABELS[claim.certainty] || claim.certainty} certainty`}>
            <dl className="evidence-definition-grid">
              <div><dt>Population</dt><dd>{claim.population}</dd></div>
              <div><dt>Effect</dt><dd>{claim.effect}</dd></div>
              <div><dt>Certainty rationale</dt><dd>{claim.certaintyRationale}</dd></div>
              <div><dt>Search cutoff</dt><dd>{formatDate(claim.searchCutoff)}</dd></div>
            </dl>
            <ListBlock title="Ограничения" items={claim.limitations} />
            <ListBlock title="Неизвестно" items={claim.unknowns} />
          </Section>

          <Section title="Исследования и assessments" aside={`${claim.evidenceLinks.length} sources`}>
            <div className="evidence-source-list">
              {claim.evidenceLinks.map((link) => (
                <SourceRow key={link.workId} link={link} assessment={assessmentsByWork.get(link.workId)}
                  isApprover={isApprover} open={openTransition} edit={setAssessmentEdit} setDialog={setDialog} />
              ))}
            </div>
          </Section>

          <Section title="Рекомендации" aside={`${claim.recommendationLinks.length}`}>
            {claim.recommendationLinks.length ? claim.recommendationLinks.map(({ recommendation }) => (
              <Recommendation key={recommendation.id} recommendation={recommendation} isApprover={isApprover} open={openTransition} />
            )) : <p className="evidence-muted">К этому claim пока нет рекомендаций.</p>}
          </Section>

          <Section title="Audit trail" aside={`${claim.audit.length} events`}>
            {claim.audit.length ? <div className="evidence-audit-list">{claim.audit.map((event) => (
              <div key={event.id}><span className="evidence-audit-dot" /><div><strong>{event.action}</strong><p>{event.comment || 'Без комментария'}</p><small>{event.actorId} · {formatDate(event.createdAt)}</small></div></div>
            ))}</div> : <p className="evidence-muted">Событий ревью ещё нет.</p>}
          </Section>
        </div>

        <aside className="evidence-detail-aside">
          <Glass padding={20} radius={16} className={claim.approvalBlockers.length ? 'evidence-blockers has-blockers' : 'evidence-blockers'}>
            <div className="evidence-section-title"><h2>Approval readiness</h2><span>{claim.approvalBlockers.length}</span></div>
            {claim.approvalBlockers.length ? (
              <ul>{claim.approvalBlockers.map((blocker) => <li key={blocker}>{blockerLabel(blocker)}</li>)}</ul>
            ) : <p className="evidence-ready">Все проверки пройдены. Claim готов к одобрению.</p>}
          </Glass>

          <Glass padding={20} radius={16} className="evidence-runtime-card">
            <div className="evidence-section-title"><h2>Runtime check</h2></div>
            <p>Проверяет, что именно получит AI-тренер из опубликованного слоя.</p>
            <Button block variant="secondary" loading={runtime.isFetching} onClick={() => setShowRuntime(true)}>Запустить fail-closed check</Button>
            {showRuntime && runtime.data && <RuntimeResult result={runtime.data} />}
            {showRuntime && runtime.isError && <p className="evidence-runtime-error">{errorMessage(runtime.error)}</p>}
          </Glass>

          <Glass padding={20} radius={16}>
            <div className="evidence-section-title"><h2>Review metadata</h2></div>
            <dl className="evidence-side-meta">
              <div><dt>Review due</dt><dd>{formatDate(claim.reviewDueAt)}</dd></div>
              <div><dt>Created by</dt><dd>{claim.createdBy}</dd></div>
              <div><dt>Reviewed by</dt><dd>{claim.reviewedBy || '—'}</dd></div>
              <div><dt>Version</dt><dd>v{claim.version}</dd></div>
            </dl>
          </Glass>
        </aside>
      </div>

      {dialog && <ActionDialog {...dialog} busy={action.isPending} onClose={() => setDialog(null)} onConfirm={runAction} />}
      {assessmentEdit && <AssessmentDialog assessment={assessmentEdit} busy={action.isPending} onClose={() => setAssessmentEdit(null)} onSave={async (body) => {
        try {
          await action.mutateAsync({ method: 'PATCH', path: `/assessments/${assessmentEdit.id}`, body })
          toast.show('Assessment обновлён', 'success')
          setAssessmentEdit(null)
        } catch (error) { toast.show(errorMessage(error)) }
      }} />}
    </EvidenceShell>
  )
}

function ClaimActions({ claim, isApprover, open }) {
  return <div className="evidence-detail-actions">
    {claim.status === 'draft' && <Button variant="accent" onClick={() => open('claimSubmit')}>Отправить на ревью</Button>}
    {claim.status === 'in_review' && isApprover && <Button variant="success" disabled={claim.approvalBlockers.length > 0} onClick={() => open('claimApprove')}>Одобрить</Button>}
    {['in_review', 'approved'].includes(claim.status) && isApprover && <Button variant="danger" onClick={() => open('claimDispute')}>Оспорить</Button>}
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
  const work = link.work
  return <article className="evidence-source-row">
    <div className="evidence-source-body">
      <div className="evidence-source-labels"><span className={`evidence-relation is-${link.relation}`}>{link.relation}</span><span>{work.workType} · {work.year}</span></div>
      <h3>{work.title}</h3>
      <p>{work.id} · source {work.status} · correction {work.correctionStatus}</p>
      {assessment ? <div className="evidence-assessment-summary">
        <StatusBadge status={assessment.status} />
        <span>{assessment.reviewScope.replaceAll('_', ' ')}</span><span>RoB: {assessment.riskOfBias.replaceAll('_', ' ')}</span>
      </div> : <p className="evidence-warning-text">Assessment не найден</p>}
    </div>
    <div className="evidence-row-actions">
      {assessment && ['draft', 'in_review'].includes(assessment.status) && <button onClick={() => edit(assessment)}>Редактировать</button>}
      {assessment?.status === 'draft' && <button onClick={() => open('assessmentSubmit', assessment)}>Submit</button>}
      {assessment?.status === 'in_review' && isApprover && <button onClick={() => open('assessmentApprove', assessment)}>Approve</button>}
      {isApprover && work.correctionStatus !== 'current' && <button onClick={() => setDialog({
        title: 'Подтвердить актуальность источника?', confirmLabel: 'Отметить current', success: 'Статус источника обновлён',
        path: `/works/${work.id}/status`, body: { correctionStatus: 'current' },
      })}>Mark current</button>}
    </div>
  </article>
}

function Recommendation({ recommendation, isApprover, open }) {
  return <article className="evidence-recommendation">
    <div className="evidence-card-top"><span className="evidence-id">{recommendation.id}</span><StatusBadge status={recommendation.status} /></div>
    <h3>{recommendation.guidance}</h3>
    <p>{recommendation.implementationHeuristic}</p>
    <div className="evidence-card-meta"><span>{recommendation.strength}</span><span>{recommendation.surfaces.join(', ')}</span><span>review {formatDate(recommendation.reviewDueAt)}</span></div>
    <div className="evidence-row-actions">
      {recommendation.status === 'draft' && <button onClick={() => open('recommendationSubmit', recommendation)}>Submit</button>}
      {recommendation.status === 'in_review' && isApprover && <button onClick={() => open('recommendationApprove', recommendation)}>Approve</button>}
    </div>
  </article>
}

function RuntimeResult({ result }) {
  return <div className={`evidence-runtime-result is-${result.answerability}`}>
    <strong>{result.answerability}</strong>
    <span>{result.claims.length} eligible claims · {result.recommendations.length} recommendations</span>
    {result.recommendations.map((recommendation) => <p key={recommendation.id}>{recommendation.guidance}</p>)}
  </div>
}

function AssessmentDialog({ assessment, busy, onClose, onSave }) {
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
      <h2>Редактировать assessment</h2>
      <p>{assessment.id}</p>
      <div className="evidence-form-grid">
        <Select name="reviewScope" label="Review scope" value={assessment.reviewScope} options={['abstract_only', 'full_text', 'full_text_and_supplements']} />
        <Select name="directness" label="Directness" value={assessment.directness} options={['high', 'some_concerns', 'low']} />
        <Select name="riskOfBias" label="Risk of bias" value={assessment.riskOfBias} options={['low', 'some_concerns', 'high', 'not_assessed']} />
      </div>
      <Field name="population" label="Population" value={assessment.population} required />
      <Field name="outcomes" label="Outcomes — по одному на строку" value={list(assessment.outcomes)} required />
      <Field name="mainResults" label="Main results — по одному на строку" value={list(assessment.mainResults)} required />
      <Field name="limitations" label="Limitations" value={list(assessment.limitations)} />
      <Field name="cannotSupport" label="Cannot support" value={list(assessment.cannotSupport)} />
      <Field name="comment" label="Комментарий к изменению" value="" required />
      <div className="evidence-modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Отмена</Button><Button type="submit" variant="accent" loading={busy}>Сохранить</Button></div>
    </form>
  </div>
}

function Field({ name, label, value, required }) {
  return <label className="evidence-field"><span>{label}</span><textarea name={name} defaultValue={value} required={required} /></label>
}

function Select({ name, label, value, options }) {
  return <label className="evidence-field"><span>{label}</span><select name={name} defaultValue={value}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}
