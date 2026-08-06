import { describe, expect, test } from 'vitest'
import { blockerLabel, statusMeta } from './evidenceUtils.js'

describe('evidence admin view model', () => {
  test('maps persisted statuses to reviewer-facing labels', () => {
    expect(statusMeta('in_review', 'ru')).toEqual({ label: 'На ревью', tone: 'warning' })
    expect(statusMeta('approved', 'en')).toEqual({ label: 'Approved', tone: 'success' })
  })

  test('keeps the entity ID visible in dynamic blockers', () => {
    expect(blockerLabel('assessment_not_approved:RW-TEST-001', 'ru'))
      .toBe('Оценка исследования не одобрена · RW-TEST-001')
    expect(blockerLabel('assessment_not_approved:RW-TEST-001', 'en'))
      .toBe('Assessment is not approved · RW-TEST-001')
  })
})
