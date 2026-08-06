import { evidenceDatasetSchema, researchWorkSchema } from './schemas.js'
import { createEvidenceRepository } from './repository.js'

const toDate = (date) => new Date(`${date}T00:00:00.000Z`)
const toDateOnly = (date) => new Date(date).toISOString().slice(0, 10)

function workData(work, existing = null) {
  const identifiers = work.identifiers
  const correctionRank = { unknown: 0, current: 1, corrected: 2, retracted: 3 }
  const keepVerifiedStatus = existing &&
    correctionRank[existing.correctionStatus] > correctionRank[work.correctionStatus]

  return {
    status: existing?.status === 'retracted' ? 'retracted' : work.status,
    title: work.title,
    year: work.year,
    workType: work.workType,
    identifiers,
    doi: identifiers.doi ?? null,
    pmid: identifiers.pmid ?? null,
    pmcid: identifiers.pmcid ?? null,
    trialId: identifiers.trialId ?? null,
    url: identifiers.url ?? null,
    correctionStatus: keepVerifiedStatus ? existing.correctionStatus : work.correctionStatus,
    statusCheckedAt: work.statusCheckedAt
      ? toDate(work.statusCheckedAt)
      : existing?.statusCheckedAt ?? null,
    reviewScope: work.reviewScope,
    includedStudiesCount: work.includedStudiesCount ?? existing?.includedStudiesCount ?? null,
    sourceNotes: work.sourceNotes ?? null,
  }
}

function claimVersionData(claim) {
  return {
    claimId: claim.claimId,
    version: claim.version,
    status: claim.status,
    statement: claim.statement,
    statementRu: claim.statementRu,
    plainStatement: claim.plainStatement,
    plainStatementRu: claim.plainStatementRu,
    population: claim.population,
    trainingStatuses: claim.trainingStatuses,
    bodyScopes: claim.bodyScopes,
    outcomes: claim.outcomes,
    muscles: claim.muscles,
    muscleRegions: claim.muscleRegions,
    exercises: claim.exercises,
    romSegments: claim.romSegments,
    measurementMethods: claim.measurementMethods,
    applicabilityNotes: claim.applicabilityNotes,
    effect: claim.effect,
    certainty: claim.certainty,
    certaintyRationale: claim.certaintyRationale,
    limitations: claim.limitations,
    unknowns: claim.unknowns,
    searchCutoff: toDate(claim.searchCutoff),
    reviewDueAt: toDate(claim.reviewDueAt),
    createdBy: claim.createdBy,
    reviewedBy: claim.reviewedBy ?? null,
    reviewedAt: claim.reviewedAt ? new Date(claim.reviewedAt) : null,
  }
}

function recommendationData(recommendation) {
  return {
    status: recommendation.status,
    surfaces: recommendation.surfaces,
    audience: recommendation.audience,
    guidance: recommendation.guidance,
    implementationHeuristic: recommendation.implementationHeuristic,
    strength: recommendation.strength,
    exceptions: recommendation.exceptions,
    safetyNotes: recommendation.safetyNotes,
    allowedWording: recommendation.allowedWording,
    forbiddenWording: recommendation.forbiddenWording,
    reviewDueAt: toDate(recommendation.reviewDueAt),
    reviewedBy: recommendation.reviewedBy ?? null,
    reviewedAt: recommendation.reviewedAt ? new Date(recommendation.reviewedAt) : null,
  }
}

function evidenceLinks(claim) {
  const links = []
  for (const relation of ['supports', 'contradicts', 'contextualizes']) {
    claim.evidence[relation].forEach((workId, displayOrder) => {
      links.push({ workId, relation, displayOrder })
    })
  }
  return links
}

