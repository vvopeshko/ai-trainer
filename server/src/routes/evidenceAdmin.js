import { Router } from 'express'
import { evidenceAdminController as controller } from '../controllers/evidenceAdminController.js'
import { requireEvidenceRole } from '../middleware/evidenceAdmin.js'

const router = Router()
const approver = requireEvidenceRole('approver')

router.get('/access', controller.access)
router.get('/questions', controller.listQuestions)
router.get('/questions/:id', controller.getQuestion)
router.get('/claims', controller.listClaims)
router.get('/claim-versions/:id', controller.getClaimVersion)
router.get('/runtime-check/:questionId', controller.runtimeCheck)

router.patch('/assessments/:id', controller.patchAssessment)
router.post('/assessments/:id/submit', controller.submitAssessment)
router.post('/assessments/:id/approve', approver, controller.approveAssessment)

router.post('/claim-versions/:id/submit', controller.submitClaimVersion)
router.post('/claim-versions/:id/approve', approver, controller.approveClaimVersion)
router.post('/claim-versions/:id/dispute', approver, controller.disputeClaimVersion)

router.post('/recommendations/:id/submit', controller.submitRecommendation)
router.post('/recommendations/:id/approve', approver, controller.approveRecommendation)

router.post('/works/:id/status', approver, controller.reviewWorkStatus)

export default router
