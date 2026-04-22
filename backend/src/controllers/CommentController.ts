import { CommentService } from '../services/CommentService';
import { ROLES } from '../utils/constants';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';

export const create = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const { targetType, targetId, content } = req.body;
  const comment = await CommentService.create({
    authorId: req.userId,
    targetType,
    targetId,
    content,
  });
  res.status(201).json({ success: true, data: comment });
});

export const remove = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  await CommentService.delete(id, { id: req.userId, role: req.userRole ?? ROLES.USER });
  res.json({ success: true, data: { id } });
});