export function buildEvidencePersistencePlan(rawDataset) {
  const dataset = evidenceDatasetSchema.parse(rawDataset)
  const stableClaims = new Map()

  for (const version of dataset.claims) {
    const current = stableClaims.get(version.claimId)
    if (current && current.questionId !== version.questionId) {
      throw new Error(`Claim ${version.claimId} cannot belong to multiple questions`)
    }
    stableClaims.set(version.claimId, {
      id: version.claimId,
      questionId: version.questionId,
      status: version.status,
    })
  }

  return {
    version: dataset.version,
    generatedAt: dataset.generatedAt,
    questions: dataset.questions.map((item) => ({
      ...item,
      searchDate: item.searchDate ? toDate(item.searchDate) : null,
    })),
    works: dataset.works.map((item) => ({ id: item.id, ...workData(item) })),
    assessments: dataset.assessments.map((item) => ({
      id: item.id,
      questionId: item.questionId,
      workId: item.workId,
      version: 1,
      status: item.status,
      reviewScope: item.reviewScope,
      population: item.population,
      outcomes: item.outcomes,
      mainResults: item.mainResults,
      directness: item.directness,
      riskOfBias: item.riskOfBias,
      limitations: item.limitations,
      cannotSupport: item.cannotSupport,
      assessedBy: item.assessedBy ?? null,
      assessedAt: item.assessedAt ? new Date(item.assessedAt) : null,
    })),
    stableClaims: [...stableClaims.values()],
    claimVersions: dataset.claims.map((item) => ({
      id: item.id,
      ...claimVersionData(item),
      evidenceLinks: evidenceLinks(item),
    })),
    recommendations: dataset.recommendations.map((item) => ({
      id: item.id,
      ...recommendationData(item),
      claimLinks: [
        { claimVersionId: item.claimVersionId, role: 'primary', displayOrder: 0 },
        ...item.supportingClaimVersionIds.map((claimVersionId, index) => ({
          claimVersionId,
          role: 'supporting',
          displayOrder: index + 1,
        })),
      ],
    })),
    aiTests: dataset.aiTests.map((payload) => ({ id: payload.id, payload })),
    blogOutlines: dataset.blogOutlines.map((payload) => ({ id: payload.id, payload })),
  }
}

function assessmentData(row) {
  const { id: _id, ...data } = row
  return data
}

function withoutNested(row, nestedKey) {
  const { id: _id, [nestedKey]: _nested, ...data } = row
  return data
}

async function upsertRow(delegate, row, data) {
  await delegate.upsert({
    where: { id: row.id },
    create: { id: row.id, ...data },
    update: data,
  })
}

export async function importEvidenceDataset(prisma, rawDataset, { dryRun = false } = {}) {
  const plan = buildEvidencePersistencePlan(rawDataset)
  const counts = {
    questions: plan.questions.length,
    works: plan.works.length,
    assessments: plan.assessments.length,
    claims: plan.claimVersions.length,
    recommendations: plan.recommendations.length,
    aiTests: plan.aiTests.length,
    blogOutlines: plan.blogOutlines.length,
  }
  if (dryRun) return { dryRun: true, counts }

  const result = await prisma.$transaction(async (tx) => {
    const [existingWorkRows, approvedAssessmentRows, approvedClaimRows, approvedRecommendationRows] =
      await Promise.all([
        tx.researchWork.findMany({ where: { id: { in: plan.works.map(({ id }) => id) } } }),
        tx.researchAssessment.findMany({
          where: { id: { in: plan.assessments.map(({ id }) => id) }, status: 'approved' },
          select: { id: true },
        }),
        tx.evidenceClaimVersion.findMany({
          where: { id: { in: plan.claimVersions.map(({ id }) => id) }, status: 'approved' },
          select: { id: true },
        }),
        tx.evidenceRecommendation.findMany({
          where: { id: { in: plan.recommendations.map(({ id }) => id) }, status: 'approved' },
          select: { id: true },
        }),
      ])
    const existingWorks = new Map(existingWorkRows.map((work) => [work.id, work]))
    const approvedAssessments = new Set(approvedAssessmentRows.map(({ id }) => id))
    const approvedClaims = new Set(approvedClaimRows.map(({ id }) => id))
    const approvedRecommendations = new Set(approvedRecommendationRows.map(({ id }) => id))

    for (const question of plan.questions) {
      const { id, ...data } = question
      await tx.evidenceQuestion.upsert({ where: { id }, create: question, update: data })
    }

    for (const row of plan.works) {
      const existing = existingWorks.get(row.id) ?? null
      const data = workData({
        ...row,
        identifiers: row.identifiers,
        statusCheckedAt: row.statusCheckedAt ? toDateOnly(row.statusCheckedAt) : undefined,
      }, existing)
      await tx.researchWork.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data })
    }

    for (const row of plan.assessments) {
      if (!approvedAssessments.has(row.id)) {
        await upsertRow(tx.researchAssessment, row, assessmentData(row))
      }
    }

    for (const row of plan.stableClaims) {
      await tx.evidenceClaim.upsert({
        where: { id: row.id },
        create: row,
        update: { questionId: row.questionId },
      })
    }

    const changedClaimVersions = []
    for (const row of plan.claimVersions) {
      if (!approvedClaims.has(row.id)) {
        await upsertRow(tx.evidenceClaimVersion, row, withoutNested(row, 'evidenceLinks'))
        changedClaimVersions.push(row)
      }
    }
    const changedClaimIds = changedClaimVersions.map(({ id }) => id)
    if (changedClaimIds.length) {
      await tx.claimEvidence.deleteMany({ where: { claimVersionId: { in: changedClaimIds } } })
      const links = changedClaimVersions.flatMap((row) =>
        row.evidenceLinks.map((link) => ({ claimVersionId: row.id, ...link })),
      )
      if (links.length) await tx.claimEvidence.createMany({ data: links })
    }

    const changedRecommendations = []
    for (const row of plan.recommendations) {
      if (!approvedRecommendations.has(row.id)) {
        await upsertRow(tx.evidenceRecommendation, row, withoutNested(row, 'claimLinks'))
        changedRecommendations.push(row)
      }
    }
    const changedRecommendationIds = changedRecommendations.map(({ id }) => id)
    if (changedRecommendationIds.length) {
      await tx.evidenceRecommendationClaim.deleteMany({
        where: { recommendationId: { in: changedRecommendationIds } },
      })
      await tx.evidenceRecommendationClaim.createMany({
        data: changedRecommendations.flatMap((row) =>
          row.claimLinks.map((link) => ({ recommendationId: row.id, ...link })),
        ),
      })
    }

    await tx.evidenceAiTest.deleteMany({ where: { id: { in: plan.aiTests.map(({ id }) => id) } } })
    await tx.evidenceAiTest.createMany({ data: plan.aiTests })
    await tx.evidenceBlogOutline.deleteMany({ where: { id: { in: plan.blogOutlines.map(({ id }) => id) } } })
    await tx.evidenceBlogOutline.createMany({ data: plan.blogOutlines })

    return {
      protectedClaimVersions: approvedClaims.size,
      protectedRecommendations: approvedRecommendations.size,
    }
  }, {
    // Pilot import performs many deterministic upserts. Neon pooler round-trips can
    // exceed Prisma's 5s interactive-transaction default even for this small corpus.
    maxWait: 10_000,
    timeout: 60_000,
  })

  return { dryRun: false, counts, ...result }
}

