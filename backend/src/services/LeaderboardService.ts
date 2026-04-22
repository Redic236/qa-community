import { Op, type WhereOptions } from 'sequelize';
import { User, Question } from '../models';

export const LEADERBOARD_RANGES = ['7d', '30d', 'all'] as const;
export type LeaderboardRange = (typeof LEADERBOARD_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TopUser {
  id: number;
  username: string;
  avatar: string | null;
  points: number;
}

export interface TopQuestion {
  id: number;
  title: string;
  tags: string[];
  votes: number;
  answersCount: number;
  isSolved: boolean;
  authorId: number;
  createdAt: Date;
}

function sinceFor(range: LeaderboardRange): Date | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : 30;
  return new Date(Date.now() - days * DAY_MS);
}

export class LeaderboardService {
  /**
   * Top users by cumulative points. The `range` param is accepted for UI
   * symmetry but points are a lifetime total — there's no cheap way to
   * re-compute "points earned in the last N days" without scanning the
   * point_records table per user, which isn't worth the DB pressure for a
   * public page. Keep it all-time; offer range for questions only.
   */
  static async topUsers(limit: number): Promise<TopUser[]> {
    const rows = await User.findAll({
      attributes: ['id', 'username', 'avatar', 'points'],
      order: [
        ['points', 'DESC'],
        ['id', 'ASC'],
      ],
      limit,
      raw: true,
    });
    return rows as unknown as TopUser[];
  }

  /**
   * Top questions by votes, optionally scoped to a time window (by createdAt
   * — so "hot questions posted in the last 7 days", NOT "questions that got
   * votes in the last 7 days"; the latter would need a vote-timestamp index
   * that we don't have yet).
   */
  static async topQuestions(range: LeaderboardRange, limit: number): Promise<TopQuestion[]> {
    const where: WhereOptions = {};
    const since = sinceFor(range);
    if (since) where.createdAt = { [Op.gte]: since };

    const rows = await Question.findAll({
      where,
      attributes: [
        'id',
        'title',
        'tags',
        'votes',
        'answersCount',
        'isSolved',
        'authorId',
        'createdAt',
      ],
      order: [
        ['votes', 'DESC'],
        ['answersCount', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      raw: true,
    });
    // SQLite JSON column comes back as string when raw:true; normalize so
    // the wire shape is stable across engines.
    return rows.map((r) => {
      const tags = Array.isArray(r.tags)
        ? r.tags
        : typeof r.tags === 'string'
          ? safeParseTags(r.tags as unknown as string)
          : [];
      return { ...r, tags } as unknown as TopQuestion;
    });
  }
}

function safeParseTags(s: string): string[] {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
