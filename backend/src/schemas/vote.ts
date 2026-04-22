import { z } from 'zod';
import { VOTE_TARGET_TYPE } from '../models/Vote';

export const toggleVoteSchema = z.object({
  targetType: z.enum([VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER]),
  targetId: z.number().int().positive(),
});

export type ToggleVoteBody = z.infer<typeof toggleVoteSchema>;
