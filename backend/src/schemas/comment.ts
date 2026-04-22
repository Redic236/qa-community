import { z } from 'zod';
import { VOTE_TARGET_TYPE } from '../models/Vote';

export const createCommentSchema = z.object({
  targetType: z.enum([VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER]),
  targetId: z.number().int().positive(),
  content: z.string().min(2, '至少 2 个字符').max(500, '最长 500 字符'),
});

export type CreateCommentBody = z.infer<typeof createCommentSchema>;
