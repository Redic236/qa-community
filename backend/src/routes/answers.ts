import { Router } from 'express';
import * as AnswerController from '../controllers/AnswerController';
import { requireAuth } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/:id/accept', requireAuth, AnswerController.accept);
router.delete('/:id/accept', requireAuth, AnswerController.unaccept);
router.patch('/:id', requireAuth, writeLimiter, AnswerController.update);
router.delete('/:id', requireAuth, AnswerController.remove);

export default router;
