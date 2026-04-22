import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  AdminStatsService,
  STATS_RANGE_DAYS,
  type StatsRangeDays,
} from '../services/AdminStatsService';

const querySchema = z.object({
  // Restrict to the three canonical buckets — keeps cache & UI predictable
  // and prevents adversaries from asking for absurd ranges.
  days: z.coerce
    .number()
    .int()
    .refine((n): n is StatsRangeDays => (STATS_RANGE_DAYS as readonly number[]).includes(n), {
      message: 'days must be one of 7, 30, 90',
    })
    .optional()
    .default(30),
});

export const getStats = asyncHandler(async (req, res) => {
  const opts = querySchema.parse(req.query);
  const data = await AdminStatsService.load({ days: opts.days });
  res.json({ success: true, data });
});
