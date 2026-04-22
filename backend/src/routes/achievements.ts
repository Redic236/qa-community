import { Router } from 'express';
import * as AchievementController from '../controllers/AchievementController';
import { requireAuth } from '../middleware/auth';
import { cacheable } from '../middleware/cacheable';

const router = Router();

router.get('/me', requireAuth, cacheable, AchievementController.listMine);

export default router;
