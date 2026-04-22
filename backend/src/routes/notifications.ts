import { Router } from 'express';
import * as NotificationController from '../controllers/NotificationController';
import { requireAuth } from '../middleware/auth';
import { cacheable } from '../middleware/cacheable';

const router = Router();

router.get('/', requireAuth, cacheable, NotificationController.list);
// Ticket exchange — Bearer-authenticated; returns a short-lived one-shot
// string to use on the SSE connection.
router.post('/stream/ticket', requireAuth, NotificationController.issueStreamTicket);
// Stream itself auths via ?ticket=, NOT via Authorization header. Do not
// attach requireAuth here — EventSource can't send headers, and the ticket
// mechanism is the intended auth path.
router.get('/stream', NotificationController.stream);
router.post('/mark-read', requireAuth, NotificationController.markRead);

export default router;
