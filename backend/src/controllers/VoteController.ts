import { VoteService } from '../services/VoteService';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';

export const toggle = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const result = await VoteService.toggle({
    userId: req.userId,
    targetType: req.body.targetType,
    targetId: req.body.targetId,
  });
  res.json({ success: true, data: result });
});
