import { z } from 'zod';
import { VOTE_TARGET_TYPE } from '../models/Vote';

export const createCommentSchema = z.object({
  targetType: z.enum([VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER]),
  targetId: z.number().int().positive(),
  content: z.string().min(2, '至少 2 个字符').max(500, '最长 500 字符'),
  // Optional reply: the comment being replied to. Must belong to the same
  // (targetType, targetId) AND itself be a root (parentId = null) — enforced
  // in the service so we can return proper 400 translations.
  parentId: z.number().int().positive().optional(),
});

export type CreateCommentBody = z.infer<typeof createCommentSchema>;
