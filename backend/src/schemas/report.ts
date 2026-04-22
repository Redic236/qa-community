import { z } from 'zod';
import { VOTE_TARGET_TYPE } from '../models/Vote';
import { REPORT_REASON_VALUES, REPORT_STATUS_VALUES } from '../utils/constants';

export const createReportSchema = z.object({
  targetType: z.enum([VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER]),
  targetId: z.number().int().positive(),
  reason: z.enum(REPORT_REASON_VALUES as [string, ...string[]]),
  details: z.string().max(500).optional(),
});

export const listReportsSchema = z.object({
  status: z.enum(REPORT_STATUS_VALUES as [string, ...string[]]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const reviewReportSchema = z.object({
  action: z.enum(['keep', 'remove']),
});

export type CreateReportBody = z.infer<typeof createReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsSchema>;
export type ReviewReportBody = z.infer<typeof reviewReportSchema>;
