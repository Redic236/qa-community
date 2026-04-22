import { Router } from 'express';
import * as AdminStatsController from '../controllers/AdminStatsController';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/stats', requireAuth, requireAdmin, AdminStatsController.getStats);

export default router;
