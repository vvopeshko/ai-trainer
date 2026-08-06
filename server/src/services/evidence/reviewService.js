import prisma from '../../utils/prisma.js'
import { AppError } from '../../middleware/errorHandler.js'
import { createDatabaseEvidenceRepository } from './persistence.js'

const snapshot = (value) => value == null ? null : JSON.parse(JSON.stringify(value))
const isFutureOrToday = (date, now) => date >= new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`)

function assertStatus(entity, allowed, label) {
  if (!allowed.includes(entity.status)) {
    throw new AppError(409, 'INVALID_EVIDENCE_TRANSITION', `${label}: status ${entity.status} is not allowed`)
  }
}

export function getClaimApprovalBlockers(claimVersion, assessments, { now = new Date() } = {}) {
  const blockers = []
  if (claimVersion.status !== 'in_review') blockers.push('claim_not_in_review')
  if (!isFutureOrToday(claimVersion.reviewDueAt, now)) blockers.push('claim_review_expired')

  const decisionLinks = claimVersion.evidenceLinks.filter(({ relation }) =>
    relation === 'supports' || relation === 'contradicts',
  )
  const supportingLinks = decisionLinks.filter(({ relation }) => relation === 'supports')
  if (supportingLinks.length === 0) blockers.push('claim_has_no_supporting_evidence')

  const isMuscleSpecificHypertrophy = claimVersion.outcomes?.includes('hypertrophy') &&
    claimVersion.bodyScopes?.includes('muscle_specific')
  if (isMuscleSpecificHypertrophy && !claimVersion.muscles?.length) {
    blockers.push('claim_muscle_scope_missing')
  }
  if (claimVersion.muscleRegions?.length && !claimVersion.measurementMethods?.length) {
    blockers.push('claim_measurement_scope_missing')
  }

  for (const { work } of claimVersion.evidenceLinks) {
    if (work.status === 'retracted' || work.correctionStatus === 'retracted') {
      blockers.push(`work_retracted:${work.id}`)
    } else if (work.correctionStatus !== 'current') {
      blockers.push(`work_status_unverified:${work.id}`)
    }
  }

  const approvedAssessmentWorks = new Set(
    assessments.filter(({ status }) => status === 'approved').map(({ workId }) => workId),
  )
  for (const { workId } of decisionLinks) {
    if (!approvedAssessmentWorks.has(workId)) blockers.push(`assessment_not_approved:${workId}`)
  }
  return [...new Set(blockers)]
}

export function getRecommendationApprovalBlockers(recommendation, { now = new Date() } = {}) {
  const blockers = []
  if (recommendation.status !== 'in_review') blockers.push('recommendation_not_in_review')
  if (!isFutureOrToday(recommendation.reviewDueAt, now)) blockers.push('recommendation_review_expired')
  if (!recommendation.claimLinks.some(({ role }) => role === 'primary')) {
    blockers.push('recommendation_has_no_primary_claim')
  }

  for (const { claimVersion } of recommendation.claimLinks) {
    if (claimVersion.status !== 'approved') {
      blockers.push(`claim_not_approved:${claimVersion.id}`)
      continue
    }
    if (!isFutureOrToday(claimVersion.reviewDueAt, now)) {
      blockers.push(`claim_review_expired:${claimVersion.id}`)
    }
    for (const { work } of claimVersion.evidenceLinks) {
      if (work.status === 'retracted' || work.correctionStatus === 'retracted') {
        blockers.push(`work_retracted:${work.id}`)
      } else if (work.correctionStatus !== 'current') {
        blockers.push(`work_status_unverified:${work.id}`)
      }
    }
  }
  return [...new Set(blockers)]
}

function createAudit(tx, { actorId, action, entityType, entityId, before, after, comment }) {
  return tx.evidenceAuditEvent.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      beforeJson: snapshot(before),
      afterJson: snapshot(after),
      comment,
    },
  })
}

function notFound(label) {
  throw new AppError(404, 'EVIDENCE_NOT_FOUND', `${label} not found`)
}

export function createEvidenceReviewService(db = prisma) {
  async function listQuestions() {
    return db.evidenceQuestion.findMany({
      include: { _count: { select: { assessments: true, claims: true } } },
      orderBy: { id: 'asc' },
    })
  }

  async function getQuestion(id) {
    const question = await db.evidenceQuestion.findUnique({
      where: { id },
      include: {
        assessments: { include: { work: true }, orderBy: [{ workId: 'asc' }, { version: 'desc' }] },
        claims: {
          include: {
            versions: {
              include: {
                evidenceLinks: { include: { work: true }, orderBy: { displayOrder: 'asc' } },
                recommendationLinks: { include: { recommendation: true } },
              },
              orderBy: { version: 'desc' },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!question) notFound('Question')

    const rawClaimVersions = question.claims.flatMap(({ versions }) => versions)
    const claimVersions = rawClaimVersions.map((version) => ({
      ...version,
      approvalBlockers: getClaimApprovalBlockers(
        version,
        question.assessments.filter(({ workId }) => version.evidenceLinks.some((link) => link.workId === workId)),
      ),
    }))
    const workById = new Map()
    for (const assessment of question.assessments) workById.set(assessment.workId, assessment.work)
    for (const version of claimVersions) {
      for (const link of version.evidenceLinks) workById.set(link.workId, link.work)
    }
    const works = [...workById.values()].sort((a, b) => b.year - a.year || a.id.localeCompare(b.id))
    const directlyLinkedIds = new Set(claimVersions.flatMap(({ evidenceLinks }) => evidenceLinks
      .filter(({ relation }) => relation === 'supports' || relation === 'contradicts')
      .map(({ workId }) => workId)))
    const assessedIds = new Set(question.assessments.map(({ workId }) => workId))
    const includedStudiesReported = works.reduce((sum, work) =>
      sum + (directlyLinkedIds.has(work.id) ? work.includedStudiesCount || 0 : 0), 0)
    const searchCutoffs = claimVersions.map(({ searchCutoff }) => searchCutoff).filter(Boolean)

    const [aiTests, blogOutlines, audit] = await Promise.all([
      db.evidenceAiTest.findMany({ orderBy: { id: 'asc' } }),
      db.evidenceBlogOutline.findMany({ orderBy: { id: 'asc' } }),
      db.evidenceAuditEvent.findMany({
        where: {
          OR: [
            { entityType: 'question', entityId: id },
            { entityType: 'claim_version', entityId: { in: claimVersions.map(({ id: claimId }) => claimId) } },
            { entityType: 'assessment', entityId: { in: question.assessments.map(({ id: assessmentId }) => assessmentId) } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    return {
      ...question,
      claims: claimVersions,
      works,
      coverage: {
        linkedPublications: works.length,
        decisionPublications: directlyLinkedIds.size,
        assessedPublications: assessedIds.size,
        primaryStudies: works.filter(({ workType }) => workType === 'rct').length,
        evidenceSyntheses: works.filter(({ workType }) => ['systematic_review', 'meta_analysis', 'umbrella_review', 'position_stand'].includes(workType)).length,
        fullTextReviewed: works.filter(({ reviewScope }) => reviewScope !== 'abstract_only').length,
        approvedAssessments: question.assessments.filter(({ status }) => status === 'approved').length,
        currentStatusVerified: works.filter(({ correctionStatus }) => ['current', 'corrected'].includes(correctionStatus)).length,
        includedStudiesReported,
        includedStudiesDeduplicated: null,
        deduplicationStatus: 'not_recorded',
        searchCutoff: searchCutoffs.length ? new Date(Math.max(...searchCutoffs.map((date) => new Date(date)))).toISOString() : null,
      },
      aiTests: aiTests.filter(({ payload }) => payload.requiredClaims?.some((claimId) => claimVersions.some(({ id: versionId }) => versionId === claimId))),
      blogOutlines: blogOutlines.filter(({ payload }) => payload.primaryQuestionId === id),
      audit,
    }
  }

  async function listClaimVersions({ status, questionId, take = 50 } = {}) {
    return db.evidenceClaimVersion.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(questionId ? { claim: { questionId } } : {}),
      },
      include: {
        claim: { include: { question: true } },
        evidenceLinks: { include: { work: true }, orderBy: { displayOrder: 'asc' } },
        recommendationLinks: { include: { recommendation: true } },
      },
      orderBy: [{ status: 'asc' }, { reviewDueAt: 'asc' }, { id: 'asc' }],
      take,
    })
  }

  async function getClaimVersion(id) {
    const row = await db.evidenceClaimVersion.findUnique({
      where: { id },
      include: {
        claim: { include: { question: true } },
        evidenceLinks: { include: { work: true }, orderBy: { displayOrder: 'asc' } },
        recommendationLinks: { include: { recommendation: true } },
      },
    })
    if (!row) notFound('Claim version')
    const [assessments, audit] = await Promise.all([
      db.researchAssessment.findMany({
        where: { questionId: row.claim.questionId, workId: { in: row.evidenceLinks.map(({ workId }) => workId) } },
        orderBy: [{ workId: 'asc' }, { version: 'desc' }],
      }),
      db.evidenceAuditEvent.findMany({
        where: { entityType: 'claim_version', entityId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return { ...row, assessments, audit, approvalBlockers: getClaimApprovalBlockers(row, assessments) }
  }

  async function updateAssessment(id, patch, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.researchAssessment.findUnique({ where: { id } })
      if (!before) notFound('Assessment')
      assertStatus(before, ['draft', 'in_review'], 'Assessment update')
      const after = await tx.researchAssessment.update({
        where: { id },
        data: { ...patch, status: 'draft', assessedBy: null, assessedAt: null },
      })
      await createAudit(tx, { actorId, action: 'updated', entityType: 'assessment', entityId: id, before, after, comment })
      return after
    })
  }

  async function submitAssessment(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.researchAssessment.findUnique({ where: { id } })
      if (!before) notFound('Assessment')
      assertStatus(before, ['draft'], 'Assessment submit')
      const after = await tx.researchAssessment.update({ where: { id }, data: { status: 'in_review' } })
      await createAudit(tx, { actorId, action: 'submitted', entityType: 'assessment', entityId: id, before, after, comment })
      return after
    })
  }

  async function approveAssessment(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.researchAssessment.findUnique({ where: { id } })
      if (!before) notFound('Assessment')
      assertStatus(before, ['in_review'], 'Assessment approval')
      if (before.reviewScope === 'abstract_only' || before.riskOfBias === 'not_assessed') {
        throw new AppError(409, 'ASSESSMENT_NOT_READY', 'Full-text scope and risk-of-bias appraisal are required')
      }
      const now = new Date()
      const after = await tx.researchAssessment.update({
        where: { id },
        data: { status: 'approved', assessedBy: actorId, assessedAt: now },
      })
      await createAudit(tx, { actorId, action: 'approved', entityType: 'assessment', entityId: id, before, after, comment })
      return after
    })
  }

  async function submitClaimVersion(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.evidenceClaimVersion.findUnique({ where: { id } })
      if (!before) notFound('Claim version')
      assertStatus(before, ['draft'], 'Claim submit')
      const after = await tx.evidenceClaimVersion.update({ where: { id }, data: { status: 'in_review' } })
      await tx.evidenceClaim.update({ where: { id: before.claimId }, data: { status: 'in_review' } })
      await createAudit(tx, { actorId, action: 'submitted', entityType: 'claim_version', entityId: id, before, after, comment })
      return after
    })
  }

  async function approveClaimVersion(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.evidenceClaimVersion.findUnique({
        where: { id },
        include: { claim: true, evidenceLinks: { include: { work: true } } },
      })
      if (!before) notFound('Claim version')
      const assessments = await tx.researchAssessment.findMany({
        where: {
          questionId: before.claim.questionId,
          workId: { in: before.evidenceLinks.map(({ workId }) => workId) },
        },
      })
      const blockers = getClaimApprovalBlockers(before, assessments)
      if (blockers.length) {
        throw new AppError(409, 'CLAIM_NOT_READY', `Claim approval blocked: ${blockers.join(', ')}`)
      }

      const now = new Date()
      const { count } = await tx.evidenceClaimVersion.updateMany({
        where: { id, status: 'in_review' },
        data: { status: 'approved', reviewedBy: actorId, reviewedAt: now },
      })
      if (count !== 1) throw new AppError(409, 'EVIDENCE_REVIEW_CONFLICT', 'Claim changed during review')
      await tx.evidenceClaimVersion.updateMany({
        where: { claimId: before.claimId, id: { not: id }, status: 'approved' },
        data: { status: 'superseded' },
      })
      await tx.evidenceClaim.update({ where: { id: before.claimId }, data: { status: 'approved' } })
      const after = await tx.evidenceClaimVersion.findUnique({ where: { id } })
      await createAudit(tx, { actorId, action: 'approved', entityType: 'claim_version', entityId: id, before, after, comment })
      return after
    })
  }

  async function disputeClaimVersion(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.evidenceClaimVersion.findUnique({ where: { id } })
      if (!before) notFound('Claim version')
      assertStatus(before, ['in_review', 'approved'], 'Claim dispute')
      const after = await tx.evidenceClaimVersion.update({ where: { id }, data: { status: 'disputed' } })
      await tx.evidenceClaim.update({ where: { id: before.claimId }, data: { status: 'disputed' } })
      await tx.evidenceRecommendation.updateMany({
        where: { claimLinks: { some: { claimVersionId: id } }, status: { in: ['in_review', 'approved'] } },
        data: { status: 'disputed' },
      })
      await createAudit(tx, { actorId, action: 'disputed', entityType: 'claim_version', entityId: id, before, after, comment })
      return after
    })
  }

  async function submitRecommendation(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.evidenceRecommendation.findUnique({ where: { id } })
      if (!before) notFound('Recommendation')
      assertStatus(before, ['draft'], 'Recommendation submit')
      const after = await tx.evidenceRecommendation.update({ where: { id }, data: { status: 'in_review' } })
      await createAudit(tx, { actorId, action: 'submitted', entityType: 'recommendation', entityId: id, before, after, comment })
      return after
    })
  }

  async function approveRecommendation(id, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.evidenceRecommendation.findUnique({
        where: { id },
        include: {
          claimLinks: {
            include: { claimVersion: { include: { evidenceLinks: { include: { work: true } } } } },
          },
        },
      })
      if (!before) notFound('Recommendation')
      const blockers = getRecommendationApprovalBlockers(before)
      if (blockers.length) {
        throw new AppError(409, 'RECOMMENDATION_NOT_READY', `Recommendation approval blocked: ${blockers.join(', ')}`)
      }
      const now = new Date()
      const { count } = await tx.evidenceRecommendation.updateMany({
        where: { id, status: 'in_review' },
        data: { status: 'approved', reviewedBy: actorId, reviewedAt: now },
      })
      if (count !== 1) throw new AppError(409, 'EVIDENCE_REVIEW_CONFLICT', 'Recommendation changed during review')
      const after = await tx.evidenceRecommendation.findUnique({ where: { id } })
      await createAudit(tx, { actorId, action: 'approved', entityType: 'recommendation', entityId: id, before, after, comment })
      return after
    })
  }

  async function reviewWorkStatus(id, correctionStatus, { actorId, comment }) {
    return db.$transaction(async (tx) => {
      const before = await tx.researchWork.findUnique({ where: { id } })
      if (!before) notFound('Research work')
      const after = await tx.researchWork.update({
        where: { id },
        data: {
          correctionStatus,
          statusCheckedAt: new Date(),
          ...(correctionStatus === 'retracted' ? { status: 'retracted' } : {}),
        },
      })
      let affectedClaimIds = []
      if (correctionStatus === 'retracted') {
        const affected = await tx.claimEvidence.findMany({
          where: { workId: id, claimVersion: { status: { in: ['in_review', 'approved'] } } },
          select: { claimVersionId: true, claimVersion: { select: { claimId: true } } },
        })
        affectedClaimIds = affected.map(({ claimVersionId }) => claimVersionId)
        if (affectedClaimIds.length) {
          await tx.evidenceClaimVersion.updateMany({
            where: { id: { in: affectedClaimIds } },
            data: { status: 'disputed' },
          })
          await tx.evidenceClaim.updateMany({
            where: { id: { in: affected.map(({ claimVersion }) => claimVersion.claimId) } },
            data: { status: 'disputed' },
          })
          await tx.evidenceRecommendation.updateMany({
            where: { claimLinks: { some: { claimVersionId: { in: affectedClaimIds } } } },
            data: { status: 'disputed' },
          })
        }
      }
      await createAudit(tx, {
        actorId,
        action: `status_${correctionStatus}`,
        entityType: 'research_work',
        entityId: id,
        before,
        after: { ...after, affectedClaimIds },
        comment,
      })
      return { work: after, affectedClaimIds }
    })
  }

  async function runtimeCheck(questionId, query = {}) {
    const repository = await createDatabaseEvidenceRepository(db)
    return repository.getEvidenceGuidance({ questionId, ...query })
  }

  return {
    listQuestions,
    getQuestion,
    listClaimVersions,
    getClaimVersion,
    updateAssessment,
    submitAssessment,
    approveAssessment,
    submitClaimVersion,
    approveClaimVersion,
    disputeClaimVersion,
    submitRecommendation,
    approveRecommendation,
    reviewWorkStatus,
    runtimeCheck,
  }
}

export const evidenceReviewService = createEvidenceReviewService()
