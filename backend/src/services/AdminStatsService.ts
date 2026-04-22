import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  User,
  Question,
  Answer,
  Comment,
  Report,
  PointRecord,
} from '../models';
import { REPORT_STATUSES } from '../utils/constants';
import { CacheService } from './CacheService';

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

export const STATS_RANGE_DAYS = [7, 30, 90] as const;
export type StatsRangeDays = (typeof STATS_RANGE_DAYS)[number];

export interface LoadStatsInput {
  /** Length of the daily series. KPIs and Top lists stay full-history. */
  days: StatsRangeDays;
}

/**
 * Dialect-specific DATE() expression used to bucket timestamps by day at the
 * DB layer. Dramatic win over the old "pull every row, bucket in JS" path
 * once there are more than a few thousand records in the window.
 */
function dayExpr(column: string): string {
  const dialect = sequelize.getDialect();
  if (dialect === 'mysql') return `DATE_FORMAT(${column}, '%Y-%m-%d')`;
  // sqlite, postgres (to_char), etc. — sqlite's strftime is the only one we
  // run in tests; extend here when another dialect enters the test matrix.
  return `strftime('%Y-%m-%d', ${column})`;
}

interface DayCountRow {
  day: string;
  n: string | number;
}

async function dailyCount(table: string, since: Date): Promise<Map<string, number>> {
  const rows = (await sequelize.query(
    `SELECT ${dayExpr('created_at')} AS day, COUNT(*) AS n
       FROM ${table}
      WHERE created_at >= :since
      GROUP BY day`,
    { replacements: { since }, type: QueryTypes.SELECT }
  )) as DayCountRow[];
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, Number(r.n));
  return map;
}

const TAG_CACHE_KEY = 'admin:topTags:v1';
const TAG_CACHE_TTL_SECONDS = 300;

async function computeTopTags(): Promise<TopTag[]> {
  // Cap the scan so an unexpectedly-huge questions table can't OOM the
  // process. 10k questions × ~200B of tags JSON ≈ 2MB — safe.
  const rows = (await Question.findAll({
    attributes: ['tags'],
    order: [['id', 'DESC']],
    limit: 10000,
    raw: true,
  })) as unknown as { tags: string[] | string | null }[];

  const tagCounts = new Map<string, number>();
  for (const row of rows) {
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
  return [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export class AdminStatsService {
  static async load(input: LoadStatsInput = { days: 30 }): Promise<AdminStats> {
    const DAYS = input.days;
    const since = new Date(Date.now() - (DAYS - 1) * DAY_MS);
    since.setHours(0, 0, 0, 0);
    const since7d = new Date(Date.now() - 7 * DAY_MS);

    // Tag aggregation is the single heavy query — cache it so admin dashboard
    // refreshes don't re-scan the questions table every time.
    const cachedTags = await CacheService.get<TopTag[]>(TAG_CACHE_KEY);

    const [
      users,
      questions,
      answers,
      comments,
      pendingReports,
      newUsers7d,
      newQuestions7d,
      qCounts,
      aCounts,
      cCounts,
      uCounts,
      topUserRows,
      topTags,
    ] = await Promise.all([
      User.count(),
      Question.count(),
      Answer.count(),
      Comment.count(),
      Report.count({ where: { status: REPORT_STATUSES.PENDING } }),
      User.count({ where: { createdAt: { [Op.gte]: since7d } } }),
      Question.count({ where: { createdAt: { [Op.gte]: since7d } } }),
      // DB-level GROUP BY day — returns at most `days` rows regardless of
      // how many records are in the window. Scales to millions of rows.
      dailyCount('questions', since),
      dailyCount('answers', since),
      dailyCount('comments', since),
      dailyCount('users', since),
      User.findAll({
        attributes: ['id', 'username', 'points'],
        order: [['points', 'DESC']],
        limit: 10,
        raw: true,
      }) as unknown as Promise<TopUser[]>,
      cachedTags ? Promise.resolve(cachedTags) : computeTopTags(),
    ]);

    if (!cachedTags) {
      await CacheService.set(TAG_CACHE_KEY, topTags, TAG_CACHE_TTL_SECONDS);
    }

    const daily = emptyDays(DAYS);
    for (const bucket of daily) {
      bucket.questions = qCounts.get(bucket.date) ?? 0;
      bucket.answers = aCounts.get(bucket.date) ?? 0;
      bucket.comments = cCounts.get(bucket.date) ?? 0;
      bucket.newUsers = uCounts.get(bucket.date) ?? 0;
    }

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