function rowToWork(row) {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    year: row.year,
    workType: row.workType,
    identifiers: row.identifiers,
    correctionStatus: row.correctionStatus,
    ...(row.statusCheckedAt ? { statusCheckedAt: toDateOnly(row.statusCheckedAt) } : {}),
    reviewScope: row.reviewScope,
    ...(row.includedStudiesCount ? { includedStudiesCount: row.includedStudiesCount } : {}),
    ...(row.sourceNotes ? { sourceNotes: row.sourceNotes } : {}),
  }
}

function rowToClaim(row) {
  const byRelation = { supports: [], contradicts: [], contextualizes: [] }
  for (const link of row.evidenceLinks.sort((a, b) => a.displayOrder - b.displayOrder)) {
    byRelation[link.relation].push(link.workId)
  }
  return {
    id: row.id,
    claimId: row.claimId,
    questionId: row.claim.questionId,
    version: row.version,
    status: row.status,
    statement: row.statement,
    statementRu: row.statementRu,
    plainStatement: row.plainStatement,
    plainStatementRu: row.plainStatementRu,
    population: row.population,
    trainingStatuses: row.trainingStatuses,
    bodyScopes: row.bodyScopes,
    outcomes: row.outcomes,
    muscles: row.muscles,
    muscleRegions: row.muscleRegions,
    exercises: row.exercises,
    romSegments: row.romSegments,
    measurementMethods: row.measurementMethods,
    applicabilityNotes: row.applicabilityNotes,
    effect: row.effect,
    certainty: row.certainty,
    certaintyRationale: row.certaintyRationale,
    limitations: row.limitations,
    unknowns: row.unknowns,
    evidence: byRelation,
    searchCutoff: toDateOnly(row.searchCutoff),
    reviewDueAt: toDateOnly(row.reviewDueAt),
    createdBy: row.createdBy,
    ...(row.reviewedBy ? { reviewedBy: row.reviewedBy } : {}),
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt.toISOString() } : {}),
  }
}

function rowToRecommendation(row) {
  const links = [...row.claimLinks].sort((a, b) => a.displayOrder - b.displayOrder)
  const primary = links.find(({ role }) => role === 'primary')
  if (!primary) throw new Error(`Recommendation ${row.id} has no primary claim`)
  return {
    id: row.id,
    claimVersionId: primary.claimVersionId,
    supportingClaimVersionIds: links
      .filter(({ role }) => role === 'supporting')
      .map(({ claimVersionId }) => claimVersionId),
    status: row.status,
    surfaces: row.surfaces,
    audience: row.audience,
    guidance: row.guidance,
    implementationHeuristic: row.implementationHeuristic,
    strength: row.strength,
    exceptions: row.exceptions,
    safetyNotes: row.safetyNotes,
    allowedWording: row.allowedWording,
    forbiddenWording: row.forbiddenWording,
    reviewDueAt: toDateOnly(row.reviewDueAt),
    ...(row.reviewedBy ? { reviewedBy: row.reviewedBy } : {}),
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt.toISOString() } : {}),
  }
}

