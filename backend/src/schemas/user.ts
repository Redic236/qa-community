import { z } from 'zod';

export const pointHistorySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type PointHistoryQuery = z.infer<typeof pointHistorySchema>;
