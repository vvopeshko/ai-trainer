import { describe, expect, test, vi } from 'vitest'
import { evidencePilotFixtures } from './fixtures.js'
import {
  buildEvidencePersistencePlan,
  importEvidenceDataset,
  importResearchWorkByIdentifiers,
  mapEvidenceRowsToDataset,
} from './persistence.js'

const clone = (value) => structuredClone(value)

function planAsLoadedRows(plan) {
  const questionByClaim = new Map(plan.stableClaims.map((claim) => [claim.id, claim.questionId]))
  return {
    questions: plan.questions,
    works: plan.works,
    assessments: plan.assessments,
    claimVersions: plan.claimVersions.map((row) => ({
      ...row,
      claim: { questionId: questionByClaim.get(row.claimId) },
    })),
    recommendations: plan.recommendations,
    aiTests: plan.aiTests,
    blogOutlines: plan.blogOutlines,
  }
}

function createDelegate() {
  const rows = new Map()
  return {
    rows,
    findUnique: vi.fn(async ({ where }) => rows.get(where.id) ?? null),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      const ids = where.id?.in ? new Set(where.id.in) : null
      return [...rows.values()].filter((row) =>
        (!ids || ids.has(row.id)) && (!where.status || row.status === where.status),
      )
    }),
    upsert: vi.fn(async ({ where, create, update }) => {
      const current = rows.get(where.id)
      const next = current ? { ...current, ...update } : { ...create }
      rows.set(where.id, next)
      return next
    }),
    deleteMany: vi.fn(async ({ where = {} } = {}) => {
      const ids = where.id?.in ? new Set(where.id.in) : null
      if (ids) for (const id of ids) rows.delete(id)
      return { count: 0 }
    }),
    createMany: vi.fn(async ({ data }) => {
      for (const row of data) if (row.id) rows.set(row.id, row)
      return { count: data.length }
    }),
  }
}

function createImportPrisma() {
  const delegateNames = [
    'evidenceQuestion',
    'researchWork',
    'researchAssessment',
    'evidenceClaim',
    'evidenceClaimVersion',
    'claimEvidence',
    'evidenceRecommendation',
    'evidenceRecommendationClaim',
    'evidenceAiTest',
    'evidenceBlogOutline',
  ]
  const prisma = Object.fromEntries(delegateNames.map((name) => [name, createDelegate()]))
  prisma.$transaction = vi.fn(async (callback) => callback(prisma))
  return prisma
}

describe('evidence persistence mapping', () => {
  test('round-trips the complete pilot through persistence row shapes', () => {
    const plan = buildEvidencePersistencePlan(evidencePilotFixtures)
    const result = mapEvidenceRowsToDataset(planAsLoadedRows(plan), {
      generatedAt: evidencePilotFixtures.generatedAt,
    })

    expect(result).toEqual(evidencePilotFixtures)
  })

  test('dry-run validates and counts without touching Prisma', async () => {
    const result = await importEvidenceDataset(null, evidencePilotFixtures, { dryRun: true })

    expect(result).toEqual({
      dryRun: true,
      counts: {
        questions: 10,
        works: 19,
        assessments: 12,
        claims: 15,
        recommendations: 10,
        aiTests: 50,
        blogOutlines: 6,
      },
    })
  })

  test('repeated pilot import never overwrites approved versions or recommendations', async () => {
    const prisma = createImportPrisma()
    await importEvidenceDataset(prisma, evidencePilotFixtures)

    const claimId = 'ECV-WEEKLY-VOLUME-HYP-v1'
    const recommendationId = 'ER-WEEKLY-VOLUME-HYP-DEFAULT-v1'
    prisma.evidenceClaimVersion.rows.set(claimId, {
      ...prisma.evidenceClaimVersion.rows.get(claimId),
      status: 'approved',
      statement: 'Reviewer-approved statement.',
    })
    prisma.evidenceRecommendation.rows.set(recommendationId, {
      ...prisma.evidenceRecommendation.rows.get(recommendationId),
      status: 'approved',
      guidance: 'Reviewer-approved guidance.',
    })

    const changedPilot = clone(evidencePilotFixtures)
    changedPilot.claims[0].statement = 'A later draft must not overwrite approval.'
    changedPilot.recommendations[0].guidance = 'A later draft must not overwrite approval.'
    const result = await importEvidenceDataset(prisma, changedPilot)

    expect(result.protectedClaimVersions).toBe(1)
    expect(result.protectedRecommendations).toBe(1)
    expect(prisma.evidenceClaimVersion.rows.get(claimId).statement).toBe('Reviewer-approved statement.')
    expect(prisma.evidenceRecommendation.rows.get(recommendationId).guidance).toBe('Reviewer-approved guidance.')
  })
})

describe('manual research-work import', () => {
  test('deduplicates by DOI and preserves an existing stable ID', async () => {
    const incoming = clone(evidencePilotFixtures.works[0])
    const existing = {
      id: 'RW-EXISTING',
      correctionStatus: 'current',
      statusCheckedAt: new Date('2026-08-01T00:00:00.000Z'),
    }
    const prisma = {
      researchWork: {
        findMany: vi.fn(async () => [existing]),
        upsert: vi.fn(async ({ where, update }) => ({ id: where.id, ...update })),
      },
    }

    const result = await importResearchWorkByIdentifiers(prisma, incoming)

    expect(prisma.researchWork.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'RW-EXISTING' },
    }))
    expect(result.correctionStatus).toBe('current')
  })

  test('rejects identifiers that point to multiple canonical works', async () => {
    const incoming = clone(evidencePilotFixtures.works[0])
    const prisma = {
      researchWork: {
        findMany: vi.fn(async () => [{ id: 'RW-A' }, { id: 'RW-B' }]),
      },
    }

    await expect(importResearchWorkByIdentifiers(prisma, incoming))
      .rejects.toThrow('Identifier conflict')
  })
})
