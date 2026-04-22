import { Op, type WhereOptions } from 'sequelize';
import { sequelize, Report, Question, Answer } from '../models';
import { VOTE_TARGET_TYPE, type VoteTargetType } from '../models/Vote';
import { QuestionService, type Actor } from './QuestionService';
import { AnswerService } from './AnswerService';
import {
  REPORT_STATUSES,
  ROLES,
  type ReportReason,
  type ReportStatus,
} from '../utils/constants';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';

export interface CreateReportInput {
  reporterId: number;
  targetType: VoteTargetType;
  targetId: number;
  reason: ReportReason;
  details?: string;
}

export interface ListReportsInput {
  status?: ReportStatus;
  page: number;
  limit: number;
}

export interface ListReportsResult {
  rows: Report[];
  total: number;
}

export type ReviewAction = 'keep' | 'remove';

export interface ReviewInput {
  reportId: number;
  reviewerId: number;
  action: ReviewAction;
}

async function targetExists(
  targetType: VoteTargetType,
  targetId: number
): Promise<boolean> {
  if (targetType === VOTE_TARGET_TYPE.QUESTION) {
    return (await Question.count({ where: { id: targetId } })) > 0;
  }
  return (await Answer.count({ where: { id: targetId } })) > 0;
}

export class ReportService {
  static async create(input: CreateReportInput): Promise<Report> {
    if (!(await targetExists(input.targetType, input.targetId))) {
      throw new NotFoundError(`${input.targetType} not found`, 'targetNotFound', {
        targetType: input.targetType,
      });
    }

    // Self-report doesn't make sense — block early so the UI surfaces a clear
    // 400 instead of a noisy unique-constraint failure.
    const ownerCheck =
      input.targetType === VOTE_TARGET_TYPE.QUESTION
        ? await Question.findByPk(input.targetId, { attributes: ['authorId'] })
        : await Answer.findByPk(input.targetId, { attributes: ['authorId'] });
    if (ownerCheck && ownerCheck.authorId === input.reporterId) {
      throw new BadRequestError('不能举报自己的内容', 'cannotReportOwn');
    }

    // Reuse a prior PENDING report from the same reporter rather than 409;
    // if the previous one was already reviewed, we allow a fresh report.
    const existing = await Report.findOne({
      where: {
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    });

    if (existing) {
      if (existing.status === REPORT_STATUSES.PENDING) {
        throw new ConflictError('你已经举报过这条内容，正在等待处理', 'alreadyReported');
      }
      // Refresh the row in place so the unique index isn't violated.
      existing.reason = input.reason;
      existing.details = input.details ?? null;
      existing.status = REPORT_STATUSES.PENDING;
      existing.reviewerId = null;
      existing.reviewedAt = null;
      await existing.save();
      return existing;
    }

    return Report.create({
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details ?? null,
    });
  }

  static async list(input: ListReportsInput): Promise<ListReportsResult> {
    const where: WhereOptions = {};
    if (input.status) where.status = input.status;
    const { rows, count } = await Report.findAndCountAll({
      where,
      order: [
        // Pending first (oldest first within), then everything else by recency.
        ['status', 'ASC'],
        ['createdAt', 'ASC'],
      ],
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    });
    return { rows, total: count };
  }

  static async review(input: ReviewInput): Promise<Report> {
    const report = await Report.findByPk(input.reportId);
    if (!report) throw new NotFoundError('Report not found', 'reportNotFound');
    if (report.status !== REPORT_STATUSES.PENDING) {
      throw new ConflictError('该举报已处理', 'reportAlreadyHandled');
    }

    const reviewer: Actor = { id: input.reviewerId, role: ROLES.ADMIN };
    let nextStatus: ReportStatus;

    if (input.action === 'remove') {
      // Cascade-delete the offending content as the admin. If it's already gone
      // (race with author delete), fall through and just close out the report.
      try {
        if (report.targetType === VOTE_TARGET_TYPE.QUESTION) {
          await QuestionService.delete(report.targetId, reviewer);
        } else {
          await AnswerService.delete(report.targetId, reviewer);
        }
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
      }
      nextStatus = REPORT_STATUSES.REVIEWED_REMOVED;
    } else {
      nextStatus = REPORT_STATUSES.REVIEWED_KEPT;
    }

    return sequelize.transaction(async (t) => {
      report.status = nextStatus;
      report.reviewerId = input.reviewerId;
      report.reviewedAt = new Date();
      await report.save({ transaction: t });

      // When removing the target, fan-out to every other PENDING report on the
      // same target so they don't sit in the queue forever.
      if (input.action === 'remove') {
        await Report.update(
          {
            status: REPORT_STATUSES.REVIEWED_REMOVED,
            reviewerId: input.reviewerId,
            reviewedAt: new Date(),
          },
          {
            where: {
              targetType: report.targetType,
              targetId: report.targetId,
              status: REPORT_STATUSES.PENDING,
              id: { [Op.ne]: report.id },
            },
            transaction: t,
          }
        );
      }
      return report;
    });
  }
}
