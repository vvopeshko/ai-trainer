import { z } from 'zod'

const isoDate = z.string().datetime({ offset: true })
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nonEmptyText = z.string().trim().min(1)

export const evidenceStatusSchema = z.enum([
  'draft',
  'in_review',
  'approved',
  'disputed',
  'superseded',
  'withdrawn',
])

export const certaintySchema = z.enum(['high', 'moderate', 'low', 'very_low'])
export const outcomeSchema = z.enum([
  'hypertrophy',
  'maximal_strength',
  'exercise_specific_strength',
  'power',
  'muscular_endurance',
  'adherence',
  'fatigue',
])
export const trainingStatusSchema = z.enum([
  'untrained',
  'novice',
  'trained',
  'advanced',
  'mixed',
  'unclear',
])
export const bodyScopeSchema = z.enum([
  'whole_body',
  'upper_body',
  'lower_body',
  'muscle_specific',
  'exercise_specific',
])

export const evidenceQuestionSchema = z.object({
  id: z.string().regex(/^EQ-[A-Z]+-\d{3}$/),
  topic: nonEmptyText,
  question: nonEmptyText,
  questionRu: nonEmptyText,
  plainQuestion: nonEmptyText,
  plainQuestionRu: nonEmptyText,
  outcomes: z.array(outcomeSchema).min(1),
  critical: z.boolean(),
  reviewIntervalMonths: z.number().int().positive(),
  scope: nonEmptyText,
  scopeRu: nonEmptyText,
  searchStrategy: z.object({
    databases: z.array(nonEmptyText),
    queries: z.array(nonEmptyText),
    supplementaryMethods: z.array(nonEmptyText),
  }),
  searchDate: dateOnly.optional(),
  searchNotes: nonEmptyText.optional(),
})

const identifiersSchema = z.object({
  doi: nonEmptyText.optional(),
  pmid: z.string().regex(/^\d+$/).optional(),
  pmcid: z.string().regex(/^PMC\d+$/).optional(),
  trialId: nonEmptyText.optional(),
  url: z.string().url().optional(),
}).refine((value) => Object.values(value).some(Boolean), {
  message: 'Research work must have at least one stable identifier',
})

export const researchWorkSchema = z.object({
  id: z.string().regex(/^RW-[A-Z0-9-]+$/),
  status: z.enum(['discovered', 'screened_in', 'screened_out', 'retracted']),
  title: nonEmptyText,
  year: z.number().int().min(1900).max(2100),
  workType: z.enum([
    'position_stand',
    'systematic_review',
    'meta_analysis',
    'umbrella_review',
    'rct',
    'other',
  ]),
  identifiers: identifiersSchema,
  correctionStatus: z.enum(['current', 'corrected', 'retracted', 'unknown']),
  statusCheckedAt: dateOnly.optional(),
  reviewScope: z.enum(['abstract_only', 'full_text', 'full_text_and_supplements']),
  includedStudiesCount: z.number().int().positive().optional(),
  sourceNotes: nonEmptyText.optional(),
})

export const researchAssessmentSchema = z.object({
  id: z.string().regex(/^RA-[A-Z0-9-]+$/),
  questionId: z.string().regex(/^EQ-[A-Z]+-\d{3}$/),
  workId: z.string().regex(/^RW-[A-Z0-9-]+$/),
  status: evidenceStatusSchema,
  reviewScope: z.enum(['abstract_only', 'full_text', 'full_text_and_supplements']),
  population: nonEmptyText,
  outcomes: z.array(outcomeSchema).min(1),
  mainResults: z.array(nonEmptyText).min(1),
  directness: z.enum(['high', 'some_concerns', 'low']),
  riskOfBias: z.enum(['low', 'some_concerns', 'high', 'not_assessed']),
  limitations: z.array(nonEmptyText),
  cannotSupport: z.array(nonEmptyText).default([]),
  assessedBy: nonEmptyText.optional(),
  assessedAt: isoDate.optional(),
})

