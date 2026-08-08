import { z } from 'zod'
import { evidenceQuerySchema, evidenceStatusSchema } from '../services/evidence/schemas.js'
import { evidenceReviewService } from '../services/evidence/reviewService.js'

const idSchema = z.string().min(3).max(160)
const commentSchema = z.object({ comment: z.string().trim().min(3).max(2000) })
const listClaimsSchema = z.object({
  status: evidenceStatusSchema.optional(),
  questionId: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
})
const assessmentPatchSchema = z.object({
  reviewScope: z.enum(['abstract_only', 'preprint_full_text', 'full_text', 'full_text_and_supplements']).optional(),
  population: z.string().trim().min(1).optional(),
  outcomes: z.array(z.string().min(1)).min(1).optional(),
  mainResults: z.array(z.string().trim().min(1)).min(1).optional(),
  directness: z.enum(['high', 'some_concerns', 'low']).optional(),
  riskOfBias: z.enum(['low', 'some_concerns', 'high', 'not_assessed']).optional(),
  limitations: z.array(z.string().trim().min(1)).optional(),
  cannotSupport: z.array(z.string().trim().min(1)).optional(),
  comment: z.string().trim().min(3).max(2000),
}).refine((value) => Object.keys(value).some((key) => key !== 'comment'), {
  message: 'At least one assessment field must change',
})
const workStatusSchema = z.object({
  correctionStatus: z.enum(['current', 'corrected', 'retracted']),
  comment: z.string().trim().min(3).max(2000),
})

export function createEvidenceAdminController(service = evidenceReviewService) {
  const actor = (req) => ({ actorId: req.user.id })
  const transitionInput = (req) => ({ ...actor(req), ...commentSchema.parse(req.body) })

  return {
    access: async (req, res) => {
      res.json({ role: req.evidenceRole, userId: req.user.id })
    },

    listQuestions: async (req, res, next) => {
      try {
        res.json({ questions: await service.listQuestions() })
      } catch (error) { next(error) }
    },

    getQuestion: async (req, res, next) => {
      try {
        res.json({ question: await service.getQuestion(idSchema.parse(req.params.id)) })
      } catch (error) { next(error) }
    },

    listClaims: async (req, res, next) => {
      try {
        const query = listClaimsSchema.parse(req.query)
        res.json({ claims: await service.listClaimVersions(query) })
      } catch (error) { next(error) }
    },

    getClaimVersion: async (req, res, next) => {
      try {
        res.json({ claim: await service.getClaimVersion(idSchema.parse(req.params.id)) })
      } catch (error) { next(error) }
    },

    patchAssessment: async (req, res, next) => {
      try {
        const { comment, ...patch } = assessmentPatchSchema.parse(req.body)
        const assessment = await service.updateAssessment(idSchema.parse(req.params.id), patch, {
          ...actor(req), comment,
        })
        res.json({ assessment })
      } catch (error) { next(error) }
    },

    submitAssessment: async (req, res, next) => {
      try {
        const assessment = await service.submitAssessment(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ assessment })
      } catch (error) { next(error) }
    },

    approveAssessment: async (req, res, next) => {
      try {
        const assessment = await service.approveAssessment(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ assessment })
      } catch (error) { next(error) }
    },

    submitClaimVersion: async (req, res, next) => {
      try {
        const claim = await service.submitClaimVersion(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ claim })
      } catch (error) { next(error) }
    },

    approveClaimVersion: async (req, res, next) => {
      try {
        const claim = await service.approveClaimVersion(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ claim })
      } catch (error) { next(error) }
    },

    disputeClaimVersion: async (req, res, next) => {
      try {
        const claim = await service.disputeClaimVersion(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ claim })
      } catch (error) { next(error) }
    },

    submitRecommendation: async (req, res, next) => {
      try {
        const recommendation = await service.submitRecommendation(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ recommendation })
      } catch (error) { next(error) }
    },

    approveRecommendation: async (req, res, next) => {
      try {
        const recommendation = await service.approveRecommendation(
          idSchema.parse(req.params.id), transitionInput(req),
        )
        res.json({ recommendation })
      } catch (error) { next(error) }
    },

    reviewWorkStatus: async (req, res, next) => {
      try {
        const { correctionStatus, comment } = workStatusSchema.parse(req.body)
        const result = await service.reviewWorkStatus(idSchema.parse(req.params.id), correctionStatus, {
          ...actor(req), comment,
        })
        res.json(result)
      } catch (error) { next(error) }
    },

    runtimeCheck: async (req, res, next) => {
      try {
        const query = evidenceQuerySchema.parse({ questionId: req.params.questionId, ...req.query })
        const { questionId, ...filters } = query
        res.json({ guidance: await service.runtimeCheck(questionId, filters) })
      } catch (error) { next(error) }
    },
  }
}

export const evidenceAdminController = createEvidenceAdminController()