function rowToAssessment(row) {
  return {
    id: row.id,
    questionId: row.questionId,
    workId: row.workId,
    status: row.status,
    reviewScope: row.reviewScope,
    population: row.population,
    outcomes: row.outcomes,
    mainResults: row.mainResults,
    directness: row.directness,
    riskOfBias: row.riskOfBias,
    limitations: row.limitations,
    cannotSupport: row.cannotSupport,
    ...(row.assessedBy ? { assessedBy: row.assessedBy } : {}),
    ...(row.assessedAt ? { assessedAt: row.assessedAt.toISOString() } : {}),
  }
}

function rowToQuestion(row) {
  return {
    id: row.id,
    topic: row.topic,
    question: row.question,
    questionRu: row.questionRu,
    plainQuestion: row.plainQuestion,
    plainQuestionRu: row.plainQuestionRu,
    outcomes: row.outcomes,
    critical: row.critical,
    reviewIntervalMonths: row.reviewIntervalMonths,
    scope: row.scope,
    scopeRu: row.scopeRu,
    searchStrategy: row.searchStrategy,
    ...(row.searchDate ? { searchDate: toDateOnly(row.searchDate) } : {}),
    ...(row.searchNotes ? { searchNotes: row.searchNotes } : {}),
  }
}

export function mapEvidenceRowsToDataset(rows, { generatedAt = new Date().toISOString() } = {}) {
  const rawDataset = {
    version: 1,
    generatedAt,
    questions: rows.questions.map(rowToQuestion),
    works: rows.works.map(rowToWork),
    assessments: rows.assessments.map(rowToAssessment),
    claims: rows.claimVersions.map(rowToClaim),
    recommendations: rows.recommendations.map(rowToRecommendation),
    aiTests: rows.aiTests.map(({ payload }) => payload),
    blogOutlines: rows.blogOutlines.map(({ payload }) => payload),
  }
  return evidenceDatasetSchema.parse(rawDataset)
}

export async function loadEvidenceDataset(prisma) {
  const [questions, works, assessments, claimVersions, recommendations, aiTests, blogOutlines] =
    await prisma.$transaction([
      prisma.evidenceQuestion.findMany({ orderBy: { id: 'asc' } }),
      prisma.researchWork.findMany({ orderBy: { id: 'asc' } }),
      prisma.researchAssessment.findMany({ orderBy: { id: 'asc' } }),
      prisma.evidenceClaimVersion.findMany({
        include: { claim: { select: { questionId: true } }, evidenceLinks: true },
        orderBy: { id: 'asc' },
      }),
      prisma.evidenceRecommendation.findMany({ include: { claimLinks: true }, orderBy: { id: 'asc' } }),
      prisma.evidenceAiTest.findMany({ orderBy: { id: 'asc' } }),
      prisma.evidenceBlogOutline.findMany({ orderBy: { id: 'asc' } }),
    ])

  return mapEvidenceRowsToDataset({
    questions,
    works,
    assessments,
    claimVersions,
    recommendations,
    aiTests,
    blogOutlines,
  })
}

export async function importResearchWorkByIdentifiers(prisma, rawWork) {
  const incoming = researchWorkSchema.parse(rawWork)
  const ids = incoming.identifiers
  const matches = await prisma.researchWork.findMany({
    where: {
      OR: [
        { id: incoming.id },
        ...(ids.doi ? [{ doi: ids.doi }] : []),
        ...(ids.pmid ? [{ pmid: ids.pmid }] : []),
        ...(ids.pmcid ? [{ pmcid: ids.pmcid }] : []),
        ...(ids.trialId ? [{ trialId: ids.trialId }] : []),
      ],
    },
  })

  const matchedIds = new Set(matches.map(({ id }) => id))
  if (matchedIds.size > 1) {
    throw new Error(`Identifier conflict: incoming work matches ${[...matchedIds].join(', ')}`)
  }

  const existing = matches[0] ?? null
  const id = existing?.id ?? incoming.id
  const data = workData(incoming, existing)
  return prisma.researchWork.upsert({ where: { id }, create: { id, ...data }, update: data })
}

export async function createDatabaseEvidenceRepository(prisma) {
  const dataset = await loadEvidenceDataset(prisma)
  return createEvidenceRepository(dataset)
}
