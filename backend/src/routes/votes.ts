import { Router } from 'express';
import * as VoteController from '../controllers/VoteController';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { voteLimiter } from '../middleware/rateLimit';
import { toggleVoteSchema } from '../schemas/vote';

const router = Router();

router.post(
  '/',
  requireAuth,
  voteLimiter,
  validate(toggleVoteSchema),
  VoteController.toggle
);

export default router;
