import { z } from 'zod';
import { FOLLOW_TARGET_TYPE } from '../models/Follow';

export const toggleFollowSchema = z.object({
  targetType: z.enum([FOLLOW_TARGET_TYPE.USER, FOLLOW_TARGET_TYPE.QUESTION]),
  targetId: z.number().int().positive(),
});

export type ToggleFollowBody = z.infer<typeof toggleFollowSchema>;
