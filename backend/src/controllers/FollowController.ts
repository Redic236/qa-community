import { Op } from 'sequelize';
import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError } from '../utils/errors';
import { FollowService } from '../services/FollowService';
import { FOLLOW_TARGET_TYPE } from '../models/Follow';
import { Question, User } from '../models';
import { z } from 'zod';

const listSchema = z.object({
  targetType: z.enum([FOLLOW_TARGET_TYPE.USER, FOLLOW_TARGET_TYPE.QUESTION]),
});

export const toggle = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const { targetType, targetId } = req.body;
  const result = await FollowService.toggle({
    followerId: req.userId,
    targetType,
    targetId,
  });
  res.json({ success: true, data: result });
});

/**
 * Expand the raw follow rows into something the UI can actually render:
 * - user follows  → {id, username, avatar, points}
 * - question follows → minimal question rows
 *
 * Keeps the frontend from having to N+1 back out to /users/:id.
 */
export const listMine = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const { targetType } = listSchema.parse(req.query);

  const ids = await FollowService.followedTargetIds(req.userId, targetType);
  if (ids.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  if (targetType === FOLLOW_TARGET_TYPE.USER) {
    const users = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'username', 'avatar', 'points'],
    });
    res.json({ success: true, data: users });
    return;
  }

  const questions = await Question.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: [
      'id',
      'title',
      'tags',
      'votes',
      'answersCount',
      'isSolved',
      'authorId',
      'createdAt',
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: questions });
});
