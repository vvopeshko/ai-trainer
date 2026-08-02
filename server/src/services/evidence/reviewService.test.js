import { describe, expect, test } from 'vitest'
import { getClaimApprovalBlockers, getRecommendationApprovalBlockers } from './reviewService.js'

const NOW = new Date('2026-08-02T12:00:00.000Z')
const currentWork = (id) => ({ id, status: 'screened_in', correctionStatus: 'current' })

describe('getClaimApprovalBlockers', () => {
  const readyClaim = () => ({
    id: 'ECV-READY-v1',
    status: 'in_review',
    reviewDueAt: new Date('2027-01-01T00:00:00.000Z'),
    evidenceLinks: [
      { workId: 'RW-A', relation: 'supports', work: currentWork('RW-A') },
      { workId: 'RW-B', relation: 'contextualizes', work: currentWork('RW-B') },
    ],
  })

  test('allows an in-review current claim with approved supporting assessment', () => {
    expect(getClaimApprovalBlockers(
      readyClaim(),
      [{ workId: 'RW-A', status: 'approved' }],
      { now: NOW },
    )).toEqual([])
  })

  test('reports state, source and assessment blockers explicitly', () => {
    const claim = readyClaim()
    claim.status = 'draft'
    claim.reviewDueAt = new Date('2026-01-01T00:00:00.000Z')
    claim.evidenceLinks[0].work.correctionStatus = 'unknown'

    expect(getClaimApprovalBlockers(claim, [], { now: NOW })).toEqual(expect.arrayContaining([
      'claim_not_in_review',
      'claim_review_expired',
      'work_status_unverified:RW-A',
      'assessment_not_approved:RW-A',
    ]))
  })

  test('requires direct supporting evidence, not contextualization alone', () => {
    const claim = readyClaim()
    claim.evidenceLinks = claim.evidenceLinks.filter(({ relation }) => relation === 'contextualizes')

    expect(getClaimApprovalBlockers(claim, [], { now: NOW }))
      .toContain('claim_has_no_supporting_evidence')
  })
})

describe('getRecommendationApprovalBlockers', () => {
  const claimVersion = {
    id: 'ECV-A-v1',
    status: 'approved',
    reviewDueAt: new Date('2027-01-01T00:00:00.000Z'),
    evidenceLinks: [{ work: currentWork('RW-A') }],
  }
  const recommendation = {
    id: 'ER-A-v1',
    status: 'in_review',
    reviewDueAt: new Date('2027-01-01T00:00:00.000Z'),
    claimLinks: [{ role: 'primary', claimVersion }],
  }

  test('allows recommendation only when every linked claim is runtime-eligible', () => {
    expect(getRecommendationApprovalBlockers(recommendation, { now: NOW })).toEqual([])
  })

  test('blocks unapproved supporting claims and retracted works', () => {
    const broken = structuredClone(recommendation)
    broken.claimLinks.push({
      role: 'supporting',
      claimVersion: {
        ...claimVersion,
        id: 'ECV-B-v1',
        status: 'draft',
        evidenceLinks: [{ work: { ...currentWork('RW-B'), correctionStatus: 'retracted' } }],
      },
    })

    expect(getRecommendationApprovalBlockers(broken, { now: NOW })).toEqual(expect.arrayContaining([
      'claim_not_approved:ECV-B-v1',
    ]))
  })
})
