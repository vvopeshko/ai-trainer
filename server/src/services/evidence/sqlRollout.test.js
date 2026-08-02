import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const sqlPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../prisma/manual/2026-08-02-evidence-foundation.sql',
)
const sql = readFileSync(sqlPath, 'utf8')
const evidenceTables = [
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
]

describe('manual Neon evidence rollout', () => {
  test('is transactional and creates every evidence table idempotently', () => {
    expect(sql).toMatch(/\bBEGIN;/)
    expect(sql).toMatch(/\bCOMMIT;/)
    for (const table of evidenceTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`)
    }
  })

  test('contains no destructive data or schema operation', () => {
    expect(sql).not.toMatch(/\bDROP\b/i)
    expect(sql).not.toMatch(/\bTRUNCATE\b/i)
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(sql).not.toMatch(/\bUPDATE\s+"/i)
  })

  test('ALTER TABLE targets only isolated evidence tables', () => {
    const alteredTables = [...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1])
    expect(alteredTables.length).toBeGreaterThan(0)
    expect(alteredTables.filter((table) => !evidenceTables.includes(table))).toEqual([])
  })

  test('creates all relation constraints used by Prisma', () => {
    for (const constraint of [
      'ResearchAssessment_questionId_fkey',
      'ResearchAssessment_workId_fkey',
      'EvidenceClaim_questionId_fkey',
      'EvidenceClaimVersion_claimId_fkey',
      'ClaimEvidence_claimVersionId_fkey',
      'ClaimEvidence_workId_fkey',
      'EvidenceRecommendationClaim_recommendationId_fkey',
      'EvidenceRecommendationClaim_claimVersionId_fkey',
    ]) {
      expect(sql).toContain(`CONSTRAINT "${constraint}"`)
    }
  })
})
