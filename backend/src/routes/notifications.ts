import { Router } from 'express';
import * as NotificationController from '../controllers/NotificationController';
import { requireAuth } from '../middleware/auth';
import { cacheable } from '../middleware/cacheable';

const router = Router();

router.get('/', requireAuth, cacheable, NotificationController.list);
router.get('/stream', requireAuth, NotificationController.stream);
router.post('/mark-read', requireAuth, NotificationController.markRead);

export default router;
