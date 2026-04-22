import { AnswerService } from '../services/AnswerService';
import { ROLES } from '../utils/constants';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { updateAnswerSchema } from '../schemas/answer';

export const create = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const questionId = Number(req.params.questionId);
  const answer = await AnswerService.create({
    authorId: req.userId,
    questionId,
    content: req.body.content,
  });
  res.status(201).json({ success: true, data: answer });
});

export const accept = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  const answer = await AnswerService.accept(id, req.userId);
  res.json({ success: true, data: answer });
});

export const unaccept = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  const answer = await AnswerService.unaccept(id, req.userId);
  res.json({ success: true, data: answer });
});

export const update = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  const body = updateAnswerSchema.parse(req.body);
  const answer = await AnswerService.update(id, req.userId, body);
  res.json({ success: true, data: answer });
});

export const remove = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  await AnswerService.delete(id, { id: req.userId, role: req.userRole ?? ROLES.USER });
  res.json({ success: true, data: { id } });
});
