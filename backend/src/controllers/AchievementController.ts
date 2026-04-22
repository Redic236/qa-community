import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError } from '../utils/errors';
import { AchievementService } from '../services/AchievementService';

export const listMine = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const items = await AchievementService.listFor(req.userId);
  res.json({ success: true, data: items });
});
