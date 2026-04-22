import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  LeaderboardService,
  LEADERBOARD_RANGES,
  type LeaderboardRange,
} from '../services/LeaderboardService';

const querySchema = z.object({
  scope: z.enum(['users', 'questions']).optional().default('users'),
  range: z
    .enum(LEADERBOARD_RANGES as unknown as [LeaderboardRange, ...LeaderboardRange[]])
    .optional()
    .default('all'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const get = asyncHandler(async (req, res) => {
  const opts = querySchema.parse(req.query);
  if (opts.scope === 'users') {
    const items = await LeaderboardService.topUsers(opts.limit);
    res.json({ success: true, data: items, meta: { scope: 'users', range: opts.range } });
    return;
  }
  const items = await LeaderboardService.topQuestions(opts.range, opts.limit);
  res.json({ success: true, data: items, meta: { scope: 'questions', range: opts.range } });
});
