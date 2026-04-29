import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { list, search, getById, batchLastResults } from '../controllers/exerciseController.js'

const router = Router()

router.use(telegramAuth)

router.get('/', list)
router.get('/search', search)
router.get('/:id', getById)
router.post('/batch-last-results', batchLastResults)

export default router
