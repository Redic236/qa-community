import { Op, type Transaction } from 'sequelize';
import { PointRecord, User } from '../models';
import {
  POINT_TYPES,
  POINTS_RULES,
  PASSIVE_POINT_TYPES,
  getDailyPassiveCap,
  type PointType,
} from '../utils/constants';

export interface AwardParams {
  userId: number;
  type: PointType;
  points: number;
  relatedId?: number;
  transaction?: Transaction;
}

export interface ListHistoryInput {
  userId: number;
  page: number;
  limit: number;
}

export interface ListHistoryResult {
  rows: PointRecord[];
  total: number;
}

export class PointsService {
  static async listHistory(input: ListHistoryInput): Promise<ListHistoryResult> {
    const { rows, count } = await PointRecord.findAndCountAll({
      where: { userId: input.userId },
      order: [['createdAt', 'DESC']],
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    });
    return { rows, total: count };
  }

  /**
   * Sum positive passive earnings (likes / acceptances) for `userId` since the
   * start of the current UTC day. Used to enforce the daily cap.
   */
  static async sumDailyPassiveEarnings(
    userId: number,
    transaction?: Transaction
  ): Promise<number> {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const sum = await PointRecord.sum('points', {
      where: {
        userId,
        type: { [Op.in]: PASSIVE_POINT_TYPES },
        points: { [Op.gt]: 0 },
        createdAt: { [Op.gte]: dayStart },
      },
      transaction,
    });
    return sum ?? 0;
  }

  /**
   * Write a point record + bump user.points. Returns the record, or null if
   * a positive passive award was suppressed because the daily cap was hit.
   *
   * Cap rules:
   *   - Cap applies only to positive deltas of PASSIVE_POINT_TYPES.
   *   - Negative deltas (e.g. unlike reversal) always go through.
   *   - Active types (ask, answer) always go through.
   *   - Cap=0 disables enforcement.
   *   - All-or-nothing: if the full amount would exceed cap, the whole award
   *     is skipped (no partial). Keeps point_record.points equal to the
   *     event's natural value, never a clipped one.
   */
  static async award(params: AwardParams): Promise<PointRecord | null> {
    const { userId, type, points, relatedId, transaction } = params;

    const cap = getDailyPassiveCap();
    if (cap > 0 && points > 0 && PASSIVE_POINT_TYPES.includes(type)) {
      const earnedToday = await this.sumDailyPassiveEarnings(userId, transaction);
      if (earnedToday + points > cap) {
        // Capped — silently skip. Vote / acceptance still succeeds upstream
        // (target.votes / isAccepted are updated by callers in the same tx).
        return null;
      }
    }

    const record = await PointRecord.create(
      { userId, type, points, relatedId: relatedId ?? null },
      { transaction }
    );

    await User.increment(
      { points },
      { where: { id: userId }, transaction }
    );

    return record;
  }

  static forAskQuestion(
    userId: number,
    questionId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.ASK,
      points: POINTS_RULES.ASK_QUESTION,
      relatedId: questionId,
      transaction,
    });
  }

  static forAnswer(
    userId: number,
    answerId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.ANSWER,
      points: POINTS_RULES.ANSWER_QUESTION,
      relatedId: answerId,
      transaction,
    });
  }

  static forAccepted(
    userId: number,
    answerId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.ACCEPT,
      points: POINTS_RULES.ANSWER_ACCEPTED,
      relatedId: answerId,
      transaction,
    });
  }

  static forQuestionLiked(
    userId: number,
    questionId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.LIKE_QUESTION,
      points: POINTS_RULES.QUESTION_LIKED,
      relatedId: questionId,
      transaction,
    });
  }

  static forQuestionUnliked(
    userId: number,
    questionId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.LIKE_QUESTION,
      points: -POINTS_RULES.QUESTION_LIKED,
      relatedId: questionId,
      transaction,
    });
  }

  static forAnswerLiked(
    userId: number,
    answerId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.LIKE_ANSWER,
      points: POINTS_RULES.ANSWER_LIKED,
      relatedId: answerId,
      transaction,
    });
  }

  static forAnswerUnliked(
    userId: number,
    answerId: number,
    transaction?: Transaction
  ): Promise<PointRecord | null> {
    return this.award({
      userId,
      type: POINT_TYPES.LIKE_ANSWER,
      points: -POINTS_RULES.ANSWER_LIKED,
      relatedId: answerId,
      transaction,
    });
  }
}
