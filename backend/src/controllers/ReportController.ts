import { ReportService } from '../services/ReportService';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listReportsSchema,
  reviewReportSchema,
  type ListReportsQuery,
  type ReviewReportBody,
} from '../schemas/report';
import type { ReportReason, ReportStatus } from '../utils/constants';
import type { VoteTargetType } from '../models/Vote';

interface CreateReportBody {
  targetType: VoteTargetType;
  targetId: number;
  reason: ReportReason;
  details?: string;
}

export const create = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const body = req.body as CreateReportBody;
  const report = await ReportService.create({
    reporterId: req.userId,
    targetType: body.targetType,
    targetId: body.targetId,
    reason: body.reason,
    details: body.details,
  });
  res.status(201).json({ success: true, data: report });
});

export const list = asyncHandler(async (req, res) => {
  const opts = listReportsSchema.parse(req.query) as ListReportsQuery;
  const { rows, total } = await ReportService.list({
    status: opts.status as ReportStatus | undefined,
    page: opts.page,
    limit: opts.limit,
  });
  res.json({
    success: true,
    data: rows,
    meta: { total, page: opts.page, limit: opts.limit },
  });
});

export const review = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  const body = reviewReportSchema.parse(req.body) as ReviewReportBody;
  const report = await ReportService.review({
    reportId: id,
    reviewerId: req.userId,
    action: body.action,
  });
  res.json({ success: true, data: report });
});
