import { Op } from 'sequelize';
import { UserAchievement, Question, Answer, User } from '../models';
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementEventType,
  type AchievementMetric,
  EVENT_METRICS,
} from '../utils/achievements';
import { NotificationService } from './NotificationService';
import { NOTIFICATION_TYPES } from '../utils/constants';

export interface AchievementStatus {
  code: string;
  tier: Achievement['tier'];
  metric: AchievementMetric;
  threshold: number;
  icon: string;
  unlocked: boolean;
  unlockedAt: Date | null;
  /** Current metric value (null when locked-but-not-computed; filled on listFor). */
  progress: number | null;
}

async function metricValue(userId: number, metric: AchievementMetric): Promise<number> {
  switch (metric) {
    case 'questions_created':
      return Question.count({ where: { authorId: userId } });
    case 'answers_created':
      return Answer.count({ where: { authorId: userId } });
    case 'answers_accepted':
      return Answer.count({ where: { authorId: userId, isAccepted: true } });
    case 'likes_received': {
      // Sum denormalized votes counts on the user's authored content rather
      // than scanning the votes table — cheap thanks to (author_id) indexes
      // on questions + answers.
      const [qSum, aSum] = await Promise.all([
        Question.sum('votes', { where: { authorId: userId } }),
        Answer.sum('votes', { where: { authorId: userId } }),
      ]);
      return (qSum ?? 0) + (aSum ?? 0);
    }
    case 'points_total': {
      const user = await User.findByPk(userId, { attributes: ['points'] });
      return user?.points ?? 0;
    }
  }
}

export class AchievementService {
  /**
   * Evaluate all achievements that could possibly be affected by `event` and
   * grant any whose threshold has been crossed. Called fire-and-forget after
   * the main user action commits. Idempotent via unique constraint on
   * (user_id, achievement_code) — duplicate inserts swallowed silently.
   */
  static async checkAndGrant(
    userId: number,
    event: AchievementEventType
  ): Promise<string[]> {
    const relevantMetrics = new Set(EVENT_METRICS[event] ?? []);
    if (relevantMetrics.size === 0) return [];

    // Which achievements might this event affect AND the user doesn't have yet.
    const candidates = ACHIEVEMENTS.filter((a) => relevantMetrics.has(a.metric));
    if (candidates.length === 0) return [];

    const alreadyRows = await UserAchievement.findAll({
      where: {
        userId,
        achievementCode: { [Op.in]: candidates.map((a) => a.code) },
      },
      attributes: ['achievementCode'],
    });
    const already = new Set(alreadyRows.map((r) => r.achievementCode));
    const pending = candidates.filter((a) => !already.has(a.code));
    if (pending.length === 0) return [];

    // Cache metric values across achievements to avoid duplicate queries.
    const metricCache = new Map<AchievementMetric, number>();
    const valueFor = async (m: AchievementMetric): Promise<number> => {
      const cached = metricCache.get(m);
      if (cached !== undefined) return cached;
      const v = await metricValue(userId, m);
      metricCache.set(m, v);
      return v;
    };

    const unlocked: string[] = [];
    for (const ach of pending) {
      const value = await valueFor(ach.metric);
      if (value < ach.threshold) continue;
      try {
        await UserAchievement.create({ userId, achievementCode: ach.code });
        unlocked.push(ach.code);
        // Fan-out: one notification per unlock. Failing to notify shouldn't
        // roll back the unlock itself — NotificationService is fail-open.
        await NotificationService.notify({
          userId,
          type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
          payload: { code: ach.code, tier: ach.tier },
        });
      } catch (err) {
        // Unique-violation race: another concurrent check granted it first —
        // treat as "already had it" and move on.
        const name = (err as Error).name;
        if (name === 'SequelizeUniqueConstraintError') continue;
        console.warn('[achievements] grant failed:', (err as Error).message);
      }
    }
    return unlocked;
  }

  /**
   * Full list of achievements annotated with the user's unlock state + current
   * progress towards the threshold. Used by the dashboard UI.
   */
  static async listFor(userId: number): Promise<AchievementStatus[]> {
    const rows = await UserAchievement.findAll({
      where: { userId },
      attributes: ['achievementCode', 'unlockedAt'],
    });
    const unlockedMap = new Map(rows.map((r) => [r.achievementCode, r.unlockedAt]));

    // One metric lookup per distinct metric in the catalog — typically 5 calls.
    const distinctMetrics = Array.from(new Set(ACHIEVEMENTS.map((a) => a.metric)));
    const metricValues = new Map<AchievementMetric, number>();
    await Promise.all(
      distinctMetrics.map(async (m) => {
        metricValues.set(m, await metricValue(userId, m));
      })
    );

    return ACHIEVEMENTS.map((a) => ({
      code: a.code,
      tier: a.tier,
      metric: a.metric,
      threshold: a.threshold,
      icon: a.icon,
      unlocked: unlockedMap.has(a.code),
      unlockedAt: unlockedMap.get(a.code) ?? null,
      progress: metricValues.get(a.metric) ?? 0,
    }));
  }
}
