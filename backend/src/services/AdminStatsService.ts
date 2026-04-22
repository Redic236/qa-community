import { Op } from 'sequelize';
import {
  User,
  Question,
  Answer,
  Comment,
  Report,
  PointRecord,
} from '../models';
import { REPORT_STATUSES } from '../utils/constants';

export interface DailyBucket {
  /** ISO date YYYY-MM-DD in server-local timezone. */
  date: string;
  questions: number;
  answers: number;
  comments: number;
  newUsers: number;
}

export interface TopUser {
  id: number;
  username: string;
  points: number;
}

export interface TopTag {
  tag: string;
  count: number;
}

export interface AdminStats {
  kpis: {
    users: number;
    questions: number;
    answers: number;
    comments: number;
    pendingReports: number;
    newUsers7d: number;
    newQuestions7d: number;
  };
  daily: DailyBucket[];
  topUsers: TopUser[];
  topTags: TopTag[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDay(d: Date): string {
  // Local-day bucket — admin lives in a single timezone, no need for UTC math.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyDays(days: number): DailyBucket[] {
  const out: DailyBucket[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    out.push({ date: toIsoDay(d), questions: 0, answers: 0, comments: 0, newUsers: 0 });
  }
  return out;
}

type DateRow = { createdAt: Date };

function bucketize<K extends keyof DailyBucket>(
  buckets: Map<string, DailyBucket>,
  rows: DateRow[],
  field: K
): void {
  for (const row of rows) {
    const key = toIsoDay(new Date(row.createdAt));
    const bucket = buckets.get(key);
    if (bucket) {
      // numeric counters only — TS knows from `field`
      (bucket as unknown as Record<K, number>)[field] =
        (bucket as unknown as Record<K, number>)[field] + 1;
    }
  }
}

export const STATS_RANGE_DAYS = [7, 30, 90] as const;
export type StatsRangeDays = (typeof STATS_RANGE_DAYS)[number];

export interface LoadStatsInput {
  /** Length of the daily series. KPIs and Top lists stay full-history. */
  days: StatsRangeDays;
}

export class AdminStatsService {
  static async load(input: LoadStatsInput = { days: 30 }): Promise<AdminStats> {
    const DAYS = input.days;
    const since = new Date(Date.now() - (DAYS - 1) * DAY_MS);
    since.setHours(0, 0, 0, 0);
    const since7d = new Date(Date.now() - 7 * DAY_MS);

    const [
      users,
      questions,
      answers,
      comments,
      pendingReports,
      newUsers7d,
      newQuestions7d,
      qRows,
      aRows,
      cRows,
      uRows,
      topUserRows,
      tagRows,
    ] = await Promise.all([
      User.count(),
      Question.count(),
      Answer.count(),
      Comment.count(),
      Report.count({ where: { status: REPORT_STATUSES.PENDING } }),
      User.count({ where: { createdAt: { [Op.gte]: since7d } } }),
      Question.count({ where: { createdAt: { [Op.gte]: since7d } } }),
      Question.findAll({
        where: { createdAt: { [Op.gte]: since } },
        attributes: ['createdAt'],
        raw: true,
      }) as unknown as Promise<DateRow[]>,
      Answer.findAll({
        where: { createdAt: { [Op.gte]: since } },
        attributes: ['createdAt'],
        raw: true,
      }) as unknown as Promise<DateRow[]>,
      Comment.findAll({
        where: { createdAt: { [Op.gte]: since } },
        attributes: ['createdAt'],
        raw: true,
      }) as unknown as Promise<DateRow[]>,
      User.findAll({
        where: { createdAt: { [Op.gte]: since } },
        attributes: ['createdAt'],
        raw: true,
      }) as unknown as Promise<DateRow[]>,
      User.findAll({
        attributes: ['id', 'username', 'points'],
        order: [['points', 'DESC']],
        limit: 10,
        raw: true,
      }) as unknown as Promise<TopUser[]>,
      // Pull tags JSON for all questions and tally in JS — tag arrays are small,
      // and cross-DB JSON aggregation (SQLite vs MySQL) isn't worth the branch.
      Question.findAll({ attributes: ['tags'], raw: true }) as unknown as Promise<
        { tags: string[] | string | null }[]
      >,
    ]);

    const daily = emptyDays(DAYS);
    const map = new Map(daily.map((b) => [b.date, b]));
    bucketize(map, qRows, 'questions');
    bucketize(map, aRows, 'answers');
    bucketize(map, cRows, 'comments');
    bucketize(map, uRows, 'newUsers');

    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      // SQLite's JSON column comes back as a string when raw:true; MySQL returns array.
      const tags = Array.isArray(row.tags)
        ? row.tags
        : typeof row.tags === 'string'
        ? safeParseTags(row.tags)
        : [];
      for (const tag of tags) {
        if (typeof tag !== 'string' || !tag) continue;
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags: TopTag[] = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sum total awarded points so admin can sanity-check against user totals.
    // Not exposed yet — left as a hook for future drill-down.
    void PointRecord;

    return {
      kpis: {
        users,
        questions,
        answers,
        comments,
        pendingReports,
        newUsers7d,
        newQuestions7d,
      },
      daily,
      topUsers: topUserRows,
      topTags,
    };
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
