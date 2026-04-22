/**
 * Declarative achievement catalog. Edit this list to ship new badges — no
 * schema change needed (codes are stored as VARCHAR).
 *
 * Rules:
 *   - `code` MUST be unique and stable; deleting one from the list does NOT
 *     remove past unlocks, but the UI will just hide it as an unknown code.
 *   - `tier` is purely visual (bronze → silver → gold).
 *   - `metric` + `threshold` is the only criterion kind right now. Extending
 *     to compound criteria would be a bigger refactor.
 */

export const ACHIEVEMENT_METRICS = [
  'questions_created',
  'answers_created',
  'answers_accepted',
  'likes_received',
  'points_total',
] as const;

export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  code: string;
  tier: AchievementTier;
  metric: AchievementMetric;
  threshold: number;
  /** AntD icon name — lets the frontend render consistent glyphs w/o extra assets. */
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ─── Authoring ───
  {
    code: 'first_question',
    tier: 'bronze',
    metric: 'questions_created',
    threshold: 1,
    icon: 'QuestionCircleOutlined',
  },
  {
    code: 'prolific_asker',
    tier: 'silver',
    metric: 'questions_created',
    threshold: 10,
    icon: 'FireOutlined',
  },

  // ─── Answering ───
  {
    code: 'first_answer',
    tier: 'bronze',
    metric: 'answers_created',
    threshold: 1,
    icon: 'MessageOutlined',
  },
  {
    code: 'prolific_answerer',
    tier: 'silver',
    metric: 'answers_created',
    threshold: 10,
    icon: 'CommentOutlined',
  },

  // ─── Quality ───
  {
    code: 'first_accepted',
    tier: 'bronze',
    metric: 'answers_accepted',
    threshold: 1,
    icon: 'CheckCircleOutlined',
  },
  {
    code: 'well_accepted',
    tier: 'silver',
    metric: 'answers_accepted',
    threshold: 5,
    icon: 'CheckCircleFilled',
  },

  // ─── Reception ───
  {
    code: 'liked_once',
    tier: 'bronze',
    metric: 'likes_received',
    threshold: 1,
    icon: 'LikeOutlined',
  },
  {
    code: 'hundred_likes',
    tier: 'gold',
    metric: 'likes_received',
    threshold: 100,
    icon: 'LikeFilled',
  },

  // ─── Points ladder ───
  {
    code: 'points_100',
    tier: 'silver',
    metric: 'points_total',
    threshold: 100,
    icon: 'StarOutlined',
  },
  {
    code: 'points_500',
    tier: 'gold',
    metric: 'points_total',
    threshold: 500,
    icon: 'TrophyOutlined',
  },
];

export const ACHIEVEMENT_CODES = ACHIEVEMENTS.map((a) => a.code);
export type AchievementCode = (typeof ACHIEVEMENTS)[number]['code'];

/**
 * Which metrics each event type can possibly change — used by the engine to
 * skip unrelated achievement checks on hot paths. Always a SUPERSET of what
 * actually changed (safe to overcheck, unsafe to undercheck).
 */
export const EVENT_METRICS: Record<string, AchievementMetric[]> = {
  'question.create': ['questions_created'],
  'answer.create': ['answers_created'],
  'answer.accept': ['answers_accepted'],
  'vote.like': ['likes_received'],
  'points.award': ['points_total'],
};

export type AchievementEventType = keyof typeof EVENT_METRICS;
