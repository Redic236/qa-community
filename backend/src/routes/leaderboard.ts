import { Router } from 'express';
import * as LeaderboardController from '../controllers/LeaderboardController';
import { cacheable } from '../middleware/cacheable';

const router = Router();

// Public list — no auth required. cacheable middleware adds ETag + Vary so
// repeat hits from the same browser get 304'd.
router.get('/', cacheable, LeaderboardController.get);

export default router;
