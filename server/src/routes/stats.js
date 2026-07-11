import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { getMonth, getYear } from '../controllers/statsController.js'

const router = Router()

router.use(auth)

router.get('/month', getMonth)
router.get('/year', getYear)

export default router
