import { evidenceDatasetSchema, evidenceQuerySchema } from './schemas.js'

function isCurrentOn(date, asOf) {
  return date >= asOf.toISOString().slice(0, 10)
}

function claimMatchesQuery(claim, query) {
  if (claim.questionId !== query.questionId) return false
  if (query.outcome && !claim.outcomes.includes(query.outcome)) return false
  if (query.trainingStatus &&
      !claim.trainingStatuses.includes(query.trainingStatus) &&
      !claim.trainingStatuses.includes('mixed')) return false
  if (query.bodyScope && !claim.bodyScopes.includes(query.bodyScope)) return false
  return true
}

export function createEvidenceRepository(rawDataset) {
  const dataset = evidenceDatasetSchema.parse(rawDataset)
  const questionsById = new Map(dataset.questions.map((question) => [question.id, question]))
  const worksById = new Map(dataset.works.map((work) => [work.id, work]))
  const claimsById = new Map(dataset.claims.map((claim) => [claim.id, claim]))

  function explainClaimEligibility(claimOrId, { asOf = new Date() } = {}) {
    const claim = typeof claimOrId === 'string' ? claimsById.get(claimOrId) : claimOrId
    if (!claim) return { eligible: false, reasons: ['claim_not_found'] }

    const reasons = []
    if (claim.status !== 'approved') reasons.push('claim_not_approved')
    if (!claim.reviewedBy || !claim.reviewedAt) reasons.push('claim_review_missing')
    if (!isCurrentOn(claim.reviewDueAt, asOf)) reasons.push('claim_review_expired')

    const workIds = [
      ...claim.evidence.supports,
      ...claim.evidence.contradicts,
      ...claim.evidence.contextualizes,
    ]
    if (workIds.length === 0) reasons.push('claim_has_no_evidence')

    for (const workId of workIds) {
      const work = worksById.get(workId)
      if (!work) {
        reasons.push(`work_missing:${workId}`)
      } else if (work.status === 'retracted' || work.correctionStatus === 'retracted') {
        reasons.push(`work_retracted:${workId}`)
      } else if (work.correctionStatus !== 'current') {
        reasons.push(`work_status_unverified:${workId}`)
      }
    }

    return { eligible: reasons.length === 0, reasons }
  }

  function isRecommendationEligible(recommendation, eligibleClaimIds, asOf) {
    if (recommendation.status !== 'approved') return false
    if (!recommendation.reviewedBy || !recommendation.reviewedAt) return false
    if (!isCurrentOn(recommendation.reviewDueAt, asOf)) return false
    return [recommendation.claimVersionId, ...recommendation.supportingClaimVersionIds]
      .every((claimId) => eligibleClaimIds.has(claimId))
  }

  function getEvidenceGuidance(rawQuery, { asOf = new Date() } = {}) {
    const query = evidenceQuerySchema.parse(rawQuery)
    const question = questionsById.get(query.questionId)
    if (!question) {
      return { answerability: 'unsupported', question: null, claims: [], recommendations: [] }
    }

    const globallyEligibleClaimIds = new Set(
      dataset.claims
        .filter((claim) => explainClaimEligibility(claim, { asOf }).eligible)
        .map((claim) => claim.id),
    )
    const matchingClaims = dataset.claims.filter((claim) => claimMatchesQuery(claim, query))
    const eligibleClaims = matchingClaims.filter((claim) => globallyEligibleClaimIds.has(claim.id))
    const matchingEligibleClaimIds = new Set(eligibleClaims.map((claim) => claim.id))
    const eligibleRecommendations = dataset.recommendations.filter((recommendation) =>
      matchingEligibleClaimIds.has(recommendation.claimVersionId) &&
      isRecommendationEligible(recommendation, globallyEligibleClaimIds, asOf),
    )

    return {
      answerability: eligibleRecommendations.length > 0
        ? 'supported'
        : eligibleClaims.length > 0 ? 'evidence_only' : 'unsupported',
      question,
      claims: eligibleClaims,
      recommendations: eligibleRecommendations,
    }
  }

  return {
    getEvidenceGuidance,
    explainClaimEligibility,
    counts: {
      questions: dataset.questions.length,
      works: dataset.works.length,
      assessments: dataset.assessments.length,
      claims: dataset.claims.length,
      recommendations: dataset.recommendations.length,
      aiTests: dataset.aiTests.length,
      blogOutlines: dataset.blogOutlines.length,
    },
  }
}
