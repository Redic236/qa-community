import { Router } from 'express';
import * as ReportController from '../controllers/ReportController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import { cacheable } from '../middleware/cacheable';
import { createReportSchema } from '../schemas/report';

const router = Router();

// User: submit a report.
router.post('/', requireAuth, writeLimiter, validate(createReportSchema), ReportController.create);

// Admin: list + review.
router.get('/', requireAuth, requireAdmin, cacheable, ReportController.list);
router.post('/:id/review', requireAuth, requireAdmin, ReportController.review);

export default router;
