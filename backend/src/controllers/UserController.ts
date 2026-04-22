import { PointsService } from '../services/PointsService';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { pointHistorySchema } from '../schemas/user';

export const getMyPointHistory = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const opts = pointHistorySchema.parse(req.query);
  const { rows, total } = await PointsService.listHistory({
    userId: req.userId,
    page: opts.page,
    limit: opts.limit,
  });
  res.json({
    success: true,
    data: rows,
    meta: { total, page: opts.page, limit: opts.limit },
  });
});
