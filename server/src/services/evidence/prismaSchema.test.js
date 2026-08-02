import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../prisma/schema.prisma',
)
const schema = readFileSync(schemaPath, 'utf8')

describe('evidence Prisma schema parity', () => {
  test('contains every persistence model used by the import adapter', () => {
    for (const model of [
      'EvidenceQuestion',
      'ResearchWork',
      'ResearchAssessment',
      'EvidenceClaim',
      'EvidenceClaimVersion',
      'ClaimEvidence',
      'EvidenceRecommendation',
      'EvidenceRecommendationClaim',
      'EvidenceAiTest',
      'EvidenceBlogOutline',
      'EvidenceAuditEvent',
    ]) {
      expect(schema).toMatch(new RegExp(`model ${model} \\{`))
    }
  })

  test('keeps claim versions and assessments version-addressable', () => {
    expect(schema).toMatch(/@@unique\(\[claimId, version\]\)/)
    expect(schema).toMatch(/@@unique\(\[questionId, workId, version\]\)/)
  })

  test('stores claim evidence and recommendation support as relations', () => {
    expect(schema).toMatch(/@@unique\(\[claimVersionId, workId\]\)/)
    expect(schema).toMatch(/@@unique\(\[recommendationId, claimVersionId\]\)/)
  })
})
