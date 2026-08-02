import { describe, expect, test, vi } from 'vitest'
import { createEvidenceAdminController } from './evidenceAdminController.js'

function response() {
  return {
    body: null,
    json(value) { this.body = value; return this },
  }
}

function request({ params = {}, query = {}, body = {}, user = { id: 'reviewer-1' } } = {}) {
  return { params, query, body, user }
}

describe('evidenceAdminController', () => {
  test('returns the role resolved by evidence middleware', async () => {
    const controller = createEvidenceAdminController({})
    const res = response()

    await controller.access(
      { ...request(), evidenceRole: 'approver' },
      res,
    )

    expect(res.body).toEqual({ role: 'approver', userId: 'reviewer-1' })
  })

  test('passes authenticated actor and mandatory comment to claim submit', async () => {
    const service = { submitClaimVersion: vi.fn(async () => ({ id: 'ECV-A-v1', status: 'in_review' })) }
    const controller = createEvidenceAdminController(service)
    const res = response()
    const next = vi.fn()

    await controller.submitClaimVersion(
      request({ params: { id: 'ECV-A-v1' }, body: { comment: 'Ready for scientific review.' } }),
      res,
      next,
    )

    expect(service.submitClaimVersion).toHaveBeenCalledWith('ECV-A-v1', {
      actorId: 'reviewer-1',
      comment: 'Ready for scientific review.',
    })
    expect(res.body.claim.status).toBe('in_review')
    expect(next).not.toHaveBeenCalled()
  })

  test('rejects empty approval comments before calling service', async () => {
    const service = { approveClaimVersion: vi.fn() }
    const controller = createEvidenceAdminController(service)
    const next = vi.fn()

    await controller.approveClaimVersion(
      request({ params: { id: 'ECV-A-v1' }, body: { comment: ' ' } }),
      response(),
      next,
    )

    expect(service.approveClaimVersion).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }))
  })

  test('validates runtime filters and preserves deterministic question ID', async () => {
    const service = { runtimeCheck: vi.fn(async () => ({ answerability: 'unsupported' })) }
    const controller = createEvidenceAdminController(service)
    const res = response()

    await controller.runtimeCheck(
      request({ params: { questionId: 'EQ-CON-001' }, query: { outcome: 'power' } }),
      res,
      vi.fn(),
    )

    expect(service.runtimeCheck).toHaveBeenCalledWith('EQ-CON-001', { outcome: 'power' })
    expect(res.body.guidance.answerability).toBe('unsupported')
  })

  test('assessment edit strips audit comment from scientific fields', async () => {
    const service = { updateAssessment: vi.fn(async (_id, patch) => patch) }
    const controller = createEvidenceAdminController(service)
    const res = response()

    await controller.patchAssessment(
      request({
        params: { id: 'RA-A' },
        body: { reviewScope: 'full_text', riskOfBias: 'some_concerns', comment: 'Full text checked.' },
      }),
      res,
      vi.fn(),
    )

    expect(service.updateAssessment).toHaveBeenCalledWith(
      'RA-A',
      { reviewScope: 'full_text', riskOfBias: 'some_concerns' },
      { actorId: 'reviewer-1', comment: 'Full text checked.' },
    )
  })
})