const evidenceLinksSchema = z.object({
  supports: z.array(z.string().regex(/^RW-[A-Z0-9-]+$/)).default([]),
  contradicts: z.array(z.string().regex(/^RW-[A-Z0-9-]+$/)).default([]),
  contextualizes: z.array(z.string().regex(/^RW-[A-Z0-9-]+$/)).default([]),
})

export const evidenceClaimVersionSchema = z.object({
  id: z.string().regex(/^ECV-[A-Z0-9-]+-v\d+$/),
  claimId: z.string().regex(/^EC-[A-Z0-9-]+$/),
  questionId: z.string().regex(/^EQ-[A-Z]+-\d{3}$/),
  version: z.number().int().positive(),
  status: evidenceStatusSchema,
  statement: nonEmptyText,
  statementRu: nonEmptyText,
  plainStatement: nonEmptyText,
  plainStatementRu: nonEmptyText,
  population: nonEmptyText,
  trainingStatuses: z.array(trainingStatusSchema).min(1),
  bodyScopes: z.array(bodyScopeSchema).min(1),
  outcomes: z.array(outcomeSchema).min(1),
  muscles: z.array(nonEmptyText).default([]),
  muscleRegions: z.array(nonEmptyText).default([]),
  exercises: z.array(nonEmptyText).default([]),
  romSegments: z.array(z.enum(['full', 'lengthened_partial', 'shortened_partial', 'middle_partial'])).default([]),
  measurementMethods: z.array(nonEmptyText).default([]),
  applicabilityNotes: z.array(nonEmptyText).default([]),
  effect: nonEmptyText,
  certainty: certaintySchema,
  certaintyRationale: nonEmptyText,
  limitations: z.array(nonEmptyText).min(1),
  unknowns: z.array(nonEmptyText).default([]),
  evidence: evidenceLinksSchema,
  searchCutoff: dateOnly,
  reviewDueAt: dateOnly,
  createdBy: nonEmptyText,
  reviewedBy: nonEmptyText.optional(),
  reviewedAt: isoDate.optional(),
}).superRefine((claim, ctx) => {
  const workIds = [
    ...claim.evidence.supports,
    ...claim.evidence.contradicts,
    ...claim.evidence.contextualizes,
  ]
  if (new Set(workIds).size !== workIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'Evidence work IDs must not repeat' })
  }
  if (claim.status === 'approved' && (!claim.reviewedBy || !claim.reviewedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Approved claim requires reviewer and review date' })
  }
})

export const evidenceRecommendationSchema = z.object({
  id: z.string().regex(/^ER-[A-Z0-9-]+-v\d+$/),
  claimVersionId: z.string().regex(/^ECV-[A-Z0-9-]+-v\d+$/),
  supportingClaimVersionIds: z.array(z.string().regex(/^ECV-[A-Z0-9-]+-v\d+$/)).default([]),
  status: evidenceStatusSchema,
  surfaces: z.array(z.enum(['ai_trainer', 'program_generation', 'blog'])).min(1),
  audience: nonEmptyText,
  guidance: nonEmptyText,
  implementationHeuristic: nonEmptyText,
  strength: z.enum(['strong', 'conditional', 'insufficient']),
  exceptions: z.array(nonEmptyText).default([]),
  safetyNotes: z.array(nonEmptyText).default([]),
  allowedWording: z.array(nonEmptyText).min(1),
  forbiddenWording: z.array(nonEmptyText).min(1),
  reviewDueAt: dateOnly,
  reviewedBy: nonEmptyText.optional(),
  reviewedAt: isoDate.optional(),
}).superRefine((recommendation, ctx) => {
  if (recommendation.supportingClaimVersionIds.includes(recommendation.claimVersionId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supportingClaimVersionIds'],
      message: 'Primary claim must not be repeated as supporting claim',
    })
  }
  if (recommendation.status === 'approved' && (!recommendation.reviewedBy || !recommendation.reviewedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Approved recommendation requires reviewer and review date' })
  }
})

