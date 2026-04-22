import { Router } from 'express';
import * as QuestionController from '../controllers/QuestionController';
import * as AnswerController from '../controllers/AnswerController';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import { cacheable } from '../middleware/cacheable';
import { createQuestionSchema } from '../schemas/question';
import { createAnswerSchema } from '../schemas/answer';

const router = Router();

router.get('/', optionalAuth, cacheable, QuestionController.list);
router.post('/', requireAuth, writeLimiter, validate(createQuestionSchema), QuestionController.create);
router.get('/:id', optionalAuth, QuestionController.getById);
router.patch('/:id', requireAuth, writeLimiter, QuestionController.update);
router.delete('/:id', requireAuth, QuestionController.remove);
router.post(
  '/:questionId/answers',
  requireAuth,
  writeLimiter,
  validate(createAnswerSchema),
  AnswerController.create
);

export default router;
