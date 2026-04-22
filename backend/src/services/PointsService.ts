import { Op, type Transaction } from 'sequelize';
import { sequelize, PointRecord, User } from '../models';
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
    // Core work: lock the user row first, then cap-check, then write. The row
    // lock (SELECT ... FOR UPDATE under MySQL) serialises concurrent awards
    // to the same user so two racing "like" events can't both read sum=195
    // and each write +5 → 205, bypassing a cap=200. SQLite ignores the lock
    // hint — fine for tests which run sequentially anyway.
    const run = async (t: Transaction): Promise<PointRecord | null> => {
      const { userId, type, points, relatedId } = params;

      await User.findByPk(userId, { lock: t.LOCK.UPDATE, transaction: t });

      const cap = getDailyPassiveCap();
      if (cap > 0 && points > 0 && PASSIVE_POINT_TYPES.includes(type)) {
        const earnedToday = await this.sumDailyPassiveEarnings(userId, t);
        if (earnedToday + points > cap) {
          // Capped — silently skip. Vote / acceptance still succeeds upstream
          // (target.votes / isAccepted are updated by callers in the same tx).
          return null;
        }
      }

      const record = await PointRecord.create(
        { userId, type, points, relatedId: relatedId ?? null },
        { transaction: t }
      );

      await User.increment({ points }, { where: { id: userId }, transaction: t });

      return record;
    };

    // Either nest in the caller's transaction (so the lock participates in
    // their commit) or open our own. Either way `run()` sees a real tx.
    return params.transaction ? run(params.transaction) : sequelize.transaction(run);
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
