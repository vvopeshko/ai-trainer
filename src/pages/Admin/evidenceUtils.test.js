import { describe, expect, test } from 'vitest'
import { blockerLabel, statusMeta } from './evidenceUtils.js'

describe('evidence admin view model', () => {
  test('maps persisted statuses to reviewer-facing labels', () => {
    expect(statusMeta('in_review')).toEqual({ label: 'На ревью', tone: 'warning' })
    expect(statusMeta('approved')).toEqual({ label: 'Одобрено', tone: 'success' })
  })

  test('keeps the entity ID visible in dynamic blockers', () => {
    expect(blockerLabel('assessment_not_approved:RW-TEST-001'))
      .toBe('Assessment не одобрен · RW-TEST-001')
  })
})
