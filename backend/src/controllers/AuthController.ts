import { AuthService } from '../services/AuthService';
import { User } from '../models';
import { NotFoundError, UnauthorizedError } from '../utils/errors';
import { toUserDto } from '../services/AuthService';
import { asyncHandler } from '../middleware/asyncHandler';

export const register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body);
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req, res) => {
  const result = await AuthService.login(req.body);
  res.json({ success: true, data: result });
});

export const me = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const user = await User.findByPk(req.userId);
  if (!user) throw new NotFoundError('User not found', 'userNotFound');
  res.json({ success: true, data: toUserDto(user) });
});

export const updateMe = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const user = await AuthService.updateProfile(req.userId, req.body);
  res.json({ success: true, data: user });
});