export const aiAnswerTestSchema = z.object({
  id: z.string().regex(/^AIT-[A-Z0-9-]+$/),
  question: nonEmptyText,
  userContext: nonEmptyText.optional(),
  expectedAnswerability: z.enum(['supported', 'uncertain', 'out_of_scope']),
  requiredClaims: z.array(z.string().regex(/^ECV-[A-Z0-9-]+-v\d+$/)),
  mustInclude: z.array(nonEmptyText),
  mustNotInclude: z.array(nonEmptyText),
  exampleAnswer: nonEmptyText.optional(),
})

export const blogOutlineSchema = z.object({
  id: z.string().regex(/^BO-[A-Z0-9-]+$/),
  primaryQuestionId: z.string().regex(/^EQ-[A-Z]+-\d{3}$/),
  workingTitle: nonEmptyText,
  searchIntent: nonEmptyText,
  reader: nonEmptyText,
  primaryClaimVersions: z.array(z.string().regex(/^ECV-[A-Z0-9-]+-v\d+$/)).min(1),
  sections: z.array(z.object({ heading: nonEmptyText, purpose: nonEmptyText })).min(1),
  originalValue: z.array(nonEmptyText).min(1),
  mandatoryLimitations: z.array(nonEmptyText).min(1),
  cta: nonEmptyText,
  reviewerRequired: z.literal(true),
})

function addDuplicateIssues(items, path, ctx) {
  const seen = new Set()
  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path, index, 'id'], message: `Duplicate ID: ${item.id}` })
    }
    seen.add(item.id)
  }
}

export const evidenceDatasetSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: isoDate,
  questions: z.array(evidenceQuestionSchema),
  works: z.array(researchWorkSchema),
  assessments: z.array(researchAssessmentSchema),
  claims: z.array(evidenceClaimVersionSchema),
  recommendations: z.array(evidenceRecommendationSchema),
  aiTests: z.array(aiAnswerTestSchema).default([]),
  blogOutlines: z.array(blogOutlineSchema).default([]),
}).superRefine((dataset, ctx) => {
  for (const key of ['questions', 'works', 'assessments', 'claims', 'recommendations', 'aiTests', 'blogOutlines']) {
    addDuplicateIssues(dataset[key], key, ctx)
  }

  const questionIds = new Set(dataset.questions.map(({ id }) => id))
  const worksById = new Map(dataset.works.map((work) => [work.id, work]))
  const claimsById = new Map(dataset.claims.map((claim) => [claim.id, claim]))

  dataset.assessments.forEach((assessment, index) => {
    if (!questionIds.has(assessment.questionId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assessments', index, 'questionId'], message: 'Unknown question' })
    }
    if (!worksById.has(assessment.workId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assessments', index, 'workId'], message: 'Unknown research work' })
    }
  })

  dataset.claims.forEach((claim, index) => {
    if (!questionIds.has(claim.questionId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claims', index, 'questionId'], message: 'Unknown question' })
    }
    const workIds = [...claim.evidence.supports, ...claim.evidence.contradicts, ...claim.evidence.contextualizes]
    for (const workId of workIds) {
      if (!worksById.has(workId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claims', index, 'evidence'], message: `Unknown research work: ${workId}` })
      }
    }
  })

  dataset.recommendations.forEach((recommendation, index) => {
    const linkedIds = [recommendation.claimVersionId, ...recommendation.supportingClaimVersionIds]
    for (const claimId of linkedIds) {
      if (!claimsById.has(claimId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recommendations', index], message: `Unknown claim: ${claimId}` })
      }
    }
  })

  dataset.aiTests.forEach((test, index) => {
    for (const claimId of test.requiredClaims) {
      if (!claimsById.has(claimId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aiTests', index, 'requiredClaims'], message: `Unknown claim: ${claimId}` })
      }
    }
  })
})

export const evidenceQuerySchema = z.object({
  questionId: z.string().regex(/^EQ-[A-Z]+-\d{3}$/),
  outcome: outcomeSchema.optional(),
  trainingStatus: trainingStatusSchema.optional(),
  bodyScope: bodyScopeSchema.optional(),
})
