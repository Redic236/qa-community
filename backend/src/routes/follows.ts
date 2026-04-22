import { Router } from 'express';
import * as FollowController from '../controllers/FollowController';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import { cacheable } from '../middleware/cacheable';
import { toggleFollowSchema } from '../schemas/follow';

const router = Router();

router.post('/', requireAuth, writeLimiter, validate(toggleFollowSchema), FollowController.toggle);
router.get('/me', requireAuth, cacheable, FollowController.listMine);

export default router;
