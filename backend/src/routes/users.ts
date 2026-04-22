import { Router } from 'express';
import * as UserController from '../controllers/UserController';
import { requireAuth } from '../middleware/auth';
import { cacheable } from '../middleware/cacheable';

const router = Router();

router.get('/me/points', requireAuth, cacheable, UserController.getMyPointHistory);

export default router;
