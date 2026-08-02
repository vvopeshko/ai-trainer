import { describe, expect, test } from 'vitest'
import { evidencePilotFixtures } from './fixtures.js'
import { evidenceDatasetSchema, evidenceClaimVersionSchema } from './schemas.js'

const clone = (value) => structuredClone(value)

describe('evidenceDatasetSchema', () => {
  test('validates the complete phase-0 pilot fixtures', () => {
    const dataset = evidenceDatasetSchema.parse(evidencePilotFixtures)

    expect(dataset.questions).toHaveLength(10)
    expect(dataset.claims).toHaveLength(15)
    expect(dataset.recommendations).toHaveLength(10)
    expect(dataset.aiTests).toHaveLength(50)
    expect(dataset.blogOutlines).toHaveLength(6)
  })

  test('rejects duplicate entity IDs', () => {
    const dataset = clone(evidencePilotFixtures)
    dataset.claims.push(clone(dataset.claims[0]))

    const result = evidenceDatasetSchema.safeParse(dataset)

    expect(result.success).toBe(false)
    expect(result.error.issues.some((issue) => issue.message.includes('Duplicate ID'))).toBe(true)
  })

  test('rejects dangling work and claim references', () => {
    const dataset = clone(evidencePilotFixtures)
    dataset.claims[0].evidence.supports = ['RW-MISSING']
    dataset.recommendations[0].claimVersionId = 'ECV-MISSING-v1'

    const result = evidenceDatasetSchema.safeParse(dataset)

    expect(result.success).toBe(false)
    expect(result.error.issues.some((issue) => issue.message.includes('Unknown research work'))).toBe(true)
    expect(result.error.issues.some((issue) => issue.message.includes('Unknown claim'))).toBe(true)
  })
})

describe('approval invariants', () => {
  test('approved claim requires reviewer identity and timestamp', () => {
    const draft = clone(evidencePilotFixtures.claims[0])
    draft.status = 'approved'

    const result = evidenceClaimVersionSchema.safeParse(draft)

    expect(result.success).toBe(false)
    expect(result.error.issues.some((issue) => issue.message.includes('requires reviewer'))).toBe(true)
  })
})
