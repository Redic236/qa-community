export const POINTS_RULES = {
  ASK_QUESTION: -5,
  ANSWER_QUESTION: 10,
  ANSWER_ACCEPTED: 30,
  QUESTION_LIKED: 5,
  ANSWER_LIKED: 10,
} as const;

export const POINT_TYPES = {
  ASK: 'ask',
  ANSWER: 'answer',
  ACCEPT: 'accept',
  LIKE_QUESTION: 'like_question',
  LIKE_ANSWER: 'like_answer',
} as const;

export type PointType = (typeof POINT_TYPES)[keyof typeof POINT_TYPES];

export const POINT_TYPE_VALUES = Object.values(POINT_TYPES) as PointType[];

/**
 * Maximum positive points a single user can earn from PASSIVE sources
 * (others liking them / accepting their answer) within one UTC day.
 *
 * Active types (ask, answer) are NOT capped — they're user-initiated work.
 * Negative deltas (e.g. ask -5) are also never capped.
 *
 * Set DAILY_PASSIVE_POINTS_CAP=0 to disable the cap entirely. Override via
 * env without a redeploy. 100 is roughly "10 question likes + 5 accepted
 * answers" worth of recognition per day — enough to feel rewarded, low
 * enough that mass-vote brigades can't game leaderboards.
 */
export const PASSIVE_POINT_TYPES: PointType[] = [
  POINT_TYPES.LIKE_QUESTION,
  POINT_TYPES.LIKE_ANSWER,
  POINT_TYPES.ACCEPT,
];

export function getDailyPassiveCap(): number {
  const raw = process.env.DAILY_PASSIVE_POINTS_CAP;
  if (raw === undefined) return 100;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 100;
}

// User roles
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = Object.values(ROLES) as Role[];

// Reports
export const REPORT_REASONS = {
  SPAM: 'spam',
  OFFENSIVE: 'offensive',
  OFF_TOPIC: 'off_topic',
  DUPLICATE: 'duplicate',
  OTHER: 'other',
} as const;
export type ReportReason = (typeof REPORT_REASONS)[keyof typeof REPORT_REASONS];
export const REPORT_REASON_VALUES = Object.values(REPORT_REASONS) as ReportReason[];

export const REPORT_STATUSES = {
  PENDING: 'pending',
  REVIEWED_KEPT: 'reviewed_kept',
  REVIEWED_REMOVED: 'reviewed_removed',
} as const;
export type ReportStatus = (typeof REPORT_STATUSES)[keyof typeof REPORT_STATUSES];
export const REPORT_STATUS_VALUES = Object.values(REPORT_STATUSES) as ReportStatus[];

// Notifications
export const NOTIFICATION_TYPES = {
  QUESTION_ANSWERED: 'question_answered',
  ANSWER_ACCEPTED: 'answer_accepted',
  QUESTION_LIKED: 'question_liked',
  ANSWER_LIKED: 'answer_liked',
  CONTENT_REMOVED: 'content_removed',
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES) as NotificationType[];
