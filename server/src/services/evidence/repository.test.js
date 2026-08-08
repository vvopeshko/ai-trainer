import { describe, expect, test } from 'vitest'
import { evidencePilotFixtures } from './fixtures.js'
import { createEvidenceRepository } from './repository.js'

const AS_OF = new Date('2026-08-02T12:00:00.000Z')
const REVIEWED_AT = '2026-08-01T12:00:00.000Z'
const clone = (value) => structuredClone(value)

function approveClaim(dataset, claimId) {
  const claim = dataset.claims.find(({ id }) => id === claimId)
  claim.status = 'approved'
  claim.reviewedBy = 'scientific-reviewer'
  claim.reviewedAt = REVIEWED_AT

  const workIds = [
    ...claim.evidence.supports,
    ...claim.evidence.contradicts,
    ...claim.evidence.contextualizes,
  ]
  for (const workId of workIds) {
    const work = dataset.works.find(({ id }) => id === workId)
    work.correctionStatus = 'current'
    work.statusCheckedAt = '2026-08-01'
  }
}

function approveRecommendation(dataset, recommendationId) {
  const recommendation = dataset.recommendations.find(({ id }) => id === recommendationId)
  recommendation.status = 'approved'
  recommendation.reviewedBy = 'scientific-reviewer'
  recommendation.reviewedAt = REVIEWED_AT
}

describe('createEvidenceRepository', () => {
  test('loads all phase-0 fixture types', () => {
    const repository = createEvidenceRepository(evidencePilotFixtures)

    expect(repository.counts).toEqual({
      questions: 10,
      works: 38,
      assessments: 31,
      claims: 18,
      recommendations: 10,
      aiTests: 56,
      blogOutlines: 6,
    })
  })

  test('fails closed: draft pilot claims never reach runtime retrieval', () => {
    const repository = createEvidenceRepository(evidencePilotFixtures)

    const result = repository.getEvidenceGuidance(
      { questionId: 'EQ-HYP-001', outcome: 'hypertrophy' },
      { asOf: AS_OF },
    )

    expect(result.answerability).toBe('unsupported')
    expect(result.claims).toEqual([])
    expect(result.recommendations).toEqual([])
  })

  test('returns approved evidence but not an unapproved product heuristic', () => {
    const dataset = clone(evidencePilotFixtures)
    approveClaim(dataset, 'ECV-WEEKLY-VOLUME-HYP-v1')
    const repository = createEvidenceRepository(dataset)

    const result = repository.getEvidenceGuidance(
      { questionId: 'EQ-HYP-001', outcome: 'hypertrophy' },
      { asOf: AS_OF },
    )

    expect(result.answerability).toBe('evidence_only')
    expect(result.claims.map(({ id }) => id)).toEqual(['ECV-WEEKLY-VOLUME-HYP-v1'])
    expect(result.recommendations).toEqual([])
  })

  test('returns guidance only when recommendation and every linked claim are approved', () => {
    const dataset = clone(evidencePilotFixtures)
    approveClaim(dataset, 'ECV-ROM-FULL-DEFAULT-v1')
    approveRecommendation(dataset, 'ER-ROM-COMFORTABLE-FULL-v1')
    let repository = createEvidenceRepository(dataset)

    let result = repository.getEvidenceGuidance(
      { questionId: 'EQ-HYP-006', outcome: 'exercise_specific_strength', bodyScope: 'lower_body' },
      { asOf: AS_OF },
    )
    expect(result.answerability).toBe('evidence_only')

    for (const claimId of [
      'ECV-ROM-LENGTHENED-PARTIAL-v1',
      'ECV-ROM-CALF-LENGTHENED-v1',
      'ECV-ROM-ARMS-LENGTHENED-v1',
      'ECV-ROM-QUAD-LENGTHENED-v1',
    ]) approveClaim(dataset, claimId)
    repository = createEvidenceRepository(dataset)
    result = repository.getEvidenceGuidance(
      { questionId: 'EQ-HYP-006', outcome: 'exercise_specific_strength', bodyScope: 'lower_body' },
      { asOf: AS_OF },
    )

    expect(result.answerability).toBe('supported')
    expect(result.recommendations.map(({ id }) => id)).toEqual(['ER-ROM-COMFORTABLE-FULL-v1'])
  })

  test('blocks expired reviews and unverified or retracted source works', () => {
    const dataset = clone(evidencePilotFixtures)
    approveClaim(dataset, 'ECV-ORDER-STRENGTH-PRIORITY-v1')
    const claim = dataset.claims.find(({ id }) => id === 'ECV-ORDER-STRENGTH-PRIORITY-v1')
    const repository = createEvidenceRepository(dataset)

    expect(repository.explainClaimEligibility(claim.id, { asOf: new Date('2027-03-01T00:00:00.000Z') }))
      .toMatchObject({ eligible: false, reasons: ['claim_review_expired'] })

    const work = dataset.works.find(({ id }) => id === 'RW-ORDER-NUNES-2021')
    work.correctionStatus = 'retracted'
    const retractedRepository = createEvidenceRepository(dataset)
    expect(retractedRepository.explainClaimEligibility(claim.id, { asOf: AS_OF }))
      .toMatchObject({ eligible: false, reasons: ['work_retracted:RW-ORDER-NUNES-2021'] })
  })

  test('filters by outcome and applicability without leaking other approved claims', () => {
    const dataset = clone(evidencePilotFixtures)
    approveClaim(dataset, 'ECV-CONCURRENT-STRENGTH-HYP-v1')
    approveClaim(dataset, 'ECV-CONCURRENT-POWER-SCHEDULE-v1')
    const repository = createEvidenceRepository(dataset)

    const power = repository.getEvidenceGuidance(
      { questionId: 'EQ-CON-001', outcome: 'power' },
      { asOf: AS_OF },
    )

    expect(power.claims.map(({ id }) => id)).toEqual(['ECV-CONCURRENT-POWER-SCHEDULE-v1'])
  })

  test('unknown question fails closed rather than guessing from adjacent claims', () => {
    const repository = createEvidenceRepository(evidencePilotFixtures)
    const result = repository.getEvidenceGuidance({ questionId: 'EQ-HYP-999' }, { asOf: AS_OF })

    expect(result).toEqual({
      answerability: 'unsupported',
      question: null,
      claims: [],
      recommendations: [],
    })
  })
})
