import { z } from 'zod';
import { NotificationService } from '../services/NotificationService';
import { NotificationStream } from '../services/NotificationStream';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';

const listSchema = z.object({
  unread: z.union([z.literal('true'), z.literal('false')]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

const markReadSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.number().int().positive()).min(1) }),
]);

export const list = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const opts = listSchema.parse(req.query);
  const result = await NotificationService.list({
    userId: req.userId,
    unreadOnly: opts.unread === 'true',
    page: opts.page,
    limit: opts.limit,
  });
  res.json({
    success: true,
    data: result.rows,
    meta: {
      total: result.total,
      page: opts.page,
      limit: opts.limit,
      unread: result.unread,
    },
  });
});

export const stream = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const userId = req.userId;
  const unsubscribe = NotificationStream.subscribe(userId, res);
  // Express ends the request when the client closes the connection — wire the
  // teardown both ways so we drop the subscriber and clear the heartbeat.
  req.on('close', unsubscribe);
});

export const markRead = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const body = markReadSchema.parse(req.body);
  const ids = 'all' in body ? 'all' : body.ids;
  const affected = await NotificationService.markRead(req.userId, ids);
  res.json({ success: true, data: { affected } });
});
