import { Router } from 'express';
import * as CommentController from '../controllers/CommentController';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import { createCommentSchema } from '../schemas/comment';

const router = Router();

router.post('/', requireAuth, writeLimiter, validate(createCommentSchema), CommentController.create);
router.delete('/:id', requireAuth, CommentController.remove);

export default router;
