import { describe, expect, test, vi } from 'vitest'
import { requireEvidenceRole, resolveEvidenceRole } from './evidenceAdmin.js'

describe('resolveEvidenceRole', () => {
  const env = {
    EVIDENCE_REVIEWER_IDS: 'user-reviewer,tg:101',
    EVIDENCE_APPROVER_IDS: 'user-approver,tg:202',
  }

  test('approver allowlist has precedence and implies reviewer access', () => {
    expect(resolveEvidenceRole({ id: 'user-approver' }, env)).toBe('approver')
    expect(resolveEvidenceRole({ id: 'x', telegramId: 202n }, env)).toBe('approver')
  })

  test('supports user UUID and explicit tg:<id> tokens', () => {
    expect(resolveEvidenceRole({ id: 'user-reviewer' }, env)).toBe('reviewer')
    expect(resolveEvidenceRole({ id: 'x', telegramId: 101n }, env)).toBe('reviewer')
  })

  test('fails closed when allowlists are empty or user is absent', () => {
    expect(resolveEvidenceRole({ id: 'user-reviewer' }, {})).toBe(null)
    expect(resolveEvidenceRole(null, env)).toBe(null)
  })
})

describe('requireEvidenceRole', () => {
  function res() {
    return {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
    }
  }

  test('denies access without configured membership', () => {
    const response = res()
    const next = vi.fn()
    requireEvidenceRole('reviewer')({ user: { id: 'unknown' } }, response, next)

    expect(response.statusCode).toBe(403)
    expect(response.body.code).toBe('EVIDENCE_ACCESS_DENIED')
    expect(next).not.toHaveBeenCalled()
  })
})
